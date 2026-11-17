import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlWordMakerExploreSource } from "./explore-word-maker";

// Exercise real Drizzle query construction without requiring the remote database.
function fixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlWordMakerExploreSource(db), queries };
}

const base = [[1, "PAINTING", 8, "high"]];

test("database Browse joins derivative links and includes short words with pagination", async () => {
  const { source, queries } = fixture([
    base, [[2, "a", 1], [3, "in", 2], [4, "nag", 3]],
  ]);
  const result = await source.getWords("painting", 2);
  assert.deepEqual(result.items.map(({ word }) => word), ["A", "IN"]);
  assert.equal(result.page.hasMore, true);
  assert.ok(result.page.nextCursor);
  assert.match(queries[1].sql, /inner join `word_derivatives`/);
  assert.match(queries[1].sql, /`word_derivatives`\.`word_id` = \?/);
  assert.doesNotMatch(queries[1].sql, /word_length` >=/);

  const next = fixture([base, [[4, "nag", 3]]]);
  const page = await next.source.getWords("PAINTING", 2, result.page.nextCursor!);
  assert.equal(page.items[0].word, "NAG");
  assert.ok(next.queries[1].params.includes("in"));
});

test("database Host accepts linked NAG and short answers regardless of casing", async () => {
  for (const [word, length] of [["NAG", 3], ["IN", 2], ["A", 1]] as const) {
    const { source, queries } = fixture([base, [[4, word, length]], [[4]]]);
    const result = await source.checkAnswer("painting", word.toLowerCase());
    assert.equal(result.dictionaryMatch, true);
    assert.equal(result.source, "database");
    assert.equal(result.playableInGame, length >= 3);
    assert.match(queries[2].sql, /`word_id` = \?.*`derivative_id` = \?/);
    assert.deepEqual(queries[2].params.slice(0, 2), [1, 4]);
  }
});

test("database Host rejects a word without its base-to-derivative link", async () => {
  const { source } = fixture([base, [[4, "nag", 3]], []]);
  const result = await source.checkAnswer("PAINTING", "NAG");
  assert.equal(result.dictionaryMatch, false);
  assert.equal(result.gameplayExclusion, "not_in_word_maker_derivatives");
});

test("database Host rejects missing words, repeated-letter overuse, and the base itself", async () => {
  for (const [candidate, answer, reason] of [
    [[], "ZZZZ", "not_in_dictionary"],
    [[[4, "PAPA", 4]], "PAPA", "letters_not_available"],
    [[[1, "PAINTING", 8]], "PAINTING", "base_word_not_a_subword"],
  ] as const) {
    const { source } = fixture([base, candidate as unknown as unknown[][]]);
    const result = await source.checkAnswer("PAINTING", answer);
    assert.equal(result.dictionaryMatch, false);
    assert.equal(result.gameplayExclusion, reason);
  }
});

test("prefix suggestions include HEART without gameplay length, frequency, or derivative restrictions", async () => {
  const { source, queries } = fixture([[[1, "heart"], [2, "hearten"]]]);
  const result = await source.searchBaseWords("heart", 20);
  assert.deepEqual(result.items, [{ baseWord: "HEART" }, { baseWord: "HEARTEN" }]);
  assert.ok(queries[0].params.includes("heart%"));
  assert.doesNotMatch(queries[0].sql, /word_length|frequency_level|word_derivatives/);
  assert.match(queries[0].sql, /order by LOWER\(`words`\.`word`\)/);
});

test("short or rare base words use exact dictionary lookup and still return linked derivatives", async () => {
  const { source, queries } = fixture([[[1, "heart", 5, "very_low"]], [[2, "art", 3]]]);
  const result = await source.getWords("heart", 100);
  assert.equal(result.baseWord, "HEART");
  assert.deepEqual(result.items.map(({ word }) => word), ["ART"]);
  assert.equal(result.items[0].playableInGame, false);
  assert.ok(queries[0].params.includes("heart"));
  assert.doesNotMatch(queries[0].sql, /between| in \(|word_derivatives/);
  assert.equal(queries.length, 2);
});

test("an existing base word without derivatives returns an empty list, not a missing-word error", async () => {
  const { source } = fixture([[[1, "heart", 5, "high"]], []]);
  assert.deepEqual((await source.getWords("HEART", 100)).items, []);
  const missing = fixture([[]]);
  await assert.rejects(missing.source.getWords("UNKNOWNWORD", 100), /base word was not found/);
});

test("word checks for a short base agree with Browse without inheriting gameplay limits", async () => {
  const { source } = fixture([[[1, "heart", 5, "high"]], [[2, "art", 3]], [[2]]]);
  const result = await source.checkAnswer("heart", "art");
  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.playableInGame, false);
  assert.equal(result.gameplayExclusion, "base_not_in_regular_word_maker_pool");
});
