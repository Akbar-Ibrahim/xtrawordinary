import assert from "node:assert/strict";
import test from "node:test";
import { getMutualFriendCountsFromEdges, rankFriendSuggestions } from "./discovery";

test("mutual friend counts only include shared accepted friendships", () => {
  const counts = getMutualFriendCountsFromEdges(1, [2, 3, 4], [
    { requesterId: 1, addresseeId: 10, status: "accepted" },
    { requesterId: 10, addresseeId: 2, status: "accepted" },
    { requesterId: 1, addresseeId: 11, status: "accepted" },
    { requesterId: 3, addresseeId: 11, status: "accepted" },
    { requesterId: 1, addresseeId: 12, status: "pending" },
    { requesterId: 12, addresseeId: 2, status: "accepted" },
    { requesterId: 1, addresseeId: 2, status: "accepted" },
  ]);

  assert.deepEqual(counts, { 2: 1, 3: 1, 4: 0 });
});

test("friend suggestions rank shared games, use mutuals as a tie-breaker, and exclude related users", () => {
  const suggestions = rankFriendSuggestions(
    1,
    ["letter-hunt", "word-maker"],
    [
      { id: 2, username: "zara", name: "Zara", avatarUrl: null, playedGameSlugs: ["word-maker"] },
      { id: 3, username: "amy", name: "Amy", avatarUrl: null, playedGameSlugs: ["word-maker", "letter-hunt"] },
      { id: 4, username: "bea", name: "Bea", avatarUrl: null, playedGameSlugs: ["letter-hunt", "other-game"] },
      { id: 1, username: "self", name: "Self", avatarUrl: null, playedGameSlugs: ["letter-hunt", "word-maker"] },
      { id: 6, username: "friend", name: "Friend", avatarUrl: null, playedGameSlugs: ["letter-hunt", "word-maker"] },
    ],
    new Set([6]),
    { 2: 4, 3: 0, 4: 2 },
  );

  assert.deepEqual(suggestions.map(({ id }) => id), [3, 2, 4]);
  assert.deepEqual(suggestions[0].sharedGameSlugs, ["letter-hunt", "word-maker"]);
  assert.deepEqual(suggestions[1].sharedGameSlugs, ["word-maker"]);
  assert.deepEqual(suggestions[2].sharedGameSlugs, ["letter-hunt"]);
});

test("friend suggestions are empty until the viewer has played a game", () => {
  assert.deepEqual(rankFriendSuggestions(
    1,
    [],
    [{ id: 2, username: "player", name: "Player", avatarUrl: null, playedGameSlugs: ["word-maker"] }],
    new Set(),
    {},
  ), []);
});
