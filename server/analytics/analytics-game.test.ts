import assert from "node:assert/strict";
import test from "node:test";
import type { Game } from "@shared/schema";
import { findAnalyticsGame } from "./analytics-game";

const games = [
  {
    id: 1,
    slug: "word-length",
    name: "Length Challenge",
    description: "",
    longDescription: "",
    rules: [],
    difficulty: "hard",
    estimatedTime: "",
    icon: "",
    color: "",
    playCount: 0,
    modes: [{ slug: "word-length-1", label: "Challenge 1" }],
  },
] satisfies Game[];

test("analytics recognizes a declared variant and resolves it to its parent game", () => {
  assert.equal(findAnalyticsGame(games, "word-length-1")?.slug, "word-length");
});

test("analytics recognizes canonical game slugs", () => {
  assert.equal(findAnalyticsGame(games, "word-length")?.slug, "word-length");
});

test("analytics does not recognize undeclared variant slugs", () => {
  assert.equal(findAnalyticsGame(games, "word-length-unknown"), undefined);
});
