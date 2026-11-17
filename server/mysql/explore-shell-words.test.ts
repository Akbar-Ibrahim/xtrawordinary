import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { createMySqlShellWordExploreSource } from "./explore-shell-words";

function createFixture(responses: unknown[][][]) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = drizzle(async (sql, params) => {
    queries.push({ sql, params });
    assert.ok(responses.length, "Unexpected database query");
    return { rows: responses.shift()! };
  });
  return { queries, source: createMySqlShellWordExploreSource(db, 1) };
}

test("MySQL Shell Words Browse joins the relationship table without gameplay-only filters", async () => {
  const fixture = createFixture([[["BRAND", "RAN"]]]);
  const result = await fixture.source.search({ direction: "shell", first: "B" }, 20);

  assert.deepEqual(result.items, [{ shellWord: "BRAND", innerWord: "RAN" }]);
  assert.equal(result.source, "database");
  assert.match(fixture.queries[0].sql, /shell_words/);
  assert.match(fixture.queries[0].sql, /shell_word_id/);
  assert.match(fixture.queries[0].sql, /inner_word_id/);
  assert.match(fixture.queries[0].sql, /depth/);
  assert.match(fixture.queries[0].sql, /REGEXP/);
  assert.doesNotMatch(fixture.queries[0].sql, /frequency_level|word_length/);
  assert.ok(fixture.queries[0].params.includes(1));
  assert.ok(fixture.queries[0].params.includes("B"));
});

test("MySQL cursors are bound to direction, boundaries, and shell depth", async () => {
  const first = createFixture([
    [
      ["BRAND", "RAN"],
      ["BRIDE", "RID"],
    ],
  ]);
  const page = await first.source.search({ direction: "shell", first: "B" }, 1);
  assert.equal(page.page.hasMore, true);

  const next = createFixture([[["BRIDE", "RID"]]]);
  await next.source.search({ direction: "shell", first: "B" }, 1, page.page.nextCursor!);
  assert.ok(next.queries[0].params.includes("BRAND"));

  const changed = createFixture([[]]);
  await assert.rejects(
    changed.source.search({ direction: "inner", first: "B" }, 1, page.page.nextCursor!),
  );
  assert.equal(changed.queries.length, 0);
});

test("Shell Explore pages are capped at 100 results", async () => {
  const fixture = createFixture([[["BRAND", "RAN"]]]);
  const result = await fixture.source.search({ direction: "shell" }, 150);

  assert.equal(result.page.limit, 100);
});

test("MySQL checks distinguish dictionary words from missing shell relationships", async () => {
  const related = createFixture([[["BRAND"]], [["RAN"]]]);
  const result = await related.source.check({ direction: "shell", word: "brand" });
  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.relationshipMatch, true);
  assert.equal(result.innerWord, "RAN");

  const noRelation = createFixture([[["PAINTING"]], []]);
  const missing = await noRelation.source.check({ direction: "shell", word: "PAINTING" });
  assert.equal(missing.dictionaryMatch, true);
  assert.equal(missing.relationshipMatch, false);
  assert.equal(missing.innerWord, null);

  const notInDictionary = createFixture([[]]);
  const unknown = await notInDictionary.source.check({ direction: "shell", word: "ZZZ" });
  assert.equal(unknown.dictionaryMatch, false);
  assert.equal(unknown.relationshipMatch, false);
  assert.equal(notInDictionary.queries.length, 1);
});

test("Deep Shell Words adapter queries depth two and inner searches count linked shells", async () => {
  const deep = createMySqlShellWordExploreSource(
    drizzle(async (sql, params) => {
      if (sql.includes("shell_words")) {
        assert.ok(params.includes(2));
        return { rows: [[3]] };
      }
      return { rows: [["RAN"]] };
    }),
    2,
  );
  const result = await deep.check({ direction: "inner", word: "RAN" });
  assert.equal(result.direction, "inner");
  assert.equal(result.dictionaryMatch, true);
  assert.equal(result.relationshipMatch, true);
  assert.equal(result.linkedShellCount, 3);
});
