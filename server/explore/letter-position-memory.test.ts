import assert from "node:assert/strict";
import test from "node:test";
import { letterPositionMemorySource } from "./letter-position-memory";

test("preview Letter Position matches and checks the same letter-position rule", async () => {
  const page = await letterPositionMemorySource.search("e", 2, 100);
  assert.ok(page.items.some(({ word }) => word === "LETTER"));
  assert.ok(page.items.every(({ word }) => word[1] === "E"));
  assert.equal(page.source, "preview");

  const valid = await letterPositionMemorySource.check("letter", "E", 2);
  const wrongPosition = await letterPositionMemorySource.check("letter", "E", 1);
  const tooShort = await letterPositionMemorySource.check("ace", "A", 4);
  assert.equal(valid.dictionaryMatch && valid.constraintMatch, true);
  assert.equal(wrongPosition.constraintMatch, false);
  assert.equal(tooShort.constraintMatch, false);
});

test("preview Letter Position results are alphabetic and paginate by letter and position", async () => {
  const first = await letterPositionMemorySource.search("A", 2, 1);
  assert.equal(first.items.length, 1);
  assert.equal(first.page.hasMore, true);
  const next = await letterPositionMemorySource.search("A", 2, 1, first.page.nextCursor!);
  assert.ok(next.items[0].word > first.items[0].word);
  await assert.rejects(letterPositionMemorySource.search("A", 3, 1, first.page.nextCursor!));
});
