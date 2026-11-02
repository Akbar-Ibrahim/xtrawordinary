import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import { initStorage } from "../storage";
import { registerAdminRoutes } from "./admin.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getCreatorHandler() {
  let updateCreator: Handler | undefined;
  const app = {
    get() { return this; },
    post() { return this; },
    patch(path: string, ...handlers: Handler[]) {
      if (path === "/api/admin/games/:slug/creator") updateCreator = handlers.at(-1);
      return this;
    },
    delete() { return this; },
  };
  registerAdminRoutes(app as unknown as Express);
  assert.ok(updateCreator);
  return updateCreator;
}

function getSimilarGamesHandler() {
  let updateSimilarGames: Handler | undefined;
  const app = {
    get() { return this; },
    post() { return this; },
    patch(path: string, ...handlers: Handler[]) {
      if (path === "/api/admin/games/:slug/similar-games") updateSimilarGames = handlers.at(-1);
      return this;
    },
    delete() { return this; },
  };
  registerAdminRoutes(app as unknown as Express);
  assert.ok(updateSimilarGames);
  return updateSimilarGames;
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

test("admins can assign or clear a game creator, but cannot assign a missing user", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const creator = await testStorage.createUser({
    email: `game-admin-owner-${suffix}@example.com`,
    name: "Game Owner",
    username: `game_owner_${suffix}`,
    usernameNormalized: `game_owner_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
  const slug = "word-bloom";
  const originalCreatorId = (await testStorage.getGameBySlug(slug))?.creatorId ?? null;
  const updateCreator = getCreatorHandler();

  try {
    const assigned = responseRecorder();
    await updateCreator({ params: { slug }, body: { creatorId: creator.id } }, assigned);
    assert.equal(assigned.statusCode, 200);
    assert.equal(assigned.body.creatorId, creator.id);
    assert.equal((await testStorage.getGameBySlug(slug))?.creatorId, creator.id);

    const invalidCreator = responseRecorder();
    await updateCreator({ params: { slug }, body: { creatorId: Number.MAX_SAFE_INTEGER } }, invalidCreator);
    assert.equal(invalidCreator.statusCode, 404);

    const cleared = responseRecorder();
    await updateCreator({ params: { slug }, body: { creatorId: null } }, cleared);
    assert.equal(cleared.statusCode, 200);
    assert.equal(cleared.body.creatorId, null);
    assert.equal((await testStorage.getGameBySlug(slug))?.creatorId ?? null, null);
  } finally {
    await testStorage.setGameCreatorId(slug, originalCreatorId);
  }
});

test("admins can add, remove, and clear ordered Similar Games recommendations", async () => {
  const testStorage = await initStorage();
  const slug = "word-sweep";
  const original = (await testStorage.getGameBySlug(slug))?.similarGameSlugs ?? null;
  const updateSimilarGames = getSimilarGamesHandler();

  try {
    const saved = responseRecorder();
    await updateSimilarGames({
      params: { slug },
      body: { similarGameSlugs: ["word-maker", "word-split"] },
    }, saved);
    assert.equal(saved.statusCode, 200);
    assert.deepEqual(saved.body.similarGameSlugs, ["word-maker", "word-split"]);
    assert.deepEqual((await testStorage.getGameBySlug(slug))?.similarGameSlugs, ["word-maker", "word-split"]);

    const removedOne = responseRecorder();
    await updateSimilarGames({
      params: { slug },
      body: { similarGameSlugs: ["word-split"] },
    }, removedOne);
    assert.equal(removedOne.statusCode, 200);
    assert.deepEqual((await testStorage.getGameBySlug(slug))?.similarGameSlugs, ["word-split"]);

    const cleared = responseRecorder();
    await updateSimilarGames({ params: { slug }, body: { similarGameSlugs: [] } }, cleared);
    assert.equal(cleared.statusCode, 200);
    assert.deepEqual((await testStorage.getGameBySlug(slug))?.similarGameSlugs, []);

    for (const invalidSlugs of [
      [slug],
      ["word-maker", "word-maker"],
      ["not-a-real-game"],
    ]) {
      const invalid = responseRecorder();
      await updateSimilarGames({
        params: { slug },
        body: { similarGameSlugs: invalidSlugs },
      }, invalid);
      assert.equal(invalid.statusCode, 400);
    }
  } finally {
    await testStorage.setGameSimilarGameSlugs(slug, original);
  }
});
