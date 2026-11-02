import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Express } from "express";
import { initStorage, storage } from "../storage";
import { errorHandler } from "../middleware/error-handler";
import { registerCommentsRoutes } from "./comments.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getMutationHandlers() {
  const handlers: Record<string, Handler | undefined> = {};
  const app = {
    get(path: string, ...routeHandlers: Handler[]) {
      if (path === "/api/admin/comments/reported") {
        handlers[path] = routeHandlers.at(-1);
      }
      if (path === "/api/comments") {
        handlers[`GET:${path}`] = routeHandlers.at(-1);
      }
      if (path === "/api/likes") {
        handlers[`GET:${path}`] = routeHandlers.at(-1);
      }
      return this;
    },
    post(path: string, ...routeHandlers: Handler[]) {
      if (path === "/api/comments" || path === "/api/comments/:id/report" || path === "/api/likes") {
        handlers[path] = routeHandlers.at(-1);
      }
      return this;
    },
    patch(path: string, ...routeHandlers: Handler[]) {
      handlers[path] = routeHandlers.at(-1);
      return this;
    },
    delete(path: string, ...routeHandlers: Handler[]) {
      if (path === "/api/comments/:id") {
        handlers[`DELETE:${path}`] = routeHandlers.at(-1);
      }
      return this;
    },
  };
  registerCommentsRoutes(app as unknown as Express);
  for (const path of [
    "/api/comments",
    "/api/comments/:id",
    "/api/comments/:id/pin",
    "/api/comments/:id/report",
    "/api/admin/comments/reported",
    "/api/likes",
    "GET:/api/likes",
  ]) {
    assert.ok(handlers[path], `${path} route is registered`);
  }
  return handlers as Record<string, Handler>;
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

test("comment mutation returns a clear 400 for malformed JSON over HTTP", async () => {
  const app = express();
  app.use(express.json());
  registerCommentsRoutes(app);
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"content":',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { message: "Invalid JSON request body" });
    assert.doesNotMatch(JSON.stringify(body), /stack|SyntaxError/i);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

async function createUser(suffix: string) {
  return storage.createUser({
    email: `comment-body-${suffix}@example.com`,
    name: `Comment Body ${suffix}`,
    username: `comment_body_${suffix}`,
    usernameNormalized: `comment_body_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: true,
    isBanned: false,
    isPremium: false,
  });
}

test("comment mutation routes reject missing, null, and non-object request bodies without side effects", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const user = await createUser(suffix);
  const targetId = `invalid-body-${suffix}`;
  const comment = await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: user.id,
    parentId: null,
    content: "Original comment",
  });
  const handlers = getMutationHandlers();
  const invalidBodies = [
    { label: "missing", body: undefined },
    { label: "null", body: null },
    { label: "array", body: [] },
    { label: "string", body: "not an object" },
    { label: "number", body: 42 },
    { label: "boolean", body: true },
  ];
  const routes = [
    { path: "/api/comments", params: {} },
    { path: "/api/comments/:id", params: { id: String(comment.id) } },
    { path: "/api/comments/:id/pin", params: { id: String(comment.id) } },
    { path: "/api/comments/:id/report", params: { id: String(comment.id) } },
  ];
  const existingReports = await testStorage.getCommentReports();

  for (const route of routes) {
    for (const invalidBody of invalidBodies) {
      const response = responseRecorder();
      await handlers[route.path]({
        params: route.params,
        body: invalidBody.body,
        user,
      }, response);

      assert.equal(response.statusCode, 400, `${route.path} should reject ${invalidBody.label} body`);
      assert.match(response.body.error, /request body must be a json object/i);
    }
  }

  const unchangedComment = await testStorage.getCommentById(comment.id);
  assert.equal(unchangedComment?.content, "Original comment");
  assert.equal(unchangedComment?.isPinned, comment.isPinned);
  assert.deepEqual(await testStorage.getCommentReports(), existingReports);
  const comments = await testStorage.getComments("game", targetId);
  assert.equal(comments.length, 1, "invalid create bodies must not create comments");
  assert.equal(comments[0].content, "Original comment");
});

test("like route rejects missing, null, and non-object request bodies without toggling likes", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const user = await createUser(`like-body-${suffix}`);
  const gameTargetId = `invalid-like-body-${suffix}`;
  const comment = await testStorage.createComment({
    targetType: "game",
    targetId: gameTargetId,
    userId: user.id,
    parentId: null,
    content: "Like target",
  });
  const handlers = getMutationHandlers();
  const invalidBodies = [
    { label: "missing", body: undefined },
    { label: "null", body: null },
    { label: "array", body: [] },
    { label: "string", body: "not an object" },
    { label: "number", body: 42 },
    { label: "boolean", body: true },
  ];

  for (const invalidBody of invalidBodies) {
    const response = responseRecorder();
    await handlers["/api/likes"]({ body: invalidBody.body, user }, response);

    assert.equal(response.statusCode, 400, `like route should reject ${invalidBody.label} body`);
    assert.match(response.body.error, /request body must be a json object/i);
  }

  assert.deepEqual(await testStorage.getUserLikes(user.id, "game", [gameTargetId]), new Set());
  assert.deepEqual(await testStorage.getUserLikes(user.id, "comment", [String(comment.id)]), new Set());
});

test("like route toggles game and comment likes with matching counts and comment notifications", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const liker = await createUser(`like-toggle-liker-${suffix}`);
  const commentAuthor = await createUser(`like-toggle-author-${suffix}`);
  const gameTargetId = `like-toggle-game-${suffix}`;
  const comment = await testStorage.createComment({
    targetType: "game",
    targetId: gameTargetId,
    userId: commentAuthor.id,
    parentId: null,
    content: "Like this comment",
  });
  const handlers = getMutationHandlers();

  const toggle = async (targetType: "game" | "comment", targetId: string) => {
    const response = responseRecorder();
    await handlers["/api/likes"]({
      body: { targetType, targetId },
      user: liker,
    }, response);
    assert.equal(response.statusCode, 200);
    return response.body as { liked: boolean; count: number };
  };

  assert.deepEqual(await toggle("game", gameTargetId), { liked: true, count: 1 });
  assert.deepEqual(await testStorage.getUserLikes(liker.id, "game", [gameTargetId]), new Set([gameTargetId]));
  assert.deepEqual(await testStorage.getLikeCounts("game", [gameTargetId]), { [gameTargetId]: 1 });

  assert.deepEqual(await toggle("game", gameTargetId), { liked: false, count: 0 });
  assert.deepEqual(await testStorage.getUserLikes(liker.id, "game", [gameTargetId]), new Set());
  assert.deepEqual(await testStorage.getLikeCounts("game", [gameTargetId]), { [gameTargetId]: 0 });

  const commentId = String(comment.id);
  assert.deepEqual(await toggle("comment", commentId), { liked: true, count: 1 });
  assert.deepEqual(await testStorage.getUserLikes(liker.id, "comment", [commentId]), new Set([commentId]));
  assert.deepEqual(await testStorage.getLikeCounts("comment", [commentId]), { [commentId]: 1 });

  await new Promise<void>((resolve) => setImmediate(resolve));
  const commentLikeNotifications = (await testStorage.getNotifications(commentAuthor.id))
    .filter((notification) => notification.type === "comment_liked");
  assert.equal(commentLikeNotifications.length, 1);
  assert.equal(commentLikeNotifications[0].body, `@${liker.username} liked your comment`);

  assert.deepEqual(await toggle("comment", commentId), { liked: false, count: 0 });
  assert.deepEqual(await testStorage.getUserLikes(liker.id, "comment", [commentId]), new Set());
  assert.deepEqual(await testStorage.getLikeCounts("comment", [commentId]), { [commentId]: 0 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(
    (await testStorage.getNotifications(commentAuthor.id))
      .filter((notification) => notification.type === "comment_liked").length,
    1,
    "unliking a comment should not create another notification",
  );
});

test("GET likes returns game counts and per-user state for signed-in and anonymous requests", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const user = await createUser(`like-list-user-${suffix}`);
  const anotherUser = await createUser(`like-list-other-${suffix}`);
  const likedGameId = `like-list-liked-${suffix}`;
  const otherGameId = `like-list-other-game-${suffix}`;

  await testStorage.toggleLike(user.id, "game", likedGameId);
  await testStorage.toggleLike(anotherUser.id, "game", likedGameId);
  await testStorage.toggleLike(anotherUser.id, "game", otherGameId);

  const getLikes = async (requestUser?: typeof user) => {
    const response = responseRecorder();
    await getMutationHandlers()["GET:/api/likes"]({
      query: {
        targetType: "game",
        targetIds: `${likedGameId},${otherGameId}`,
      },
      user: requestUser,
    }, response);
    assert.equal(response.statusCode, 200);
    return response.body as {
      counts: Record<string, number>;
      likedByMe: Record<string, boolean>;
    };
  };

  assert.deepEqual(await getLikes(user), {
    counts: {
      [likedGameId]: 2,
      [otherGameId]: 1,
    },
    likedByMe: {
      [likedGameId]: true,
      [otherGameId]: false,
    },
  });
  assert.deepEqual(await getLikes(), {
    counts: {
      [likedGameId]: 2,
      [otherGameId]: 1,
    },
    likedByMe: {
      [likedGameId]: false,
      [otherGameId]: false,
    },
  });
});

test("comment-like notifications respect the author's preference without changing like state", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const liker = await createUser(`like-muted-liker-${suffix}`);
  const commentAuthor = await createUser(`like-muted-author-${suffix}`);
  const comment = await testStorage.createComment({
    targetType: "game",
    targetId: `like-muted-game-${suffix}`,
    userId: commentAuthor.id,
    parentId: null,
    content: "Like notifications are disabled",
  });
  await testStorage.setNotificationPreference(commentAuthor.id, "comment_liked", false);
  const handlers = getMutationHandlers();
  const toggle = async () => {
    const response = responseRecorder();
    await handlers["/api/likes"]({
      body: { targetType: "comment", targetId: String(comment.id) },
      user: liker,
    }, response);
    assert.equal(response.statusCode, 200);
    return response.body as { liked: boolean; count: number };
  };

  assert.deepEqual(await toggle(), { liked: true, count: 1 });
  assert.deepEqual(await testStorage.getUserLikes(liker.id, "comment", [String(comment.id)]), new Set([String(comment.id)]));
  assert.deepEqual(await testStorage.getLikeCounts("comment", [String(comment.id)]), { [String(comment.id)]: 1 });
  assert.deepEqual(await testStorage.getNotifications(commentAuthor.id), []);

  assert.deepEqual(await toggle(), { liked: false, count: 0 });
  assert.deepEqual(await testStorage.getUserLikes(liker.id, "comment", [String(comment.id)]), new Set());
  assert.deepEqual(await testStorage.getLikeCounts("comment", [String(comment.id)]), { [String(comment.id)]: 0 });
  assert.deepEqual(await testStorage.getNotifications(commentAuthor.id), []);
});

test("liking your own comment toggles normally without a notification", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const author = await createUser(`like-self-author-${suffix}`);
  const comment = await testStorage.createComment({
    targetType: "game",
    targetId: `like-self-game-${suffix}`,
    userId: author.id,
    parentId: null,
    content: "Like my own comment",
  });
  const handlers = getMutationHandlers();
  const toggle = async () => {
    const response = responseRecorder();
    await handlers["/api/likes"]({
      body: { targetType: "comment", targetId: String(comment.id) },
      user: author,
    }, response);
    assert.equal(response.statusCode, 200);
    return response.body as { liked: boolean; count: number };
  };

  assert.deepEqual(await toggle(), { liked: true, count: 1 });
  assert.deepEqual(await testStorage.getUserLikes(author.id, "comment", [String(comment.id)]), new Set([String(comment.id)]));
  assert.deepEqual(await testStorage.getLikeCounts("comment", [String(comment.id)]), { [String(comment.id)]: 1 });
  assert.deepEqual(await testStorage.getNotifications(author.id), []);

  assert.deepEqual(await toggle(), { liked: false, count: 0 });
  assert.deepEqual(await testStorage.getUserLikes(author.id, "comment", [String(comment.id)]), new Set());
  assert.deepEqual(await testStorage.getLikeCounts("comment", [String(comment.id)]), { [String(comment.id)]: 0 });
  assert.deepEqual(await testStorage.getNotifications(author.id), []);
});

test("a removed member cannot mutate a private group-round discussion", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const owner = await createUser(`private-round-owner-${suffix}`);
  const member = await createUser(`private-round-member-${suffix}`);
  const group = await testStorage.createGroup({
    name: `Private round ${suffix}`,
    description: null,
    creatorId: owner.id,
    inviteCode: `private${suffix}`,
    isPublic: false,
    isFeatured: false,
    tags: null,
    pinnedAnnouncement: null,
  });
  await testStorage.addGroupMember(group.id, owner.id, "owner");
  await testStorage.addGroupMember(group.id, member.id, "member");
  const round = await testStorage.createGroupRound({
    groupId: group.id,
    gameSlug: "word-chain",
    seed: 42,
    status: "active",
    createdById: owner.id,
    closesAt: null,
    gameConfig: null,
    seasonId: null,
  });
  const comment = await testStorage.createComment({
    targetType: "group_round",
    targetId: String(round.id),
    userId: member.id,
    parentId: null,
    content: "Private discussion content",
  });
  await testStorage.removeGroupMember(group.id, member.id);

  const handlers = getMutationHandlers();
  const requests: Array<{ path: string; body?: unknown }> = [
    {
      path: "/api/comments",
      body: { targetType: "group_round", targetId: String(round.id), content: "Another comment" },
    },
    { path: "/api/comments/:id", body: { content: "Edited after removal" } },
    {
      path: "/api/comments/:id/pin",
      body: { targetType: "group_round", targetId: String(round.id), isPinned: true },
    },
    { path: "/api/comments/:id/report", body: { reason: "Report after removal" } },
    { path: "/api/likes", body: { targetType: "comment", targetId: String(comment.id) } },
  ];
  for (const request of requests) {
    const response = responseRecorder();
    await handlers[request.path]({
      params: { id: String(comment.id) },
      body: request.body,
      user: member,
    }, response);
    assert.equal(response.statusCode, 403, `${request.path} must deny a removed member`);
  }

  const deleteResponse = responseRecorder();
  await handlers["DELETE:/api/comments/:id"]({
    params: { id: String(comment.id) },
    user: member,
  }, deleteResponse);
  assert.equal(deleteResponse.statusCode, 403, "delete must deny a removed member");

  const unchanged = await testStorage.getCommentById(comment.id);
  assert.equal(unchanged?.content, "Private discussion content");
  assert.deepEqual(await testStorage.getUserLikes(member.id, "comment", [String(comment.id)]), new Set());
  assert.equal((await testStorage.getCommentReports()).length, 0);
});

test("a public-to-private change hides and blocks actions on its group-round discussion", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const owner = await createUser(`privacy-round-owner-${suffix}`);
  const nonmember = await createUser(`privacy-round-nonmember-${suffix}`);
  const group = await testStorage.createGroup({
    name: `Public round ${suffix}`,
    description: null,
    creatorId: owner.id,
    inviteCode: `public${suffix}`,
    isPublic: true,
    isFeatured: false,
    tags: null,
    pinnedAnnouncement: null,
  });
  await testStorage.addGroupMember(group.id, owner.id, "owner");
  const round = await testStorage.createGroupRound({
    groupId: group.id,
    gameSlug: "word-chain",
    seed: 42,
    status: "active",
    createdById: owner.id,
    closesAt: null,
    gameConfig: null,
    seasonId: null,
  });
  const comment = await testStorage.createComment({
    targetType: "group_round",
    targetId: String(round.id),
    userId: nonmember.id,
    parentId: null,
    content: "Public discussion content",
  });

  const handlers = getMutationHandlers();
  const publicResponse = responseRecorder();
  await handlers["GET:/api/comments"]({
    params: {},
    query: { targetType: "group_round", targetId: String(round.id) },
    user: nonmember,
  }, publicResponse);
  assert.equal(publicResponse.statusCode, 200);
  assert.equal(publicResponse.body[0]?.content, "Public discussion content");

  await testStorage.updateGroup(group.id, { isPublic: false });

  const privateResponse = responseRecorder();
  await handlers["GET:/api/comments"]({
    params: {},
    query: { targetType: "group_round", targetId: String(round.id) },
    user: nonmember,
  }, privateResponse);
  assert.equal(privateResponse.statusCode, 403, "comment reads must stop after privacy changes");

  const requests: Array<{ path: string; body?: unknown }> = [
    {
      path: "/api/comments",
      body: { targetType: "group_round", targetId: String(round.id), content: "New comment" },
    },
    { path: "/api/comments/:id", body: { content: "Edited after privacy change" } },
    {
      path: "/api/comments/:id/pin",
      body: { targetType: "group_round", targetId: String(round.id), isPinned: true },
    },
    { path: "/api/comments/:id/report", body: { reason: "Report after privacy change" } },
    { path: "/api/likes", body: { targetType: "comment", targetId: String(comment.id) } },
  ];
  for (const request of requests) {
    const response = responseRecorder();
    await handlers[request.path]({
      params: { id: String(comment.id) },
      body: request.body,
      user: nonmember,
    }, response);
    assert.equal(response.statusCode, 403, `${request.path} must deny a nonmember after privacy changes`);
  }

  const deleteResponse = responseRecorder();
  await handlers["DELETE:/api/comments/:id"]({
    params: { id: String(comment.id) },
    user: nonmember,
  }, deleteResponse);
  assert.equal(deleteResponse.statusCode, 403, "delete must deny a nonmember after privacy changes");

  assert.equal((await testStorage.getCommentById(comment.id))?.content, "Public discussion content");
  assert.deepEqual(await testStorage.getUserLikes(nonmember.id, "comment", [String(comment.id)]), new Set());
  assert.equal((await testStorage.getCommentReports()).length, 0);
});

test("admin reported comments include only resolved mention accounts", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now()).slice(-6);
  const author = await createUser(`a${suffix}`);
  const mentionedUser = await createUser(`m${suffix}`);
  const reporter = await createUser(`r${suffix}`);
  const comment = await testStorage.createComment({
    targetType: "game",
    targetId: `reported-${suffix}`,
    userId: author.id,
    parentId: null,
    content: `Hello @${mentionedUser.username}, unknown @missing_user, email person@example.com`,
  });
  await testStorage.reportComment(comment.id, reporter.id, "Needs review");

  const handlers = getMutationHandlers();
  const response = responseRecorder();
  await handlers["/api/admin/comments/reported"]({}, response);

  assert.equal(response.statusCode, 200);
  const reports = response.body as Array<{ comment?: { mentionedUsers?: Array<{ id: number; username: string }> } }>;
  const reportedComment = reports.find((report) => report.comment)?.comment;
  assert.deepEqual(reportedComment?.mentionedUsers, [{
    id: mentionedUser.id,
    username: mentionedUser.username,
  }]);
});
