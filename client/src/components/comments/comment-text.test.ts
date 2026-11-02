import assert from "node:assert/strict";
import test from "node:test";
import { insertTextAtSelection } from "./comment-text";

test("inserts emoji at a saved cursor while preserving the surrounding text", () => {
  assert.deepEqual(
    insertTextAtSelection("Hello world", "😊", { start: 6, end: 6 }, 500),
    { text: "Hello 😊world", cursor: 8 },
  );
});

test("replaces selected text with emoji and returns the next cursor position", () => {
  assert.deepEqual(
    insertTextAtSelection("Hello there", "👍", { start: 6, end: 11 }, 500),
    { text: "Hello 👍", cursor: 8 },
  );
});

test("rejects emoji insertion that would exceed the character limit", () => {
  assert.equal(
    insertTextAtSelection(`${"a".repeat(499)}x`, "😊", { start: 500, end: 500 }, 500),
    null,
  );
});

test("allows emoji insertion at the character limit when it replaces enough selected text", () => {
  assert.deepEqual(
    insertTextAtSelection(`${"a".repeat(498)}xy`, "😊", { start: 498, end: 500 }, 500),
    { text: `${"a".repeat(498)}😊`, cursor: 500 },
  );
});
