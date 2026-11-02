import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import type { CommentPage } from "@shared/schema";
import { initStorage, storage } from "../storage";
import { registerCommentsRoutes } from "./comments.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getCommentsHandler(): Handler {
  let handler: Handler | undefined;
  const app = {
    get(path: string, ...routeHandlers: Handler[]) {
      if (path === "/api/comments") handler = routeHandlers.at(-1);
      return this;
    },
    post() { return this; },
    patch() { return this; },
    delete() { return this; },
  };
  registerCommentsRoutes(app as unknown as Express);
  assert.ok(handler, "GET /api/comments route is registered");
  return handler;
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

async function createUser(suffix: string) {
  return storage.createUser({
    email: `comment-pagination-${suffix}@example.com`,
    name: `Comment Pagination ${suffix}`,
    username: `comment_page_${suffix}`,
    usernameNormalized: `comment_page_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
}

test("comments API pages top-level comments and keeps their replies attached", async () => {
  const testStorage = await initStorage();
  const author = await createUser(String(Date.now()));
  const targetId = `pagination-${Date.now()}`;
  const roots = [];

  for (const content of ["First", "Second", "Third"]) {
    roots.push(await testStorage.createComment({
      targetType: "game",
      targetId,
      userId: author.id,
      parentId: null,
      content,
    }));
  }
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: roots[1].id,
    content: "Reply to second",
  });

  const getComments = getCommentsHandler();
  const firstResponse = responseRecorder();
  await getComments({
    params: {},
    query: { targetType: "game", targetId, page: "1", pageSize: "2", sort: "newest" },
    user: undefined,
  }, firstResponse);

  assert.equal(firstResponse.statusCode, 200);
  const firstPage = firstResponse.body as CommentPage;
  assert.deepEqual(firstPage.comments.map(comment => comment.content), ["Third", "Second"]);
  assert.equal(firstPage.comments[1].replies?.[0]?.content, "Reply to second");
  assert.equal(firstPage.totalCount, 4);
  assert.equal(firstPage.hasMore, true);

  const secondResponse = responseRecorder();
  await getComments({
    params: {},
    query: { targetType: "game", targetId, page: "2", pageSize: "2", sort: "newest" },
    user: undefined,
  }, secondResponse);
  const secondPage = secondResponse.body as CommentPage;
  assert.deepEqual(secondPage.comments.map(comment => comment.content), ["First"]);
  assert.equal(secondPage.hasMore, false);
});

test("comments API resolves existing mentions and ignores unknown names and email addresses", async () => {
  const testStorage = await initStorage();
  const suffix = Date.now().toString(36).slice(-5);
  const author = await createUser(`a${suffix}`);
  const mentionedUser = await createUser(`m${suffix}`);
  const targetId = `mentions-${Date.now()}`;
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: null,
    content: `@${mentionedUser.username} @unknown_player reader@${mentionedUser.username}.example`,
  });

  const response = responseRecorder();
  await getCommentsHandler()({
    params: {},
    query: { targetType: "game", targetId, page: "1", pageSize: "20", sort: "newest" },
    user: undefined,
  }, response);

  assert.equal(response.statusCode, 200);
  const page = response.body as CommentPage;
  assert.deepEqual(page.mentionedUsers, [{ id: mentionedUser.id, username: mentionedUser.username }]);
  assert.match(page.comments[0].content, new RegExp(`@${mentionedUser.username}`));
});

test("comments API preserves the unpaginated response and rejects invalid sort values", async () => {
  await initStorage();
  const getComments = getCommentsHandler();
  const targetId = `legacy-${Date.now()}`;
  const legacyResponse = responseRecorder();

  await getComments({
    params: {},
    query: { targetType: "game", targetId },
    user: undefined,
  }, legacyResponse);
  assert.equal(legacyResponse.statusCode, 200);
  assert.ok(Array.isArray(legacyResponse.body));

  const invalidResponse = responseRecorder();
  await getComments({
    params: {},
    query: { targetType: "game", targetId, page: "1", sort: "random" },
    user: undefined,
  }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
  assert.match(invalidResponse.body.error, /sort order/i);

  const invalidCommenterResponse = responseRecorder();
  await getComments({
    params: {},
    query: { targetType: "game", targetId, commenterId: "not-a-user-id" },
    user: undefined,
  }, invalidCommenterResponse);
  assert.equal(invalidCommenterResponse.statusCode, 400);
  assert.match(invalidCommenterResponse.body.error, /commenterId/i);
});

test("comments API searches replies, keeps their full thread context, and paginates matching threads", async () => {
  const testStorage = await initStorage();
  const author = await createUser(`search-${Date.now()}`);
  const targetId = `search-${Date.now()}`;
  const matchingRoot = await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: null,
    content: "A parent comment",
  });
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: matchingRoot.id,
    content: "The unique phrase appears here",
  });
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: matchingRoot.id,
    content: "A second reply stays for context",
  });
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: author.id,
    parentId: null,
    content: "An unrelated discussion",
  });

  const getComments = getCommentsHandler();
  const response = responseRecorder();
  await getComments({
    params: {},
    query: { targetType: "game", targetId, page: "1", pageSize: "1", sort: "newest", search: "UNIQUE phrase" },
    user: undefined,
  }, response);

  assert.equal(response.statusCode, 200);
  const result = response.body as CommentPage;
  assert.equal(result.totalCount, 1);
  assert.equal(result.hasMore, false);
  assert.equal(result.comments.length, 1);
  assert.equal(result.comments[0].content, "A parent comment");
  assert.deepEqual(result.comments[0].replies?.map(reply => reply.content), [
    "The unique phrase appears here",
    "A second reply stays for context",
  ]);
});

test("comments API filters by commenter across paginated threads and preserves reply context", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const selectedAuthor = await createUser(`selected-${suffix}`);
  const otherAuthor = await createUser(`other-${suffix}`);
  const targetId = `commenter-filter-${suffix}`;

  const parentByOther = await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: otherAuthor.id,
    parentId: null,
    content: "Parent by another commenter",
  });
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: selectedAuthor.id,
    parentId: parentByOther.id,
    content: "Reply by selected commenter",
  });
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: otherAuthor.id,
    parentId: parentByOther.id,
    content: "Another reply stays for context",
  });

  const parentBySelected = await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: selectedAuthor.id,
    parentId: null,
    content: "Top-level comment by selected commenter",
  });
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: otherAuthor.id,
    parentId: parentBySelected.id,
    content: "Reply by another commenter stays for context",
  });
  await testStorage.createComment({
    targetType: "game",
    targetId,
    userId: otherAuthor.id,
    parentId: null,
    content: "Unmatched thread",
  });

  const getComments = getCommentsHandler();
  const firstResponse = responseRecorder();
  await getComments({
    params: {},
    query: {
      targetType: "game",
      targetId,
      page: "1",
      pageSize: "1",
      sort: "newest",
      commenterId: String(selectedAuthor.id),
    },
    user: undefined,
  }, firstResponse);

  assert.equal(firstResponse.statusCode, 200);
  const firstPage = firstResponse.body as CommentPage;
  assert.equal(firstPage.totalCount, 2);
  assert.equal(firstPage.hasMore, true);
  assert.equal(firstPage.comments[0].content, "Top-level comment by selected commenter");
  assert.equal(firstPage.comments[0].replies?.[0]?.content, "Reply by another commenter stays for context");
  const commenterNames = firstPage.commenters?.map(author => author.name) ?? [];
  assert.deepEqual(commenterNames, [...commenterNames].sort((a, b) => a.localeCompare(b)));

  const secondResponse = responseRecorder();
  await getComments({
    params: {},
    query: {
      targetType: "game",
      targetId,
      page: "2",
      pageSize: "1",
      sort: "newest",
      commenterId: String(selectedAuthor.id),
    },
    user: undefined,
  }, secondResponse);
  const secondPage = secondResponse.body as CommentPage;
  assert.equal(secondPage.totalCount, 2);
  assert.equal(secondPage.hasMore, false);
  assert.equal(secondPage.comments[0].content, "Parent by another commenter");
  assert.deepEqual(secondPage.comments[0].replies?.map(reply => reply.content), [
    "Reply by selected commenter",
    "Another reply stays for context",
  ]);
});

test("comment search and commenter filters do not bypass private group-round access checks", async () => {
  await initStorage();
  const getComments = getCommentsHandler();
  const response = responseRecorder();

  await getComments({
    params: {},
    query: { targetType: "group_round", targetId: "999999", page: "1", search: "private", commenterId: "1" },
    user: undefined,
  }, response);

  assert.equal(response.statusCode, 403);
});
