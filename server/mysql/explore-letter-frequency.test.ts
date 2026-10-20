import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlLetterFrequencyExploreSource } from "./explore-letter-frequency";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { source: createMySqlLetterFrequencyExploreSource(db), queries };
}

test("Letter Frequency Browse joins the frequency table and alphabetically paginates exact matches", async () => {
  const fixture = createFixture([[["COFFEE"], ["LETTER"]]]);
  const result = await fixture.source.search([{ letter: "E", count: 2 }], "exact", 1);

  assert.deepEqual(result.items.map(({ word }) => word), ["COFFEE"]);
  assert.equal(result.page.hasMore, true);
  assert.match(fixture.queries[0].sql, /inner join `letter_frequency`/);
  assert.match(fixture.queries[0].sql, /count\(distinct/i);
  assert.ok(fixture.queries[0].params.includes("E"));
  assert.ok(fixture.queries[0].params.includes(2));
  assert.equal(result.source, "database");
});

test("Letter Frequency minimum matching and cursors use the complete selected rule", async () => {
  const first = createFixture([[["ASSESSMENT"], ["MISSISSIPPI"]]]);
  const page = await first.source.search([{ letter: "S", count: 4 }], "minimum", 1);
  assert.equal(page.page.hasMore, true);

  const next = createFixture([[["MISSISSIPPI"]]]);
  await next.source.search([{ letter: "S", count: 4 }], "minimum", 1, page.page.nextCursor!);
  assert.ok(next.queries[0].params.includes("assessment"));

  const wrongContext = createFixture([[]]);
  await assert.rejects(wrongContext.source.search(
    [{ letter: "S", count: 4 }],
    "exact",
    1,
    page.page.nextCursor!,
  ));
  assert.equal(wrongContext.queries.length, 0);
});

test("Letter Frequency multi-letter Browse requires all exact counts", async () => {
  const fixture = createFixture([[["ABBREVIATION"]]]);
  const result = await fixture.source.search(
    [{ letter: "E", count: 1 }, { letter: "A", count: 2 }],
    "exact",
    20,
  );
  assert.equal(result.items[0].word, "ABBREVIATION");
  assert.match(fixture.queries[0].sql, /having/i);
  assert.ok(fixture.queries[0].params.includes("A"));
  assert.ok(fixture.queries[0].params.includes("E"));
});

test("Letter Frequency Host checks dictionary membership and reads the selected frequency rows", async () => {
  const fixture = createFixture([
    [[3, "LETTER"]],
    [["E", 2], ["T", 2]],
  ]);
  const result = await fixture.source.check(
    "letter",
    [{ letter: "E", count: 2 }, { letter: "T", count: 2 }],
    "exact",
  );
  assert.deepEqual(result, {
    word: "LETTER",
    dictionaryMatch: true,
    constraintMatch: true,
    source: "database",
  });
  assert.equal(fixture.queries.length, 2);
  assert.match(fixture.queries[1].sql, /letter_frequency/);
});

test("Letter Frequency Host separates unknown dictionary words from count mismatches", async () => {
  const unknown = createFixture([[]]);
  const notFound = await unknown.source.check("NOTAWORD", [{ letter: "A", count: 2 }], "exact");
  assert.equal(notFound.dictionaryMatch, false);
  assert.equal(notFound.constraintMatch, false);
  assert.equal(unknown.queries.length, 1);

  const mismatch = createFixture([[[3, "LETTER"]], [["E", 2]]]);
  const result = await mismatch.source.check("LETTER", [{ letter: "E", count: 3 }], "exact");
  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.constraintMatch, false);
});
