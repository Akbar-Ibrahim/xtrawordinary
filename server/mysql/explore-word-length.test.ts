import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlWordLengthExploreSource } from "./explore-word-length";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlWordLengthExploreSource(db), queries };
}

test("MySQL Browse filters exact dictionary length and orders results alphabetically", async () => {
  const fixture = createFixture([[["ACE"], ["ACT"]]]);
  const result = await fixture.source.search({ variation: 1, length: 3 }, 20);
  assert.deepEqual(result.items.map(({ word }) => word), ["ACE", "ACT"]);
  assert.equal(result.source, "database");
  assert.match(fixture.queries[0].sql, /REGEXP/);
  assert.match(fixture.queries[0].sql, /word_length/);
  assert.match(fixture.queries[0].sql, /order by LOWER/);
  assert.ok(fixture.queries[0].params.includes(3));
  assert.ok(fixture.queries[0].params.includes(21));
});

test("MySQL Browse preserves the special Contains position rules for variations 4 and 5", async () => {
  const startsPattern = createFixture([[["ECLATS"]]]);
  await startsPattern.source.search(
    { variation: 4, length: 6, startsWith: "e", contains: "a" },
    10,
  );
  assert.match(startsPattern.queries[0].sql, /LEFT/);
  assert.match(startsPattern.queries[0].sql, /LOCATE/);
  assert.ok(startsPattern.queries[0].params.includes("E"));
  assert.ok(startsPattern.queries[0].params.includes("A"));

  const endsPattern = createFixture([[["ORANGE"]]]);
  await endsPattern.source.search(
    { variation: 5, length: 6, endsWith: "e", contains: "a" },
    10,
  );
  assert.match(endsPattern.queries[0].sql, /SUBSTRING/);
  assert.match(endsPattern.queries[0].sql, /LOCATE/);
});

test("MySQL word Check confirms dictionary membership separately from pattern match", async () => {
  const fixture = createFixture([[["HEART"]]]);
  const result = await fixture.source.check("heart", { variation: 1, length: 5 });
  assert.equal(result.word, "HEART");
  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.constraintMatch, true);
  assert.equal(result.playableInGame, true);
  assert.match(fixture.queries[0].sql, /UPPER/);
});

test("MySQL cursor is bound to the selected Length Challenge pattern", async () => {
  const first = createFixture([[["ACE"], ["ACT"]]]);
  const page = await first.source.search({ variation: 1, length: 3 }, 1);
  assert.equal(page.page.hasMore, true);

  const next = createFixture([[["ACT"]]]);
  await next.source.search({ variation: 1, length: 3 }, 1, page.page.nextCursor!);
  assert.ok(next.queries[0].params.includes("ace"));

  const changedPattern = createFixture([[]]);
  await assert.rejects(
    changedPattern.source.search({ variation: 1, length: 4 }, 1, page.page.nextCursor!),
  );
  assert.equal(changedPattern.queries.length, 0);
});
