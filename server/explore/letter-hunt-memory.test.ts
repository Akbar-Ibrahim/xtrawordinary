import assert from "node:assert/strict";
import test from "node:test";
import { letterHuntMemorySource } from "./letter-hunt-memory";

test("preview Letter Hunt results keep repeated-letter and order rules aligned with checks", async () => {
  const unordered = await letterHuntMemorySource.search("TEA", false, 100);
  const ordered = await letterHuntMemorySource.search("TEA", true, 100);

  assert.ok(unordered.items.some(({ word }) => word === "CREATE"));
  assert.ok(ordered.items.some(({ word }) => word === "TREAT"));
  assert.ok(!ordered.items.some(({ word }) => word === "CREATE"));

  const accepted = await letterHuntMemorySource.check("TREAT", "TEA", true);
  const rejected = await letterHuntMemorySource.check("CREATE", "TEA", true);
  assert.equal(accepted.dictionaryMatch && accepted.constraintMatch, true);
  assert.equal(rejected.dictionaryMatch, true);
  assert.equal(rejected.constraintMatch, false);
});

test("preview Letter Hunt requires duplicate letters and paginates alphabetically", async () => {
  const results = await letterHuntMemorySource.search("LL", false, 100);
  assert.ok(results.items.some(({ word }) => word === "LULL"));
  assert.ok(results.items.every(({ word }) => word === word.toUpperCase()));
  assert.deepEqual(results.items.map(({ word }) => word), [...results.items.map(({ word }) => word)].sort());
});
