import assert from "node:assert/strict";
import test from "node:test";
import {
  getWordStackLeaderboardSlug,
  WORD_STACK_GAME_MODES,
  WORD_STACK_VARIANTS,
} from "./word-stack";

test("Word Stack challenges have distinct mode and leaderboard slugs", () => {
  assert.equal(WORD_STACK_VARIANTS.length, 2);
  assert.deepEqual(
    WORD_STACK_GAME_MODES.map(({ label, slug }) => ({ label, slug })),
    [
      { label: "Build Up", slug: "word-stack-build-up" },
      { label: "Break Down", slug: "word-stack-break-down" },
    ],
  );
  assert.equal(
    getWordStackLeaderboardSlug("build-up"),
    "word-stack-build-up",
  );
  assert.equal(
    getWordStackLeaderboardSlug("break-down"),
    "word-stack-break-down",
  );
});
