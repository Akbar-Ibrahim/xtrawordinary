import test from "node:test";
import assert from "node:assert/strict";
import {
  getEffectiveWordFusionTarget,
  isCurrentWordFusionSubmission,
  wordFusionPuzzlesSchema,
} from "@shared/schema";
import { wordFusionPuzzles } from "../game-data";
import { MemStorage } from "../mem-storage";

test("fallback Word Fusion puzzles satisfy the public contract", () => {
  const parsed = wordFusionPuzzlesSchema.parse(wordFusionPuzzles);
  assert.ok(parsed.length >= 5);
  for (const puzzle of parsed) {
    assert.ok(puzzle.components.every(component => component.length >= 3));
    assert.equal(
      new Set(puzzle.components.flatMap(component => component.split(""))).size > 0,
      true,
    );
  }
});

test("Word Fusion fallback validation accepts the base answer and rejects other words", async () => {
  const storage = new MemStorage();
  const valid = await storage.validateWordFusionAnswer(-1, "notebook");
  assert.deepEqual(valid, {
    valid: true,
    exact: true,
    canonicalWord: "NOTEBOOK",
    points: 10,
  });

  assert.deepEqual(
    await storage.validateWordFusionAnswer(-1, "caution"),
    { valid: false, exact: false, canonicalWord: undefined, points: undefined },
  );
});

test("Word Fusion is available in the game catalogue", async () => {
  const storage = new MemStorage();
  const game = await storage.getGameBySlug("word-fusion");
  assert.equal(game?.name, "Word Fusion");
  assert.equal(game?.wordTarget, 5);
});

test("Word Fusion uses its configured round target up to the available puzzle count", () => {
  assert.equal(getEffectiveWordFusionTarget(3, 8), 3);
  assert.equal(getEffectiveWordFusionTarget(10, 8), 8);
  assert.equal(getEffectiveWordFusionTarget(undefined, 8), 5);
});

test("Word Fusion ignores validation responses from a previous run", () => {
  const submitted = { run: 1, request: 1, round: 0, combinationId: 10 };
  assert.equal(
    isCurrentWordFusionSubmission(true, submitted, {
      run: 2,
      request: 2,
      round: 0,
      combinationId: 10,
    }),
    false,
  );
  assert.equal(isCurrentWordFusionSubmission(true, submitted, submitted), true);
});

test("Word Fusion ignores an older validation request in the current run", () => {
  assert.equal(
    isCurrentWordFusionSubmission(
      true,
      { run: 2, request: 3, round: 0, combinationId: 10 },
      { run: 2, request: 4, round: 0, combinationId: 10 },
    ),
    false,
  );
});