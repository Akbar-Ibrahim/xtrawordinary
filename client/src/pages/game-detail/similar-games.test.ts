import assert from "node:assert/strict";
import { test } from "node:test";
import type { Game } from "@shared/schema";
import { getRelatedGames } from "./similar-games";

function makeGame(slug: string): Game {
  return {
    id: 1,
    slug,
    name: slug,
    description: "",
    longDescription: "",
    rules: [],
    difficulty: "easy",
    estimatedTime: "",
    icon: "Gamepad2",
    color: "#000000",
    playCount: 0,
  };
}

test("returns curated similar games in editorial order", () => {
  const currentGame = makeGame("anagram-solver");
  const games = [
    currentGame,
    makeGame("word-fusion"),
    makeGame("letter-pool"),
    makeGame("word-scramble"),
  ];

  const result = getRelatedGames(currentGame, games);

  assert.equal(result.heading, "Similar Games");
  assert.deepEqual(result.games.map((game) => game.slug), [
    "word-scramble",
    "letter-pool",
    "word-fusion",
  ]);
});

test("falls back to More Games when no curated matches are available", () => {
  const currentGame = makeGame("word-sweep");
  const games = [currentGame, makeGame("anagram-solver"), makeGame("word-maker")];

  const result = getRelatedGames(currentGame, games);

  assert.equal(result.heading, "More Games");
  assert.deepEqual(result.games.map((game) => game.slug), ["anagram-solver", "word-maker"]);
});

test("saved recommendations override the initial editorial defaults", () => {
  const currentGame = { ...makeGame("anagram-solver"), similarGameSlugs: ["word-maker"] };
  const games = [currentGame, makeGame("word-maker"), makeGame("word-scramble")];

  const result = getRelatedGames(currentGame, games);

  assert.equal(result.heading, "Similar Games");
  assert.deepEqual(result.games.map((game) => game.slug), ["word-maker"]);
});

test("an explicitly empty saved list uses the More Games fallback", () => {
  const currentGame = { ...makeGame("anagram-solver"), similarGameSlugs: [] };
  const games = [currentGame, makeGame("word-maker")];

  const result = getRelatedGames(currentGame, games);

  assert.equal(result.heading, "More Games");
  assert.deepEqual(result.games.map((game) => game.slug), ["word-maker"]);
});

test("returns no recommendations when the catalogue has no other games", () => {
  const currentGame = makeGame("shell-words");
  const games = [currentGame];

  const result = getRelatedGames(currentGame, games);

  assert.equal(result.heading, "More Games");
  assert.deepEqual(result.games, []);
});
