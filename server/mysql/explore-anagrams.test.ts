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
  const first = createFixture([[[1, "HEART"]], [], [["earth"], ["hater"]]]);
  const firstPage = await first.source.getWords("heart", 1);
  assert.deepEqual(firstPage.items, [{ word: "EARTH" }]);
  assert.equal(firstPage.page.hasMore, true);
  assert.ok(firstPage.page.nextCursor);
  assert.doesNotMatch(first.queries[0].sql, /word_anagrams/);
  assert.match(first.queries[2].sql, /`word_anagrams`\.`word_id` in/);

  const next = createFixture([[[1, "HEART"]], [], [["hater"]]]);
  const nextPage = await next.source.getWords("HEART", 1, firstPage.page.nextCursor!);
  assert.deepEqual(nextPage.items, [{ word: "HATER" }]);
  assert.ok(next.queries[2].params.includes("earth"));
});

test("database Host accepts only a linked word, case-insensitively", async () => {
  const accepted = createFixture([[[1, "SPEAR"]], [[8]], [], [[1]]]);
  assert.deepEqual(await accepted.source.checkAnswer("spear", "SpArE"), {
    valid: true,
    source: "database",
  });
  assert.ok(accepted.queries[3].params.includes(8));

  const unlinked = createFixture([[[1, "SPEAR"]]]);
  assert.deepEqual(await unlinked.source.checkAnswer("SPEAR", "HEART"), {
    valid: false,
    source: "database",
  });
});

test("database search includes short words and does not apply gameplay frequency limits", async () => {
  const browse = createFixture([[[1, "NO"]], [], [["ON"]]]);
  const result = await browse.source.getWords("NO", 100);
  assert.deepEqual(result.items, [{ word: "ON" }]);
  assert.doesNotMatch(browse.queries[0].sql, /frequency_level/);
  assert.doesNotMatch(browse.queries[2].sql, /word_length/);

  const check = createFixture([[[1, "NO"]], [[2]], [], [[1]]]);
  assert.equal((await check.source.checkAnswer("NO", "on")).valid, true);
});

test("database source returns alphabetized base matches and random linked base", async () => {
  const search = createFixture([[["HEART"]]]);
  const bases = await search.source.searchBaseWords("heart", 1);
  assert.deepEqual(bases.items, [{ baseWord: "HEART" }]);
  assert.equal(bases.page.hasMore, false);
  assert.doesNotMatch(search.queries[0].sql, /word_anagrams|like /i);
  assert.ok(search.queries[0].params.includes("heart"));

  const random = createFixture([[["LISTEN"]]]);
  assert.deepEqual(await random.source.randomBaseWord(), {
    baseWord: "LISTEN",
    source: "database",
  });
});

test("dictionary word without links returns an empty anagram list, not a missing-word error", async () => {
  const fixture = createFixture([[[5, "QUIZ"]], [], []]);
  const result = await fixture.source.getWords("quiz", 100);
  assert.deepEqual(result.items, []);
  assert.equal(result.page.hasMore, false);
});

test("bad links cannot appear in results or validate as spoken answers", async () => {
  const fixture = createFixture([
    [[1, "HEART"]],
    [],
    [["EARTH"], ["HATER"], ["REAUDIT"]],
  ]);
  const result = await fixture.source.getWords("HEART", 1);
  assert.deepEqual(result.items, [{ word: "EARTH" }]);
  assert.equal(result.page.hasMore, true);

  const next = createFixture([[[1, "HEART"]], [], [["HATER"], ["REAUDIT"]]]);
  const second = await next.source.getWords("HEART", 1, result.page.nextCursor!);
  assert.deepEqual(second.items, [{ word: "HATER" }]);
  assert.equal(second.page.hasMore, false);
  assert.equal((await createFixture([[[1, "HEART"]]]).source.checkAnswer("HEART", "REAUDIT")).valid, false);
  assert.equal((await createFixture([[[1, "PACE"]]]).source.checkAnswer("PACE", "OVERMINDEDNESS")).valid, false);
});

test("anagram side of a link also finds its parent and siblings", async () => {
  const browse = createFixture([
    [[8, "NOTE"]],
    [[3]],
    [["NOTE"], ["TOEN"], ["TONE"]],
  ]);
  const result = await browse.source.getWords("NOTE", 20);
  assert.deepEqual(result.items, [{ word: "TOEN" }, { word: "TONE" }]);
  assert.ok(browse.queries[2].params.includes(3));

  const check = createFixture([[[8, "NOTE"]], [[9]], [[3]], [[3]]]);
  assert.equal((await check.source.checkAnswer("NOTE", "TOEN")).valid, true);
});

test("exact dictionary search finds a word regardless of its anagram links", async () => {
  const fixture = createFixture([[["NOTE"]]]);
  assert.deepEqual((await fixture.source.searchBaseWords("note", 20)).items, [{ baseWord: "NOTE" }]);
  assert.doesNotMatch(fixture.queries[0].sql, /word_anagrams/);
});
