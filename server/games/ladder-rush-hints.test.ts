import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { registerGamesRoutes } from "../routes/games.routes";

test("Ladder Rush double-swap hints change exactly two letters and skip used words", async () => {
  const app = express();
  app.use(express.json());
  registerGamesRoutes(app);
  const server = app.listen(0);
  const originalRandom = Math.random;

  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    Math.random = () => 0;

    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/ladder-rush/hint`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentWord: "ABLE", usedWords: ["ACHE"], doubleSwap: true }),
    });

    assert.equal(response.status, 200);
    const { word } = await response.json() as { word: string };
    assert.equal(word, word.toUpperCase());
    assert.ok(!["ABLE", "ACHE"].includes(word), "hint must not repeat the current or a used word");
    assert.equal(
      [..."ABLE"].filter((letter, index) => letter !== word[index]).length,
      2,
      `expected ${word} to differ from ABLE in exactly two positions`,
    );
  } finally {
    Math.random = originalRandom;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
