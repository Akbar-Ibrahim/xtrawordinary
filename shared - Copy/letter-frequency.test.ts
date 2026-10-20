import assert from "node:assert/strict";
import {
  getLetterFrequencyLeaderboardSlug,
  LETTER_FREQUENCY_GAME_MODES,
  LETTER_FREQUENCY_VARIANTS,
} from "./letter-frequency";

assert.deepEqual(
  LETTER_FREQUENCY_GAME_MODES,
  [
    { label: "Challenge 1", slug: "letter-frequency-1" },
    { label: "Challenge 2", slug: "letter-frequency-2" },
    { label: "Challenge 3", slug: "letter-frequency-3" },
    { label: "Challenge 4", slug: "letter-frequency-4" },
    { label: "Challenge Random", slug: "letter-frequency-random" },
    { label: "Multi-Letter", slug: "letter-frequency-multi" },
  ],
);

for (const mode of LETTER_FREQUENCY_VARIANTS) {
  assert.equal(
    getLetterFrequencyLeaderboardSlug(mode.challenge),
    mode.slug,
  );
  assert.equal(
    getLetterFrequencyLeaderboardSlug(mode.challenge, true),
    `${mode.slug}-survival`,
  );
}
