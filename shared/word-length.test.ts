import assert from "node:assert/strict";
import {
  getWordLengthLeaderboardSlug,
  WORD_LENGTH_GAME_MODES,
  WORD_LENGTH_VARIANTS,
} from "./word-length";

assert.deepEqual(
  WORD_LENGTH_VARIANTS.map(({ variation, label }) => [variation, label]),
  [
    [1, "Length Only"],
    [2, "Starts With"],
    [3, "Ends With"],
    [4, "Starts & Contains"],
    [5, "Ends & Contains"],
  ],
);
assert.deepEqual(
  WORD_LENGTH_GAME_MODES.map(({ label, slug }) => [label, slug]),
  WORD_LENGTH_VARIANTS.map(({ label, slug }) => [label, slug]),
);

for (const mode of WORD_LENGTH_VARIANTS) {
  assert.equal(getWordLengthLeaderboardSlug(mode.variation), mode.slug);
  assert.equal(
    getWordLengthLeaderboardSlug(mode.variation, true),
    `${mode.slug}-survival`,
  );
}

assert.throws(() => getWordLengthLeaderboardSlug(0), RangeError);
assert.throws(() => getWordLengthLeaderboardSlug(6), RangeError);
