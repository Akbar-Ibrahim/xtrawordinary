import assert from "node:assert/strict";
import test from "node:test";
import { MemStorage } from "./mem-storage";
import { DAILY_CHALLENGE_SLUGS, getDailySlugForDate } from "./routes/games.routes";

test("Word Extension is part of the daily challenge rotation", () => {
  assert.ok(DAILY_CHALLENGE_SLUGS.includes("word-extension"));

  const date = "2026-08-25";
  assert.equal(getDailySlugForDate(date), getDailySlugForDate(date));
});

test("seeded Word Extension puzzle order is stable", async () => {
  const storage = new MemStorage();

  const first = await storage.getWordExtensionPuzzles(2, 12345);
  const second = await storage.getWordExtensionPuzzles(2, 12345);

  assert.deepEqual(second, first);
  assert.equal(first.every((puzzle) => puzzle.lettersToAdd === 2), true);
});