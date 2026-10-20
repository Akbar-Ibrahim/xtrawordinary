import assert from "node:assert/strict";
import test from "node:test";
import { meetsLetterPositionConstraint } from "./letter-constraint-utils";

test("Letter Position requires the selected letter at the 1-based position", () => {
  assert.equal(meetsLetterPositionConstraint("letter", "e", 2), true);
  assert.equal(meetsLetterPositionConstraint("letter", "T", 2), false);
  assert.equal(meetsLetterPositionConstraint("ear", "R", 2), false);
});

test("Letter Position rejects invalid positions and multi-letter requirements", () => {
  assert.equal(meetsLetterPositionConstraint("letter", "E", 0), false);
  assert.equal(meetsLetterPositionConstraint("letter", "E", 9), false);
  assert.equal(meetsLetterPositionConstraint("letter", "EE", 2), false);
});
