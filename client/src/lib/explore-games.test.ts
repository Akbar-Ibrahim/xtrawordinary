import assert from "node:assert/strict";
import test from "node:test";
import { EXPLORE_GAMES, getExploreGame } from "./explore-games";

test("the Explore directory contains a unique route for every eligible game", () => {
  assert.equal(EXPLORE_GAMES.length, 9);
  assert.equal(new Set(EXPLORE_GAMES.map(({ gameSlug }) => gameSlug)).size, EXPLORE_GAMES.length);
  assert.equal(new Set(EXPLORE_GAMES.map(({ path }) => path)).size, EXPLORE_GAMES.length);

  for (const game of EXPLORE_GAMES) {
    assert.equal(getExploreGame(game.gameSlug)?.path, game.path);
  }
});

test("games without an Explore experience are not included", () => {
  assert.equal(getExploreGame("letter-pool"), undefined);
});
