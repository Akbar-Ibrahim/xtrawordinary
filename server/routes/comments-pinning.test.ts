import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import type { CommentPage } from "@shared/schema";
import { initStorage, storage } from "../storage";
import { registerCommentsRoutes } from "./comments.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getHandlers() {
  let getComments: Handler | undefined;
  let setPinned: Handler | undefined;
  const app = {
    get(path: string, ...handlers: Handler[]) {
      if (path === "/api/comments") getComments = handlers.at(-1);
      return this;
    },
    post() { return this; },
    patch(path: string, ...handlers: Handler[]) {
      if (path === "/api/comments/:id/pin") setPinned = handlers.at(-1);
      return this;
    },
    delete() { return this; },
  };
  registerCommentsRoutes(app as unknown as Express);
  assert.ok(getComments);
  assert.ok(setPinned);
  return { getComments, setPinned };
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

async function createUser(suffix: string, isAdmin: boolean) {
  return storage.createUser({
    email: `comment-pinning-${suffix}@example.com`,
    name: `Comment Pinning ${suffix}`,
    username: `comment_pin_${suffix}`,
    usernameNormalized: `comment_pin_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin,
    isBanned: false,
    isPremium: false,
  });
}

test("only admins can pin global game discussions, and only within the selected discussion", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const author = await createUser(`author_${suffix}`, false);
  const regularUser = await createUser(`player_${suffix}`, false);
  const admin = await createUser(`admin_${suffix}`, true);
  const targetId = `pinning-${suffix}`;
  const otherTargetId = `other-${suffix}`;
  const comment = await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: null,
    content: "An important comment",
  });
  const { getComments, setPinned } = getHandlers();

  const denied = responseRecorder();
  await setPinned({
    params: { id: String(comment.id) },
    body: { targetType: "game", targetId, isPinned: true },
    user: { id: regularUser.id, isAdmin: false },
  }, denied);
  assert.equal(denied.statusCode, 403);

  const wrongDiscussion = responseRecorder();
  await setPinned({
    params: { id: String(comment.id) },
    body: { targetType: "game", targetId: otherTargetId, isPinned: true },
    user: { id: admin.id, isAdmin: true },
  }, wrongDiscussion);
  assert.equal(wrongDiscussion.statusCode, 404);

  const pinned = responseRecorder();
  await setPinned({
    params: { id: String(comment.id) },
    body: { targetType: "game", targetId, isPinned: true },
    user: { id: admin.id, isAdmin: true },
  }, pinned);
  assert.equal(pinned.statusCode, 200);
  assert.equal(pinned.body.isPinned, true);

  const pageResponse = responseRecorder();
  await getComments({
    params: {},
    query: { targetType: "game", targetId, page: "1", pageSize: "1", sort: "newest" },
    user: undefined,
  }, pageResponse);
  const page = pageResponse.body as CommentPage;
  assert.equal(page.pinnedComment?.id, comment.id);
  assert.deepEqual(page.comments, []);

  const unpinned = responseRecorder();
  await setPinned({
    params: { id: String(comment.id) },
    body: { targetType: "game", targetId, isPinned: false },
    user: { id: admin.id, isAdmin: true },
  }, unpinned);
  assert.equal(unpinned.statusCode, 200);
  assert.equal(unpinned.body.isPinned, false);
});

test("game creators can pin only comments on their own game discussions", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const creator = await createUser(`game_creator_${suffix}`, false);
  const unrelatedUser = await createUser(`game_other_${suffix}`, false);
  const gameSlug = "word-chain";
  const otherGameSlug = "word-length";
  const originalCreatorId = (await testStorage.getGameBySlug(gameSlug))?.creatorId ?? null;

  await testStorage.setGameCreatorId(gameSlug, creator.id);
  try {
    const ownComment = await testStorage.createComment({
      targetType: "game",
      targetId: gameSlug,
      userId: unrelatedUser.id,
      parentId: null,
      content: "A note on the creator's game",
    });
    const otherGameComment = await testStorage.createComment({
      targetType: "game",
      targetId: otherGameSlug,
      userId: unrelatedUser.id,
      parentId: null,
      content: "A note on another game",
    });
    const { setPinned } = getHandlers();

    const allowed = responseRecorder();
    await setPinned({
      params: { id: String(ownComment.id) },
      body: { targetType: "game", targetId: gameSlug, isPinned: true },
      user: { id: creator.id, isAdmin: false },
    }, allowed);
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.body.isPinned, true);

    const cannotManageOtherGame = responseRecorder();
    await setPinned({
      params: { id: String(otherGameComment.id) },
      body: { targetType: "game", targetId: otherGameSlug, isPinned: true },
      user: { id: creator.id, isAdmin: false },
    }, cannotManageOtherGame);
    assert.equal(cannotManageOtherGame.statusCode, 403);

    const cannotPinOtherDiscussionComment = responseRecorder();
    await setPinned({
      params: { id: String(otherGameComment.id) },
      body: { targetType: "game", targetId: gameSlug, isPinned: true },
      user: { id: creator.id, isAdmin: false },
    }, cannotPinOtherDiscussionComment);
    assert.equal(cannotPinOtherDiscussionComment.statusCode, 404);

    const unrelatedDenied = responseRecorder();
    await setPinned({
      params: { id: String(ownComment.id) },
      body: { targetType: "game", targetId: gameSlug, isPinned: false },
      user: { id: unrelatedUser.id, isAdmin: false },
    }, unrelatedDenied);
    assert.equal(unrelatedDenied.statusCode, 403);

    const unpinned = responseRecorder();
    await setPinned({
      params: { id: String(ownComment.id) },
      body: { targetType: "game", targetId: gameSlug, isPinned: false },
      user: { id: creator.id, isAdmin: false },
    }, unpinned);
    assert.equal(unpinned.statusCode, 200);
    assert.equal(unpinned.body.isPinned, false);
    assert.equal((await testStorage.getGameBySlug(gameSlug))?.creatorId, creator.id);
    assert.equal((await testStorage.getGameBySlug(otherGameSlug))?.creatorId ?? null, null);
  } finally {
    await testStorage.setGameCreatorId(gameSlug, originalCreatorId);
  }
});

test("a pinned comment remains visible on later pages and while searching", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const author = await createUser(`visibility_${suffix}`, false);
  const targetId = `visibility-${suffix}`;
  const pinned = await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: null,
    content: "Pinned important notice",
  });
  await testStorage.setCommentPinned(pinned.id, "game", targetId, true);
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: null,
    content: "Regular comment",
  });

  const { getComments } = getHandlers();
  for (const query of [
    { page: "1", pageSize: "1", sort: "newest" },
    { page: "2", pageSize: "1", sort: "newest" },
    { page: "2", pageSize: "1", sort: "newest", search: "not found" },
  ]) {
    const response = responseRecorder();
    await getComments({
      params: {},
      query: { targetType: "game", targetId, ...query },
      user: undefined,
    }, response);
    const page = response.body as CommentPage;
    assert.equal(page.pinnedComment?.id, pinned.id);
    assert.equal(page.pinnedComment?.isPinned, true);
    assert.equal(page.comments.some(comment => comment.id === pinned.id), false);
  }
});

test("the creator of a group round can pin its discussion, but another user cannot", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const creator = await createUser(`round_creator_${suffix}`, false);
  const otherUser = await createUser(`round_player_${suffix}`, false);
  const group = await testStorage.createGroup({
    name: `Pin test ${suffix}`,
    description: null,
    creatorId: creator.id,
    inviteCode: `pin${suffix}`,
    isPublic: true,
    isFeatured: false,
    tags: null,
    pinnedAnnouncement: null,
  });
  const round = await testStorage.createGroupRound({
    groupId: group.id,
    gameSlug: "word-chain",
    seed: 42,
    status: "active",
    createdById: creator.id,
    closesAt: null,
    gameConfig: null,
    seasonId: null,
  });
  const comment = await testStorage.createComment({
    targetType: "group_round",
    targetId: String(round.id),
    userId: otherUser.id,
    parentId: null,
    content: "A useful round note",
  });
  const { setPinned } = getHandlers();

  const permitted = responseRecorder();
  await setPinned({
    params: { id: String(comment.id) },
    body: { targetType: "group_round", targetId: String(round.id), isPinned: true },
    user: { id: creator.id, isAdmin: false },
  }, permitted);
  assert.equal(permitted.statusCode, 200);
  assert.equal(permitted.body.isPinned, true);

  const forbidden = responseRecorder();
  await setPinned({
    params: { id: String(comment.id) },
    body: { targetType: "group_round", targetId: String(round.id), isPinned: false },
    user: { id: otherUser.id, isAdmin: false },
  }, forbidden);
  assert.equal(forbidden.statusCode, 403);
});
