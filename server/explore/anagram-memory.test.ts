import assert from "node:assert/strict";
import test from "node:test";
import { anagramMemorySource } from "./anagram-memory";
import { anagramExplorePreviewRows } from "./anagram-preview-data";

test("preview bases have alphabetized answers and Host accepts exactly those answers", async () => {
  const bases = await anagramMemorySource.searchBaseWords("", 100);
  assert.equal(bases.source, "preview");
  assert.ok(bases.items.length > 0);

  for (const { baseWord } of bases.items) {
    const results = await anagramMemorySource.getWords(baseWord.toLowerCase(), 100);
    const answers = results.items.map(({ word }) => word);
    assert.deepEqual(answers, [...answers].sort((a, b) => a.localeCompare(b, "en")));
    for (const answer of answers) {
      assert.deepEqual(
        await anagramMemorySource.checkAnswer(baseWord.toLowerCase(), answer.toLowerCase()),
        { valid: true, source: "preview" },
      );
    }
  }
});

test("preview supports short words without changing regular game fixtures", async () => {
  const result = await anagramMemorySource.getWords("no", 100);
  assert.deepEqual(result.items.map(({ word }) => word), ["ON"]);
  assert.deepEqual(await anagramMemorySource.checkAnswer("NO", "on"), {
    valid: true,
    source: "preview",
  });
  assert.ok(!anagramExplorePreviewRows.slice(0, -1).some(({ original }) => original === "NO"));
});

test("preview rejects unlinked answers and paginates base-word search", async () => {
  assert.equal((await anagramMemorySource.checkAnswer("SPEAR", "HEART")).valid, false);
  const first = await anagramMemorySource.searchBaseWords("", 2);
  assert.equal(first.page.hasMore, true);
  assert.ok(first.page.nextCursor);
  const second = await anagramMemorySource.searchBaseWords("", 2, first.page.nextCursor!);
  assert.notEqual(second.items[0]?.baseWord, first.items[0]?.baseWord);
});

test("random preview selection has linked anagrams", async () => {
  const { baseWord } = await anagramMemorySource.randomBaseWord();
  assert.ok((await anagramMemorySource.getWords(baseWord, 100)).items.length > 0);
});
