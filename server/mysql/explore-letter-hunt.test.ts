import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlLetterHuntExploreSource } from "./explore-letter-hunt";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlLetterHuntExploreSource(db), queries };
}

test("Letter Hunt SQL enforces repeated letter counts and ordered sequence", async () => {
  const fixture = createFixture([[["TREAT"], ["TEAR"]]]);
  const result = await fixture.source.search("TEA", true, 20);
  assert.deepEqual(result.items.map(({ word }) => word), ["TREAT", "TEAR"]);
  assert.match(fixture.queries[0].sql, /CHAR_LENGTH/);
  assert.match(fixture.queries[0].sql, /REPLACE/);
  assert.match(fixture.queries[0].sql, /REGEXP/);
  assert.match(fixture.queries[0].sql, /`words`/);
  assert.match(fixture.queries[0].sql, /limit \?/);
});

test("Letter Hunt cursor is scoped to required letters and order", async () => {
  const first = createFixture([[["TREAT"], ["TEAR"]]]);
  const firstPage = await first.source.search("TEA", false, 1);
  assert.equal(firstPage.page.hasMore, true);
  assert.ok(firstPage.page.nextCursor);

  const next = createFixture([[["TEAR"]]]);
  await next.source.search("TEA", false, 1, firstPage.page.nextCursor!);
  assert.ok(next.queries[0].params.includes("treat"));

  const wrongContext = createFixture([[]]);
  await assert.rejects(wrongContext.source.search("TEA", true, 1, firstPage.page.nextCursor!));
  assert.equal(wrongContext.queries.length, 0);
});

test("Letter Hunt host check queries the full word dictionary and returns source", async () => {
  const fixture = createFixture([[["TREAT"]]]);
  const result = await fixture.source.check("treat", "TEA", true);
  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.constraintMatch, true);
  assert.equal(result.source, "database");
  assert.match(fixture.queries[0].sql, /UPPER/);
});
