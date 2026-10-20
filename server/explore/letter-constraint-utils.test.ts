import assert from "node:assert/strict";
import test from "node:test";
import { meetsLetterDodgeConstraint, meetsLetterHuntConstraint, normalizeLetters } from "./letter-constraint-utils";

test("Letter Hunt counts repeated required letters at least as many times as entered", () => {
  assert.equal(meetsLetterHuntConstraint("LETTER", "LL", false), false);
  assert.equal(meetsLetterHuntConstraint("LULL", "LL", false), true);
  assert.equal(meetsLetterHuntConstraint("letter", "TT", false), true);
});

test("Letter Hunt ordered mode requires the submitted sequence as a subsequence", () => {
  assert.equal(meetsLetterHuntConstraint("TREAT", "TEA", true), true);
  assert.equal(meetsLetterHuntConstraint("CREATE", "TEA", true), false);
  assert.equal(meetsLetterHuntConstraint("CREATE", "TEA", false), true);
});

test("Letter Dodge rejects any forbidden letter but accepts words without one", () => {
  assert.equal(meetsLetterDodgeConstraint("BOLD", "AE"), true);
  assert.equal(meetsLetterDodgeConstraint("CAT", "AE"), false);
  assert.equal(meetsLetterDodgeConstraint("sun", "ae"), true);
});

test("letter normalization removes non-letters and uppercases", () => {
  assert.equal(normalizeLetters(" T-ea! "), "TEA");
});
