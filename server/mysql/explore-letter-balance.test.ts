import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlLetterBalanceExploreSource } from "./explore-letter-balance";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlLetterBalanceExploreSource(db), queries };
}

test("Vowel-count Browse uses database counts and returns alphabetized pages", async () => {
  const fixture = createFixture([[["ACE"], ["ATE"], ["QUEUE"]]]);
  const page = await fixture.source.search({ category: "vowel_count", count: 2 }, 2);

  assert.deepEqual(page.items.map(({ word }) => word), ["ACE", "ATE"]);
  assert.equal(page.page.hasMore, true);
  assert.equal(page.source, "database");
  assert.match(fixture.queries[0].sql, /`words`\.`vowel_count`/);
  assert.match(fixture.queries[0].sql, /order by lower\(`words`\.`word`\)/i);
  assert.ok(fixture.queries[0].params.includes(2));
});

test("positional Browse queries the word's first and last letters without a gameplay length minimum", async () => {
  const fixture = createFixture([[["A"], ["ACE"]]]);
  const page = await fixture.source.search({ category: "start_end_vowel" }, 10);

  assert.deepEqual(page.items.map(({ word }) => word), ["A", "ACE"]);
  assert.match(fixture.queries[0].sql, /left\(`words`\.`word`, 1\)/i);
  assert.match(fixture.queries[0].sql, /right\(`words`\.`word`, 1\)/i);
  assert.ok(!fixture.queries[0].params.includes(3));
});

test("locked balance filters by length and exact consonant count", async () => {
  const fixture = createFixture([[["BOOK"], ["TREE"]]]);
  await fixture.source.search({
    category: "locked_balance",
    length: 4,
    consonantCount: 2,
  }, 10);

  assert.match(fixture.queries[0].sql, /`words`\.`word_length`/);
  assert.match(fixture.queries[0].sql, /`words`\.`consonant_count`/);
  assert.ok(fixture.queries[0].params.includes(4));
  assert.ok(fixture.queries[0].params.includes(2));
});

test("Host accepts an exact dictionary match and rejects unknown words", async () => {
  const accepted = createFixture([[["CAT", 3, 1, 2]]]);
  assert.deepEqual(await accepted.source.check("cat", {
    category: "vowel_count",
    count: 1,
  }), {
    word: "CAT",
    dictionaryMatch: true,
    constraintMatch: true,
    source: "database",
  });

  const unknown = createFixture([[]]);
  assert.deepEqual(await unknown.source.check("UNKNOWN", {
    category: "vowel_count",
    count: 1,
  }), {
    word: "UNKNOWN",
    dictionaryMatch: false,
    constraintMatch: false,
    source: "database",
  });
});
