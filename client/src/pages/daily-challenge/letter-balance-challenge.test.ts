import assert from "node:assert/strict";
import test from "node:test";
import { getDailyLetterBalanceChallenge } from "./letter-balance-challenge";

test("daily Letter Balance challenges only select supported categories and levels", () => {
  for (let seed = 0; seed < 10_000; seed += 1) {
    const challenge = getDailyLetterBalanceChallenge(seed);

    assert.ok([
      "consonant_count",
      "vowel_count",
      "start_end_vowel",
      "start_end_consonant",
      "start_vowel_end_consonant",
      "start_consonant_end_vowel",
    ].includes(challenge.category));
    assert.ok(Number.isInteger(challenge.level));
    assert.ok(challenge.level >= 2 && challenge.level <= 12);
  }
});
