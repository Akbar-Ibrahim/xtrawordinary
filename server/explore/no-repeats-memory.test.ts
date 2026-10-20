import assert from "node:assert/strict";
import test from "node:test";
import { noRepeatsMemorySource } from "./no-repeats-memory";

test("preview Browse lists only alphabetic isograms and includes short words", async () => {
  const result = await noRepeatsMemorySource.search({ requiredLetters: "" }, 100);
  const words = result.items.map(({ word }) => word);
  assert.ok(words.includes("A"));
  assert.ok(words.includes("AT"));
  assert.ok(words.includes("CAT"));
  assert.ok(!words.includes("LETTER"));
  assert.ok(words.every((word) => new Set(word).size === word.length));
  assert.deepEqual(words, [...words].sort((left, right) => left.localeCompare(right, "en")));
  assert.equal(result.source, "preview");
});

test("preview required-letter and length filters match Host checks", async () => {
  const filters = { length: 3, requiredLetters: "TC" };
  const result = await noRepeatsMemorySource.search(filters, 100);
  assert.deepEqual(result.items.map(({ word }) => word), ["ACT", "CAT"]);

  const accepted = await noRepeatsMemorySource.check("cat", filters);
  const wrongLength = await noRepeatsMemorySource.check("CLOUD", filters);
  assert.deepEqual(accepted, {
    word: "CAT",
    dictionaryMatch: true,
    constraintMatch: true,
    source: "preview",
  });
  assert.equal(wrongLength.dictionaryMatch, true);
  assert.equal(wrongLength.constraintMatch, false);
});

test("preview Host distinguishes unknown words from dictionary words with repeated letters", async () => {
  const repeated = await noRepeatsMemorySource.check("noon", { requiredLetters: "" });
  const unknown = await noRepeatsMemorySource.check("UNLISTED", { requiredLetters: "" });
  assert.equal(repeated.dictionaryMatch, true);
  assert.equal(repeated.constraintMatch, false);
  assert.equal(unknown.dictionaryMatch, false);
});

test("preview pagination is alphabetic and scoped to the selected filters", async () => {
  const first = await noRepeatsMemorySource.search({ requiredLetters: "" }, 1);
  assert.equal(first.page.hasMore, true);
  const next = await noRepeatsMemorySource.search(
    { requiredLetters: "" },
    1,
    first.page.nextCursor!,
  );
  assert.ok(next.items[0].word > first.items[0].word);
  await assert.rejects(noRepeatsMemorySource.search(
    { length: 3, requiredLetters: "" },
    1,
    first.page.nextCursor!,
  ));
});
