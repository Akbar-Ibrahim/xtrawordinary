import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCustomFreshAnswerSnapshot,
  clearCustomFreshAnswerSnapshot,
  CUSTOM_FRESH_ANSWER_GAMES,
  isFreshAnswerRunEligible,
  readCustomFreshAnswerSnapshot,
  saveCustomFreshAnswerSnapshot,
} from "./custom-fresh-answers";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

test("Custom Fresh Answers normalizes and deduplicates the saved snapshot", () => {
  const storage = new MemoryStorage();

  const saved = saveCustomFreshAnswerSnapshot(
    17,
    "letter-hunt",
    [" rate ", "RATE", "late"],
    storage,
  );

  assert.deepEqual(saved, { words: ["RATE", "LATE"], enabled: true });
  assert.deepEqual(readCustomFreshAnswerSnapshot(17, "letter-hunt", storage), saved);
});

test("Fresh Answers is available in standard play and Custom Play, not seeded or hosted modes", () => {
  assert.equal(isFreshAnswerRunEligible({ customPlay: false }), true);
  assert.equal(isFreshAnswerRunEligible({ customPlay: false, isUntimed: true }), false);
  assert.equal(isFreshAnswerRunEligible({ customPlay: false, locked: true }), false);
  assert.equal(isFreshAnswerRunEligible({ customPlay: false, groupSeed: 42 }), false);
  assert.equal(isFreshAnswerRunEligible({ customPlay: false, quizMode: true }), false);
  assert.equal(isFreshAnswerRunEligible({
    customPlay: true,
    locked: true,
    groupSeed: 42,
    quizMode: true,
  }), true);
});

test("Custom Fresh Answers keeps users and games isolated", () => {
  const storage = new MemoryStorage();
  const sampleWords = ["RATE", "WORD", "VOWEL", "LENGTH", "POSITION", "REPEATS", "FREQUENCY"];
  for (const [index, game] of CUSTOM_FRESH_ANSWER_GAMES.entries()) {
    saveCustomFreshAnswerSnapshot(17, game, [sampleWords[index]], storage);
  }
  saveCustomFreshAnswerSnapshot(18, "letter-hunt", ["LATE"], storage);

  for (const [index, game] of CUSTOM_FRESH_ANSWER_GAMES.entries()) {
    assert.deepEqual(
      readCustomFreshAnswerSnapshot(17, game, storage)?.words,
      [sampleWords[index]],
    );
  }
  assert.deepEqual(readCustomFreshAnswerSnapshot(18, "letter-hunt", storage)?.words, ["LATE"]);
});

test("answers from later runs append without duplicates", () => {
  const storage = new MemoryStorage();
  saveCustomFreshAnswerSnapshot(17, "letter-dodge", ["WORD", "TEST"], storage);

  assert.deepEqual(
    appendCustomFreshAnswerSnapshot(17, "letter-dodge", ["test", "GAME"], storage),
    { words: ["WORD", "TEST", "GAME"], enabled: true },
  );
});

test("opting in again appends to the existing saved list", () => {
  const storage = new MemoryStorage();
  saveCustomFreshAnswerSnapshot(17, "letter-hunt", ["RATE"], storage);

  assert.deepEqual(
    saveCustomFreshAnswerSnapshot(17, "letter-hunt", ["LATE", "RATE"], storage),
    { words: ["RATE", "LATE"], enabled: true },
  );
});

test("an empty answer set is not saved, and clearing is game-specific", () => {
  const storage = new MemoryStorage();
  assert.equal(saveCustomFreshAnswerSnapshot(17, "letter-hunt", [], storage), null);

  saveCustomFreshAnswerSnapshot(17, "letter-hunt", ["RATE"], storage);
  saveCustomFreshAnswerSnapshot(17, "letter-dodge", ["WORD"], storage);
  assert.equal(clearCustomFreshAnswerSnapshot(17, "letter-hunt", storage), true);

  assert.equal(readCustomFreshAnswerSnapshot(17, "letter-hunt", storage), null);
  assert.deepEqual(readCustomFreshAnswerSnapshot(17, "letter-dodge", storage)?.words, ["WORD"]);
});
