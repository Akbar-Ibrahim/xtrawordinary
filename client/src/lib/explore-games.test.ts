import assert from "node:assert/strict";
import test from "node:test";
import { EXPLORE_GAMES, getExploreGame } from "./explore-games";

test("the Explore directory contains a unique route for every eligible game", () => {
  const gameEntries = EXPLORE_GAMES.filter((entry) => entry.gameSlug);
  const standaloneTools = EXPLORE_GAMES.filter((entry) => !entry.gameSlug);
  assert.equal(gameEntries.length, 14);
  assert.equal(standaloneTools.length, 3);
  assert.equal(new Set(gameEntries.map(({ gameSlug }) => gameSlug)).size, gameEntries.length);
  assert.equal(new Set(EXPLORE_GAMES.map(({ path }) => path)).size, EXPLORE_GAMES.length);

  for (const game of gameEntries) {
    assert.equal(getExploreGame(game.gameSlug!)?.path, game.path);
  }
});

test("games without an Explore experience are not included", () => {
  assert.equal(getExploreGame("letter-pool"), undefined);
});

test("standalone sequence tools are listed without being attached to a game", () => {
  const tools = EXPLORE_GAMES.filter(({ path }) => path.includes("search"));
  assert.deepEqual(tools.map(({ title, path }) => [title, path]), [
    ["Prefix Search", "/explore/prefix-search"],
    ["Suffix Search", "/explore/suffix-search"],
    ["Contains Search", "/explore/contains-search"],
  ]);
  assert.ok(tools.every(({ gameSlug }) => gameSlug === undefined));
});
