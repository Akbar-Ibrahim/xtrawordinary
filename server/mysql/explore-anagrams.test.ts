import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlAnagramExploreSource } from "./explore-anagrams";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlAnagramExploreSource(db), queries };
}

test("database Browse searches linked words alphabetically and paginates", async () => {
  const first = createFixture([[[1, "HEART"]], [["earth"], ["hater"]]]);
  const firstPage = await first.source.getWords("heart", 1);
  assert.deepEqual(firstPage.items, [{ word: "EARTH" }]);
  assert.equal(firstPage.page.hasMore, true);
  assert.ok(firstPage.page.nextCursor);
  assert.match(first.queries[0].sql, /inner join `word_anagrams`/);
  assert.match(first.queries[1].sql, /`word_anagrams`\.`word_id` = \?/);

  const next = createFixture([[[1, "HEART"]], [["hater"]]]);
  const nextPage = await next.source.getWords("HEART", 1, firstPage.page.nextCursor!);
  assert.deepEqual(nextPage.items, [{ word: "HATER" }]);
  assert.ok(next.queries[1].params.includes("earth"));
});

test("database Host accepts only a linked word, case-insensitively", async () => {
  const accepted = createFixture([[[1, "SPEAR"]], [[8]], [[1]]]);
  assert.deepEqual(await accepted.source.checkAnswer("spear", "SpArE"), {
    valid: true,
    source: "database",
  });
  assert.deepEqual(accepted.queries[2].params.slice(0, 2), [1, 8]);

  const unlinked = createFixture([[[1, "SPEAR"]], [[9]], []]);
  assert.deepEqual(await unlinked.source.checkAnswer("SPEAR", "HEART"), {
    valid: false,
    source: "database",
  });
});

test("database search includes short words and does not apply gameplay frequency limits", async () => {
  const browse = createFixture([[[1, "NO"]], [["ON"]]]);
  const result = await browse.source.getWords("NO", 100);
  assert.deepEqual(result.items, [{ word: "ON" }]);
  assert.doesNotMatch(browse.queries[0].sql, /frequency_level/);
  assert.doesNotMatch(browse.queries[1].sql, /word_length/);

  const check = createFixture([[[1, "NO"]], [[2]], [[1]]]);
  assert.equal((await check.source.checkAnswer("NO", "on")).valid, true);
});

test("database source returns alphabetized base matches and random linked base", async () => {
  const search = createFixture([[["HEART"], ["SPEAR"]]]);
  const bases = await search.source.searchBaseWords("", 1);
  assert.deepEqual(bases.items, [{ baseWord: "HEART" }]);
  assert.equal(bases.page.hasMore, true);
  assert.match(search.queries[0].sql, /word_anagrams/);

  const random = createFixture([[["LISTEN"]]]);
  assert.deepEqual(await random.source.randomBaseWord(), {
    baseWord: "LISTEN",
    source: "database",
  });
});
