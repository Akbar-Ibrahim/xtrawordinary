import assert from "node:assert/strict";
import test from "node:test";
import {
  canFormWordFromLetters,
  chooseRandomUnfilledLetterIndex,
  createLetterPool,
  filterWordsWithoutAnagrams,
  getLetterPoolDecoyCount,
  getLetterPoolLeaderboardSlug,
  LETTER_POOL_DECOY_LEVELS,
  LETTER_POOL_GAME_MODES,
  LETTER_POOL_SESSION_VARIANTS,
} from "./letter-pool";

test("Letter Pool exposes separate leaderboards for each visible-pool decoy level", () => {
  assert.equal(LETTER_POOL_SESSION_VARIANTS.length, 2);
  assert.deepEqual(
    LETTER_POOL_DECOY_LEVELS.map(({ decoyCount, label, slug }) => ({
      decoyCount,
      label,
      slug,
    })),
    [
      { decoyCount: 1, label: "1 Decoy", slug: "letter-pool-decoys-1" },
      { decoyCount: 2, label: "2 Decoys", slug: "letter-pool-decoys-2" },
      { decoyCount: 3, label: "3 Decoys", slug: "letter-pool-decoys-3" },
    ],
  );
  assert.deepEqual(
    LETTER_POOL_GAME_MODES.map(({ label, slug }) => ({ label, slug })),
    [
      { label: "With Pool · 1 Decoy", slug: "letter-pool-decoys-1" },
      { label: "With Pool · 2 Decoys", slug: "letter-pool-decoys-2" },
      { label: "With Pool · 3 Decoys", slug: "letter-pool-decoys-3" },
    ],
  );
  assert.equal(
    getLetterPoolLeaderboardSlug("with-pool", 1),
    "letter-pool-decoys-1",
  );
  assert.equal(
    getLetterPoolLeaderboardSlug("with-pool", 2),
    "letter-pool-decoys-2",
  );
  assert.equal(
    getLetterPoolLeaderboardSlug("with-pool", 3),
    "letter-pool-decoys-3",
  );
  assert.equal(
    getLetterPoolLeaderboardSlug("without-pool"),
    "letter-pool-without-pool",
  );
});

test("Letter Pool creates a shuffled target plus exactly the requested decoys", () => {
  for (const decoyCount of [1, 2, 3]) {
    const pool = createLetterPool("APPLE", decoyCount, () => 0);
    const decoys = pool.filter((letter) => !"APPLE".includes(letter));
    assert.equal(pool.length, "APPLE".length + decoyCount);
    assert.equal(decoys.length, decoyCount);
    assert.equal(new Set(decoys).size, decoyCount);
    assert.deepEqual(
      [...pool].sort(),
      [..."APPLE".split(""), ...decoys].sort(),
    );
  }
});

test("Letter Pool removes anagram targets while preserving unrelated words", () => {
  const words = [
    { word: "CARE", hint: "A clue" },
    { word: "RACE", hint: "Another clue" },
    { word: "PLANT", hint: "A third clue" },
  ];
  assert.deepEqual(filterWordsWithoutAnagrams(words), [words[2]]);
});

test("alternate words must use the available letter counts", () => {
  assert.equal(canFormWordFromLetters("PLEASE", [..."ALEPMSE"]), true);
  assert.equal(canFormWordFromLetters("SAMPLE", [..."ALEPMSE"]), true);
  assert.equal(canFormWordFromLetters("SAMPLES", [..."ALEPMSE"]), false);
});

test("Letter Pool safely defaults unsupported decoy counts to one", () => {
  assert.equal(getLetterPoolDecoyCount(2), 2);
  assert.equal(getLetterPoolDecoyCount("3"), 1);
  assert.equal(getLetterPoolDecoyCount(4), 1);
});

test("Letter Pool hint selection only chooses unfilled positions", () => {
  assert.equal(chooseRandomUnfilledLetterIndex(["A", null, null], () => 0), 1);
  assert.equal(chooseRandomUnfilledLetterIndex(["A", null, null], () => 0.99), 2);
  assert.equal(chooseRandomUnfilledLetterIndex(["A", "B"]), null);
});
