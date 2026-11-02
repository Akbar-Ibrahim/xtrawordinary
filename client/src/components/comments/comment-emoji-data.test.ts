import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_COMMENT_EMOJIS,
  POPULAR_COMMENT_EMOJIS,
  searchCommentEmojis,
} from "./comment-emoji-data";

test("keeps the existing popular emoji set compact and the searchable catalog broad", () => {
  assert.equal(POPULAR_COMMENT_EMOJIS.length, 24);
  assert.ok(ALL_COMMENT_EMOJIS.length >= 100);
  assert.equal(new Set(ALL_COMMENT_EMOJIS.map(({ emoji }) => emoji)).size, ALL_COMMENT_EMOJIS.length);
});

test("searches the full catalog by accessible emoji label, ignoring case and extra spaces", () => {
  assert.deepEqual(searchCommentEmojis("  ROCKET  ").map(({ emoji }) => emoji), ["🚀"]);
  assert.ok(searchCommentEmojis("heart").some(({ emoji }) => emoji === "💙"));
});

test("returns popular emoji for an empty search and no results for an unmatched search", () => {
  assert.deepEqual(searchCommentEmojis("  "), POPULAR_COMMENT_EMOJIS);
  assert.deepEqual(searchCommentEmojis("not an emoji"), []);
});
