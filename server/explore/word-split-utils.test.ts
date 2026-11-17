import assert from "node:assert/strict";
import test from "node:test";
import { createWordSplitExplorePage } from "./word-split-utils";

const educationCandidates = [
  "ACTION",
  "CATION",
  "DUE",
  "ACT",
  "CAT",
  "ION",
  "OO",
];

function search(
  targetWord: string,
  candidates: string[],
  wordCount: number | null,
  minWordLength: number,
  limit = 50,
  cursor?: string,
) {
  return createWordSplitExplorePage(
    targetWord,
    candidates,
    { targetWord, wordCount, minWordLength },
    limit,
    cursor,
    "preview",
  );
}

test("calculates two- and three-word exact letter partitions", () => {
  const all = search("EDUCATION", educationCandidates, null, 3);
  assert.deepEqual(
    all.items.map(({ words }) => words),
    [
      ["ACT", "DUE", "ION"],
      ["ACTION", "DUE"],
      ["CAT", "DUE", "ION"],
      ["CATION", "DUE"],
    ],
  );
});

test("filters by exact component count and minimum component length", () => {
  const twoWords = search("EDUCATION", educationCandidates, 2, 3);
  assert.deepEqual(twoWords.items.map(({ words }) => words), [
    ["ACTION", "DUE"],
    ["CATION", "DUE"],
  ]);

  const longerOnly = search("EDUCATION", educationCandidates, null, 4);
  assert.deepEqual(longerOnly.items, []);
});

test("allows the same derivative more than once when its letters are available", () => {
  const result = search("NOON", ["ON"], 2, 2);
  assert.deepEqual(result.items.map(({ words }) => words), [["ON", "ON"]]);
});

test("rejects candidates that consume a letter too many times", () => {
  const result = search("EDUCATION", ["OO", "ACT", "DUE", "ION"], 2, 2);
  assert.deepEqual(result.items, []);
});

test("rejects minimum component lengths above the Explore limit", () => {
  assert.throws(
    () => search("EDUCATION", educationCandidates, null, 21),
    /between 1 and 20/,
  );
});

test("paginates splits in stable order without repeating results", () => {
  const first = search("EDUCATION", educationCandidates, 2, 3, 1);
  assert.equal(first.page.hasMore, true);
  assert.deepEqual(first.items.map(({ words }) => words), [["ACTION", "DUE"]]);

  const second = search(
    "EDUCATION",
    educationCandidates,
    2,
    3,
    1,
    first.page.nextCursor ?? undefined,
  );
  assert.equal(second.page.hasMore, false);
  assert.deepEqual(second.items.map(({ words }) => words), [["CATION", "DUE"]]);
});
