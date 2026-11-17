import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import {
  getCrackPuzzle,
  getDeepCrackAnswer,
  getDeepCrackPuzzle,
  getDeepShellWordPuzzle,
  getShellWordPuzzle,
  validateDeepShellWord,
  validateShellWord,
} from "./words";

function createDb(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { db, queries };
}

const fallbackGameData = {
  getCrackPuzzle: () => ({ first: "X", last: "Y" }),
  getDeepCrackPuzzle: () => ({ first: "XY", last: "YZ" }),
  getDeepCrackAnswer: () => "RANG",
  getShellWordPuzzle: () => ({ middle: "RAN", count: 3 }),
  getDeepShellWordPuzzle: () => ({ middle: "RANG", count: 3 }),
};

function assertMinimumInnerLength(query: { sql: string; params: unknown[] }) {
  assert.match(query.sql, /inner_words/);
  assert.match(query.sql, /word_length/);
  assert.ok(query.params.includes(3), "The query should require a three-letter inner word");
}

test("Shell Words gameplay validation requires a three-letter inner word", () => {
  assert.deepEqual(
    validateShellWord(new Set(["CARE", "AR"]), "CARE"),
    { valid: false, innerWord: null },
  );
  assert.deepEqual(
    validateShellWord(new Set(["BRAND", "RAN"]), "BRAND"),
    { valid: true, innerWord: "RAN" },
  );
});

test("Deep Shell Words gameplay validation requires a three-letter inner word", () => {
  assert.deepEqual(
    validateDeepShellWord(new Set(["ABCDEF", "CD"]), "ABCDEF"),
    { valid: false, innerWord: null },
  );
  assert.deepEqual(
    validateDeepShellWord(new Set(["STRANGER", "RANG"]), "STRANGER"),
    { valid: true, innerWord: "RANG" },
  );
});

test("Wrapper and Crack puzzle queries keep short Explore links out of gameplay", async () => {
  const shellWrapper = createDb([[["RAN", 3]]]);
  await getShellWordPuzzle(shellWrapper.db, fallbackGameData, 1);
  assertMinimumInnerLength(shellWrapper.queries[0]);

  const shellCrack = createDb([[["B", "D"]]]);
  await getCrackPuzzle(shellCrack.db, fallbackGameData, 1);
  assertMinimumInnerLength(shellCrack.queries[0]);

  const deepWrapper = createDb([[["RANG", 3]]]);
  await getDeepShellWordPuzzle(deepWrapper.db, fallbackGameData, 1);
  assertMinimumInnerLength(deepWrapper.queries[0]);

  const deepCrack = createDb([[["ST", "ER"]]]);
  await getDeepCrackPuzzle(deepCrack.db, fallbackGameData, 1);
  assertMinimumInnerLength(deepCrack.queries[0]);
});

test("Deep Crack answer lookup also excludes short inner words", async () => {
  const fixture = createDb([[["ST", "ER"]], [["RANG"]]]);
  const answer = await getDeepCrackAnswer(fixture.db, fallbackGameData, 1);

  assert.equal(answer, "RANG");
  assert.equal(fixture.queries.length, 2);
  assertMinimumInnerLength(fixture.queries[0]);
  assertMinimumInnerLength(fixture.queries[1]);
});
