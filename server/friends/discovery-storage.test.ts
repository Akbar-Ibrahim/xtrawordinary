import assert from "node:assert/strict";
import test from "node:test";
import { MemStorage } from "../mem-storage";

async function createUser(storage: MemStorage, suffix: string) {
  return storage.createUser({
    email: `friend-discovery-${suffix}@example.com`,
    name: `User ${suffix}`,
    username: `discovery_${suffix}`,
    usernameNormalized: `discovery_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
}

async function recordPlay(storage: MemStorage, userId: number, gameSlug: string) {
  await storage.saveUserGameStats({
    userId,
    gameSlug,
    bestScore: 1,
    gamesPlayed: 1,
    gamesWon: 0,
    wordsFound: 0,
    lastPlayedAt: new Date(0).toISOString(),
  });
}

test("in-memory friend discovery counts mutuals and recommends users with shared games", async () => {
  const storage = new MemStorage();
  const viewer = await createUser(storage, "viewer");
  const mutual = await createUser(storage, "mutual");
  const strongest = await createUser(storage, "strongest");
  const second = await createUser(storage, "second");
  const pending = await createUser(storage, "pending");
  const unrelated = await createUser(storage, "unrelated");

  const viewerToMutual = await storage.sendFriendRequest(viewer.id, mutual.id);
  await storage.acceptFriendRequest(viewerToMutual.id);
  const mutualToStrongest = await storage.sendFriendRequest(mutual.id, strongest.id);
  await storage.acceptFriendRequest(mutualToStrongest.id);
  await storage.sendFriendRequest(viewer.id, pending.id);

  await Promise.all([
    recordPlay(storage, viewer.id, "word-maker"),
    recordPlay(storage, viewer.id, "letter-hunt"),
    recordPlay(storage, strongest.id, "word-maker"),
    recordPlay(storage, strongest.id, "letter-hunt"),
    recordPlay(storage, second.id, "word-maker"),
    recordPlay(storage, pending.id, "word-maker"),
    recordPlay(storage, unrelated.id, "letter-dodge"),
  ]);

  const mutualCounts = await storage.getMutualFriendCounts(viewer.id, [strongest.id, second.id]);
  assert.deepEqual(mutualCounts, { [strongest.id]: 1, [second.id]: 0 });

  const suggestions = await storage.getFriendSuggestions(viewer.id);
  assert.deepEqual(suggestions.map((suggestion) => suggestion.id), [strongest.id, second.id]);
  assert.equal(suggestions[0].mutualFriendsCount, 1);
  assert.deepEqual(suggestions[0].sharedGameSlugs, ["letter-hunt", "word-maker"]);
  assert.equal(suggestions.some((suggestion) => suggestion.id === pending.id), false);
  assert.equal(suggestions.some((suggestion) => suggestion.id === unrelated.id), false);
});
