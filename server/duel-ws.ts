import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { Request, Response } from "express";
import { getSessionMiddleware } from "./auth";
import { log } from "./index";
import { storage } from "./storage";
import { wordDictSet } from "./game-data";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";

interface DuelWebSocket extends WebSocket {
  userId: number;
}

type SessionIncomingMessage = IncomingMessage & {
  session: { passport?: { user?: number } };
};

const DUEL_START_WORDS = [
  "APPLE", "BRIDGE", "CLOUD", "DREAM", "EAGLE", "FLAME", "GRAPE", "HONEY",
  "IMAGE", "JEWEL", "KNEEL", "LEMON", "MAPLE", "NIGHT", "OLIVE", "PEARL",
  "QUEEN", "RIVER", "STONE", "TIGER", "ULTRA", "VAPOR", "WHALE", "XEROX",
  "YACHT", "ZEBRA", "ANGEL", "BRAVE", "CANDY", "DANCE", "EMBER", "FROST",
  "GLOBE", "HEART", "IVORY", "JOKER", "KNIFE", "LIGHT", "MOOSE", "NOVEL",
  "ORBIT", "PIANO", "QUIET", "ROBIN", "SNAIL", "TOAST", "UNDER", "VIVID",
  "WATER", "YIELD",
];

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function send(ws: WebSocket, msg: DuelServerMessage): void {
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
  startWord: string;
  status: "waiting" | "countdown" | "playing" | "over";
  createdAt: number;
  /** The challenger (goes first). */
  challengerId: number;
  /** Server-tracked lives per player (userId → lives). Populated when playing begins. */
  livesPerPlayer: Map<number, number>;
  /** Words submitted by each player (userId → word list, excluding seed). */
  wordsPerPlayer: Map<number, string[]>;
  /** Authoritative chain head (uppercased). Set to startWord when game starts. */
  currentWord: string;
  /** All words used so far (uppercased). */
  usedWords: string[];
  /** Whose turn it currently is. null until game starts. */
  currentTurnUserId: number | null;
  /** Ensures ELO/session is written exactly once. */
  finalized: boolean;
  /** Epoch ms when the 3-second countdown began; null outside countdown phase. */
  countdownStartAt: number | null;
  /** Server-side authoritative turn expiry timer; cleared on each valid move. */
  turnTimeoutTimer: ReturnType<typeof setTimeout> | null;
};

const INITIAL_LIVES = 3;
/** Must match the client's default turnTimeSeconds (8 s). */
const TURN_DURATION_MS = 8_500; // 500 ms of grace over client's 8 s UI timer

function deriveWinnerId(room: DuelRoom): number | null {
  const entries = Array.from(room.livesPerPlayer.entries());
  if (entries.length < 2) return null;
  const [a, b] = entries;
  if (a[1] <= 0 && b[1] <= 0) return -1;
  if (a[1] <= 0) return b[0];
  if (b[1] <= 0) return a[0];
  return null;
}

async function finalizeGame(room: DuelRoom, winnerId: number, isForfeit = false): Promise<void> {
  if (room.finalized) return;
  room.finalized = true;
  room.status = "over";
  // Cancel the per-turn timer so it never fires after the game ends
  if (room.turnTimeoutTimer !== null) {
    clearTimeout(room.turnTimeoutTimer);
    room.turnTimeoutTimer = null;
  }

  const playerIds = Array.from(room.players.keys());
  if (playerIds.length < 2) return;
  const [id1, id2] = playerIds;

  const [r1, r2] = await Promise.all([
    storage.getDuelRating(id1),
    storage.getDuelRating(id2),
  ]);
  const elo1 = r1?.elo ?? 1200;
  const elo2 = r2?.elo ?? 1200;

  const isDraw = winnerId === -1;
  const p1wins = winnerId === id1;

  const K = 32;
  const expected1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
  const expected2 = 1 - expected1;
  const result1 = isDraw ? 0.5 : p1wins ? 1 : 0;
  const result2 = isDraw ? 0.5 : p1wins ? 0 : 1;
  const delta1 = Math.round(K * (result1 - expected1));
  const delta2 = Math.round(K * (result2 - expected2));

  const challenge = await storage.getDuelChallengeByRoom(room.roomCode);
  // Mark challenge terminal so restoreRoom is never called for a completed game
  if (challenge) {
    void storage.updateDuelChallengeStatus(challenge.id, "completed").catch(() => {});
  }
  const outcome = isDraw
    ? "draw"
    : isForfeit
    ? p1wins
      ? "forfeit_player2"  // p1 wins = p2 forfeited
      : "forfeit_player1"  // p2 wins = p1 forfeited
    : p1wins
    ? "player1_wins"
    : "player2_wins";

  await Promise.all([
    storage.upsertDuelRating(id1, {
      elo: elo1 + delta1,
      wins: (r1?.wins ?? 0) + (p1wins ? 1 : 0),
      losses: (r1?.losses ?? 0) + (!isDraw && !p1wins ? 1 : 0),
      draws: (r1?.draws ?? 0) + (isDraw ? 1 : 0),
    }),
    storage.upsertDuelRating(id2, {
      elo: elo2 + delta2,
      wins: (r2?.wins ?? 0) + (!isDraw && !p1wins ? 1 : 0),
      losses: (r2?.losses ?? 0) + (!isDraw && p1wins ? 1 : 0),
      draws: (r2?.draws ?? 0) + (isDraw ? 1 : 0),
    }),
    storage.createDuelSession({
      roomCode: room.roomCode,
      challengeId: challenge?.id ?? null,
      player1Id: id1,
      player2Id: id2,
      gameSlug: room.gameSlug,
      seed: room.seed,
      outcome,
      eloDeltaPlayer1: delta1,
      eloDeltaPlayer2: delta2,
      startedAt: new Date(room.createdAt).toISOString(),
      endedAt: new Date().toISOString(),
    }),
  ]);

  const p1 = room.players.get(id1);
  const p2 = room.players.get(id2);

  if (p1) {
    send(p1.ws, {
      type: "game:over",
      outcome: isDraw ? "draw" : p1wins ? (isForfeit ? "forfeit" : "you_win") : "you_lose",
      eloChange: delta1,
      newElo: elo1 + delta1,
    });
  }
  if (p2) {
    send(p2.ws, {
      type: "game:over",
      outcome: isDraw ? "draw" : !p1wins ? (isForfeit ? "forfeit" : "you_win") : "you_lose",
      eloChange: delta2,
      newElo: elo2 + delta2,
    });
  }
}

export class DuelRoomRegistry {
  private rooms: Map<string, DuelRoom> = new Map();

  constructor() {
    // Sweep stale "waiting" rooms (created >2 h ago with no active players)
    // every 30 minutes so unclaimed pre-created rooms don't accumulate.
    const SWEEP_INTERVAL_MS = 30 * 60 * 1000;
    const STALE_WAITING_MS  = 2 * 60 * 60 * 1000; // 2 hours
    const sweep = () => {
      const now = Date.now();
      for (const [code, room] of Array.from(this.rooms.entries())) {
        if (
          room.status === "waiting" &&
          room.players.size === 0 &&
          now - room.createdAt > STALE_WAITING_MS
        ) {
          this.rooms.delete(code);
          log(`[Duel] Swept stale waiting room ${code}`, "duel-ws");
        }
      }
    };
    setInterval(sweep, SWEEP_INTERVAL_MS).unref?.();
  }

  createRoom(gameSlug: string, challengerId: number): { roomCode: string; seed: number; startWord: string } {
    let roomCode: string;
    do {
      roomCode = generateRoomCode();
    } while (this.rooms.has(roomCode));

    const seed = Math.floor(Math.random() * 1_000_000);
    const startWord = DUEL_START_WORDS[seed % DUEL_START_WORDS.length];

    const room: DuelRoom = {
      roomCode,
      players: new Map(),
      gameSlug,
      seed,
      startWord,
      status: "waiting",
      createdAt: Date.now(),
      challengerId,
      livesPerPlayer: new Map(),
      wordsPerPlayer: new Map(),
      currentWord: startWord,
      usedWords: [startWord],
      currentTurnUserId: null,
      finalized: false,
      countdownStartAt: null,
      turnTimeoutTimer: null,
    };
    this.rooms.set(roomCode, room);
    log(`[Duel] Room ${roomCode} created for game ${gameSlug}`, "duel-ws");
    return { roomCode, seed, startWord };
  }

  getRoom(roomCode: string): DuelRoom | undefined {
    return this.rooms.get(roomCode);
  }

  /**
   * Recreate a waiting room from persisted challenge metadata after a process restart.
   * Accepts optional seed/startWord from the DB so the room is deterministic.
   * Only creates a new room; if one already exists it is returned as-is.
   */
  restoreRoom(
    roomCode: string,
    gameSlug: string,
    challengerId: number,
    persistedSeed?: number | null,
    persistedStartWord?: string | null,
  ): DuelRoom {
    const existing = this.rooms.get(roomCode);
    if (existing) return existing;

    const seed = persistedSeed ?? Math.floor(Math.random() * 1_000_000);
    const startWord = persistedStartWord ?? DUEL_START_WORDS[seed % DUEL_START_WORDS.length];
    const room: DuelRoom = {
      roomCode,
      players: new Map(),
      gameSlug,
      seed,
      startWord,
      status: "waiting",
      createdAt: Date.now(),
      challengerId,
      livesPerPlayer: new Map(),
      wordsPerPlayer: new Map(),
      currentWord: startWord,
      usedWords: [startWord],
      currentTurnUserId: null,
      finalized: false,
      countdownStartAt: null,
      turnTimeoutTimer: null,
    };
    this.rooms.set(roomCode, room);
    log(`[Duel] Room ${roomCode} restored from challenge metadata`, "duel-ws");
    return room;
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
      // Reconnect — update WS handle and cancel disconnect timer
      existingPlayer.ws = ws;
      if (existingPlayer.disconnectTimer) {
        clearTimeout(existingPlayer.disconnectTimer);
        existingPlayer.disconnectTimer = null;
      }

      const opponent = this.getOpponent(room, userId);
      if (opponent) {
        send(opponent.ws, { type: "player:reconnect" });
      }

      if (room.status === "waiting") {
        // Always send room:joined on reconnect — null opponent if not yet present
        send(ws, {
          type: "room:joined",
          roomCode,
          opponentId: opponent?.userId ?? null,
          opponentName: opponent?.name ?? null,
          opponentAvatarUrl: opponent?.avatarUrl ?? null,
        });
        // If opponent had already marked ready, replay that signal so UI stays in sync
        if (opponent?.ready) {
          send(ws, { type: "room:player_ready", userId: opponent.userId });
        }
      } else if (room.status === "countdown") {
        // Reconnect during 3-2-1 countdown — resend ready signal with original startAt
        // so the client rejoins the countdown at the correct point in time
        if (opponent) {
          const elapsedMs = room.countdownStartAt ? Date.now() - room.countdownStartAt : 3000;
          const startAt = (room.countdownStartAt ?? Date.now()) + 3000;
          const secondsLeft = Math.max(1, Math.ceil((3000 - elapsedMs) / 1000));
          send(ws, { type: "room:ready", startAt });
          send(ws, { type: "room:countdown", secondsLeft });
        }
      } else if (room.status === "playing") {
        // Send full authoritative game snapshot so client can restore state
        if (opponent) {
          const myLives = room.livesPerPlayer.get(userId) ?? INITIAL_LIVES;
          const opponentLives = room.livesPerPlayer.get(opponent.userId) ?? INITIAL_LIVES;
          const isMyTurn = room.currentTurnUserId === userId;
          const myWords = room.wordsPerPlayer.get(userId) ?? [];
          const opponentWords = room.wordsPerPlayer.get(opponent.userId) ?? [];
          send(ws, {
            type: "room:state",
            phase: "playing",
            opponentId: opponent.userId,
            opponentName: opponent.name,
            opponentAvatarUrl: opponent.avatarUrl,
            myLives,
            opponentLives,
            myWords: [...myWords],
            opponentWords: [...opponentWords],
            currentWord: room.currentWord,
            usedWords: [...room.usedWords],
            isMyTurn,
          });
        }
      }

      log(`[Duel] Player ${userId} reconnected to room ${roomCode}`, "duel-ws");
      return { success: true };
    }

    if (room.players.size >= 2) return { success: false, error: "Room is full" };

    room.players.set(userId, { ws, userId, name, avatarUrl, ready: false, disconnectTimer: null });
    log(`[Duel] Player ${userId} joined room ${roomCode} (${room.players.size}/2)`, "duel-ws");

    if (room.players.size === 1) {
      // First player (challenger) — send waiting confirmation with no opponent yet
      send(ws, {
        type: "room:joined",
        roomCode,
        opponentId: null,
        opponentName: null,
        opponentAvatarUrl: null,
      });
    } else if (room.players.size === 2) {
      // Second player joined — notify both with each other's info
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

    // Notify the opponent that this player is now ready
    const opponent = this.getOpponent(room, userId);
    if (opponent) {
      send(opponent.ws, { type: "room:player_ready", userId });
    }

    if (room.players.size === 2 && this.allReady(room)) {
      room.status = "countdown";
      for (const pid of Array.from(room.players.keys())) {
        room.livesPerPlayer.set(pid, INITIAL_LIVES);
      }
      // Initialize authoritative game state
      room.currentWord = room.startWord;
      room.usedWords = [room.startWord.toUpperCase()];
      room.currentTurnUserId = room.challengerId;

      const startAt = Date.now() + 3000;
      room.countdownStartAt = Date.now();
      for (const p of Array.from(room.players.values())) {
        send(p.ws, { type: "room:ready", startAt });
      }
      let seconds = 3;
      const tick = (): void => {
        // Abort if a disconnect or other transition already moved room out of countdown
        if (room.status !== "countdown") return;
        if (seconds <= 0) {
          room.status = "playing";
          // Arm server-side turn timer now that the game is live
          this.armTurnTimer(room);
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

  /** Relay a game move with full server-side validation. Returns an error string when
   *  the move is illegal, or triggered=true when it causes the game to end. */
  relayMove(
    roomCode: string,
    fromUserId: number,
    payload: unknown,
  ): { triggered: boolean; winnerId?: number; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== "playing") return { triggered: false };

    // --- Turn enforcement ---
    if (room.currentTurnUserId !== null && room.currentTurnUserId !== fromUserId) {
      log(`[Duel] Rejected out-of-turn move from user ${fromUserId} in room ${roomCode}`, "duel-ws");
      return { triggered: false, error: "It is not your turn" };
    }

    const opponent = this.getOpponent(room, fromUserId);

    if (payload !== null && typeof payload === "object") {
      const p = payload as { type?: string; word?: string; lives?: number };

      if (p.type === "word" && typeof p.word === "string") {
        const submittedWord = p.word.toUpperCase().trim();

        // --- Starting-letter constraint ---
        const requiredLetter = room.currentWord[room.currentWord.length - 1];
        if (!submittedWord.startsWith(requiredLetter)) {
          return {
            triggered: false,
            error: `Word must start with "${requiredLetter}"`,
          };
        }

        // --- Duplicate constraint ---
        if (room.usedWords.includes(submittedWord)) {
          return { triggered: false, error: "That word was already used" };
        }

        // --- Dictionary check ---
        if (!wordDictSet.has(submittedWord.toLowerCase())) {
          return { triggered: false, error: `"${submittedWord}" is not a valid word` };
        }

        // Move is valid — update authoritative state and relay to opponent
        room.currentWord = submittedWord;
        room.usedWords = [...room.usedWords, submittedWord];
        const senderWords = room.wordsPerPlayer.get(fromUserId) ?? [];
        room.wordsPerPlayer.set(fromUserId, [...senderWords, submittedWord]);
        room.currentTurnUserId = opponent?.userId ?? room.currentTurnUserId;

        if (opponent) send(opponent.ws, { type: "opponent:move", payload });

        // Re-arm server turn timer for the next player
        this.armTurnTimer(room);

      } else if (p.type === "timeout") {
        // Client-reported timeout — life deduction is fully server-authoritative.
        // The client's `lives` field is intentionally ignored to prevent
        // forged payloads from skipping the life cost.
        const currentLives = room.livesPerPlayer.get(fromUserId) ?? INITIAL_LIVES;
        const newLives = Math.max(0, currentLives - 1);
        room.livesPerPlayer.set(fromUserId, newLives);
        room.currentTurnUserId = opponent?.userId ?? room.currentTurnUserId;

        // Relay authoritative payload with server-computed lives to opponent
        const authoritativeTimeout = { type: "timeout", lives: newLives };
        if (opponent) send(opponent.ws, { type: "opponent:move", payload: authoritativeTimeout });

        this.armTurnTimer(room);

        if (newLives <= 0 && !room.finalized) {
          return { triggered: true, winnerId: opponent?.userId ?? -1 };
        }
        return { triggered: false };
      } else {
        if (opponent) send(opponent.ws, { type: "opponent:move", payload });
      }

      // --- Lives tracking for word moves: accept only non-increasing values ---
      // (Timeout path handled above and returns early, so this only runs for words/other)
      if (typeof p.lives === "number" && p.type !== "timeout") {
        const current = room.livesPerPlayer.get(fromUserId) ?? INITIAL_LIVES;
        const serverLives = Math.min(current, p.lives);
        room.livesPerPlayer.set(fromUserId, serverLives);

        if (serverLives <= 0 && !room.finalized) {
          return { triggered: true, winnerId: opponent?.userId ?? -1 };
        }
      }
    }

    return { triggered: false };
  }

  handleDisconnect(roomCode: string, userId: number): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(userId);
    if (!player) return;

    const GRACE_MS = 30_000;
    const deadline = Date.now() + GRACE_MS;

    const opponent = this.getOpponent(room, userId);

    // Only start forfeit countdown and notify opponent if the game is active.
    // Pre-game disconnects (waiting/countdown) remove the player, reset room
    // state, and notify the remaining player so they are not left in a stale
    // "opponent joined and ready" state.
    if (room.status !== "playing") {
      const priorStatus = room.status;
      room.players.delete(userId);

      if (priorStatus === "countdown") {
        // Cancel pending turn timer in case countdown already triggered it
        if (room.turnTimeoutTimer !== null) {
          clearTimeout(room.turnTimeoutTimer);
          room.turnTimeoutTimer = null;
        }
        room.status = "waiting";
        room.livesPerPlayer.clear();
        room.currentTurnUserId = null;
        room.countdownStartAt = null;
      }

      // Notify remaining player in both waiting and countdown cases so their
      // UI can reset opponent presence and ready state.
      if (opponent) {
        send(opponent.ws, { type: "player:disconnect", reconnectDeadlineMs: 0 });
      }

      log(`[Duel] Player ${userId} disconnected from room ${roomCode} (phase: ${priorStatus}) — no forfeit`, "duel-ws");
      return;
    }

    if (opponent) {
      send(opponent.ws, { type: "player:disconnect", reconnectDeadlineMs: deadline });
    }

    player.disconnectTimer = setTimeout(async () => {
      log(`[Duel] Player ${userId} forfeited room ${roomCode} (timeout)`, "duel-ws");
      const currentRoom = this.rooms.get(roomCode);
      if (!currentRoom) return;
      const currentOpponent = this.getOpponent(currentRoom, userId);
      if (currentOpponent) {
        send(currentOpponent.ws, { type: "player:forfeited", reason: "disconnect" });
        try {
          await finalizeGame(currentRoom, currentOpponent.userId, true);
        } catch (err) {
          log(`[Duel] ELO update failed for forfeit in room ${roomCode}: ${err}`, "duel-ws");
        }
      }
      this.endRoom(roomCode);
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
    void (async () => {
      try {
        await finalizeGame(room, opponent?.userId ?? -1, true);
      } catch (err) {
        log(`[Duel] ELO update failed for manual forfeit in room ${roomCode}: ${err}`, "duel-ws");
      }
      this.endRoom(roomCode);
    })();
    log(`[Duel] Player ${userId} manually forfeited room ${roomCode}`, "duel-ws");
  }

  async finalizeFromClient(roomCode: string): Promise<void> {
    const room = this.rooms.get(roomCode);
    if (!room || room.finalized) return;
    const winnerId = deriveWinnerId(room);
    // Only finalize if server state actually confirms a winner — reject premature signals
    if (winnerId === null) {
      log(`[Duel] Ignoring premature game:end in room ${roomCode} — no winner yet`, "duel-ws");
      return;
    }
    await finalizeGame(room, winnerId);
    this.endRoom(roomCode);
  }

  endRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.status = "over";
    if (room.turnTimeoutTimer !== null) {
      clearTimeout(room.turnTimeoutTimer);
      room.turnTimeoutTimer = null;
    }
    for (const p of Array.from(room.players.values())) {
      if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    }
    this.rooms.delete(roomCode);
    log(`[Duel] Room ${roomCode} closed`, "duel-ws");
  }

  /**
   * Arms (or re-arms) the server-authoritative per-turn timeout.
   * Fires TURN_DURATION_MS after the current player's turn begins.
   * On expiry: deducts a life, advances the turn, and relays a synthetic
   * timeout move to both players so both UIs stay in sync.
   */
  private armTurnTimer(room: DuelRoom): void {
    if (room.turnTimeoutTimer !== null) {
      clearTimeout(room.turnTimeoutTimer);
      room.turnTimeoutTimer = null;
    }
    if (room.finalized || room.status !== "playing" || room.currentTurnUserId === null) return;

    const timedOutUserId = room.currentTurnUserId;
    room.turnTimeoutTimer = setTimeout(() => {
      // Guard: room may have been finalized or status changed since timer was armed
      if (room.finalized || room.status !== "playing") return;
      if (room.currentTurnUserId !== timedOutUserId) return; // stale timer

      const opponent = this.getOpponent(room, timedOutUserId);
      const timedOutPlayer = room.players.get(timedOutUserId);

      // Deduct one life server-side
      const currentLives = room.livesPerPlayer.get(timedOutUserId) ?? INITIAL_LIVES;
      const newLives = Math.max(0, currentLives - 1);
      room.livesPerPlayer.set(timedOutUserId, newLives);
      room.currentTurnUserId = opponent?.userId ?? timedOutUserId;

      // Include timedOutUserId so each client can route the life deduction to
      // myLives (if they're the one who timed out) vs opponentLives correctly.
      const timeoutPayload = { type: "timeout", lives: newLives, timedOutUserId };

      // Notify timed-out player that their turn ended (so UI stays in sync)
      if (timedOutPlayer) {
        send(timedOutPlayer.ws, { type: "opponent:move", payload: timeoutPayload });
      }
      // Notify opponent that the other player timed out
      if (opponent) {
        send(opponent.ws, { type: "opponent:move", payload: timeoutPayload });
      }

      log(`[Duel] Server timeout for user ${timedOutUserId} in room ${room.roomCode}, lives now ${newLives}`, "duel-ws");

      if (newLives <= 0 && !room.finalized) {
        void finalizeGame(room, opponent?.userId ?? -1).then(() => {
          this.endRoom(room.roomCode);
        });
        return;
      }

      // Re-arm timer for the new current player
      this.armTurnTimer(room);
    }, TURN_DURATION_MS);
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
    const url = request.url ?? "";
    if (!url.startsWith("/ws/duel")) return;

    const sessionMiddleware = getSessionMiddleware();
    const noopRes = {
      getHeader: (_name: string) => undefined as string | string[] | number | undefined,
      setHeader: (_name: string, _value: string | string[]) => noopRes,
      end: () => noopRes,
      on: (_event: string, _fn: () => void) => noopRes,
    } as unknown as Response;
    sessionMiddleware(request as unknown as Request, noopRes, () => {
      const sessionReq = request as SessionIncomingMessage;
      const userId = sessionReq.session?.passport?.user;

      if (!userId) {
        log("[Duel] WS connection rejected: unauthenticated", "duel-ws");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (rawWs) => {
        const ws = rawWs as DuelWebSocket;
        ws.userId = userId;
        wss.emit("connection", ws, request);
      });
    });
  });

  wss.on("connection", (rawWs: WebSocket) => {
    const ws = rawWs as DuelWebSocket;
    const userId = ws.userId;
    let currentRoomCode: string | undefined;

    log(`[Duel] WS connection established for user ${userId}`, "duel-ws");

    ws.on("message", (raw) => {
      void handleMessage(raw.toString());
    });

    async function handleMessage(rawStr: string): Promise<void> {
      let msg: DuelClientMessage;
      try {
        msg = JSON.parse(rawStr) as DuelClientMessage;
      } catch {
        send(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      switch (msg.type) {
        case "room:join": {
          const roomCode = msg.roomCode.toUpperCase();

          const challenge = await storage.getDuelChallengeByRoom(roomCode);
          if (!challenge) {
            send(ws, { type: "error", message: "Room not found or not linked to a duel challenge" });
            return;
          }
          if (challenge.challengerId !== userId && challenge.challengeeId !== userId) {
            send(ws, { type: "error", message: "You are not a participant in this duel" });
            return;
          }
          // Reject entry for non-playable statuses (including completed — duel is over)
          if (
            challenge.status === "declined" ||
            challenge.status === "cancelled" ||
            challenge.status === "expired" ||
            challenge.status === "completed"
          ) {
            send(ws, { type: "error", message: `This challenge has been ${challenge.status}` });
            return;
          }
          // Challengee must have explicitly accepted before being allowed into the room
          if (challenge.challengeeId === userId && challenge.status === "pending") {
            send(ws, { type: "error", message: "You must accept the challenge before entering the room" });
            return;
          }

          // Restore room lazily if missing after a process restart
          const room =
            duelRegistry.getRoom(roomCode) ??
            duelRegistry.restoreRoom(roomCode, challenge.gameSlug, challenge.challengerId, challenge.seed, challenge.startWord);

          const user = await storage.getUserById(userId);
          const name = user?.name ?? "Player";
          const avatarUrl = user?.avatarUrl ?? null;

          const result = duelRegistry.joinRoom(roomCode, userId, name, avatarUrl, ws);
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
          const moveResult = duelRegistry.relayMove(currentRoomCode, userId, msg.payload);
          if (moveResult.error) {
            // Illegal move — notify sender only (opponent state unchanged)
            send(ws, { type: "error", message: moveResult.error });
            break;
          }
          if (moveResult.triggered && moveResult.winnerId !== undefined) {
            const room = duelRegistry.getRoom(currentRoomCode);
            if (room) {
              try {
                await finalizeGame(room, moveResult.winnerId);
              } catch (err) {
                log(`[Duel] ELO finalization error in room ${currentRoomCode}: ${err}`, "duel-ws");
              }
              duelRegistry.endRoom(currentRoomCode);
              currentRoomCode = undefined;
            }
          }
          break;
        }

        case "game:end": {
          if (!currentRoomCode) {
            // Room already closed (server finalised it first via game:move) — ignore silently.
            break;
          }
          const endRoom = duelRegistry.getRoom(currentRoomCode);
          if (!endRoom || endRoom.finalized) {
            // Already handled server-side; clear local ref without emitting an error.
            currentRoomCode = undefined;
            break;
          }
          try {
            await duelRegistry.finalizeFromClient(currentRoomCode);
          } catch (err) {
            log(`[Duel] ELO finalization error in room ${currentRoomCode}: ${err}`, "duel-ws");
          }
          currentRoomCode = undefined;
          break;
        }

        default:
          send(ws, { type: "error", message: "Unknown message type" });
      }
    }

    ws.on("close", () => {
      log(`[Duel] WS closed for user ${userId}`, "duel-ws");
      if (currentRoomCode) {
        duelRegistry.handleDisconnect(currentRoomCode, userId);
      }
    });

    ws.on("error", (err: Error) => {
      log(`[Duel] WS error for user ${userId}: ${err.message}`, "duel-ws");
    });
  });

  log("[Duel] WebSocket server ready at /ws/duel", "duel-ws");
  return wss;
}
