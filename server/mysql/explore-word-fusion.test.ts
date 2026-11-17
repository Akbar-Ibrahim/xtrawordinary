import assert from "node:assert/strict";
import test from "node:test";
import { createMySqlWordFusionExploreSource } from "./explore-word-fusion";
import {
  WordFusionComponentsNotFoundError,
  WordFusionLetterDataMissingError,
} from "../explore/word-fusion-types";

function createFakeDatabase(resultSets: unknown[][]) {
  let queryIndex = 0;
  const db = {
    select() {
      const rows = resultSets[queryIndex++] ?? [];
      const query: Record<string, any> = {};
      for (const method of ["from", "leftJoin", "innerJoin", "where", "groupBy", "having", "orderBy"]) {
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

const componentRows = [
  { id: 1, word: "HE", letter: "H", frequency: 1 },
  { id: 1, word: "HE", letter: "E", frequency: 1 },
  { id: 2, word: "ART", letter: "A", frequency: 1 },
  { id: 2, word: "ART", letter: "R", frequency: 1 },
  { id: 2, word: "ART", letter: "T", frequency: 1 },
];

test("queries component letters and returns exact database matches", async () => {
  const { db, queryCount } = createFakeDatabase([
    componentRows,
    [{ word: "EARTH" }, { word: "HEART" }],
  ]);
  const source = createMySqlWordFusionExploreSource(db);

  const result = await source.search(["he", "art"], 50);

  assert.equal(queryCount(), 2);
  assert.equal(result.source, "database");
  assert.deepEqual(result.components, ["HE", "ART"]);
  assert.deepEqual(result.items.map(({ word }) => word), ["EARTH", "HEART"]);
});

test("reports component words absent from the dictionary", async () => {
  const { db } = createFakeDatabase([componentRows.slice(0, 2)]);
  const source = createMySqlWordFusionExploreSource(db);

  await assert.rejects(
    () => source.search(["HE", "MISSING"], 50),
    WordFusionComponentsNotFoundError,
  );
});

test("fails explicitly when a component lacks complete letter-frequency rows", async () => {
  const incomplete = componentRows.map((row) =>
    row.id === 2 && row.letter === "T" ? { ...row, frequency: null, letter: null } : row,
  );
  const { db } = createFakeDatabase([incomplete]);
  const source = createMySqlWordFusionExploreSource(db);

  await assert.rejects(
    () => source.search(["HE", "ART"], 50),
    WordFusionLetterDataMissingError,
  );
});
