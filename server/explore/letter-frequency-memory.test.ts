import assert from "node:assert/strict";
import test from "node:test";
import { letterFrequencyMemorySource } from "./letter-frequency-memory";

test("preview Browse and Host use the same exact and minimum frequency rules", async () => {
  const exact = await letterFrequencyMemorySource.search(
    [{ letter: "E", count: 2 }],
    "exact",
    100,
  );
  assert.ok(exact.items.some(({ word }) => word === "LETTER"));
  assert.ok(exact.items.every(({ word }) => [...word].filter((letter) => letter === "E").length === 2));

  const hostMatch = await letterFrequencyMemorySource.check(
    "letter",
    [{ letter: "E", count: 2 }],
    "exact",
  );
  const tooFew = await letterFrequencyMemorySource.check(
    "tree",
    [{ letter: "E", count: 3 }],
    "minimum",
  );
  assert.deepEqual(hostMatch, {
    word: "LETTER",
    dictionaryMatch: true,
    constraintMatch: true,
    source: "preview",
  });
  assert.equal(tooFew.dictionaryMatch, true);
  assert.equal(tooFew.constraintMatch, false);
});

test("preview Multi-Letter matching requires every letter count", async () => {
  const constraints = [
    { letter: "A", count: 2 },
    { letter: "E", count: 1 },
  ];
  const results = await letterFrequencyMemorySource.search(constraints, "exact", 100);
  assert.ok(results.items.some(({ word }) => word === "ABBREVIATION"));
  assert.ok(results.items.every(({ word }) =>
    [...word].filter((letter) => letter === "A").length === 2
      && [...word].filter((letter) => letter === "E").length === 1,
  ));

  const failed = await letterFrequencyMemorySource.check("LETTER", constraints, "exact");
  assert.equal(failed.dictionaryMatch, true);
  assert.equal(failed.constraintMatch, false);
});

test("preview results are alphabetic and cursors are scoped to the selected rule", async () => {
  const first = await letterFrequencyMemorySource.search(
    [{ letter: "E", count: 2 }],
    "exact",
    1,
  );
  assert.equal(first.page.hasMore, true);
  const next = await letterFrequencyMemorySource.search(
    [{ letter: "E", count: 2 }],
    "exact",
    1,
    first.page.nextCursor!,
  );
  assert.ok(next.items[0].word > first.items[0].word);

  await assert.rejects(letterFrequencyMemorySource.search(
    [{ letter: "E", count: 3 }],
    "exact",
    1,
    first.page.nextCursor!,
  ));
});
