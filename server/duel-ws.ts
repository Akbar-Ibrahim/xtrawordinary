import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { getSessionMiddleware } from "./auth";
import { log } from "./index";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function send(ws: WebSocket, msg: DuelServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

type RoomPlayer = {
  ws: WebSocket;
  userId: number;
  name: string;
  avatarUrl: string | null;
  ready: boolean;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
};

type DuelRoom = {
  roomCode: string;
  players: Map<number, RoomPlayer>;
  gameSlug: string;
  seed: number;
  status: "waiting" | "countdown" | "playing" | "over";
  createdAt: number;
};

export class DuelRoomRegistry {
  private rooms: Map<string, DuelRoom> = new Map();

  createRoom(gameSlug: string): string {
    let roomCode: string;
    do {
      roomCode = generateRoomCode();
    } while (this.rooms.has(roomCode));

    const room: DuelRoom = {
      roomCode,
      players: new Map(),
      gameSlug,
      seed: Math.floor(Math.random() * 1_000_000),
      status: "waiting",
      createdAt: Date.now(),
    };
    this.rooms.set(roomCode, room);
    log(`[Duel] Room ${roomCode} created for game ${gameSlug}`, "duel-ws");
    return roomCode;
  }

  getRoom(roomCode: string): DuelRoom | undefined {
    return this.rooms.get(roomCode);
  }

  joinRoom(
    roomCode: string,
    userId: number,
    name: string,
    avatarUrl: string | null,
    ws: WebSocket,
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: "Room not found" };
    if (room.status === "over") return { success: false, error: "Duel has already ended" };

    const existingPlayer = room.players.get(userId);
    if (existingPlayer) {
      existingPlayer.ws = ws;
      if (existingPlayer.disconnectTimer) {
        clearTimeout(existingPlayer.disconnectTimer);
        existingPlayer.disconnectTimer = null;
      }
      const opponent = this.getOpponent(room, userId);
      if (opponent) {
        send(opponent.ws, { type: "player:reconnect" });
      }
      log(`[Duel] Player ${userId} reconnected to room ${roomCode}`, "duel-ws");
      return { success: true };
    }

    if (room.players.size >= 2) return { success: false, error: "Room is full" };

    room.players.set(userId, {
      ws,
      userId,
      name,
      avatarUrl,
      ready: false,
      disconnectTimer: null,
    });
    log(`[Duel] Player ${userId} joined room ${roomCode} (${room.players.size}/2)`, "duel-ws");

    if (room.players.size === 2) {
      const [p1, p2] = Array.from(room.players.values());
      send(p1.ws, {
        type: "room:joined",
        roomCode,
        opponentId: p2.userId,
        opponentName: p2.name,
        opponentAvatarUrl: p2.avatarUrl,
      });
      send(p2.ws, {
        type: "room:joined",
        roomCode,
        opponentId: p1.userId,
        opponentName: p1.name,
        opponentAvatarUrl: p1.avatarUrl,
      });
    }

    return { success: true };
  }

  markReady(roomCode: string, userId: number): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(userId);
    if (!player) return;
    player.ready = true;
    log(`[Duel] Player ${userId} ready in room ${roomCode}`, "duel-ws");

    if (room.players.size === 2 && this.allReady(room)) {
      room.status = "countdown";
      const startAt = Date.now() + 3000;
      for (const p of Array.from(room.players.values())) {
        send(p.ws, { type: "room:ready", startAt });
      }
      let seconds = 3;
      const tick = () => {
        if (seconds <= 0) {
          room.status = "playing";
          return;
        }
        for (const p of Array.from(room.players.values())) {
          send(p.ws, { type: "room:countdown", secondsLeft: seconds });
        }
        seconds--;
        setTimeout(tick, 1000);
      };
      tick();
    }
  }

  relayMove(roomCode: string, fromUserId: number, payload: unknown): void {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== "playing") return;
    const opponent = this.getOpponent(room, fromUserId);
    if (opponent) {
      send(opponent.ws, { type: "opponent:move", payload });
    }
  }

  handleDisconnect(roomCode: string, userId: number): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(userId);
    if (!player) return;

    const GRACE_MS = 30_000;
    const deadline = Date.now() + GRACE_MS;

    const opponent = this.getOpponent(room, userId);
    if (opponent) {
      send(opponent.ws, { type: "player:disconnect", reconnectDeadlineMs: deadline });
    }

    player.disconnectTimer = setTimeout(() => {
      log(`[Duel] Player ${userId} forfeited in room ${roomCode} (timeout)`, "duel-ws");
      if (opponent) {
        send(opponent.ws, { type: "player:forfeited", reason: "disconnect" });
      }
      room.status = "over";
      room.players.delete(userId);
    }, GRACE_MS);

    log(`[Duel] Player ${userId} disconnected from room ${roomCode}, grace timer started`, "duel-ws");
  }

  forfeit(roomCode: string, userId: number): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const opponent = this.getOpponent(room, userId);
    if (opponent) {
      send(opponent.ws, { type: "player:forfeited", reason: "manual" });
    }
    room.status = "over";
    log(`[Duel] Player ${userId} manually forfeited room ${roomCode}`, "duel-ws");
  }

  endRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.status = "over";
    for (const p of Array.from(room.players.values())) {
      if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    }
    this.rooms.delete(roomCode);
    log(`[Duel] Room ${roomCode} closed`, "duel-ws");
  }

  private getOpponent(room: DuelRoom, userId: number): RoomPlayer | undefined {
    for (const [id, player] of Array.from(room.players.entries())) {
      if (id !== userId) return player;
    }
    return undefined;
  }

  private allReady(room: DuelRoom): boolean {
    for (const p of Array.from(room.players.values())) {
      if (!p.ready) return false;
    }
    return true;
  }

  getRoomCodeForUser(userId: number): string | undefined {
    for (const [code, room] of Array.from(this.rooms.entries())) {
      if (room.players.has(userId)) return code;
    }
    return undefined;
  }
}

export const duelRegistry = new DuelRoomRegistry();

export function setupDuelWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket, head) => {
    const url = request.url || "";
    if (!url.startsWith("/ws/duel")) return;

    const sessionMiddleware = getSessionMiddleware();
    sessionMiddleware(request as any, {} as any, () => {
      const session = (request as any).session;
      const userId: number | undefined = session?.passport?.user;

      if (!userId) {
        log("[Duel] WS connection rejected: unauthenticated", "duel-ws");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as any).userId = userId;
        wss.emit("connection", ws, request);
      });
    });
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const userId: number = (ws as any).userId;
    let currentRoomCode: string | undefined;

    log(`[Duel] WS connection established for user ${userId}`, "duel-ws");

    ws.on("message", (raw) => {
      let msg: DuelClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as DuelClientMessage;
      } catch {
        send(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      switch (msg.type) {
        case "room:join": {
          const roomCode = msg.roomCode.toUpperCase();
          const room = duelRegistry.getRoom(roomCode);
          if (!room) {
            send(ws, { type: "error", message: "Room not found" });
            return;
          }
          const result = duelRegistry.joinRoom(roomCode, userId, "Player", null, ws);
          if (!result.success) {
            send(ws, { type: "error", message: result.error ?? "Cannot join room" });
            return;
          }
          currentRoomCode = roomCode;
          break;
        }

        case "room:ready": {
          if (!currentRoomCode) {
            send(ws, { type: "error", message: "Not in a room" });
            return;
          }
          duelRegistry.markReady(currentRoomCode, userId);
          break;
        }

        case "game:move": {
          if (!currentRoomCode) {
            send(ws, { type: "error", message: "Not in a room" });
            return;
          }
          duelRegistry.relayMove(currentRoomCode, userId, msg.payload);
          break;
        }

        default:
          send(ws, { type: "error", message: "Unknown message type" });
      }
    });

    ws.on("close", () => {
      log(`[Duel] WS closed for user ${userId}`, "duel-ws");
      if (currentRoomCode) {
        duelRegistry.handleDisconnect(currentRoomCode, userId);
      }
    });

    ws.on("error", (err) => {
      log(`[Duel] WS error for user ${userId}: ${err.message}`, "duel-ws");
    });
  });

  log("[Duel] WebSocket server ready at /ws/duel", "duel-ws");
  return wss;
}
