import assert from "node:assert/strict";
import {
  getSpokenWordLeaderboardSlug,
  isValidSpokenWord,
  isValidSpokenWordBank,
  SPOKEN_WORD_BANK,
  transformSpokenWord,
} from "./spoken-word";

assert.ok(SPOKEN_WORD_BANK.length >= 200, "the curated word bank should contain at least 200 words");
assert.ok(isValidSpokenWordBank(), "the curated word bank should be unique and suitable for transformations");
assert.ok(isValidSpokenWord("planet"));
assert.ok(!isValidSpokenWord("aeiou"));
assert.ok(!isValidSpokenWord("12345"));
assert.equal(transformSpokenWord("planet", "spell-it"), "planet");
assert.equal(transformSpokenWord("planet", "reverse"), "tenalp");
assert.equal(transformSpokenWord("planet", "vowels-only"), "ae");
assert.equal(transformSpokenWord("planet", "consonants-only"), "plnt");
assert.equal(transformSpokenWord("planet", "vowel-count"), "2");
assert.equal(transformSpokenWord("planet", "consonant-count"), "4");
assert.equal(transformSpokenWord("yellow", "vowel-count"), "2", "Y is counted as a consonant");
assert.equal(getSpokenWordLeaderboardSlug("reverse"), "spoken-word-transformations-reverse");
