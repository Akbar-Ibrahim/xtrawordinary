import assert from "node:assert/strict";
import test from "node:test";
import { countLetters } from "./unscramble-utils";
import { unscrambleMemorySource } from "./unscramble-memory";

test("memory preview samples are scrambled from its small dictionary fixture", async () => {
  const examples = await unscrambleMemorySource.getExamples(6);
  assert.equal(examples.source, "preview");
  assert.equal(examples.items.length, 6);

  for (const scrambled of examples.items) {
    const result = await unscrambleMemorySource.solve(scrambled, 100);
    assert.ok(result.items.length > 0, `${scrambled} should resolve to a preview dictionary word`);
    assert.ok(result.items.every((word) =>
      JSON.stringify([...countLetters(word)].sort()) === JSON.stringify([...countLetters(scrambled)].sort()),
    ));
  }
});

test("memory preview returns only exact letter-count matches", async () => {
  const valid = await unscrambleMemorySource.solve("NITSEL", 100);
  assert.ok(valid.items.includes("LISTEN"));
  assert.ok(valid.items.includes("SILENT"));
  assert.equal(valid.source, "preview");

  const invalid = await unscrambleMemorySource.solve("NITSELX", 100);
  assert.deepEqual(invalid.items, []);
});

test("memory result pagination is alphabetical and scoped to the submitted letters", async () => {
  const first = await unscrambleMemorySource.solve("NITSEL", 1);
  assert.ok(first.nextCursor);
  const next = await unscrambleMemorySource.solve("NITSEL", 1, first.nextCursor!);
  assert.notEqual(first.items[0], next.items[0]);
  assert.ok(first.items[0].localeCompare(next.items[0], "en") < 0);
  await assert.rejects(() => unscrambleMemorySource.solve("SPEAR", 1, first.nextCursor!));
});
