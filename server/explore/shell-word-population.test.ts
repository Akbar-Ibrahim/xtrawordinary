import assert from "node:assert/strict";
import test from "node:test";
import { deriveShellWordRelationships } from "./shell-word-population";

test("derives exact relationships through all four Explore depths", () => {
  const relationships = deriveShellWordRelationships([
    { id: 1, word: "brand" },
    { id: 2, word: "ran" },
    { id: 3, word: "a" },
    { id: 4, word: "stranger" },
    { id: 5, word: "rang" },
    { id: 6, word: "stone" },
    { id: 7, word: "cooperate" },
    { id: 8, word: "per" },
    { id: 9, word: "education" },
    { id: 10, word: "cat" },
    { id: 11, word: "chocolate" },
    { id: 12, word: "o" },
  ]);

  assert.deepEqual(relationships, [
    { shellWordId: 1, innerWordId: 2, depth: 1 },
    { shellWordId: 1, innerWordId: 3, depth: 2 },
    { shellWordId: 2, innerWordId: 3, depth: 1 },
    { shellWordId: 4, innerWordId: 5, depth: 2 },
    { shellWordId: 6, innerWordId: 12, depth: 2 },
    { shellWordId: 7, innerWordId: 8, depth: 3 },
    { shellWordId: 9, innerWordId: 10, depth: 3 },
    { shellWordId: 9, innerWordId: 3, depth: 4 },
    { shellWordId: 10, innerWordId: 3, depth: 1 },
    { shellWordId: 11, innerWordId: 12, depth: 4 },
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
