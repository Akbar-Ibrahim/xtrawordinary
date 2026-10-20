import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlLetterPositionExploreSource } from "./explore-letter-position";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlLetterPositionExploreSource(db), queries };
}

test("Letter Position Browse filters at the requested one-based position", async () => {
  const fixture = createFixture([[["LETTER"], ["BEE"]]]);
  const result = await fixture.source.search("e", 2, 20);
  assert.deepEqual(result.items.map(({ word }) => word), ["LETTER", "BEE"]);
  assert.match(fixture.queries[0].sql, /SUBSTRING/);
  assert.match(fixture.queries[0].sql, /REGEXP/);
  assert.match(fixture.queries[0].sql, /limit \?/);
  assert.ok(fixture.queries[0].params.includes(2));
  assert.ok(fixture.queries[0].params.includes("E"));
});

test("Letter Position cursor is scoped to the chosen letter and position", async () => {
  const first = createFixture([[["ABLE"], ["CABLE"]]]);
  const firstPage = await first.source.search("B", 2, 1);
  assert.equal(firstPage.page.hasMore, true);

  const next = createFixture([[["CABLE"]]]);
  await next.source.search("B", 2, 1, firstPage.page.nextCursor!);
  assert.ok(next.queries[0].params.includes("able"));

  const wrongContext = createFixture([[]]);
  await assert.rejects(wrongContext.source.search("B", 3, 1, firstPage.page.nextCursor!));
  assert.equal(wrongContext.queries.length, 0);
});

test("Letter Position Host checks dictionary membership and returns source metadata", async () => {
  const fixture = createFixture([[["LETTER"]]]);
  const result = await fixture.source.check("letter", "E", 2);
  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.constraintMatch, true);
  assert.equal(result.playableInGame, true);
  assert.equal(result.source, "database");
  assert.match(fixture.queries[0].sql, /UPPER/);
});
