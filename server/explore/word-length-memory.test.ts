import assert from "node:assert/strict";
import test from "node:test";
import { wordLengthMemorySource } from "./word-length-memory";

test("preview Length Challenge results are alphabetic and continue from a scoped cursor", async () => {
  const pattern = { variation: 1 as const, length: 3 };
  const first = await wordLengthMemorySource.search(pattern, 2);
  assert.deepEqual(first.items.map(({ word }) => word), ["ACE", "ACT"]);
  assert.equal(first.page.hasMore, true);
  assert.ok(first.page.nextCursor);

  const next = await wordLengthMemorySource.search(pattern, 2, first.page.nextCursor!);
  assert.deepEqual(next.items.map(({ word }) => word), ["ADD", "AGE"]);

  await assert.rejects(
    wordLengthMemorySource.search({ variation: 1, length: 5 }, 2, first.page.nextCursor!),
  );
});

test("preview Check uses the same pattern rules as Browse and notes short words", async () => {
  const shortResult = await wordLengthMemorySource.check("an", { variation: 1, length: 2 });
  assert.equal(shortResult.dictionaryMatch, true);
  assert.equal(shortResult.constraintMatch, true);
  assert.equal(shortResult.playableInGame, false);
  assert.equal(shortResult.gameplayExclusion, "below_minimum_length");

  const mismatch = await wordLengthMemorySource.check("DOG", { variation: 1, length: 5 });
  assert.equal(mismatch.dictionaryMatch, true);
  assert.equal(mismatch.constraintMatch, false);
});
