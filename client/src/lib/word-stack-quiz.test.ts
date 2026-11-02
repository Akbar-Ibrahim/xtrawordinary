import assert from "node:assert/strict";
import test from "node:test";
import { createWordStackQuizPlan } from "./word-stack-quiz";
import { getVariantSummary } from "./variant-summary";

const puzzles = ["PERSONAL", "STARTING", "STRANGER", "CREATING", "PLEASANT"].map((targetWord) => ({ targetWord }));

test("Word Stack quiz seed gives participants the same mode and puzzle sequence", () => {
  const first = createWordStackQuizPlan(puzzles, 148);
  const second = createWordStackQuizPlan(puzzles, 148);

  assert.equal(first.challengeType, second.challengeType);
  assert.deepEqual(first.orderedPuzzles, second.orderedPuzzles);
});

test("a chosen Word Stack mode keeps the same seeded puzzle order", () => {
  const defaultPlan = createWordStackQuizPlan(puzzles, 148);
  const buildUpPlan = createWordStackQuizPlan(puzzles, 148, "build-up");
  const breakDownPlan = createWordStackQuizPlan(puzzles, 148, "break-down");

  assert.equal(buildUpPlan.challengeType, "build-up");
  assert.equal(breakDownPlan.challengeType, "break-down");
  assert.deepEqual(buildUpPlan.orderedPuzzles, defaultPlan.orderedPuzzles);
  assert.deepEqual(breakDownPlan.orderedPuzzles, defaultPlan.orderedPuzzles);
});

test("selected Word Stack lengths use the same seeded puzzle prefix", () => {
  const puzzlePool = Array.from({ length: 12 }, (_, index) => ({ targetWord: `WORD${index}` }));
  const fullPlan = createWordStackQuizPlan(puzzlePool, 148);
  const shortPlan = createWordStackQuizPlan(puzzlePool, 148, undefined, "short");
  const mediumPlan = createWordStackQuizPlan(puzzlePool, 148, undefined, "medium");

  assert.equal(shortPlan.orderedPuzzles.length, 5);
  assert.equal(mediumPlan.orderedPuzzles.length, 10);
  assert.deepEqual(shortPlan.orderedPuzzles, fullPlan.orderedPuzzles.slice(0, 5));
  assert.deepEqual(mediumPlan.orderedPuzzles, fullPlan.orderedPuzzles.slice(0, 10));
  assert.deepEqual(
    createWordStackQuizPlan(puzzles, 148, undefined, "medium").orderedPuzzles,
    createWordStackQuizPlan(puzzles, 148).orderedPuzzles,
  );
});

test("Word Stack plan defaults to the complete available puzzle pool", () => {
  assert.deepEqual(
    createWordStackQuizPlan(puzzles, 148).orderedPuzzles,
    createWordStackQuizPlan(puzzles, 148, undefined, "full").orderedPuzzles,
  );
});

test("Word Stack quiz summaries show the selected puzzle length", () => {
  assert.match(getVariantSummary("word-stack", 148, { puzzleCount: "short" }) ?? "", /Short · 5 puzzles/);
  assert.match(getVariantSummary("word-stack", 148, { puzzleCount: "medium" }) ?? "", /Medium · 10 puzzles/);
  assert.match(getVariantSummary("word-stack", 148, { puzzleCount: "full" }) ?? "", /Full puzzle set/);
});
