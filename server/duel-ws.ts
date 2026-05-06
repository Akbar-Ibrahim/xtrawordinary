import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import type { Request, Response } from "express";
import { getSessionMiddleware } from "./auth";
import { log } from "./index";
import { storage } from "./storage";
import { wordDictSet, ladderRushStartWords } from "./game-data";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";
import { resolveWordWarsGame } from "./word-wars-engine";

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

/** Target letters used for Letter Hunt, Letter Frequency, and Letter Position duels. */
const DUEL_HUNT_LETTERS = ["R", "T", "L", "S", "N", "M", "B", "D", "F", "G", "P", "C"];
/** Word-length targets (as strings) used for Word Length duels. */
const DUEL_WORD_LENGTHS = ["4", "5", "6", "7"];
/** Letter Balance constraints: N vowels ("NV") or N consonants ("NC"). Counts 2-4. */
const DUEL_BALANCE_CONSTRAINTS = ["2V", "3V", "4V", "2C", "3C", "4C"];
/** Positions used for Letter Position duels (2–5). */
const DUEL_POSITIONS = [2, 3, 4, 5];

/** Deterministic Fisher-Yates shuffle driven by an integer seed. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = (seed ^ 0xdeadbeef) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0);
    s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0);
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── Race-format game constants ─────────────────────────────────────────────

/** 6-letter pools for word-scramble race mode. */
const RACE_SCRAMBLE_POOLS = [
  "PLANET", "GARDEN", "CASTLE", "BRIDGE",
  "MARKET", "FINGER", "BUCKET", "CANDLE",
  "CARPET", "GRAVEL", "BRANCH", "CINDER",
];
const RACE_ANAGRAM_WORDS = [
  "STONE", "TRACE", "PARTS", "SNARE", "TEARS",
  "REINS", "NOTES", "STEAM", "STARE", "PEARS",
  "CRATE", "RATES", "TALES", "LEAST", "EARNS",
];
/** 12-letter pools for letter-pool race mode. */
const RACE_LETTER_POOLS = [
  "RSTLNEAIOUMB", "GRIMSTONAEDP", "BLAKETROUNDA", "FLOWERSCAPEI",
  "AEIOUPLMNSTR", "PRINTEDCARSH", "SHAKEGROUNDL", "CLOUDSTREAMN",
  "TRAILSPONDEK", "BRAVECOASTNI", "FLOCKSTANDRE", "WINDYPLASOME",
];
/** Starting words for word-maker race mode (players submit ordered subsequences). */
const RACE_MAKER_WORDS = [
  "PLANETS", "HISTORY", "CABINET", "TRADING",
  "BLANKET", "CHAPTER", "MYSTERY", "DRAGONS",
  "PARKING", "COUNTRY", "GARDENS", "WINTERS",
];
/** Compound words for word-split race mode (players submit substrings). */
const RACE_SPLIT_WORDS = [
  "SUNFLOWER", "STARLIGHT", "BLACKBIRD", "FIREWORKS",
  "AFTERNOON", "BUTTERFLY", "MOONLIGHT", "SNOWFLAKE",
  "CLASSROOM", "FOOTPRINT", "HANDCRAFT", "DAYDREAMS",
];
/** Starting words for word-stack race mode (each word must differ by ±1 letter in length). */
const RACE_STACK_WORDS = [
  "APPLE", "FLAME", "CHESS", "STONE", "CRISP",
  "FABLE", "GRADE", "PLANT", "SPINE", "TROVE",
  "DRIVE", "CABLE",
];

/** Category word sets for definition-match race mode. */
const DEFINITION_CATEGORIES: Record<string, Set<string>> = {
  ANIMALS:  new Set(["DOG","CAT","BEAR","LION","WOLF","BIRD","FISH","FROG","DEER","GOAT","HAWK","MOLE","PONY","SWAN","CRAB","EEL","EMU","YAK","COD","RAM","EWE","APE","OX","BAT","ANT","BEE","COW","HEN","OWL","FOX","ELK","ASS","GNU","PIG","RAT"]),
  COLORS:   new Set(["RED","BLUE","PINK","GOLD","GREY","TEAL","LIME","ROSE","PLUM","CYAN","JADE","RUBY","AMBER","CORAL","CREAM","OLIVE","ONYX","SAGE","TAN","NAVY","AQUA","PUCE","ECRU","FAWN","RUST"]),
  FOODS:    new Set(["RICE","BEAN","CORN","SOUP","CAKE","MILK","BEEF","PORK","LAMB","TOFU","SALT","LIME","PLUM","PEAR","KALE","BEET","YAM","FIG","RYE","OAT","HAM","COD","NUT","PEA","EGG","JAM","TEA","RUM"]),
  SPORTS:   new Set(["GOLF","POLO","RACE","BIKE","SKI","SURF","DIVE","BOWL","JUDO","YOGA","SAIL","HUNT","FISH","HIKE","LUGE","CURL","SWIM","SPAR","RIDE","TROT","JUMP","LEAP","FENC","SLED"]),
  SCIENCE:  new Set(["ATOM","BOND","CELL","GENE","MASS","WAVE","HEAT","ACID","BASE","SALT","IRON","ZINC","GOLD","LEAD","NEON","LENS","VOLT","WATT","OHMS","FLUX","BEAM","CORE","MOLE","NODE","ROCK","SOIL","COAL"]),
};

/**
 * Returns the game-specific constraint string stored in `startWord` for a room.
 * - word-chain       → a seed word (e.g. "APPLE")
 * - letter-hunt      → a target letter (e.g. "R")
 * - letter-frequency → a target letter (e.g. "T")
 * - word-length      → a target length string (e.g. "5")
 * - letter-position  → "LETTER:POSITION" (e.g. "R:3")
 * - letter-balance   → "NV" or "NC" (e.g. "3V" = exactly 3 vowels)
 * Race-only games:
 * - word-scramble    → 7-letter pool string (e.g. "PLANETS")
 * - no-repeats       → min-length string (e.g. "5")
 * - anagram-solver   → seed word (e.g. "STONE")
 * - word-stack       → starting word length string (e.g. "4")
 * - letter-pool      → 11-letter pool string (e.g. "RSTLNEAIOUM")
 * - word-maker       → base word (e.g. "PLANETS")
 * - word-split       → compound word pool (e.g. "SUNFLOWER")
 * - definition-match → category tag (e.g. "ANIMALS")
 */
function getDuelGameInit(gameSlug: string, seed: number): string {
  switch (gameSlug) {
    case "letter-hunt":
    case "letter-frequency":
      return DUEL_HUNT_LETTERS[seed % DUEL_HUNT_LETTERS.length];
    case "word-length":
      return DUEL_WORD_LENGTHS[seed % DUEL_WORD_LENGTHS.length];
    case "letter-position": {
      const letter = DUEL_HUNT_LETTERS[seed % DUEL_HUNT_LETTERS.length];
      const position = DUEL_POSITIONS[(seed >> 4) % DUEL_POSITIONS.length];
      return `${letter}:${position}`;
    }
    case "letter-balance":
      return DUEL_BALANCE_CONSTRAINTS[seed % DUEL_BALANCE_CONSTRAINTS.length];
    // ── Ladder Rush duel games (turn-based) ──
    case "ladder-rush-4":
    case "ladder-rush-double-4":
      return ladderRushStartWords[4][seed % ladderRushStartWords[4].length];
    case "ladder-rush-5":
    case "ladder-rush-double-5":
      return ladderRushStartWords[5][seed % ladderRushStartWords[5].length];
    case "ladder-rush-6":
    case "ladder-rush-double-6":
      return ladderRushStartWords[6][seed % ladderRushStartWords[6].length];
    // ── Race-only games ──
    case "word-scramble": {
      const scrambleWord = RACE_SCRAMBLE_POOLS[seed % RACE_SCRAMBLE_POOLS.length];
      return seededShuffle(scrambleWord.toUpperCase().split(""), seed).join("");
    }
    case "no-repeats":
      // min length 4–7 driven by seed
      return String(4 + (seed % 4));
    case "anagram-solver":
      return RACE_ANAGRAM_WORDS[seed % RACE_ANAGRAM_WORDS.length].toUpperCase();
    case "word-stack":
      // starting word for word-stack (subsequent words must differ by ±1 letter)
      return RACE_STACK_WORDS[seed % RACE_STACK_WORDS.length].toUpperCase();
    case "letter-pool":
      return RACE_LETTER_POOLS[seed % RACE_LETTER_POOLS.length].toUpperCase();
    case "word-maker":
      return RACE_MAKER_WORDS[seed % RACE_MAKER_WORDS.length].toUpperCase();
    case "word-split":
      return RACE_SPLIT_WORDS[seed % RACE_SPLIT_WORDS.length].toUpperCase();
    case "definition-match": {
      const cats = ["ANIMALS", "COLORS", "FOODS", "SPORTS", "SCIENCE"];
      return cats[seed % cats.length];
    }
    default:
      return DUEL_START_WORDS[seed % DUEL_START_WORDS.length];
  }
}

/** Check whether two same-length words differ by exactly n letter positions (by frequency). */
function isNLetterDiff(a: string, b: string, n: number): boolean {
  if (a.length !== b.length) return false;
  const freqA: Record<string, number> = {};
  const freqB: Record<string, number> = {};
  for (const c of a) freqA[c] = (freqA[c] ?? 0) + 1;
  for (const c of b) freqB[c] = (freqB[c] ?? 0) + 1;
  let added = 0, removed = 0;
  for (const c of Object.keys(freqA)) {
    const diff = (freqB[c] ?? 0) - freqA[c];
    if (diff < 0) removed -= diff;
  }
  for (const c of Object.keys(freqB)) {
    const diff = freqB[c] - (freqA[c] ?? 0);
    if (diff > 0) added += diff;
  }
  return added === n && removed === n;
}

/** Check whether a word can be formed from a multiset of letters (pool). */
function canFormFromPool(word: string, pool: string): boolean {
  const counts: Record<string, number> = {};
  for (const c of pool.toUpperCase()) counts[c] = (counts[c] ?? 0) + 1;
  for (const c of word.toUpperCase()) {
    if (!counts[c] || counts[c] <= 0) return false;
    counts[c]--;
  }
  return true;
}

/** Deduct word letters from pool string. Returns the remaining pool. */
function deductFromPool(word: string, pool: string): string {
  const counts: Record<string, number> = {};
  for (const c of pool.toUpperCase()) counts[c] = (counts[c] ?? 0) + 1;
  for (const c of word.toUpperCase()) {
    if (counts[c]) counts[c]--;
  }
  let remaining = "";
  for (const [c, n] of Object.entries(counts)) remaining += c.repeat(n);
  return remaining;
}

/** Check whether word is an ordered subsequence of base (letters appear in order). */
function isSubsequenceOf(word: string, base: string): boolean {
  let bi = 0;
  for (let wi = 0; wi < word.length; wi++) {
    while (bi < base.length && base[bi] !== word[wi]) bi++;
    if (bi >= base.length) return false;
    bi++;
  }
  return true;
}

/**
 * True if b can be obtained from a by inserting or deleting exactly one letter at any position.
 * (edit distance = 1 using only insertions/deletions, no substitutions)
 */
function differsByOneLetter(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let si = 0;
  for (let li = 0; li < longer.length; li++) {
    if (si < shorter.length && longer[li] === shorter[si]) si++;
  }
  return si === shorter.length;
}

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

function sendToSpectators(room: DuelRoom, msg: DuelServerMessage): void {
  for (const ws of Array.from(room.spectators.values())) {
    send(ws, msg);
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
  /** Authenticated users watching this room in read-only mode (userId → ws). */
  spectators: Map<number, WebSocket>;
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
  /** All words used so far (uppercased). Turn-based only. */
  usedWords: string[];
  /** Whose turn it currently is. null until game starts; null for race format. */
  currentTurnUserId: number | null;
  /** Ensures ELO/session is written exactly once. */
  finalized: boolean;
  /** Epoch ms when the 3-second countdown began; null outside countdown phase. */
  countdownStartAt: number | null;
  /** Server-side authoritative turn expiry timer; cleared on each valid move. */
  turnTimeoutTimer: ReturnType<typeof setTimeout> | null;
  // ── Race format fields ──────────────────────────────────────────────────
  /** "turn" (default alternating turns) or "race" (simultaneous, first to target wins). */
  format: "turn" | "race";
  /** Race: first player to reach this word count wins. Default 15. */
  raceTarget: number;
  /** Race: time limit in ms; winner by count when time expires. */
  raceTimeLimitMs: number;
  /** Race: per-player valid word counts (userId → count). */
  countsPerPlayer: Map<number, number>;
  /** Race: per-player remaining letter pool (userId → pool string). Used by letter-pool. */
  racePoolPerPlayer: Map<number, string>;
  /** Race: server-side timer handle for the time-limit fallback. */
  raceTimerHandle: ReturnType<typeof setTimeout> | null;
  /** Timestamp (ms) when race started; used to broadcast remaining time. */
  raceStartedAt: number | null;
  /** Race: set of userIds with a move validation currently in progress (prevents double-submit). */
  racePendingMoves: Set<number>;
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
  // Mark any associated huddle challenge as completed
  void storage.getHuddleChallengeByRoom(room.roomCode).then(hc => {
    if (hc && hc.status === "accepted") {
      return storage.updateHuddleChallenge(hc.id, { status: "completed" });
    }
  }).catch(() => {});
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
      format: room.format,
      raceTarget: room.format === "race" ? room.raceTarget : null,
      raceTimeLimit: room.format === "race" ? Math.round(room.raceTimeLimitMs / 1000) : null,
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
  // Notify spectators which player won
  const winnerPlayer = isDraw ? null : (p1wins ? p1 : p2);
  sendToSpectators(room, { type: "spectator:game_over", winnerName: winnerPlayer?.name ?? null });

  // Word Wars integration — fire-and-forget; errors are logged inside
  void resolveWordWarsGame(room.roomCode, winnerId);
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

    // Expire open challenges whose expiresAt has passed (runs every 30 min).
    const expireChallenges = () => {
      storage.expireOpenChallenges().then((n) => {
        if (n > 0) log(`[Duel] Expired ${n} open challenge(s)`, "duel-ws");
      }).catch(() => {});
    };
    setInterval(expireChallenges, SWEEP_INTERVAL_MS).unref?.();
  }

  createRoom(
    gameSlug: string,
    challengerId: number,
    format: "turn" | "race" = "turn",
    raceTarget = 15,
    raceTimeLimitSecs = 300,
  ): { roomCode: string; seed: number; startWord: string } {
    let roomCode: string;
    do {
      roomCode = generateRoomCode();
    } while (this.rooms.has(roomCode));

    const seed = Math.floor(Math.random() * 1_000_000);
    const startWord = getDuelGameInit(gameSlug, seed);

    const room: DuelRoom = {
      roomCode,
      players: new Map(),
      spectators: new Map(),
      gameSlug,
      seed,
      startWord,
      status: "waiting",
      createdAt: Date.now(),
      challengerId,
      livesPerPlayer: new Map(),
      wordsPerPlayer: new Map(),
      currentWord: startWord,
      usedWords: (gameSlug === "word-chain" || gameSlug.startsWith("ladder-rush")) ? [startWord.toUpperCase()] : [],
      currentTurnUserId: null,
      finalized: false,
      countdownStartAt: null,
      turnTimeoutTimer: null,
      format,
      raceTarget,
      raceTimeLimitMs: raceTimeLimitSecs * 1000,
      countsPerPlayer: new Map(),
      racePoolPerPlayer: new Map(),
      raceTimerHandle: null,
      raceStartedAt: null,
      racePendingMoves: new Set(),
    };
    this.rooms.set(roomCode, room);
    log(`[Duel] Room ${roomCode} created for game ${gameSlug} (format: ${format})`, "duel-ws");
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
    format: "turn" | "race" = "turn",
    raceTarget = 15,
    raceTimeLimitSecs = 300,
  ): DuelRoom {
    const existing = this.rooms.get(roomCode);
    if (existing) return existing;

    const seed = persistedSeed ?? Math.floor(Math.random() * 1_000_000);
    const startWord = persistedStartWord ?? getDuelGameInit(gameSlug, seed);
    const room: DuelRoom = {
      roomCode,
      players: new Map(),
      spectators: new Map(),
      gameSlug,
      seed,
      startWord,
      status: "waiting",
      createdAt: Date.now(),
      challengerId,
      livesPerPlayer: new Map(),
      wordsPerPlayer: new Map(),
      currentWord: startWord,
      usedWords: (gameSlug === "word-chain" || gameSlug.startsWith("ladder-rush")) ? [startWord.toUpperCase()] : [],
      currentTurnUserId: null,
      finalized: false,
      countdownStartAt: null,
      turnTimeoutTimer: null,
      format,
      raceTarget,
      raceTimeLimitMs: raceTimeLimitSecs * 1000,
      countsPerPlayer: new Map(),
      racePoolPerPlayer: new Map(),
      raceTimerHandle: null,
      raceStartedAt: null,
      racePendingMoves: new Set(),
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
          format: room.format,
          raceTarget: room.raceTarget,
          raceTimeLimitMs: room.raceTimeLimitMs,
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
          send(ws, { type: "room:ready", startAt, format: room.format, raceTarget: room.raceTarget, raceTimeLimitMs: room.raceTimeLimitMs });
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
          const myCount = room.countsPerPlayer.get(userId) ?? 0;
          const opponentCount = room.countsPerPlayer.get(opponent.userId) ?? 0;
          send(ws, {
            type: "room:state",
            phase: "playing",
            opponentId: opponent.userId,
            opponentName: opponent.name,
            opponentAvatarUrl: opponent.avatarUrl,
            format: room.format,
            raceTarget: room.raceTarget,
            raceTimeLimitMs: room.raceStartedAt
              ? Math.max(0, room.raceTimeLimitMs - (Date.now() - room.raceStartedAt))
              : room.raceTimeLimitMs,
            myCount,
            opponentCount,
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
        format: room.format,
        raceTarget: room.raceTarget,
        raceTimeLimitMs: room.raceTimeLimitMs,
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
        format: room.format,
        raceTarget: room.raceTarget,
        raceTimeLimitMs: room.raceTimeLimitMs,
      });
      send(p2.ws, {
        type: "room:joined",
        roomCode,
        opponentId: p1.userId,
        opponentName: p1.name,
        opponentAvatarUrl: p1.avatarUrl,
        format: room.format,
        raceTarget: room.raceTarget,
        raceTimeLimitMs: room.raceTimeLimitMs,
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
        room.countsPerPlayer.set(pid, 0);
        // Initialize per-player letter pool for letter-pool game
        if (room.gameSlug === "letter-pool") {
          room.racePoolPerPlayer.set(pid, room.startWord);
        }
      }
      // Initialize authoritative game state
      room.currentWord = room.startWord;
      room.usedWords = [room.startWord.toUpperCase()];
      // Turn-based: challenger goes first. Race: no turn ownership.
      room.currentTurnUserId = room.format === "turn" ? room.challengerId : null;

      const startAt = Date.now() + 3000;
      room.countdownStartAt = Date.now();
      for (const p of Array.from(room.players.values())) {
        send(p.ws, { type: "room:ready", startAt, format: room.format, raceTarget: room.raceTarget, raceTimeLimitMs: room.raceTimeLimitMs });
      }
      let seconds = 3;
      const tick = (): void => {
        if (room.status !== "countdown") return;
        if (seconds <= 0) {
          room.status = "playing";
          if (room.format === "turn") {
            this.armTurnTimer(room);
          } else {
            // Race: arm the time-limit fallback timer
            room.raceStartedAt = Date.now();
            this.armRaceTimer(room);
          }
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

  /**
   * Perform the dictionary check for race moves.
   * Declared as a protected method so tests can override it with a delayed
   * implementation to exercise the async in-flight lock.
   */
  protected isDictionaryWord(word: string): Promise<boolean> {
    return Promise.resolve(wordDictSet.has(word.toUpperCase()));
  }

  /** Relay a game move with full server-side validation. Returns an error string when
   *  the move is illegal, or triggered=true when it causes the game to end. */
  async relayMove(
    roomCode: string,
    fromUserId: number,
    payload: unknown,
  ): Promise<{ triggered: boolean; winnerId?: number; error?: string }> {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== "playing") return { triggered: false };

    // ── Race format handling ──────────────────────────────────────────────────
    if (room.format === "race") {
      return this.relayRaceMove(room, fromUserId, payload);
    }

    // ── Turn-based handling ───────────────────────────────────────────────────

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

        // --- Game-specific constraint check ---
        const constraintError = this.checkTurnConstraint(room, submittedWord);
        if (constraintError) return { triggered: false, error: constraintError };

        // --- Duplicate constraint ---
        if (room.usedWords.includes(submittedWord)) {
          return { triggered: false, error: "That word was already used" };
        }

        // --- Dictionary check ---
        if (!wordDictSet.has(submittedWord.toUpperCase())) {
          return { triggered: false, error: `"${submittedWord}" is not a valid word` };
        }

        // Move is valid — update authoritative state and relay to opponent
        const slug = room.gameSlug;
        if (slug === "word-chain" || slug.startsWith("ladder-rush")) room.currentWord = submittedWord;
        room.usedWords = [...room.usedWords, submittedWord];
        const senderWords = room.wordsPerPlayer.get(fromUserId) ?? [];
        room.wordsPerPlayer.set(fromUserId, [...senderWords, submittedWord]);
        room.currentTurnUserId = opponent?.userId ?? room.currentTurnUserId;

        if (opponent) send(opponent.ws, { type: "opponent:move", payload });
        sendToSpectators(room, { type: "opponent:move", payload });

        this.armTurnTimer(room);

      } else if (p.type === "timeout") {
        const currentLives = room.livesPerPlayer.get(fromUserId) ?? INITIAL_LIVES;
        const newLives = Math.max(0, currentLives - 1);
        room.livesPerPlayer.set(fromUserId, newLives);
        room.currentTurnUserId = opponent?.userId ?? room.currentTurnUserId;

        const authoritativeTimeout = { type: "timeout", lives: newLives };
        if (opponent) send(opponent.ws, { type: "opponent:move", payload: authoritativeTimeout });
        sendToSpectators(room, { type: "opponent:move", payload: authoritativeTimeout });

        this.armTurnTimer(room);

        if (newLives <= 0 && !room.finalized) {
          return { triggered: true, winnerId: opponent?.userId ?? -1 };
        }
        return { triggered: false };
      } else {
        if (opponent) send(opponent.ws, { type: "opponent:move", payload });
        sendToSpectators(room, { type: "opponent:move", payload });
      }

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

  /** Server-side constraint check for turn-based games. Returns an error string or null. */
  private checkTurnConstraint(room: DuelRoom, submittedWord: string): string | null {
    const slug = room.gameSlug;
    if (slug === "letter-hunt" || slug === "letter-frequency") {
      const targetLetter = room.startWord.toUpperCase();
      if (!submittedWord.includes(targetLetter)) {
        return `Word must contain the letter "${targetLetter}"`;
      }
    } else if (slug === "word-length") {
      const targetLen = parseInt(room.startWord, 10);
      if (submittedWord.length !== targetLen) {
        return `Word must be exactly ${targetLen} letters long`;
      }
    } else if (slug === "letter-position") {
      const [targetLetter, posStr] = room.startWord.split(":");
      const pos = parseInt(posStr, 10);
      if (submittedWord.length < pos) {
        return `Word must have at least ${pos} letters`;
      }
      if (submittedWord[pos - 1] !== targetLetter.toUpperCase()) {
        return `Letter at position ${pos} must be "${targetLetter}"`;
      }
    } else if (slug === "letter-balance") {
      const constraint = room.startWord;
      const count = parseInt(constraint.slice(0, -1), 10);
      const type = constraint.slice(-1);
      const VOWELS = "AEIOU";
      const actual = type === "V"
        ? submittedWord.split("").filter(c => VOWELS.includes(c)).length
        : submittedWord.split("").filter(c => !VOWELS.includes(c) && /[A-Z]/.test(c)).length;
      if (actual !== count) {
        const typeName = type === "V" ? "vowel" : "consonant";
        return `Word must have exactly ${count} ${typeName}${count !== 1 ? "s" : ""}`;
      }
    } else if (slug.startsWith("ladder-rush")) {
      const isDouble = slug.includes("double");
      const swapCount = isDouble ? 2 : 1;
      const expectedLen = parseInt(slug[slug.length - 1], 10);
      if (submittedWord.length !== expectedLen) {
        return `Word must be exactly ${expectedLen} letters long`;
      }
      if (!isNLetterDiff(room.currentWord, submittedWord, swapCount)) {
        return swapCount === 1
          ? "Word must differ from the previous word by exactly 1 letter"
          : "Word must differ from the previous word by exactly 2 letters";
      }
    } else {
      // word-chain
      const requiredLetter = room.currentWord[room.currentWord.length - 1];
      if (!submittedWord.startsWith(requiredLetter)) {
        return `Word must start with "${requiredLetter}"`;
      }
    }
    return null;
  }

  /** Handle a move in race format: per-player duplicate check, constraint check, count update. */
  private async relayRaceMove(
    room: DuelRoom,
    fromUserId: number,
    payload: unknown,
  ): Promise<{ triggered: boolean; winnerId?: number; error?: string }> {
    if (payload === null || typeof payload !== "object") return { triggered: false };
    const p = payload as { type?: string; word?: string };
    if (p.type !== "word" || typeof p.word !== "string") return { triggered: false };

    const submittedWord = p.word.toUpperCase().trim();
    if (!submittedWord) return { triggered: false };

    // --- In-flight lock: reject if this player already has a move being validated ---
    if (room.racePendingMoves.has(fromUserId)) {
      return { triggered: false, error: "Move already in progress, please wait" };
    }
    room.racePendingMoves.add(fromUserId);

    try {
    const slug = room.gameSlug;

    // --- Per-player duplicate check (each player has own word pool) ---
    // word-split allows repeating the same word across compound cycles
    const myWords = room.wordsPerPlayer.get(fromUserId) ?? [];
    if (slug !== "word-split" && myWords.includes(submittedWord)) {
      return { triggered: false, error: "You already used that word" };
    }

    // --- Game-specific constraint check ---
    const constraintError = this.checkRaceConstraint(room, submittedWord, myWords, fromUserId);
    if (constraintError) return { triggered: false, error: constraintError };

    // --- Dictionary check (async so the in-flight lock genuinely spans this boundary) ---
    if (slug !== "definition-match") {
      const valid = await this.isDictionaryWord(submittedWord);
      if (!valid) {
        return { triggered: false, error: `"${submittedWord}" is not a valid word` };
      }
    }

    // Move is valid — update per-player state
    room.wordsPerPlayer.set(fromUserId, [...myWords, submittedWord]);

    // word-split: score only when a full compound cycle is completed (no partial cycles)
    let scoreIncrement = 1;
    if (slug === "word-split") {
      const totalCoveredBefore = myWords.reduce((sum, w) => sum + w.length, 0);
      const splitPos = totalCoveredBefore % room.startWord.length;
      scoreIncrement = (splitPos + submittedWord.length === room.startWord.length) ? 1 : 0;
    }
    const newCount = (room.countsPerPlayer.get(fromUserId) ?? 0) + scoreIncrement;
    room.countsPerPlayer.set(fromUserId, newCount);

    // letter-pool: deduct used letters from player's remaining pool
    if (slug === "letter-pool") {
      const remaining = deductFromPool(submittedWord, room.racePoolPerPlayer.get(fromUserId) ?? room.startWord);
      room.racePoolPerPlayer.set(fromUserId, remaining);
    }

    // Broadcast progress to both players and spectators
    for (const p2 of Array.from(room.players.values())) {
      send(p2.ws, { type: "race:progress", userId: fromUserId, count: newCount });
    }
    sendToSpectators(room, { type: "race:progress", userId: fromUserId, count: newCount });

    log(`[Duel] Race move: user ${fromUserId} in room ${room.roomCode} → count ${newCount}/${room.raceTarget}`, "duel-ws");

    // Check win condition
    if (newCount >= room.raceTarget) {
      return { triggered: true, winnerId: fromUserId };
    }

    return { triggered: false };
    } finally {
      room.racePendingMoves.delete(fromUserId);
    }
  }

  /** Game-specific constraint check for race format. Returns error string or null. */
  private checkRaceConstraint(room: DuelRoom, word: string, myWords: string[], userId: number): string | null {
    const slug = room.gameSlug;
    // Existing 5 games in race mode use their same constraint
    if (slug === "letter-hunt" || slug === "letter-frequency") {
      const targetLetter = room.startWord.toUpperCase();
      if (!word.includes(targetLetter)) {
        return `Word must contain the letter "${targetLetter}"`;
      }
    } else if (slug === "word-length") {
      const targetLen = parseInt(room.startWord, 10);
      if (word.length !== targetLen) {
        return `Word must be exactly ${targetLen} letters long`;
      }
    } else if (slug === "letter-position") {
      const [targetLetter, posStr] = room.startWord.split(":");
      const pos = parseInt(posStr, 10);
      if (word.length < pos) return `Word must have at least ${pos} letters`;
      if (word[pos - 1] !== targetLetter.toUpperCase()) {
        return `Letter at position ${pos} must be "${targetLetter}"`;
      }
    } else if (slug === "letter-balance") {
      const constraint = room.startWord;
      const count = parseInt(constraint.slice(0, -1), 10);
      const type = constraint.slice(-1);
      const VOWELS = "AEIOU";
      const actual = type === "V"
        ? word.split("").filter(c => VOWELS.includes(c)).length
        : word.split("").filter(c => !VOWELS.includes(c) && /[A-Z]/.test(c)).length;
      if (actual !== count) {
        const typeName = type === "V" ? "vowel" : "consonant";
        return `Word must have exactly ${count} ${typeName}${count !== 1 ? "s" : ""}`;
      }
    } else if (slug === "word-scramble") {
      // Pool-based: word must be formable from the static letter pool
      if (!canFormFromPool(word, room.startWord)) {
        return "Word must only use letters from the pool";
      }
    } else if (slug === "letter-pool") {
      // Player-specific: word must be formable from this player's REMAINING pool
      const remainingPool = room.racePoolPerPlayer.get(userId) ?? room.startWord;
      if (!remainingPool) return "Your letter pool is exhausted";
      if (!canFormFromPool(word, remainingPool)) {
        return "Word must only use your remaining letters";
      }
    } else if (slug === "word-maker") {
      // Ordered subsequence: letters must appear in the same order as in the base word
      if (!isSubsequenceOf(word, room.startWord)) {
        return `Word letters must appear in order within "${room.startWord}"`;
      }
    } else if (slug === "word-split") {
      // Sequential cursor: word must exactly match the compound from the player's current position
      const totalCovered = myWords.reduce((sum, w) => sum + w.length, 0);
      const splitPos = totalCovered % room.startWord.length;
      const remaining = room.startWord.slice(splitPos);
      if (!remaining.startsWith(word)) {
        return `Word must match the next letters of "${room.startWord}" (position ${splitPos + 1}: "${remaining.slice(0, 6)}...")`;
      }
    } else if (slug === "no-repeats") {
      const minLen = parseInt(room.startWord, 10);
      if (word.length < minLen) return `Word must be at least ${minLen} letters long`;
      const letterSet = new Set(word.split(""));
      if (letterSet.size !== word.length) return "Word must have no repeated letters";
    } else if (slug === "anagram-solver") {
      const seedSorted = room.startWord.split("").sort().join("");
      const wordSorted = word.split("").sort().join("");
      if (wordSorted !== seedSorted) {
        return `Word must be an anagram of "${room.startWord}"`;
      }
    } else if (slug === "word-stack") {
      // Each word must be obtainable from the previous by adding or removing exactly one letter
      // at any position (not just a length change — a letter must align as a subsequence).
      const prevWord = myWords.length > 0 ? myWords[myWords.length - 1] : room.startWord;
      if (!differsByOneLetter(word, prevWord)) {
        const prevLen = prevWord.length;
        return `Word must differ from "${prevWord}" by adding or removing exactly one letter (±1 at any position)`;
      }
    } else if (slug === "definition-match") {
      const categoryWords = DEFINITION_CATEGORIES[room.startWord] ?? new Set<string>();
      if (!categoryWords.has(word)) {
        const catName = room.startWord.charAt(0) + room.startWord.slice(1).toLowerCase();
        return `"${word}" is not in the ${catName} category`;
      }
    }
    return null;
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
        if (room.turnTimeoutTimer !== null) {
          clearTimeout(room.turnTimeoutTimer);
          room.turnTimeoutTimer = null;
        }
        if (room.raceTimerHandle !== null) {
          clearTimeout(room.raceTimerHandle);
          room.raceTimerHandle = null;
        }
        room.status = "waiting";
        room.livesPerPlayer.clear();
        room.countsPerPlayer.clear();
        room.currentTurnUserId = null;
        room.countdownStartAt = null;
        room.raceStartedAt = null;
      }

      // Reset ready flags for ALL remaining players so that when the
      // disconnecting player (or a new opponent) rejoins, both sides must
      // explicitly click Ready again before countdown can begin.
      // Without this, a remaining player whose ready=true would auto-satisfy
      // allReady() as soon as the rejoining player clicks Ready once, causing
      // an unintended auto-start that violates the "both confirm ready" rule.
      for (const p of Array.from(room.players.values())) {
        p.ready = false;
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

  /** Notify all connected players in a room that the challenge was externally
   *  cancelled/declined/expired, then close the room. Called from REST routes
   *  so the challenger in the waiting room gets an immediate terminal event
   *  rather than waiting until disconnect/error. */
  notifyChallengeCancelled(
    roomCode: string,
    reason: "declined" | "cancelled" | "expired",
  ): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    for (const p of Array.from(room.players.values())) {
      send(p.ws, { type: "challenge:cancelled", reason });
    }
    this.endRoom(roomCode);
  }

  // ── Spectator helpers ──────────────────────────────────────────────────────

  private broadcastSpectatorCount(room: DuelRoom): void {
    const count = room.spectators.size;
    for (const p of Array.from(room.players.values())) {
      send(p.ws, { type: "spectator:count", count });
    }
  }

  joinSpectator(
    roomCode: string,
    userId: number,
    ws: WebSocket,
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: "Room not found" };
    if (room.status !== "playing") return { success: false, error: "Duel is not in progress" };
    if (room.players.has(userId)) return { success: false, error: "You are a participant, not a spectator" };

    room.spectators.set(userId, ws);
    this.broadcastSpectatorCount(room);

    const players = Array.from(room.players.values());
    if (players.length < 2) return { success: false, error: "Room not ready" };
    const [p1, p2] = players;

    send(ws, {
      type: "spectator:joined",
      player1Id: p1.userId,
      player1Name: p1.name,
      player1AvatarUrl: p1.avatarUrl,
      player2Id: p2.userId,
      player2Name: p2.name,
      player2AvatarUrl: p2.avatarUrl,
      gameSlug: room.gameSlug,
      format: room.format,
      raceTarget: room.raceTarget,
      raceTimeLimitMs: room.raceStartedAt
        ? Math.max(0, room.raceTimeLimitMs - (Date.now() - room.raceStartedAt))
        : room.raceTimeLimitMs,
      count1: room.countsPerPlayer.get(p1.userId) ?? 0,
      count2: room.countsPerPlayer.get(p2.userId) ?? 0,
      lives1: room.livesPerPlayer.get(p1.userId) ?? INITIAL_LIVES,
      lives2: room.livesPerPlayer.get(p2.userId) ?? INITIAL_LIVES,
      spectatorCount: room.spectators.size,
    });

    log(`[Duel] Spectator ${userId} joined room ${roomCode} (${room.spectators.size} watching)`, "duel-ws");
    return { success: true };
  }

  removeSpectator(roomCode: string, userId: number): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    if (!room.spectators.has(userId)) return;
    room.spectators.delete(userId);
    this.broadcastSpectatorCount(room);
    log(`[Duel] Spectator ${userId} left room ${roomCode} (${room.spectators.size} watching)`, "duel-ws");
  }

  broadcastReaction(roomCode: string, emoji: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const msg: DuelServerMessage = { type: "spectator:reaction", emoji };
    for (const p of Array.from(room.players.values())) {
      send(p.ws, msg);
    }
    sendToSpectators(room, msg);
  }

  getActiveLiveRooms(): Array<{
    roomCode: string;
    gameSlug: string;
    format: "turn" | "race";
    player1Name: string;
    player2Name: string;
    spectatorCount: number;
  }> {
    const result = [];
    for (const room of Array.from(this.rooms.values())) {
      if (room.status !== "playing") continue;
      const players = Array.from(room.players.values());
      if (players.length < 2) continue;
      result.push({
        roomCode: room.roomCode,
        gameSlug: room.gameSlug,
        format: room.format,
        player1Name: players[0].name,
        player2Name: players[1].name,
        spectatorCount: room.spectators.size,
      });
    }
    return result;
  }

  // ── Room teardown ──────────────────────────────────────────────────────────

  endRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.status = "over";
    if (room.turnTimeoutTimer !== null) {
      clearTimeout(room.turnTimeoutTimer);
      room.turnTimeoutTimer = null;
    }
    if (room.raceTimerHandle !== null) {
      clearTimeout(room.raceTimerHandle);
      room.raceTimerHandle = null;
    }
    for (const p of Array.from(room.players.values())) {
      if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    }
    this.rooms.delete(roomCode);
    log(`[Duel] Room ${roomCode} closed`, "duel-ws");
  }

  /**
   * Arms the race time-limit fallback timer.
   * When it fires, the player with more valid words wins (or draw if tied).
   */
  private armRaceTimer(room: DuelRoom): void {
    if (room.raceTimerHandle !== null) {
      clearTimeout(room.raceTimerHandle);
      room.raceTimerHandle = null;
    }
    if (room.finalized || room.raceTimeLimitMs <= 0) return;

    room.raceTimerHandle = setTimeout(async () => {
      if (room.finalized || room.status !== "playing") return;
      const entries = Array.from(room.countsPerPlayer.entries());
      if (entries.length < 2) return;
      const [a, b] = entries;
      let winnerId: number;
      if (a[1] === b[1]) {
        winnerId = -1; // draw
      } else {
        winnerId = a[1] > b[1] ? a[0] : b[0];
      }
      log(`[Duel] Race time limit reached in room ${room.roomCode}. Counts: ${a[0]}=${a[1]}, ${b[0]}=${b[1]}. Winner: ${winnerId}`, "duel-ws");
      try {
        await finalizeGame(room, winnerId);
      } catch (err) {
        log(`[Duel] ELO finalization error in race room ${room.roomCode}: ${err}`, "duel-ws");
      }
      this.endRoom(room.roomCode);
    }, room.raceTimeLimitMs);
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

  getOpponent(room: DuelRoom, userId: number): RoomPlayer | undefined {
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
    /** Server-side throttle: track last time race:typing was relayed for this connection. */
    let lastTypingRelayedAt = 0;

    log(`[Duel] WS connection established for user ${userId}`, "duel-ws");
    let currentSpectatorRoomCode: string | undefined;

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
          const isOpenChallenge = challenge.challengeeId === null;
          // Non-open challenge: must be a named participant
          if (!isOpenChallenge && challenge.challengerId !== userId && challenge.challengeeId !== userId) {
            send(ws, { type: "error", message: "You are not a participant in this duel" });
            return;
          }
          // Open challenge: challenger is always allowed; a stranger joining becomes the challengee atomically
          if (isOpenChallenge && challenge.challengerId !== userId) {
            if (challenge.status !== "pending") {
              send(ws, { type: "error", message: "This open challenge is no longer available" });
              return;
            }
            // Atomically claim the open challenge so only one joiner wins the race
            const claimed = await storage.acceptOpenDuelChallenge(challenge.id, userId);
            if (!claimed) {
              send(ws, { type: "error", message: "This open challenge was just taken by another player" });
              return;
            }
            // Re-fetch updated challenge so downstream code sees the accepted state
            const refreshed = await storage.getDuelChallengeByRoom(roomCode);
            if (refreshed) Object.assign(challenge, refreshed);
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
          // Named challengee must have explicitly accepted before being allowed into the room
          if (!isOpenChallenge && challenge.challengeeId === userId && challenge.status === "pending") {
            send(ws, { type: "error", message: "You must accept the challenge before entering the room" });
            return;
          }

          // Restore room lazily if missing after a process restart
          const room =
            duelRegistry.getRoom(roomCode) ??
            duelRegistry.restoreRoom(
              roomCode,
              challenge.gameSlug,
              challenge.challengerId,
              challenge.seed,
              challenge.startWord,
              (challenge.format as "turn" | "race") ?? "turn",
              challenge.raceTarget ?? 15,
              challenge.raceTimeLimit ?? 300,
            );

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
          const moveResult = await duelRegistry.relayMove(currentRoomCode, userId, msg.payload);
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

        case "race:typing": {
          if (!currentRoomCode) break;
          const typingRoom = duelRegistry.getRoom(currentRoomCode);
          if (!typingRoom || typingRoom.status !== "playing" || typingRoom.format !== "race") break;
          // Server-side rate limit: relay at most once per 500 ms per connection
          const now = Date.now();
          if (now - lastTypingRelayedAt < 500) break;
          lastTypingRelayedAt = now;
          const typingOpponent = duelRegistry.getOpponent(typingRoom, userId);
          if (typingOpponent) {
            send(typingOpponent.ws, { type: "race:typing", userId });
          }
          break;
        }

        case "game:forfeit": {
          if (!currentRoomCode) break;
          const forfeitRoom = duelRegistry.getRoom(currentRoomCode);
          if (!forfeitRoom || forfeitRoom.finalized) {
            currentRoomCode = undefined;
            break;
          }
          // Manual forfeit: opponent wins
          const forfeitOpponent = duelRegistry.getOpponent(forfeitRoom, userId);
          const forfeitWinnerId = forfeitOpponent?.userId ?? -1;
          log(`[Duel] User ${userId} forfeited room ${currentRoomCode}. Winner: ${forfeitWinnerId}`, "duel-ws");
          try {
            await finalizeGame(forfeitRoom, forfeitWinnerId, true);
          } catch (err) {
            log(`[Duel] ELO finalization error on forfeit in room ${currentRoomCode}: ${err}`, "duel-ws");
          }
          duelRegistry.endRoom(currentRoomCode);
          currentRoomCode = undefined;
          break;
        }

        case "spectator:join": {
          const spectRoomCode = msg.roomCode.toUpperCase();
          const result = duelRegistry.joinSpectator(spectRoomCode, userId, ws);
          if (!result.success) {
            send(ws, { type: "error", message: result.error ?? "Cannot spectate this duel" });
            return;
          }
          currentSpectatorRoomCode = spectRoomCode;
          break;
        }

        case "spectator:react": {
          if (!currentSpectatorRoomCode) break;
          const VALID_EMOJIS = new Set(["👀", "🔥", "😬", "❤️", "👏"]);
          if (!VALID_EMOJIS.has(msg.emoji)) break;
          duelRegistry.broadcastReaction(currentSpectatorRoomCode, msg.emoji);
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
      if (currentSpectatorRoomCode) {
        duelRegistry.removeSpectator(currentSpectatorRoomCode, userId);
      }
    });

    ws.on("error", (err: Error) => {
      log(`[Duel] WS error for user ${userId}: ${err.message}`, "duel-ws");
    });
  });

  log("[Duel] WebSocket server ready at /ws/duel", "duel-ws");
  return wss;
}
