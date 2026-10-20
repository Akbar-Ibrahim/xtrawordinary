import assert from "node:assert/strict";
import test from "node:test";
import {
  getWordExtensionLeaderboardSlug,
  WORD_EXTENSION_GAME_MODES,
  WORD_EXTENSION_VARIANTS,
} from "./word-extension";

test("Word Extension has one leaderboard mode per added-letter difficulty", () => {
  assert.equal(WORD_EXTENSION_VARIANTS.length, 4);
  assert.deepEqual(WORD_EXTENSION_GAME_MODES, [
    { label: "Easy (+1)", slug: "word-extension-1" },
    { label: "Medium (+2)", slug: "word-extension-2" },
    { label: "Hard (+3)", slug: "word-extension-3" },
    { label: "Expert (+4)", slug: "word-extension-4" },
  ]);
  assert.equal(
    new Set(WORD_EXTENSION_GAME_MODES.map(({ slug }) => slug)).size,
    4,
  );
});

test("Word Extension resolves each extra-letter count to its leaderboard slug", () => {
  assert.equal(getWordExtensionLeaderboardSlug(1), "word-extension-1");
  assert.equal(getWordExtensionLeaderboardSlug(2), "word-extension-2");
  assert.equal(getWordExtensionLeaderboardSlug(3), "word-extension-3");
  assert.equal(getWordExtensionLeaderboardSlug(4), "word-extension-4");
});
