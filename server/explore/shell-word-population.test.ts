import assert from "node:assert/strict";
import test from "node:test";
import { deriveShellWordRelationships } from "./shell-word-population";

test("derives depth-one and depth-two relationships from exact dictionary middles", () => {
  const relationships = deriveShellWordRelationships([
    { id: 1, word: "brand" },
    { id: 2, word: "ran" },
    { id: 3, word: "a" },
    { id: 4, word: "stranger" },
    { id: 5, word: "rang" },
    { id: 6, word: "stone" },
  ]);

  assert.deepEqual(relationships, [
    { shellWordId: 1, innerWordId: 2, depth: 1 },
    { shellWordId: 1, innerWordId: 3, depth: 2 },
    { shellWordId: 2, innerWordId: 3, depth: 1 },
    { shellWordId: 4, innerWordId: 5, depth: 2 },
  ]);
});

test("includes short dictionary middles and ignores non-alphabetic entries", () => {
  const relationships = deriveShellWordRelationships([
    { id: 1, word: "CAT" },
    { id: 2, word: "A" },
    { id: 3, word: "ABABA" },
    { id: 4, word: "A!" },
  ]);

  assert.deepEqual(relationships, [
    { shellWordId: 1, innerWordId: 2, depth: 1 },
    { shellWordId: 3, innerWordId: 2, depth: 2 },
  ]);
});

test("rejects duplicate dictionary words that differ only by case", () => {
  assert.throws(
    () => deriveShellWordRelationships([
      { id: 1, word: "PORT" },
      { id: 2, word: "port" },
    ]),
    /duplicate words that differ only by case/i,
  );
});
