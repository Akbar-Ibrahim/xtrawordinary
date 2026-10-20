import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlNoRepeatsExploreSource } from "./explore-no-repeats";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlNoRepeatsExploreSource(db), queries };
}

test("No Repeats Browse uses letter frequencies to find alphabetic isograms", async () => {
  const fixture = createFixture([[["A"], ["ACE"], ["ACT"]]]);
  const result = await fixture.source.search({ requiredLetters: "" }, 2);
  assert.deepEqual(result.items.map(({ word }) => word), ["A", "ACE"]);
  assert.equal(result.page.hasMore, true);
  assert.match(fixture.queries[0].sql, /inner join `letter_frequency`/);
  assert.match(fixture.queries[0].sql, /max\(.*frequency/i);
  assert.match(fixture.queries[0].sql, /count\(distinct/i);
  assert.equal(result.source, "database");
});

test("No Repeats Browse applies optional length and required-letter filters", async () => {
  const fixture = createFixture([[["ACT"], ["CAT"]]]);
  const result = await fixture.source.search({ length: 3, requiredLetters: "TC" }, 20);
  assert.deepEqual(result.items.map(({ word }) => word), ["ACT", "CAT"]);
  assert.ok(fixture.queries[0].params.includes(3));
  assert.ok(fixture.queries[0].params.includes("T"));
  assert.ok(fixture.queries[0].params.includes("C"));
  assert.match(fixture.queries[0].sql, /case\s+when/i);
});

test("No Repeats cursor is scoped to length and required letters", async () => {
  const first = createFixture([[["ACE"], ["ACT"]]]);
  const page = await first.source.search({ length: 3, requiredLetters: "C" }, 1);
  assert.equal(page.page.hasMore, true);

  const next = createFixture([[["ACT"]]]);
  await next.source.search({ length: 3, requiredLetters: "C" }, 1, page.page.nextCursor!);
  assert.ok(next.queries[0].params.includes("ace"));

  const wrongContext = createFixture([[]]);
  await assert.rejects(wrongContext.source.search(
    { length: 4, requiredLetters: "C" },
    1,
    page.page.nextCursor!,
  ));
  assert.equal(wrongContext.queries.length, 0);
});

test("No Repeats Host checks dictionary word, stored frequencies, length, and required letters", async () => {
  const fixture = createFixture([
    [[5, "PAINT"]],
    [["A", 1], ["I", 1], ["N", 1], ["P", 1], ["T", 1]],
  ]);
  const result = await fixture.source.check("paint", { length: 5, requiredLetters: "TP" });
  assert.deepEqual(result, {
    word: "PAINT",
    dictionaryMatch: true,
    constraintMatch: true,
    source: "database",
  });
  assert.equal(fixture.queries.length, 2);
  assert.match(fixture.queries[1].sql, /letter_frequency/);
});

test("No Repeats Host rejects repeated-letter words and unknown dictionary entries", async () => {
  const repeated = createFixture([
    [[7, "LETTER"]],
    [["E", 2], ["L", 1], ["R", 1], ["T", 2]],
  ]);
  const repeatedResult = await repeated.source.check("LETTER", { requiredLetters: "" });
  assert.equal(repeatedResult.dictionaryMatch, true);
  assert.equal(repeatedResult.constraintMatch, false);

  const unknown = createFixture([[]]);
  const unknownResult = await unknown.source.check("UNLISTED", { requiredLetters: "" });
  assert.equal(unknownResult.dictionaryMatch, false);
  assert.equal(unknownResult.constraintMatch, false);
  assert.equal(unknown.queries.length, 1);
});
