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

class AlwaysValidDictionaryRegistry extends DuelRoomRegistry {
  protected override isDictionaryWord(): Promise<boolean> {
    return Promise.resolve(true);
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

function setupWordSplitRaceRoom(registry: DuelRoomRegistry, userId: number, target = "CAPITAL") {
  const { roomCode } = registry.createRoom("word-split", userId, "race", 15, 300, target);
  const room = registry.getRoom(roomCode)!;

  registry.joinRoom(roomCode, userId, "TestPlayer", null, makeFakeWs());
  room.status = "playing";
  room.livesPerPlayer.set(userId, 3);
  room.countsPerPlayer.set(userId, 0);
  room.wordsPerPlayer.set(userId, []);
  room.racePoolPerPlayer.set(userId, target);

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

test("word-split accepts non-contiguous, reordered words and advances after a complete split", async () => {
  const registry = new AlwaysValidDictionaryRegistry();
  const userId = 30;
  const { roomCode, room } = setupWordSplitRaceRoom(registry, userId);

  // ACT is not a contiguous slice of CAPITAL, but it is a valid use of its letters.
  const first = await registry.relayMove(roomCode, userId, { type: "word", word: "ACT" });
  assert.equal(first.error, undefined);
  assert.equal((room.racePoolPerPlayer.get(userId) ?? "").split("").sort().join(""), "AILP");

  const second = await registry.relayMove(roomCode, userId, { type: "word", word: "PAIL" });
  assert.equal(second.error, undefined);
  assert.equal(second.triggered, false, "Word Split must not use the generic first-to-target winner rule");
  assert.equal(room.countsPerPlayer.get(userId), 1, "A completed target is worth one round");
  assert.equal(room.raceRoundPerPlayer.get(userId), 1);
  assert.deepEqual(room.raceRoundWordsPerPlayer.get(userId), []);
  assert.notEqual(room.racePoolPerPlayer.get(userId), "", "A completed split should load the next target");
});

test("word-split accepts the EDUCATION → ACT + DUE + ION decomposition", async () => {
  const registry = new AlwaysValidDictionaryRegistry();
  const userId = 32;
  const { roomCode, room } = setupWordSplitRaceRoom(registry, userId, "EDUCATION");

  for (const word of ["ACT", "DUE", "ION"]) {
    const result = await registry.relayMove(roomCode, userId, { type: "word", word });
    assert.equal(result.error, undefined, `${word} should be accepted`);
  }

  assert.equal(room.countsPerPlayer.get(userId), 1, "Three subwords still complete one target round");
  assert.equal(room.raceRoundPerPlayer.get(userId), 1);
  assert.notEqual(room.racePoolPerPlayer.get(userId), "");
});

test("word-split rejects a full target, duplicate words, and reused letters", async () => {
  const registry = new AlwaysValidDictionaryRegistry();
  const userId = 31;
  const { roomCode } = setupWordSplitRaceRoom(registry, userId);

  const wholeWord = await registry.relayMove(roomCode, userId, { type: "word", word: "CAPITAL" });
  assert.equal(wholeWord.error, "You need to split the word into at least two words");

  await registry.relayMove(roomCode, userId, { type: "word", word: "ACT" });
  const duplicate = await registry.relayMove(roomCode, userId, { type: "word", word: "ACT" });
  assert.equal(duplicate.error, "You already used that word");

  const reusedLetter = await registry.relayMove(roomCode, userId, { type: "word", word: "CAP" });
  assert.equal(reusedLetter.error, "Letters don't fit the remaining pool");
});

test("word-split players advance through their own independent rounds", async () => {
  const registry = new AlwaysValidDictionaryRegistry();
  const userId1 = 40;
  const userId2 = 41;
  const { roomCode, room } = setupWordSplitRaceRoom(registry, userId1);
  registry.joinRoom(roomCode, userId2, "Player2", null, makeFakeWs());
  room.livesPerPlayer.set(userId2, 3);
  room.countsPerPlayer.set(userId2, 0);
  room.wordsPerPlayer.set(userId2, []);
  room.racePoolPerPlayer.set(userId2, "CAPITAL");
  room.raceRoundPerPlayer.set(userId2, 0);
  room.raceRoundWordsPerPlayer.set(userId2, []);

  await registry.relayMove(roomCode, userId1, { type: "word", word: "ACT" });
  await registry.relayMove(roomCode, userId1, { type: "word", word: "PAIL" });

  assert.equal(room.countsPerPlayer.get(userId1), 1);
  assert.equal(room.raceRoundPerPlayer.get(userId1), 1);
  assert.equal(room.countsPerPlayer.get(userId2), 0);
  assert.equal(room.raceRoundPerPlayer.get(userId2), 0);
  assert.equal(room.racePoolPerPlayer.get(userId2), "CAPITAL");
});

test("word-split allows a word to be reused after advancing to a new target", async () => {
  const registry = new AlwaysValidDictionaryRegistry();
  const userId = 42;
  const { roomCode, room } = setupWordSplitRaceRoom(registry, userId, "STARLIGHT");

  await registry.relayMove(roomCode, userId, { type: "word", word: "AIR" });
  await registry.relayMove(roomCode, userId, { type: "word", word: "STLGHT" });

  assert.equal(room.raceRoundPerPlayer.get(userId), 1);
  assert.equal(room.racePoolPerPlayer.get(userId), "BLACKBIRD");

  const repeatedInNextRound = await registry.relayMove(roomCode, userId, { type: "word", word: "AIR" });
  assert.equal(repeatedInNextRound.error, undefined);
  assert.equal(room.raceRoundWordsPerPlayer.get(userId)?.[0], "AIR");
});

// Force the process to exit after the test runner finishes.
// The module import chain starts a server (background timers/WebSocket) that
// would otherwise keep Node.js alive indefinitely after tests complete.
setTimeout(() => process.exit(process.exitCode ?? 0), 3000).unref();
