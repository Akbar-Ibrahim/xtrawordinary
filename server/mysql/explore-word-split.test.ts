import assert from "node:assert/strict";
import test from "node:test";
import { createMySqlWordSplitExploreSource } from "./explore-word-split";
import { WordSplitTargetNotFoundError } from "../explore/word-split-types";

function createFakeDatabase(resultSets: unknown[][]) {
  let queryIndex = 0;
  const db = {
    select() {
      const rows = resultSets[queryIndex++] ?? [];
      const query: Record<string, any> = {};
      for (const method of ["from", "innerJoin", "where", "orderBy"]) {
        query[method] = () => query;
      }
      query.limit = async () => rows;
      query.then = (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject);
      return query;
    },
  };
  return { db, queryCount: () => queryIndex };
}

test("loads the target's linked derivatives and calculates exact splits", async () => {
  const { db, queryCount } = createFakeDatabase([
    [{ id: 42, word: "EDUCATION" }],
    [
      { word: "ACTION" },
      { word: "CATION" },
      { word: "DUE" },
      { word: "ACT" },
      { word: "ION" },
    ],
  ]);
  const source = createMySqlWordSplitExploreSource(db);

  const result = await source.getSplits({
    targetWord: "education",
    wordCount: 2,
    minWordLength: 3,
  }, 50);

  assert.equal(queryCount(), 2);
  assert.equal(result.source, "database");
  assert.equal(result.targetWord, "EDUCATION");
  assert.deepEqual(result.items.map(({ words }) => words), [
    ["ACTION", "DUE"],
    ["CATION", "DUE"],
  ]);
});

test("reports a dictionary miss rather than returning an empty split list", async () => {
  const { db } = createFakeDatabase([[]]);
  const source = createMySqlWordSplitExploreSource(db);

  await assert.rejects(
    () => source.getSplits({ targetWord: "NOTAWORDEXAMPLE", wordCount: null, minWordLength: 2 }, 50),
    WordSplitTargetNotFoundError,
  );
});
