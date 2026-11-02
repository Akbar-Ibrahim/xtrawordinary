import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import { initStorage } from "../storage";
import { registerAdminRoutes } from "./admin.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getMarkNotificationReadHandler(): Handler {
  let markRead: Handler | undefined;
  const app = {
    get() { return this; },
    post() { return this; },
    patch(path: string, ...handlers: Handler[]) {
      if (path === "/api/notifications/:id/read") markRead = handlers.at(-1);
      return this;
    },
    delete() { return this; },
  };

  registerAdminRoutes(app as unknown as Express);
  assert.ok(markRead, "notification read route is registered");
  return markRead;
}

function getMarkAllNotificationsReadHandler(): Handler {
  let markAllRead: Handler | undefined;
  const app = {
    get() { return this; },
    post(path: string, ...handlers: Handler[]) {
      if (path === "/api/notifications/read-all") markAllRead = handlers.at(-1);
      return this;
    },
    patch() { return this; },
    delete() { return this; },
  };

  registerAdminRoutes(app as unknown as Express);
  assert.ok(markAllRead, "mark all notifications read route is registered");
  return markAllRead;
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined as unknown,
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

test("players cannot mark another user's notification as read", async () => {
  const storage = await initStorage();
  const suffix = String(Date.now());
  const makeUser = (name: string) => storage.createUser({
    email: `${name}-${suffix}@example.com`,
    name,
    username: `${name.toLowerCase()}_${suffix}`,
    usernameNormalized: `${name.toLowerCase()}_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
  const [player, recipient] = await Promise.all([
    makeUser("NotificationReader"),
    makeUser("NotificationRecipient"),
  ]);
  const notificationInput = {
    type: "friend_request_received" as const,
    title: "New friend request",
    body: "Someone sent you a friend request.",
    linkUrl: null,
  };
  const [playerNotification, recipientNotification] = await Promise.all([
    storage.createNotification({ ...notificationInput, userId: player.id }),
    storage.createNotification({ ...notificationInput, userId: recipient.id }),
  ]);

  assert.equal(await storage.getUnreadNotificationCount(player.id), 1);
  assert.equal(await storage.getUnreadNotificationCount(recipient.id), 1);

  const markRead = getMarkNotificationReadHandler();
  const response = responseRecorder();
  await markRead(
    { params: { id: String(recipientNotification.id) }, user: player },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true });
  assert.equal(await storage.getUnreadNotificationCount(player.id), 1);
  assert.equal(await storage.getUnreadNotificationCount(recipient.id), 1);
  assert.equal(
    (await storage.getNotifications(recipient.id)).find((n) => n.id === recipientNotification.id)?.readAt,
    null,
    "the recipient's notification remains unread",
  );
  assert.equal(
    (await storage.getNotifications(player.id)).find((n) => n.id === playerNotification.id)?.readAt,
    null,
    "the signed-in player's own notification is unchanged",
  );
});

test("read-all only marks the signed-in player's notifications as read", async () => {
  const storage = await initStorage();
  const suffix = String(Date.now());
  const makeUser = (name: string) => storage.createUser({
    email: `${name}-${suffix}@example.com`,
    name,
    username: `${name.toLowerCase()}_${suffix}`,
    usernameNormalized: `${name.toLowerCase()}_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
  const [player, otherPlayer] = await Promise.all([
    makeUser("ReadAllPlayer"),
    makeUser("ReadAllOther"),
  ]);
  const notificationInput = {
    type: "friend_request_received" as const,
    title: "New friend request",
    body: "Someone sent you a friend request.",
    linkUrl: null,
  };
  const [playerNotification, otherNotification] = await Promise.all([
    storage.createNotification({ ...notificationInput, userId: player.id }),
    storage.createNotification({ ...notificationInput, userId: otherPlayer.id }),
  ]);

  assert.equal(await storage.getUnreadNotificationCount(player.id), 1);
  assert.equal(await storage.getUnreadNotificationCount(otherPlayer.id), 1);

  const markAllRead = getMarkAllNotificationsReadHandler();
  const response = responseRecorder();
  await markAllRead({ user: player }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true });
  assert.equal(await storage.getUnreadNotificationCount(player.id), 0);
  assert.equal(await storage.getUnreadNotificationCount(otherPlayer.id), 1);

  const [playerNotifications, otherNotifications] = await Promise.all([
    storage.getNotifications(player.id),
    storage.getNotifications(otherPlayer.id),
  ]);
  assert.ok(
    playerNotifications.find((notification) => notification.id === playerNotification.id)?.readAt,
    "the signed-in player's notification is marked read",
  );
  assert.deepEqual(
    otherNotifications.find((notification) => notification.id === otherNotification.id),
    otherNotification,
    "the other player's notification remains unchanged",
  );
});
