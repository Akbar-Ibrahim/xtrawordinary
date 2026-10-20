import assert from "node:assert/strict";
import {
  getLetterPositionLeaderboardSlug,
  LETTER_POSITION_GAME_MODES,
  LETTER_POSITION_VARIANTS,
} from "./letter-position";

assert.deepEqual(
  LETTER_POSITION_GAME_MODES,
  [
    { label: "Challenge 1", slug: "letter-position-1" },
    { label: "Challenge 2", slug: "letter-position-2" },
  ],
);

for (const mode of LETTER_POSITION_VARIANTS) {
  assert.equal(getLetterPositionLeaderboardSlug(mode.challenge), mode.slug);
  assert.equal(
    getLetterPositionLeaderboardSlug(mode.challenge, true),
    `${mode.slug}-survival`,
  );
}

assert.throws(
  () => getLetterPositionLeaderboardSlug(3 as LetterPositionChallenge),
  RangeError,
);
