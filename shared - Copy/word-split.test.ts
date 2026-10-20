import assert from "node:assert/strict";
import test from "node:test";
import {
  getWordSplitLeaderboardSlug,
  WORD_SPLIT_DIFFICULTIES,
  WORD_SPLIT_GAME_MODES,
} from "./word-split";

test("Word Split has one leaderboard mode for each word-length difficulty", () => {
  assert.deepEqual(WORD_SPLIT_GAME_MODES, [
    { label: "Short (5–6 letters)", slug: "word-split-short" },
    { label: "Medium (7–8 letters)", slug: "word-split-medium" },
    { label: "Long (9+ letters)", slug: "word-split-long" },
  ]);
  assert.equal(
    new Set(WORD_SPLIT_GAME_MODES.map(({ slug }) => slug)).size,
    3,
  );
});

test("Word Split maps each difficulty to its own leaderboard slug", () => {
  assert.equal(getWordSplitLeaderboardSlug("short"), "word-split-short");
  assert.equal(getWordSplitLeaderboardSlug("medium"), "word-split-medium");
  assert.equal(getWordSplitLeaderboardSlug("long"), "word-split-long");
  assert.equal(WORD_SPLIT_DIFFICULTIES.short.minLength, 5);
  assert.equal(WORD_SPLIT_DIFFICULTIES.medium.maxLength, 8);
  assert.equal(WORD_SPLIT_DIFFICULTIES.long.minLength, 9);
  assert.throws(
    () => getWordSplitLeaderboardSlug("expert" as "short"),
    RangeError,
  );
});
