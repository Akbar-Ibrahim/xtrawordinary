import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { getLetterPoolWords } from "./words";

test("database Letter Pool targets exclude words linked as anagrams in either direction", async () => {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    return { rows: [] };
  });

  const result = await getLetterPoolWords(db, { getLetterPoolWords: () => [] });

  assert.deepEqual(result, []);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /not exists/i);
  assert.match(queries[0].sql, /`word_anagrams`\.`word_id`/);
  assert.match(queries[0].sql, /`word_anagrams`\.`anagram_id`/);
  assert.match(queries[0].sql, /`words`\.`id`/);
});
