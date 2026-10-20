import assert from "node:assert/strict";
import {
  getLetterHuntLeaderboardSlug,
  LETTER_HUNT_GAME_MODES,
  LETTER_HUNT_VARIANTS,
} from "./letter-hunt";

assert.equal(LETTER_HUNT_VARIANTS.length, 12);
assert.equal(LETTER_HUNT_GAME_MODES.length, 12);
assert.equal(new Set(LETTER_HUNT_GAME_MODES.map(({ slug }) => slug)).size, 12);

for (const variant of LETTER_HUNT_VARIANTS) {
  assert.equal(
    getLetterHuntLeaderboardSlug(variant.challenge, variant.ordered),
    variant.slug,
  );
  assert.equal(
    getLetterHuntLeaderboardSlug(variant.challenge, variant.ordered, true),
    `${variant.slug}-survival`,
  );
}

assert.deepEqual(LETTER_HUNT_GAME_MODES[0], {
  label: "Challenge 1 (2 letters) - Unordered",
  slug: "letter-hunt-1-unordered",
});
assert.deepEqual(LETTER_HUNT_GAME_MODES[11], {
  label: "Challenge Advanced (random 2-6 letters) - Ordered",
  slug: "letter-hunt-advanced-ordered",
});
