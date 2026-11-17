import assert from "node:assert/strict";
import test from "node:test";
import { wordRootsMemorySource } from "./word-roots-memory";
import {
  createWordRootsExplorePage,
  normalizeWordRootsInputs,
  validateWordRootsInputs,
} from "./word-roots-utils";

test("normalizes entered words and finds preview parents linked to every entry", async () => {
  const result = await wordRootsMemorySource.findBaseWords(["fast", "cast"], { limit: 50 });

  assert.equal(result.source, "preview");
  assert.deepEqual(result.inputs, ["FAST", "CAST"]);
  assert.deepEqual(result.items.map(({ word }) => word), ["FANTASTIC"]);
});

test("keeps preview results in alphabetical order", async () => {
  const result = await wordRootsMemorySource.findBaseWords(["rate", "tear"], { limit: 50 });

  assert.deepEqual(result.items.map(({ word }) => word), ["CREATIVE"]);
});

test("filters base words by length in the preview source", async () => {
  const result = await wordRootsMemorySource.findBaseWords(["fast", "cast"], {
    limit: 50,
    length: 9,
  });

  assert.equal(result.length, 9);
  assert.deepEqual(result.items.map(({ word }) => word), ["FANTASTIC"]);
});

test("paginates sorted base words and allows equivalent input order for the cursor", () => {
  const first = createWordRootsExplorePage(
    ["FAST", "CAST"],
    ["ZEBRA", "FANTASTIC", "CREATIVE", "ANOTHER"],
    2,
    undefined,
    "preview",
  );
  const next = createWordRootsExplorePage(
    ["CAST", "FAST"],
    ["ZEBRA", "FANTASTIC", "CREATIVE", "ANOTHER"],
    2,
    first.page.nextCursor ?? undefined,
    "preview",
  );

  assert.deepEqual(first.items.map(({ word }) => word), ["ANOTHER", "CREATIVE"]);
  assert.equal(first.page.hasMore, true);
  assert.deepEqual(next.items.map(({ word }) => word), ["FANTASTIC", "ZEBRA"]);
});

test("does not allow a cursor to continue under a different base-word length", () => {
  const first = createWordRootsExplorePage(
    ["FAST", "CAST"],
    ["FANTASTIC", "SOMETHING"],
    1,
    undefined,
    "preview",
    9,
  );

  assert.throws(
    () => createWordRootsExplorePage(
      ["FAST", "CAST"],
      ["FANTASTIC", "SOMETHING"],
      1,
      first.page.nextCursor ?? undefined,
      "preview",
      null,
    ),
    /cursor/i,
  );
});

test("rejects base-word length filters above the Explore limit", () => {
  assert.throws(
    () => createWordRootsExplorePage(["FAST", "CAST"], ["FANTASTIC"], 50, undefined, "preview", 21),
    /between 1 and 20/,
  );
});

test("normalizes case and rejects duplicate or malformed inputs", () => {
  assert.deepEqual(normalizeWordRootsInputs([" but ", "not"]), ["BUT", "NOT"]);
  assert.doesNotThrow(() => validateWordRootsInputs(["BUT", "NOT"]));
  assert.throws(() => validateWordRootsInputs(["BUT", "BUT"]), /only once/);
  assert.throws(() => validateWordRootsInputs(["BUT", "N0T"]), /A–Z/);
});

test("accepts one-letter entries because Explore follows the dictionary links", () => {
  assert.doesNotThrow(() => validateWordRootsInputs(["A", "I"]));
});
