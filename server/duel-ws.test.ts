/**
 * Unit tests for the per-player in-flight move lock in DuelRoomRegistry.
 *
 * The lock (racePendingMoves) is meaningful because relayRaceMove is async and
 * yields to the event loop during the dictionary check (isDictionaryWord).
 * Two WebSocket messages arriving before the first await resolves would both
 * enter relayRaceMove concurrently without the lock.
 *
 * Run with: tsx server/duel-ws.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { DuelRoomRegistry } from "./duel-ws.js";
import type { WebSocket } from "ws";

// ── Test subclass with a deliberately delayed dictionary check ─────────────
// Overrides isDictionaryWord to defer resolution until after a setImmediate tick
// (a macrotask boundary), so a second submission can arrive and hit the lock
// while the first is awaiting the dictionary check.
class SlowDictRegistry extends DuelRoomRegistry {
  protected override isDictionaryWord(word: string): Promise<boolean> {
    // Call super's implementation then delay by one macrotask.
    const result = super.isDictionaryWord(word);
    return new Promise(resolve => setImmediate(() => void result.then(resolve)));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFakeWs(): WebSocket {
  return {
    readyState: 1,       // OPEN
    send: (_data: unknown) => {},
  } as unknown as WebSocket;
}

function setupRaceRoom(registry: DuelRoomRegistry, userId: number) {
  const { roomCode } = registry.createRoom("letter-hunt", userId, "race", 15, 300);
  const room = registry.getRoom(roomCode)!;

  registry.joinRoom(roomCode, userId, "TestPlayer", null, makeFakeWs());

  // Manually transition to "playing" state — joinRoom leaves us in "waiting"
  room.status = "playing";
  // letter-hunt: word must contain "R" — use startWord = "R"
  room.startWord = "R";
  room.livesPerPlayer.set(userId, 3);
  room.countsPerPlayer.set(userId, 0);
  room.wordsPerPlayer.set(userId, []);

  return { roomCode, room };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// "ARK" is in the wordDictSet (uppercase) and satisfies the "R" letter-hunt constraint.
const VALID_WORD = "ARK";
// A word containing "R" that is NOT in the dictionary.
const INVALID_WORD_WITH_R = "RRRRX";

test("lock is set during async validation and blocks a concurrent submission", async () => {
  const registry = new SlowDictRegistry();
  const userId = 10;
  const { roomCode, room } = setupRaceRoom(registry, userId);

  // Launch both submissions without awaiting the first.
  // Because isDictionaryWord yields to a macrotask, the second call executes
  // synchronously after the lock is set but before the first resolves.
  const p1 = registry.relayMove(roomCode, userId, { type: "word", word: VALID_WORD });
  const p2 = registry.relayMove(roomCode, userId, { type: "word", word: VALID_WORD });

  const [r1, r2] = await Promise.all([p1, p2]);

  const errors = [r1.error, r2.error];
  assert.ok(
    errors.includes("Move already in progress, please wait"),
    `Expected one result to carry the lock error. Got: ${JSON.stringify(errors)}`,
  );

  // Core anti-inflation assertion: score must be exactly 1, not 2.
  const finalCount = room.countsPerPlayer.get(userId) ?? 0;
  assert.equal(finalCount, 1, "Score must increment by 1 even when the same word is submitted twice");
});

test("lock is cleared after the validation resolves (non-winning move)", async () => {
  const registry = new SlowDictRegistry();
  const userId = 11;
  const { roomCode, room } = setupRaceRoom(registry, userId);

  await registry.relayMove(roomCode, userId, { type: "word", word: VALID_WORD });

  assert.equal(
    room.racePendingMoves.has(userId),
    false,
    "Lock must be released after the move is recorded",
  );
});

test("lock is cleared after a duplicate-word rejection", async () => {
  const registry = new SlowDictRegistry();
  const userId = 12;
  const { roomCode, room } = setupRaceRoom(registry, userId);

  room.wordsPerPlayer.set(userId, [VALID_WORD]);

  const result = await registry.relayMove(roomCode, userId, { type: "word", word: VALID_WORD });

  assert.equal(result.triggered, false);
  assert.equal(result.error, "You already used that word");
  assert.equal(room.racePendingMoves.has(userId), false, "Lock released after duplicate rejection");
});

test("lock is cleared after a dictionary rejection", async () => {
  const registry = new DuelRoomRegistry();
  const userId = 13;
  const { roomCode, room } = setupRaceRoom(registry, userId);

  const result = await registry.relayMove(roomCode, userId, { type: "word", word: INVALID_WORD_WITH_R });

  assert.equal(result.triggered, false);
  assert.match(result.error ?? "", /not a valid word/);
  assert.equal(room.racePendingMoves.has(userId), false, "Lock released after dict rejection");
});

test("lock on one player does not block a different player", async () => {
  const registry = new SlowDictRegistry();
  const userId1 = 20;
  const userId2 = 21;
  const { roomCode, room } = setupRaceRoom(registry, userId1);

  // Register a second player
  registry.joinRoom(roomCode, userId2, "Player2", null, makeFakeWs());
  room.livesPerPlayer.set(userId2, 3);
  room.countsPerPlayer.set(userId2, 0);
  room.wordsPerPlayer.set(userId2, []);

  // Player 1 starts a slow move; Player 2 submits at the same time
  const p1 = registry.relayMove(roomCode, userId1, { type: "word", word: VALID_WORD });
  const p2 = registry.relayMove(roomCode, userId2, { type: "word", word: VALID_WORD });

  const [r1, r2] = await Promise.all([p1, p2]);

  assert.notEqual(
    r2.error,
    "Move already in progress, please wait",
    "Player 2 must not be blocked by Player 1's in-flight lock",
  );
  assert.equal(r1.error, undefined, "Player 1's first move should succeed");
  assert.equal(r2.error, undefined, "Player 2's first move should succeed");
});

// Force the process to exit after the test runner finishes.
// The module import chain starts a server (background timers/WebSocket) that
// would otherwise keep Node.js alive indefinitely after tests complete.
setTimeout(() => process.exit(process.exitCode ?? 0), 3000).unref();
