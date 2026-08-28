import test from "node:test";
import assert from "node:assert/strict";
import { wordFusionPuzzlesSchema } from "@shared/schema";
import { wordFusionPuzzles } from "./game-data";
import { MemStorage } from "./mem-storage";

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