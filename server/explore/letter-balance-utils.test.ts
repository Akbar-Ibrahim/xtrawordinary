import assert from "node:assert/strict";
import test from "node:test";
import { getLetterBalanceWordStats, matchesLetterBalanceFilters } from "./letter-balance-utils";

test("Vowel and consonant counts include short words and count Y as a consonant", () => {
  assert.deepEqual(getLetterBalanceWordStats("A"), {
    length: 1,
    vowelCount: 1,
    consonantCount: 0,
  });
  assert.deepEqual(getLetterBalanceWordStats("SKY"), {
    length: 3,
    vowelCount: 0,
    consonantCount: 3,
  });
});

test("count patterns match exact totals and optional word length", () => {
  assert.equal(matchesLetterBalanceFilters("CAT", { category: "vowel_count", count: 1 }), true);
  assert.equal(matchesLetterBalanceFilters("CAT", { category: "vowel_count", count: 2 }), false);
  assert.equal(matchesLetterBalanceFilters("CAT", { category: "consonant_count", count: 2, length: 3 }), true);
  assert.equal(matchesLetterBalanceFilters("CAT", { category: "consonant_count", count: 2, length: 4 }), false);
});

test("start/end patterns work on one-letter words and mixed letter types", () => {
  assert.equal(matchesLetterBalanceFilters("A", { category: "start_end_vowel" }), true);
  assert.equal(matchesLetterBalanceFilters("Y", { category: "start_end_consonant" }), true);
  assert.equal(matchesLetterBalanceFilters("AT", { category: "start_vowel_end_consonant" }), true);
  assert.equal(matchesLetterBalanceFilters("ATE", { category: "start_vowel_end_consonant" }), false);
  assert.equal(matchesLetterBalanceFilters("BE", { category: "start_consonant_end_vowel" }), true);
});

test("locked balance uses the selected length and consonant count", () => {
  assert.equal(matchesLetterBalanceFilters("BOOK", {
    category: "locked_balance",
    length: 4,
    consonantCount: 2,
  }), true);
  assert.equal(matchesLetterBalanceFilters("BOOK", {
    category: "locked_balance",
    length: 4,
    consonantCount: 3,
  }), false);
});

test("non-alphabetic entries are never treated as dictionary words", () => {
  assert.equal(matchesLetterBalanceFilters("A1", { category: "vowel_count", count: 1 }), false);
});
