import assert from "node:assert/strict";
import test from "node:test";
import {
  createLetterSequenceExplorePage,
  wordMatchesLetterSequence,
} from "./letter-sequence-utils";

test("prefix and suffix matching require the exact sequence at the requested edge", () => {
  assert.equal(wordMatchesLetterSequence("BRIGHT", "bri", "prefix"), true);
  assert.equal(wordMatchesLetterSequence("BRIGHT", "rig", "prefix"), false);
  assert.equal(wordMatchesLetterSequence("ACTION", "ion", "suffix"), true);
  assert.equal(wordMatchesLetterSequence("ACTION", "act", "suffix"), false);
});

test("contains matching requires an internal occurrence and excludes edge matches", () => {
  assert.equal(wordMatchesLetterSequence("CARTON", "art", "contains"), true);
  assert.equal(wordMatchesLetterSequence("ARTFUL", "art", "contains"), false);
  assert.equal(wordMatchesLetterSequence("HEART", "art", "contains"), false);
  assert.equal(wordMatchesLetterSequence("ARTXARTY", "art", "contains"), false);
  assert.equal(wordMatchesLetterSequence("XARTYARTZ", "art", "contains"), true);
});

test("preview pages are alphabetical and cursor-scoped by tool and sequence", async () => {
  const words = ["CARTON", "CHARTS", "CART", "ARTFUL", "HEART"];
  const first = createLetterSequenceExplorePage("contains", "art", words, 1);
  assert.deepEqual(first.items.map(({ word }) => word), ["CARTON"]);
  assert.equal(first.page.hasMore, true);

  const next = createLetterSequenceExplorePage(
    "contains",
    "ART",
    words,
    1,
    first.page.nextCursor ?? undefined,
  );
  assert.deepEqual(next.items.map(({ word }) => word), ["CHARTS"]);

  assert.throws(
    () => createLetterSequenceExplorePage("prefix", "ART", words, 1, first.page.nextCursor ?? undefined),
  );
});

test("preview applies the selected word length and scopes cursors to it", () => {
  const words = ["BRIGHT", "BRICK", "BRIAR"];
  const first = createLetterSequenceExplorePage("prefix", "BRI", words, 1, undefined, 5);

  assert.equal(first.length, 5);
  assert.deepEqual(first.items.map(({ word }) => word), ["BRIAR"]);
  assert.equal(first.page.hasMore, true);

  const next = createLetterSequenceExplorePage(
    "prefix",
    "BRI",
    words,
    1,
    first.page.nextCursor ?? undefined,
    5,
  );
  assert.deepEqual(next.items.map(({ word }) => word), ["BRICK"]);

  assert.throws(
    () => createLetterSequenceExplorePage(
      "prefix",
      "BRI",
      words,
      1,
      first.page.nextCursor ?? undefined,
      6,
    ),
  );
});

test("rejects sequence word-length filters above the Explore limit", () => {
  assert.throws(
    () => createLetterSequenceExplorePage("prefix", "BRI", ["BRIGHT"], 20, undefined, 21),
    /between 1 and 20/,
  );
});
