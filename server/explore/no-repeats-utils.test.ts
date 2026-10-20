import assert from "node:assert/strict";
import test from "node:test";
import {
  hasUniqueLetters,
  matchesNoRepeatsFilters,
  normalizeRequiredLetters,
} from "./no-repeats-utils";

test("isogram matching is case-insensitive and includes optional filters", () => {
  assert.equal(hasUniqueLetters("Paint"), true);
  assert.equal(hasUniqueLetters("letter"), false);
  assert.equal(
    matchesNoRepeatsFilters("PAINT", { length: 5, requiredLetters: "TP" }),
    true,
  );
  assert.equal(
    matchesNoRepeatsFilters("PAINT", { length: 4, requiredLetters: "P" }),
    false,
  );
  assert.equal(
    matchesNoRepeatsFilters("PAINT", { requiredLetters: "TP" }),
    true,
  );
});

test("required letters normalize without discarding duplicates", () => {
  assert.equal(normalizeRequiredLetters("tac"), "ACT");
  assert.equal(normalizeRequiredLetters("TTA"), "ATT");
});
