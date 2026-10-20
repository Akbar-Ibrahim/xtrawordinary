import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlUnscrambleSource } from "./explore-unscramble";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlUnscrambleSource(db), queries };
}

test("exact unscramble lookup matches every letter count and exact word length", async () => {
  const fixture = createFixture([[["ENLIST"], ["LISTEN"], ["SILENT"]]]);
  const result = await fixture.source.solve("nitsel", 100);

  assert.deepEqual(result, {
    input: "NITSEL",
    items: ["ENLIST", "LISTEN", "SILENT"],
    hasMore: false,
    nextCursor: null,
    source: "database",
  });
  assert.match(fixture.queries[0].sql, /inner join `letter_frequency`/);
  assert.match(fixture.queries[0].sql, /`words`\.`word_length` = \?/);
  assert.match(fixture.queries[0].sql, /COUNT\(DISTINCT/);
  assert.match(fixture.queries[0].sql, /SUM\(/);
  assert.doesNotMatch(fixture.queries[0].sql, /word_anagrams|frequency_level/);
});

test("caps results and reports whether additional exact matches exist", async () => {
  const fixture = createFixture([[["ACT"], ["CAT"], ["TAC"]]]);
  const result = await fixture.source.solve("cat", 2);
  assert.deepEqual(result.items, ["ACT", "CAT"]);
  assert.equal(result.hasMore, true);
  assert.ok(result.nextCursor);
  assert.ok(fixture.queries[0].params.includes(3));

  const next = createFixture([[["TAC"]]]);
  assert.deepEqual((await next.source.solve("cat", 2, result.nextCursor!)).items, ["TAC"]);
  assert.ok(next.queries[0].params.includes("cat"));
});

test("preview samples are shuffled from database words and use the letter table", async () => {
  const fixture = createFixture([[["CAT"], ["DOG"]]]);
  const result = await fixture.source.getExamples(2);
  assert.equal(result.source, "database");
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((sample) => !["CAT", "DOG"].includes(sample)));
  assert.match(fixture.queries[0].sql, /inner join `letter_frequency`/);
});

test("empty database sample set is returned without invented fallback words", async () => {
  const fixture = createFixture([[]]);
  assert.deepEqual(await fixture.source.getExamples(6), {
    items: [],
    source: "database",
  });
});
