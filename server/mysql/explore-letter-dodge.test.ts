import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlLetterDodgeExploreSource } from "./explore-letter-dodge";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlLetterDodgeExploreSource(db), queries };
}

test("Letter Dodge SQL excludes all selected letters and includes short words", async () => {
  const fixture = createFixture([[["COT"], ["BOLD"]]]);
  const result = await fixture.source.search("AE", 20);
  assert.equal(result.items[0].word, "COT");
  assert.equal(result.items[0].playableInGame, false);
  assert.match(fixture.queries[0].sql, /not like/);
  assert.match(fixture.queries[0].sql, /REGEXP/);
  assert.ok(!fixture.queries[0].sql.includes("word_length"));
});

test("Letter Dodge pages are scoped to the forbidden-letter set", async () => {
  const first = createFixture([[["BOLD"], ["BOOK"]]]);
  const firstPage = await first.source.search("AE", 1);
  assert.equal(firstPage.page.hasMore, true);
  assert.ok(firstPage.page.nextCursor);

  const next = createFixture([[["BOOK"]]]);
  await next.source.search("EA", 1, firstPage.page.nextCursor!);
  assert.ok(next.queries[0].params.includes("bold"));

  const wrongContext = createFixture([[]]);
  await assert.rejects(wrongContext.source.search("AB", 1, firstPage.page.nextCursor!));
  assert.equal(wrongContext.queries.length, 0);
});

test("Letter Dodge Host accepts valid short Explore matches but marks gameplay exclusion", async () => {
  const fixture = createFixture([[["COT"]]]);
  const result = await fixture.source.check("cot", "AE");
  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.constraintMatch, true);
  assert.equal(result.playableInGame, false);
  assert.match(result.gameplayExclusion ?? "", /4 letters/);
  assert.match(fixture.queries[0].sql, /UPPER/);
});
