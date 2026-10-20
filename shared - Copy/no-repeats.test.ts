import assert from "node:assert/strict";
import test from "node:test";
import {
  getNoRepeatsLeaderboardSlug,
  NO_REPEATS_GAME_MODES,
  NO_REPEATS_VARIANTS,
} from "./no-repeats";

test("No Repeats has separate leaderboards for every challenge length and play mode", () => {
  assert.equal(NO_REPEATS_VARIANTS.length, 14);
  assert.equal(NO_REPEATS_GAME_MODES.length, 14);
  assert.equal(
    new Set(NO_REPEATS_GAME_MODES.map(({ slug }) => slug)).size,
    14,
  );
  assert.deepEqual(NO_REPEATS_GAME_MODES.slice(0, 2), [
    { label: "Challenge 3 - Free Form", slug: "no-repeats-3-free" },
    { label: "Challenge 3 - Required Letters", slug: "no-repeats-3-required" },
  ]);
  assert.deepEqual(NO_REPEATS_GAME_MODES.slice(-2), [
    { label: "Challenge 9 - Free Form", slug: "no-repeats-9-free" },
    { label: "Challenge 9 - Required Letters", slug: "no-repeats-9-required" },
  ]);
});

test("No Repeats uses a Survival suffix for the existing competitive timer mode", () => {
  assert.equal(
    getNoRepeatsLeaderboardSlug(3, "restricted"),
    "no-repeats-3-required",
  );
  assert.equal(
    getNoRepeatsLeaderboardSlug(3, "restricted", true),
    "no-repeats-3-required-survival",
  );
  assert.equal(
    getNoRepeatsLeaderboardSlug(9, "free", true),
    "no-repeats-9-free-survival",
  );
});
