import assert from "node:assert/strict";
import test from "node:test";
import { createMySqlWordRootsExploreSource } from "./explore-word-roots";
import { WordRootsExploreWordsNotFoundError } from "../explore/word-roots-types";

function createFakeDatabase(resultSets: unknown[][]) {
  let queryIndex = 0;
  const db = {
    select() {
      const rows = resultSets[queryIndex++] ?? [];
      const query: Record<string, any> = {};
      for (const method of ["from", "innerJoin", "where", "groupBy", "having", "orderBy"]) {
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

test("finds parent words that are linked to all submitted derivatives", async () => {
  const { db, queryCount } = createFakeDatabase([
    [{ id: 10, word: "BUT" }, { id: 11, word: "NOT" }],
    [{ word: "BUTTON" }, { word: "BUTTONS" }],
  ]);
  const source = createMySqlWordRootsExploreSource(db);

  const result = await source.findBaseWords(["but", "not"], { limit: 50, length: 6 });

  assert.equal(queryCount(), 2);
  assert.equal(result.source, "database");
  assert.deepEqual(result.inputs, ["BUT", "NOT"]);
  assert.equal(result.length, 6);
  assert.deepEqual(result.items.map(({ word }) => word), ["BUTTON"]);
});

test("reports submitted words that do not exist in the database", async () => {
  const { db, queryCount } = createFakeDatabase([
    [{ id: 10, word: "BUT" }],
  ]);
  const source = createMySqlWordRootsExploreSource(db);

  await assert.rejects(
    () => source.findBaseWords(["BUT", "MISSING"], { limit: 50 }),
    (error: unknown) => {
      assert.ok(error instanceof WordRootsExploreWordsNotFoundError);
      assert.deepEqual(error.words, ["MISSING"]);
      return true;
    },
  );
  assert.equal(queryCount(), 1);
});
