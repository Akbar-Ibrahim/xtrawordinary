import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUsername, suggestUsername, validateUsername } from "./usernames";

test("normalizes usernames case-insensitively", () => {
  assert.equal(normalizeUsername("  Word_Player  "), "word_player");
});

test("accepts valid username handles", () => {
  assert.equal(validateUsername("word_player7"), null);
});

test("rejects invalid and reserved username handles", () => {
  assert.match(validateUsername("ab") ?? "", /3–20/);
  assert.match(validateUsername("word-player") ?? "", /lowercase letters/);
  assert.match(validateUsername("_player") ?? "", /cannot start/);
  assert.match(validateUsername("admin") ?? "", /reserved/);
});

test("creates a valid suggestion from a display name", () => {
  assert.equal(suggestUsername("Ada Lovelace!"), "ada_lovelace");
  assert.equal(suggestUsername("A"), "player");
});