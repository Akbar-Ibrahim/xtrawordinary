import assert from "node:assert/strict";
import test from "node:test";
import { countLetters, normalizeScrambledLetters, shuffleLetters } from "./unscramble-utils";

test("normalizes input and counts repeated letters without losing multiplicity", () => {
  assert.equal(normalizeScrambledLetters("  tAt  "), "TAT");
  assert.deepEqual([...countLetters("tAt").entries()], [["T", 2], ["A", 1]]);
});

test("scrambles database samples and avoids unchanged order when possible", () => {
  const scrambled = shuffleLetters("LISTEN", () => 0);
  assert.notEqual(scrambled, "LISTEN");
  assert.deepEqual([...scrambled].sort(), [..."LISTEN"].sort());
});

test("does not claim a shuffle for a word with one repeated letter", () => {
  assert.equal(shuffleLetters("AAA", () => 0), "AAA");
});
