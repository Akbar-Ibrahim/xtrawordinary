import assert from "node:assert/strict";
import test from "node:test";
import { isCompleteTargetSet } from "./fixed-answer-outcome";

test("a fixed-answer goal is complete only when every target is solved", () => {
  assert.equal(isCompleteTargetSet(0, 3), false);
  assert.equal(isCompleteTargetSet(2, 3), false);
  assert.equal(isCompleteTargetSet(3, 3), true);
  assert.equal(isCompleteTargetSet(4, 3), true);
  assert.equal(isCompleteTargetSet(0, 0), false);
});
