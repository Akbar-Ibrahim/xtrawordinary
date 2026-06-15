import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { getSessionMiddleware } from "./auth";
import { log } from "./index";
import { storage } from "./storage";
import { wordDictSet, makerWords } from "./game-data";
import type { TeamRaceClientMessage, TeamRaceServerMessage, TeamRacePlayerInfo, TeamRaceContribution } from "@shared/team-race-protocol";
import { DUEL_HUNT_LETTERS, DUEL_WORD_LENGTHS, DUEL_DEFINITION_CATEGORIES } from "@shared/schema";

interface TeamRaceWebSocket extends WebSocket {
  userId: number;
}

type SessionIncomingMessage = IncomingMessage & {
  session: { passport?: { user?: number } };
};

// ── Game constraint constants ────────────────────────────────────────────────

const TR_ANAGRAM_WORDS = [
  "STONE", "TRACE", "PARTS", "SNARE", "TEARS",
  "REINS", "NOTES", "STEAM", "STARE", "PEARS",
  "CRATE", "RATES", "TALES", "LEAST", "EARNS",
];

const TR_MAKER_WORDS = [
  "PLANETS", "HISTORY", "CABINET", "TRADING",
  "BLANKET", "CHAPTER", "MYSTERY", "DRAGONS",
  "PARKING", "COUNTRY", "GARDENS", "WINTERS",
  "FORESTS", "SAILING", "MARKETS", "FARMERS",
];

const TR_DODGE_SETS = [
  "E,T,A", "I,O,S", "R,N,H", "L,D,C",
  "U,M,F", "G,B,Y", "W,K,V", "P,X,J",
  "E,I,S", "A,T,R", "N,L,C", "H,D,P",
  "O,U,M", "B,F,G", "Y,W,Z", "K,Q,X",
];

const DEFINITION_CATEGORIES: Record<string, Set<string>> = {
  ANIMALS: new Set(["DOG","CAT","BEAR","LION","WOLF","BIRD","FISH","FROG","DEER","GOAT","HAWK","MOLE","PONY","SWAN","CRAB","EEL","EMU","YAK","COD","RAM","EWE","APE","OX","BAT","ANT","BEE","COW","HEN","OWL","FOX","ELK","ASS","GNU","PIG","RAT"]),
  COLORS:  new Set(["RED","BLUE","PINK","GOLD","GREY","TEAL","LIME","ROSE","PLUM","CYAN","JADE","RUBY","AMBER","CORAL","CREAM","OLIVE","ONYX","SAGE","TAN","NAVY","AQUA","PUCE","ECRU","FAWN","RUST"]),
  FOODS:   new Set(["RICE","BEAN","CORN","SOUP","CAKE","MILK","BEEF","PORK","LAMB","TOFU","SALT","LIME","PLUM","PEAR","KALE","BEET","YAM","FIG","RYE","OAT","HAM","COD","NUT","PEA","EGG","JAM","TEA","RUM"]),
  SPORTS:  new Set(["GOLF","POLO","RACE","BIKE","SKI","SURF","DIVE","BOWL","JUDO","YOGA","SAIL","HUNT","FISH","HIKE","LUGE","CURL","SWIM","SPAR","RIDE","TROT","JUMP","LEAP","SLED"]),
  SCIENCE: new Set(["ATOM","BOND","CELL","GENE","MASS","WAVE","HEAT","ACID","BASE","SALT","IRON","ZINC","GOLD","LEAD","NEON","LENS","VOLT","WATT","OHMS","FLUX","BEAM","CORE","MOLE","NODE","ROCK","SOIL","COAL"]),
};

// ── Helper functions ─────────────────────────────────────────────────────────

function isSubsequenceOf(word: string, base: string): boolean {
  let bi = 0;
  for (let wi = 0; wi < word.length; wi++) {
    while (bi < base.length && base[bi] !== word[wi]) bi++;
    if (bi >= base.length) return false;
    bi++;
  }
  return true;
}

function getTeamRaceGameInit(slug: string, seed: number): string {
  switch (slug) {
    case "letter-hunt":
    case "letter-frequency":
      return DUEL_HUNT_LETTERS[seed % DUEL_HUNT_LETTERS.length];
    case "word-length":
      return DUEL_WORD_LENGTHS[seed % DUEL_WORD_LENGTHS.length];
    case "no-repeats":
      return String(4 + (seed % 4));
    case "anagram-solver":
      return TR_ANAGRAM_WORDS[seed % TR_ANAGRAM_WORDS.length].toUpperCase();
    case "word-maker":
      return TR_MAKER_WORDS[seed % TR_MAKER_WORDS.length].toUpperCase();
    case "definition-match":
      return DUEL_DEFINITION_CATEGORIES[seed % DUEL_DEFINITION_CATEGORIES.length];
    case "letter-dodge":
      return TR_DODGE_SETS[seed % TR_DODGE_SETS.length];
    case "word-roots": {
      const puzzle = makerWords[seed % makerWords.length];
      return puzzle ? puzzle.baseWord.toUpperCase() : "PLANETS";
    }
    default:
      return String(seed);
  }
}

function send(ws: WebSocket, msg: TeamRaceServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Room types ───────────────────────────────────────────────────────────────

interface TeamRacePlayer {
  ws: TeamRaceWebSocket;
  userId: number;
  name: string;
  avatarUrl: string | null;
  groupId: number;
}

interface TeamRaceRoom {
  roomCode: string;
  challengeId: number;
  challengerGroupId: number;
  challengeeGroupId: number;
  adminUserIds: Set<number>;
  gameSlug: string;
  seed: number;
  startWord: string;
  raceTarget: number;
  raceTimeLimitMs: number;
  status: "waiting" | "countdown" | "playing" | "over";
  players: Map<number, TeamRacePlayer>;
  teamAWords: Set<string>;
  teamBWords: Set<string>;
  teamAContributions: Map<number, number>;
  teamBContributions: Map<number, number>;
  pendingMoves: Set<number>;
  raceTimerHandle: NodeJS.Timeout | null;
  startedAt: number | null;
  wordRootsDerivatives: Set<string> | null;
}

// ── Registry ─────────────────────────────────────────────────────────────────

export class TeamRaceRegistry {
  private rooms = new Map<string, TeamRaceRoom>();

  createRoom(opts: {
    challengeId: number;
    challengerGroupId: number;
    challengeeGroupId: number;
    adminUserIds: number[];
    gameSlug: string;
    seed: number;
    raceTarget: number;
    raceTimeLimitMs: number;
  }): { roomCode: string; startWord: string } {
    const roomCode = this.genCode();
    const startWord = getTeamRaceGameInit(opts.gameSlug, opts.seed);

    let wordRootsDerivatives: Set<string> | null = null;
    if (opts.gameSlug === "word-roots") {
      const puzzle = makerWords[opts.seed % makerWords.length];
      if (puzzle) {
        wordRootsDerivatives = new Set(puzzle.derivatives.map(d => d.toUpperCase()));
      }
    }

    const room: TeamRaceRoom = {
      roomCode,
      challengeId: opts.challengeId,
      challengerGroupId: opts.challengerGroupId,
      challengeeGroupId: opts.challengeeGroupId,
      adminUserIds: new Set(opts.adminUserIds),
      gameSlug: opts.gameSlug,
      seed: opts.seed,
      startWord,
      raceTarget: opts.raceTarget,
      raceTimeLimitMs: opts.raceTimeLimitMs,
      status: "waiting",
      players: new Map(),
      teamAWords: new Set(),
      teamBWords: new Set(),
      teamAContributions: new Map(),
      teamBContributions: new Map(),
      pendingMoves: new Set(),
      raceTimerHandle: null,
      startedAt: null,
      wordRootsDerivatives,
    };
    this.rooms.set(roomCode, room);
    log(`[TeamRace] Room ${roomCode} created for challenge ${opts.challengeId} (${opts.gameSlug})`, "team-race-ws");
    return { roomCode, startWord };
  }

  getRoom(roomCode: string): TeamRaceRoom | undefined {
    return this.rooms.get(roomCode);
  }

  private genCode(): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let code: string;
    do {
      code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    } while (this.rooms.has(code));
    return code;
  }

  private broadcast(room: TeamRaceRoom, msg: TeamRaceServerMessage, excludeUserId?: number): void {
    for (const [uid, player] of room.players) {
      if (excludeUserId !== undefined && uid === excludeUserId) continue;
      send(player.ws, msg);
    }
  }

  private getTeamWords(room: TeamRaceRoom, groupId: number): Set<string> {
    return groupId === room.challengerGroupId ? room.teamAWords : room.teamBWords;
  }

  private getContributions(room: TeamRaceRoom, groupId: number): Map<number, number> {
    return groupId === room.challengerGroupId ? room.teamAContributions : room.teamBContributions;
  }

  private playerInfos(room: TeamRaceRoom): TeamRacePlayerInfo[] {
    return Array.from(room.players.values()).map(p => ({
      userId: p.userId,
      name: p.name,
      avatarUrl: p.avatarUrl,
      groupId: p.groupId,
    }));
  }

  // ── Word validation ──────────────────────────────────────────────────────

  private checkConstraint(room: TeamRaceRoom, word: string): string | null {
    const slug = room.gameSlug;
    if (slug === "letter-hunt" || slug === "letter-frequency") {
      const letter = room.startWord.toUpperCase();
      if (!word.includes(letter)) return `Word must contain the letter "${letter}"`;
    } else if (slug === "word-length") {
      const len = parseInt(room.startWord, 10);
      if (word.length !== len) return `Word must be exactly ${len} letters`;
    } else if (slug === "no-repeats") {
      const min = parseInt(room.startWord, 10);
      if (word.length < min) return `Word must be at least ${min} letters`;
      if (new Set(word.split("")).size !== word.length) return "Word must have no repeated letters";
    } else if (slug === "anagram-solver") {
      const sorted1 = word.split("").sort().join("");
      const sorted2 = room.startWord.split("").sort().join("");
      if (sorted1 !== sorted2) return `Word must be an anagram of "${room.startWord}"`;
    } else if (slug === "word-maker") {
      if (!isSubsequenceOf(word, room.startWord)) return `Letters must appear in order within "${room.startWord}"`;
    } else if (slug === "definition-match") {
      const catWords = DEFINITION_CATEGORIES[room.startWord] ?? new Set<string>();
      if (!catWords.has(word)) {
        const cat = room.startWord.charAt(0) + room.startWord.slice(1).toLowerCase();
        return `"${word}" is not in the ${cat} category`;
      }
    } else if (slug === "letter-dodge") {
      const forbidden = room.startWord.split(",");
      const offenders = forbidden.filter(l => word.includes(l.trim().toUpperCase()));
      if (offenders.length > 0) return `Word must not contain: ${offenders.join(", ")}`;
    } else if (slug === "word-roots") {
      if (!room.wordRootsDerivatives?.has(word)) return `"${word}" is not a valid derivative`;
    }
    return null;
  }

  private async isDictWord(word: string): Promise<boolean> {
    return wordDictSet.has(word.toUpperCase());
  }

  // ── Game lifecycle ───────────────────────────────────────────────────────

  private startCountdown(room: TeamRaceRoom): void {
    if (room.status !== "waiting") return;
    room.status = "countdown";
    const startAt = Date.now() + 3000;
    this.broadcast(room, { type: "team:countdown", startAt });
    setTimeout(() => {
      if (room.status !== "countdown") return;
      room.status = "playing";
      room.startedAt = Date.now();
      this.broadcast(room, {
        type: "team:progress",
        challengerCount: 0,
        challengeeCount: 0,
        lastWord: "",
        lastWordGroupId: 0,
        lastWordUserId: 0,
      });
      this.armRaceTimer(room);
    }, 3000);
  }

  private armRaceTimer(room: TeamRaceRoom): void {
    if (room.raceTimerHandle) clearTimeout(room.raceTimerHandle);
    room.raceTimerHandle = setTimeout(() => {
      if (room.status === "playing") {
        this.finalizeGame(room, null);
      }
    }, room.raceTimeLimitMs);
  }

  private async finalizeGame(room: TeamRaceRoom, winnerGroupId: number | null): Promise<void> {
    if (room.status === "over") return;
    room.status = "over";
    if (room.raceTimerHandle) {
      clearTimeout(room.raceTimerHandle);
      room.raceTimerHandle = null;
    }

    const challengerCount = room.teamAWords.size;
    const challengeeCount = room.teamBWords.size;

    if (winnerGroupId === null) {
      if (challengerCount > challengeeCount) winnerGroupId = room.challengerGroupId;
      else if (challengeeCount > challengerCount) winnerGroupId = room.challengeeGroupId;
      else winnerGroupId = null;
    }

    const contributions: TeamRaceContribution[] = Array.from(room.players.values()).map(p => {
      const contribs = this.getContributions(room, p.groupId);
      return {
        userId: p.userId,
        name: p.name,
        groupId: p.groupId,
        count: contribs.get(p.userId) ?? 0,
      };
    });

    this.broadcast(room, {
      type: "team:over",
      winnerGroupId,
      challengerCount,
      challengeeCount,
      contributions,
    });

    // Persist result
    try {
      await storage.updateTeamRaceChallenge(room.challengeId, {
        status: "completed",
        winnerGroupId,
      });
    } catch (err) {
      log(`[TeamRace] Failed to persist result for room ${room.roomCode}: ${err}`, "team-race-ws");
    }

    log(`[TeamRace] Room ${room.roomCode} over — challenger ${challengerCount} vs challengee ${challengeeCount}, winner group ${winnerGroupId ?? "tie"}`, "team-race-ws");
  }

  // ── Handle player joining ────────────────────────────────────────────────

  async handleJoin(ws: TeamRaceWebSocket, roomCode: string, groupId: number): Promise<void> {
    const userId = ws.userId;
    const room = this.rooms.get(roomCode);
    if (!room) {
      send(ws, { type: "team:error", message: "Room not found" });
      return;
    }
    if (room.status === "over") {
      send(ws, { type: "team:error", message: "This race has already ended" });
      return;
    }

    // Validate group membership
    if (groupId !== room.challengerGroupId && groupId !== room.challengeeGroupId) {
      send(ws, { type: "team:error", message: "Your group is not part of this race" });
      return;
    }
    const membership = await storage.getGroupMember(groupId, userId);
    if (!membership) {
      send(ws, { type: "team:error", message: "You are not a member of that group" });
      return;
    }

    // Fetch user info
    const user = await storage.getUser(userId);
    if (!user) {
      send(ws, { type: "team:error", message: "User not found" });
      return;
    }

    // Add to room (overwrite if reconnecting)
    const player: TeamRacePlayer = {
      ws,
      userId,
      name: user.name ?? user.username ?? "Player",
      avatarUrl: user.avatarUrl ?? null,
      groupId,
    };
    room.players.set(userId, player);

    // Send full state to joiner
    send(ws, {
      type: "team:joined",
      roomCode,
      gameSlug: room.gameSlug,
      startWord: room.startWord,
      raceTarget: room.raceTarget,
      raceTimeLimitMs: room.raceTimeLimitMs,
      challengerGroupId: room.challengerGroupId,
      challengeeGroupId: room.challengeeGroupId,
      players: this.playerInfos(room),
      yourGroupId: groupId,
      status: room.status,
    });

    // Notify others
    this.broadcast(room, {
      type: "team:member_joined",
      player: { userId, name: player.name, avatarUrl: player.avatarUrl, groupId },
    }, userId);

    log(`[TeamRace] User ${userId} (group ${groupId}) joined room ${roomCode} [${room.status}]`, "team-race-ws");
  }

  // ── Handle start ─────────────────────────────────────────────────────────

  handleStart(ws: TeamRaceWebSocket, roomCode: string): void {
    const userId = ws.userId;
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (room.status !== "waiting") {
      send(ws, { type: "team:error", message: "Race has already started" });
      return;
    }
    if (!room.adminUserIds.has(userId)) {
      send(ws, { type: "team:error", message: "Only group admins can start the race" });
      return;
    }

    // Need at least 1 player from each team
    const teamA = Array.from(room.players.values()).filter(p => p.groupId === room.challengerGroupId);
    const teamB = Array.from(room.players.values()).filter(p => p.groupId === room.challengeeGroupId);
    if (teamA.length === 0 || teamB.length === 0) {
      send(ws, { type: "team:error", message: "Both teams need at least one player to start" });
      return;
    }
    this.startCountdown(room);
  }

  // ── Handle word submission ────────────────────────────────────────────────

  async handleMove(ws: TeamRaceWebSocket, roomCode: string, word: string): Promise<void> {
    const userId = ws.userId;
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (room.status !== "playing") {
      send(ws, { type: "team:word_rejected", word, error: "Race is not in progress" });
      return;
    }
    if (room.pendingMoves.has(userId)) return;
    room.pendingMoves.add(userId);

    try {
      const player = room.players.get(userId);
      if (!player) return;

      const submitted = word.toUpperCase().trim();
      if (!submitted || submitted.length < 2) {
        send(ws, { type: "team:word_rejected", word: submitted, error: "Word is too short" });
        return;
      }

      const teamWords = this.getTeamWords(room, player.groupId);

      // Team duplicate check
      if (teamWords.has(submitted)) {
        send(ws, { type: "team:word_rejected", word: submitted, error: "Your team already found that word" });
        return;
      }

      // Constraint check
      const constraintErr = this.checkConstraint(room, submitted);
      if (constraintErr) {
        send(ws, { type: "team:word_rejected", word: submitted, error: constraintErr });
        return;
      }

      // Dictionary check (skip for definition-match and word-roots — those validate against their own sets)
      if (room.gameSlug !== "definition-match" && room.gameSlug !== "word-roots") {
        const valid = await this.isDictWord(submitted);
        if (!valid) {
          send(ws, { type: "team:word_rejected", word: submitted, error: `"${submitted}" is not a valid word` });
          return;
        }
      }

      // Accept the word
      teamWords.add(submitted);
      const contribs = this.getContributions(room, player.groupId);
      contribs.set(userId, (contribs.get(userId) ?? 0) + 1);

      const challengerCount = room.teamAWords.size;
      const challengeeCount = room.teamBWords.size;

      this.broadcast(room, {
        type: "team:progress",
        challengerCount,
        challengeeCount,
        lastWord: submitted,
        lastWordGroupId: player.groupId,
        lastWordUserId: userId,
      });

      log(`[TeamRace] ${room.roomCode} — ${player.name} (group ${player.groupId}) found "${submitted}" — A:${challengerCount} B:${challengeeCount}`, "team-race-ws");

      // Check win condition
      const myTeamCount = player.groupId === room.challengerGroupId ? challengerCount : challengeeCount;
      if (myTeamCount >= room.raceTarget) {
        await this.finalizeGame(room, player.groupId);
      }
    } finally {
      room.pendingMoves.delete(userId);
    }
  }

  // ── Handle typing indicator ──────────────────────────────────────────────

  handleTyping(ws: TeamRaceWebSocket, roomCode: string): void {
    const userId = ws.userId;
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== "playing") return;
    const player = room.players.get(userId);
    if (!player) return;
    this.broadcast(room, { type: "team:typing", userId, groupId: player.groupId }, userId);
  }

  // ── Handle disconnect ────────────────────────────────────────────────────

  handleDisconnect(roomCode: string, userId: number): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(userId);
    if (!player) return;
    room.players.delete(userId);
    this.broadcast(room, { type: "team:member_left", userId, groupId: player.groupId });
    log(`[TeamRace] User ${userId} left room ${roomCode} [${room.status}]`, "team-race-ws");
  }
}

export const teamRaceRegistry = new TeamRaceRegistry();

// ── WebSocket setup ──────────────────────────────────────────────────────────

export function setupTeamRaceWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const sessionMiddleware = getSessionMiddleware();

  httpServer.on("upgrade", (request: SessionIncomingMessage, socket, head) => {
    if (!request.url?.startsWith("/ws/team-race")) return;
    sessionMiddleware(request as any, {} as any, () => {
      const userId = request.session?.passport?.user;
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as TeamRaceWebSocket).userId = userId;
        wss.emit("connection", ws, request);
      });
    });
  });

  wss.on("connection", (rawWs, _req) => {
    const ws = rawWs as TeamRaceWebSocket;
    let currentRoomCode: string | null = null;

    ws.on("message", async (data) => {
      let msg: TeamRaceClientMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === "team:join") {
        currentRoomCode = msg.roomCode;
        await teamRaceRegistry.handleJoin(ws, msg.roomCode, msg.groupId);
      } else if (msg.type === "team:start") {
        if (currentRoomCode) teamRaceRegistry.handleStart(ws, currentRoomCode);
      } else if (msg.type === "team:move") {
        if (currentRoomCode && typeof msg.word === "string") {
          await teamRaceRegistry.handleMove(ws, currentRoomCode, msg.word);
        }
      } else if (msg.type === "team:typing") {
        if (currentRoomCode) teamRaceRegistry.handleTyping(ws, currentRoomCode);
      }
    });

    ws.on("close", () => {
      if (currentRoomCode) {
        teamRaceRegistry.handleDisconnect(currentRoomCode, ws.userId);
      }
    });
  });

  log("[TeamRace] WebSocket server mounted at /ws/team-race", "team-race-ws");
}
