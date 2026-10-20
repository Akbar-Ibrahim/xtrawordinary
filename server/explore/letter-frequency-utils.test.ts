import assert from "node:assert/strict";
import test from "node:test";
import {
  countWordLetters,
  matchesFrequencyConstraints,
  normalizeFrequencyConstraints,
} from "./letter-frequency-utils";

test("frequency constraints normalize letters and count repeated characters", () => {
  assert.deepEqual(countWordLetters("Letter"), new Map([
    ["L", 1], ["E", 2], ["T", 2], ["R", 1],
  ]));
  assert.deepEqual(
    normalizeFrequencyConstraints([{ letter: "e", count: 2 }, { letter: "A", count: 1 }]),
    [{ letter: "A", count: 1 }, { letter: "E", count: 2 }],
  );
});

test("exact and minimum frequency rules apply to every selected letter", () => {
  const constraints = [
    { letter: "A", count: 2 },
    { letter: "E", count: 1 },
  ];
  assert.equal(matchesFrequencyConstraints("ABBREVIATION", constraints, "exact"), true);
  assert.equal(matchesFrequencyConstraints("BANANA", [{ letter: "A", count: 2 }], "exact"), false);
  assert.equal(matchesFrequencyConstraints("BANANA", [{ letter: "A", count: 2 }], "minimum"), true);
  assert.equal(matchesFrequencyConstraints("LETTER", constraints, "exact"), false);
});
