import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import { initStorage, storage } from "../storage";
import { registerCommentsRoutes } from "./comments.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getCreateCommentHandler(): Handler {
  let handler: Handler | undefined;
  const app = {
    get() { return this; },
    post(path: string, ...routeHandlers: Handler[]) {
      if (path === "/api/comments") handler = routeHandlers.at(-1);
      return this;
    },
    patch() { return this; },
    delete() { return this; },
  };
  registerCommentsRoutes(app as unknown as Express);
  assert.ok(handler, "POST /api/comments route is registered");
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
  const role = suffix.replace(/_\d+$/, "").split("_").at(-1) || "user";
  const username = `m_${role.slice(0, 6)}_${Date.now().toString(36)}`;
  return storage.createUser({
    email: `comment-mention-${suffix}@example.com`,
    name: `Comment Mention ${suffix}`,
    username,
    usernameNormalized: username,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
}

async function postComment(user: Awaited<ReturnType<typeof createUser>>, content: string, targetType = "game", targetId = `game-${Date.now()}`) {
  const handler = getCreateCommentHandler();
  const response = responseRecorder();
  await handler({
    user,
    body: { targetType, targetId, content },
  }, response);
  assert.equal(response.statusCode, 201);
  return response.body;
}

test("comment mentions notify each existing non-self user once and respect preferences", async () => {
  await initStorage();
  const author = await createUser(`author_${Date.now()}`);
  const recipient = await createUser(`recipient_${Date.now()}`);
  const optedOut = await createUser(`optout_${Date.now()}`);
  await storage.setNotificationPreference(optedOut.id, "comment_mention", false);

  const content = `Thanks @${recipient.username}, @${recipient.username}, @${author.username}, and @deleted_user`;
  const targetId = `game-${Date.now()}`;
  const comment = await postComment(author, content, "game", targetId);

  const recipientNotifications = await storage.getNotifications(recipient.id);
  assert.equal(recipientNotifications.filter(notification => notification.type === "comment_mention").length, 1);
  assert.equal(recipientNotifications[0].linkUrl, `/game/${targetId}#comments`);
  assert.equal((await storage.getNotifications(author.id)).some(notification => notification.type === "comment_mention"), false);
  assert.equal((await storage.getNotifications(optedOut.id)).some(notification => notification.type === "comment_mention"), false);
  assert.equal(comment.content, content);
});

test("comment mentions skip users blocked by the author and banned users", async () => {
  const testStorage = await initStorage();
  const suffix = Date.now();
  const author = await createUser(`safety_author_${suffix}`);
  const blocked = await createUser(`safety_blocked_${suffix}`);
  const banned = await createUser(`safety_banned_${suffix}`);
  const eligible = await createUser(`safety_eligible_${suffix}`);
  await testStorage.blockUser(author.id, blocked.id);
  await testStorage.updateUser(banned.id, { isBanned: true });

  await postComment(
    author,
    `@${blocked.username} @${banned.username} @${eligible.username}`,
  );

  for (const recipient of [blocked, banned]) {
    assert.equal(
      (await testStorage.getNotifications(recipient.id)).some(notification => notification.type === "comment_mention"),
      false,
      `${recipient.username} should not receive a comment-mention notification`,
    );
  }
  assert.equal(
    (await testStorage.getNotifications(eligible.id)).filter(notification => notification.type === "comment_mention").length,
    1,
    "an eligible, unblocked user should receive exactly one comment-mention notification",
  );
});

test("email-like text containing a username does not send a mention notification", async () => {
  await initStorage();
  const author = await createUser(`email_author_${Date.now()}`);
  const recipient = await createUser(`email_recipient_${Date.now()}`);

  await postComment(author, `Contact reader@${recipient.username}.example`);

  assert.equal(
    (await storage.getNotifications(recipient.id)).some(notification => notification.type === "comment_mention"),
    false,
  );
});

test("private group-round mentions only notify users who can access the discussion", async () => {
  const testStorage = await initStorage();
  const author = await createUser(`private_author_${Date.now()}`);
  const member = await createUser(`private_member_${Date.now()}`);
  const outsider = await createUser(`private_outsider_${Date.now()}`);
  const group = await testStorage.createGroup({
    name: "Private comments test",
    description: null,
    creatorId: author.id,
    inviteCode: `comment-mention-${Date.now()}`,
    isPublic: false,
    isFeatured: false,
    tags: null,
    pinnedAnnouncement: null,
  });
  await testStorage.addGroupMember(group.id, author.id, "owner");
  await testStorage.addGroupMember(group.id, member.id, "member");
  const round = await testStorage.createGroupRound({
    groupId: group.id,
    gameSlug: "letter-grid",
    seed: 1,
    status: "active",
    createdById: author.id,
    closesAt: null,
    gameConfig: null,
    seasonId: null,
  });

  await postComment(author, `@${member.username} @${outsider.username}`, "group_round", String(round.id));

  const memberNotifications = await testStorage.getNotifications(member.id);
  assert.equal(memberNotifications.filter(notification => notification.type === "comment_mention").length, 1);
  assert.equal(memberNotifications[0].linkUrl, `/groups/${group.id}/rounds/${round.id}/play#comments`);
  assert.equal((await testStorage.getNotifications(outsider.id)).some(notification => notification.type === "comment_mention"), false);
});
