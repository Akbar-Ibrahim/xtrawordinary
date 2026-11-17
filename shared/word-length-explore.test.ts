import assert from "node:assert/strict";
import test from "node:test";
import {
  createWordLengthExploreCheck,
  createWordLengthExploreItem,
  matchesWordLengthPattern,
} from "./word-length-explore";

test("Length Challenge pattern matching follows all five variation rules", () => {
  assert.equal(matchesWordLengthPattern("HEART", { variation: 1, length: 5 }), true);
  assert.equal(matchesWordLengthPattern("HEART", { variation: 2, length: 5, startsWith: "h" }), true);
  assert.equal(matchesWordLengthPattern("HEART", { variation: 3, length: 5, endsWith: "t" }), true);
  assert.equal(
    matchesWordLengthPattern("ECLATS", { variation: 4, length: 6, startsWith: "e", contains: "a" }),
    true,
  );
  assert.equal(
    matchesWordLengthPattern("EUREKA", { variation: 4, length: 6, startsWith: "e", contains: "a" }),
    false,
    "variation 4 does not allow the contained letter only at the last position",
  );
  assert.equal(
    matchesWordLengthPattern("ORANGE", { variation: 5, length: 6, endsWith: "e", contains: "a" }),
    true,
  );
  assert.equal(
    matchesWordLengthPattern("ALIBIE", { variation: 5, length: 6, endsWith: "e", contains: "a" }),
    false,
    "variation 5 does not allow the contained letter only at the first position",
  );
});

test("Explore includes short words but marks them outside normal gameplay length rules", () => {
  assert.deepEqual(createWordLengthExploreItem("an"), {
    word: "AN",
    playableInGame: false,
    gameplayExclusion: "below_minimum_length",
  });
  assert.equal(
    createWordLengthExploreCheck("an", true, { variation: 1, length: 2 }, "preview").constraintMatch,
    true,
  );
});
