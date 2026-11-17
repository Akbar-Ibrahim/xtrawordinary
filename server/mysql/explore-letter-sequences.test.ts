import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlLetterSequenceExploreSource } from "./explore-letter-sequences";

function createFixture(resultSets: unknown[][][]) {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const db = drizzle(async (query, params) => {
    queries.push({ sql: query, params });
    return { rows: resultSets.shift() ?? [] };
  });
  return { source: createMySqlLetterSequenceExploreSource(db), queries };
}

test("prefix, suffix, and contains searches query positional letter records", async () => {
  const prefix = createFixture([[["BRIGHT"]]]);
  const prefixPage = await prefix.source.search("prefix", "bri", 20);
  assert.deepEqual(prefixPage.items.map(({ word }) => word), ["BRIGHT"]);
  assert.equal(prefixPage.sequence, "BRI");
  assert.match(prefix.queries[0].sql, /word_letter_positions/);
  assert.ok(prefix.queries[0].params.includes("b"));
  assert.ok(prefix.queries[0].params.includes("r"));
  assert.ok(prefix.queries[0].params.includes("i"));
  assert.ok(prefix.queries[0].params.includes(1));

  const suffix = createFixture([[["ACTION"]]]);
  const suffixPage = await suffix.source.search("suffix", "ion", 20);
  assert.deepEqual(suffixPage.items.map(({ word }) => word), ["ACTION"]);
  assert.ok(suffix.queries[0].params.includes("i"));
  assert.ok(suffix.queries[0].params.includes("o"));
  assert.ok(suffix.queries[0].params.includes("n"));
  assert.match(suffix.queries[0].sql, /word_length/);

  const contains = createFixture([[["CARTON"]]]);
  const containsPage = await contains.source.search("contains", "art", 20);
  assert.deepEqual(containsPage.items.map(({ word }) => word), ["CARTON"]);
  assert.match(contains.queries[0].sql, /word_letter_positions/);
  assert.match(contains.queries[0].sql, /left/i);
  assert.match(contains.queries[0].sql, /right/i);
  assert.ok(contains.queries[0].params.includes(2));
  assert.ok(contains.queries[0].params.includes("ART"));
});

test("MySQL result pages continue alphabetically with a cursor scoped to the filter", async () => {
  const first = createFixture([[["BRIAR"], ["BRICK"]]]);
  const firstPage = await first.source.search("prefix", "BRI", 1);
  assert.deepEqual(firstPage.items.map(({ word }) => word), ["BRIAR"]);
  assert.equal(firstPage.page.hasMore, true);
  assert.ok(firstPage.page.nextCursor);

  const next = createFixture([[["BRICK"]]]);
  const nextPage = await next.source.search("prefix", "BRI", 1, firstPage.page.nextCursor!);
  assert.deepEqual(nextPage.items.map(({ word }) => word), ["BRICK"]);
  assert.ok(next.queries[0].params.includes("BRIAR"));

  const wrongFilter = createFixture([[]]);
  await assert.rejects(
    wrongFilter.source.search("suffix", "BRI", 1, firstPage.page.nextCursor!),
  );
  assert.equal(wrongFilter.queries.length, 0);
});

test("MySQL applies the selected word length before pagination", async () => {
  const fixture = createFixture([[["BRIGHT"]]]);
  const result = await fixture.source.search("prefix", "BRI", 20, undefined, 6);

  assert.equal(result.length, 6);
  assert.deepEqual(result.items.map(({ word }) => word), ["BRIGHT"]);
  assert.match(fixture.queries[0].sql, /word_length/);
  assert.ok(fixture.queries[0].params.includes(6));
});

test("MySQL cursors cannot be reused with a different word length", async () => {
  const first = createFixture([[["BRIAR"], ["BRICK"]]]);
  const firstPage = await first.source.search("prefix", "BRI", 1, undefined, 5);
  assert.equal(firstPage.page.hasMore, true);

  const next = createFixture([[]]);
  await assert.rejects(
    next.source.search("prefix", "BRI", 1, firstPage.page.nextCursor!, 6),
  );
  assert.equal(next.queries.length, 0);
});
