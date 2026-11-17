import assert from "node:assert/strict";
import test from "node:test";
import { wordFusionMemorySource } from "./word-fusion-memory";
import {
  countWordFusionLetters,
  createWordFusionExplorePage,
} from "./word-fusion-utils";
import { WordFusionComponentsNotFoundError } from "./word-fusion-types";

test("pools repeated letters from all component words", () => {
  assert.deepEqual(
    [...countWordFusionLetters(["BOOK", "NOTE"])],
    [["B", 1], ["O", 3], ["K", 1], ["N", 1], ["T", 1], ["E", 1]],
  );
});

test("preview finds dictionary targets made from all pooled letters", async () => {
  const result = await wordFusionMemorySource.search(["he", "art"], 50);

  assert.equal(result.source, "preview");
  assert.deepEqual(result.items.map(({ word }) => word), ["EARTH", "HATER", "HEART", "RATHE"]);
});

test("preview returns an empty result rather than a partial letter match", async () => {
  const result = await wordFusionMemorySource.search(["BOOK", "NOTE"], 50);

  assert.deepEqual(result.items.map(({ word }) => word), ["NOTEBOOK"]);
});

test("preview distinguishes unknown component words from zero matching targets", async () => {
  await assert.rejects(
    () => wordFusionMemorySource.search(["ACT", "UNKNOWN"], 50),
    WordFusionComponentsNotFoundError,
  );
});

test("paginates matches and keeps the cursor valid if component order changes", () => {
  const first = createWordFusionExplorePage(
    ["HE", "ART"],
    ["HEART", "EARTH", "HATER", "RATHE"],
    2,
    undefined,
    "preview",
  );
  assert.equal(first.page.hasMore, true);
  assert.deepEqual(first.items.map(({ word }) => word), ["EARTH", "HATER"]);

  const next = createWordFusionExplorePage(
    ["ART", "HE"],
    ["HEART", "EARTH", "HATER", "RATHE"],
    2,
    first.page.nextCursor ?? undefined,
    "preview",
  );
  assert.deepEqual(next.items.map(({ word }) => word), ["HEART", "RATHE"]);
});

test("rejects component words shorter than two letters", () => {
  assert.throws(
    () => createWordFusionExplorePage(["A", "ART"], ["TAR"], 10, undefined, "preview"),
    /at least two letters/,
  );
});
