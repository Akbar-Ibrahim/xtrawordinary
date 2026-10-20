import assert from "node:assert/strict";
import test from "node:test";
import { letterBalanceMemorySource } from "./letter-balance-memory";

test("preview Browse is alphabetic and includes one- and two-letter words", async () => {
  const result = await letterBalanceMemorySource.search({
    category: "vowel_count",
    count: 1,
  }, 100);
  const words = result.items.map(({ word }) => word);

  assert.equal(result.source, "preview");
  assert.ok(words.includes("A"));
  assert.ok(words.includes("AN"));
  assert.deepEqual(words, [...words].sort((first, second) => first.localeCompare(second)));
});

test("preview Browse applies positional, length, and locked-balance filters", async () => {
  const edgeWords = await letterBalanceMemorySource.search({
    category: "start_end_vowel",
    length: 3,
  }, 100);
  assert.deepEqual(edgeWords.items.map(({ word }) => word), ["ACE", "AGE", "ATE"]);

  const lockedWords = await letterBalanceMemorySource.search({
    category: "locked_balance",
    length: 4,
    consonantCount: 2,
  }, 100);
  assert.deepEqual(lockedWords.items.map(({ word }) => word), ["BOOK", "TREE", "YEAH"]);
});

test("preview Host uses dictionary membership and the same rule as Browse", async () => {
  const accepted = await letterBalanceMemorySource.check("sky", {
    category: "consonant_count",
    count: 3,
  });
  assert.deepEqual(accepted, {
    word: "SKY",
    dictionaryMatch: true,
    constraintMatch: true,
    source: "preview",
  });

  const rejected = await letterBalanceMemorySource.check("CAT", {
    category: "vowel_count",
    count: 2,
  });
  assert.equal(rejected.dictionaryMatch, true);
  assert.equal(rejected.constraintMatch, false);

  const unknown = await letterBalanceMemorySource.check("NOTINPREVIEW", {
    category: "vowel_count",
    count: 1,
  });
  assert.equal(unknown.dictionaryMatch, false);
  assert.equal(unknown.constraintMatch, false);
});

test("preview pagination is alphabetic and rejects a cursor from other filters", async () => {
  const firstPage = await letterBalanceMemorySource.search({
    category: "vowel_count",
    count: 1,
  }, 2);
  assert.equal(firstPage.page.hasMore, true);

  const secondPage = await letterBalanceMemorySource.search({
    category: "vowel_count",
    count: 1,
  }, 2, firstPage.page.nextCursor!);
  assert.ok(secondPage.items[0].word > firstPage.items.at(-1)!.word);

  await assert.rejects(letterBalanceMemorySource.search({
    category: "consonant_count",
    count: 1,
  }, 2, firstPage.page.nextCursor!));
});
