import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import { initStorage, storage } from "../storage";
import { registerFriendsRoutes } from "./friends.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getSendFriendRequestHandler(): Handler {
  let handler: Handler | undefined;
  const app = {
    get() {
      return this;
    },
    post(path: string, ...routeHandlers: Handler[]) {
      if (path === "/api/friends/request") handler = routeHandlers.at(-1);
      return this;
    },
    delete() {
      return this;
    },
  };
  registerFriendsRoutes(app as unknown as Express);
  assert.ok(handler, "POST /api/friends/request route is registered");
  return handler;
}

function getRouteHandler(method: "get" | "delete", path: string): Handler {
  let handler: Handler | undefined;
  const app = {
    get(routePath: string, ...routeHandlers: Handler[]) {
      if (method === "get" && routePath === path) handler = routeHandlers.at(-1);
      return this;
    },
    post() {
      return this;
    },
    delete(routePath: string, ...routeHandlers: Handler[]) {
      if (method === "delete" && routePath === path) handler = routeHandlers.at(-1);
      return this;
    },
  };
  registerFriendsRoutes(app as unknown as Express);
  assert.ok(handler, `${method.toUpperCase()} ${path} route is registered`);
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
    email: `friend-note-${suffix}@example.com`,
    name: `Friend Note ${suffix}`,
    username: `friend_note_${suffix}`,
    usernameNormalized: `friend_note_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
}

test("friend-request API accepts notes up to 200 characters and rejects longer notes", async () => {
  const testStorage = await initStorage();
  const requester = await createUser(`sender_${Date.now()}`);
  const exactLimitRecipient = await createUser(`limit_${Date.now()}`);
  const overLimitRecipient = await createUser(`over_${Date.now()}`);
  const sendFriendRequest = getSendFriendRequestHandler();
  const validNote = "n".repeat(200);

  const validResponse = responseRecorder();
  await sendFriendRequest({
    user: requester,
    body: { userId: exactLimitRecipient.id, note: validNote },
  }, validResponse);

  assert.equal(validResponse.statusCode, 200);
  assert.equal(validResponse.body.note, validNote);
  assert.equal(
    (await testStorage.getPendingFriendRequests(exactLimitRecipient.id))[0]?.note,
    validNote,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const notification = (await testStorage.getNotifications(exactLimitRecipient.id))[0];
  assert.equal(notification?.body, `@${requester.username} wants to be your friend: ${validNote}`);
  assert.equal(notification?.linkUrl, "/friends?tab=requests");

  const invalidResponse = responseRecorder();
  await sendFriendRequest({
    user: requester,
    body: { userId: overLimitRecipient.id, note: "n".repeat(201) },
  }, invalidResponse);

  assert.equal(invalidResponse.statusCode, 400);
  assert.match(invalidResponse.body.error, /200 characters or fewer/);
  assert.equal(await testStorage.getFriendship(requester.id, overLimitRecipient.id), undefined);
});

test("friend-request API rejects missing and non-object bodies without creating requests", async () => {
  const testStorage = await initStorage();
  const requester = await createUser(`invalid_body_sender_${Date.now()}`);
  const recipients = await Promise.all(
    Array.from({ length: 6 }, (_, index) => createUser(`invalid_body_${index}_${Date.now()}`)),
  );
  const invalidBodies = [
    { label: "missing", body: undefined },
    { label: "null", body: null },
    { label: "string", body: "not an object" },
    { label: "number", body: 42 },
    { label: "boolean", body: false },
    { label: "array", body: [] },
  ];
  const sendFriendRequest = getSendFriendRequestHandler();

  for (const [index, invalidBody] of invalidBodies.entries()) {
    const response = responseRecorder();
    await sendFriendRequest({
      user: requester,
      body: invalidBody.body,
    }, response);

    assert.equal(response.statusCode, 400, `${invalidBody.label} body should return 400`);
    assert.equal(response.body.error, "Request body must be a JSON object");
    assert.equal(await testStorage.getFriendship(requester.id, recipients[index].id), undefined);
    assert.equal((await testStorage.getPendingFriendRequests(recipients[index].id)).length, 0);
  }
});

test("friend-request API still accepts blank and omitted notes", async () => {
  const testStorage = await initStorage();
  const requester = await createUser(`blank_sender_${Date.now()}`);
  const blankRecipient = await createUser(`blank_${Date.now()}`);
  const omittedRecipient = await createUser(`omitted_${Date.now()}`);
  const sendFriendRequest = getSendFriendRequestHandler();

  const blankResponse = responseRecorder();
  await sendFriendRequest({
    user: requester,
    body: { userId: blankRecipient.id, note: "   \n " },
  }, blankResponse);

  const omittedResponse = responseRecorder();
  await sendFriendRequest({
    user: requester,
    body: { userId: omittedRecipient.id },
  }, omittedResponse);

  assert.equal(blankResponse.statusCode, 200);
  assert.equal(blankResponse.body.note, null);
  assert.equal(omittedResponse.statusCode, 200);
  assert.equal(omittedResponse.body.note, null);
  assert.equal((await testStorage.getPendingFriendRequests(blankRecipient.id)).length, 1);
  assert.equal((await testStorage.getPendingFriendRequests(omittedRecipient.id)).length, 1);

  await new Promise((resolve) => setTimeout(resolve, 0));
  const blankNotification = (await testStorage.getNotifications(blankRecipient.id))[0];
  const omittedNotification = (await testStorage.getNotifications(omittedRecipient.id))[0];
  assert.equal(blankNotification?.body, `@${requester.username} wants to be your friend`);
  assert.equal(omittedNotification?.body, `@${requester.username} wants to be your friend`);
  assert.equal(blankNotification?.linkUrl, "/friends?tab=requests");
  assert.equal(omittedNotification?.linkUrl, "/friends?tab=requests");
});

test("friend-request API rejects non-string notes without creating requests", async () => {
  const testStorage = await initStorage();
  const requester = await createUser(`malformed_sender_${Date.now()}`);
  const numericRecipient = await createUser(`malformed_number_${Date.now()}`);
  const objectRecipient = await createUser(`malformed_object_${Date.now()}`);
  const sendFriendRequest = getSendFriendRequestHandler();
  const malformedNotes = [
    { recipient: numericRecipient, note: 42 },
    { recipient: objectRecipient, note: { text: "hello" } },
  ];

  for (const { recipient, note } of malformedNotes) {
    const response = responseRecorder();
    await sendFriendRequest({
      user: requester,
      body: { userId: recipient.id, note },
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.error, /note must be a string/i);
    assert.equal(await testStorage.getFriendship(requester.id, recipient.id), undefined);
    assert.equal((await testStorage.getPendingFriendRequests(recipient.id)).length, 0);
  }
});

test("sent friend requests identify their recipient and can only be cancelled by the sender while pending", async () => {
  const testStorage = await initStorage();
  const sender = await createUser(`sent_sender_${Date.now()}`);
  const recipient = await createUser(`sent_recipient_${Date.now()}`);
  const otherUser = await createUser(`sent_other_${Date.now()}`);
  const pendingRequest = await testStorage.sendFriendRequest(sender.id, recipient.id);

  const getSentRequests = getRouteHandler("get", "/api/friends/requests/sent");
  const sentResponse = responseRecorder();
  await getSentRequests({ user: sender }, sentResponse);
  assert.equal(sentResponse.statusCode, 200);
  assert.equal(sentResponse.body.length, 1);
  assert.equal(sentResponse.body[0].id, pendingRequest.id);
  assert.equal(sentResponse.body[0].addresseeUser.id, recipient.id);
  assert.equal(sentResponse.body[0].addresseeUser.username, recipient.username);

  const cancelRequest = getRouteHandler("delete", "/api/friends/requests/:id");
  const unauthorizedResponse = responseRecorder();
  await cancelRequest({ params: { id: String(pendingRequest.id) }, user: otherUser }, unauthorizedResponse);
  assert.equal(unauthorizedResponse.statusCode, 403);
  assert.equal(await testStorage.getFriendship(sender.id, recipient.id), pendingRequest);

  const cancelledResponse = responseRecorder();
  await cancelRequest({ params: { id: String(pendingRequest.id) }, user: sender }, cancelledResponse);
  assert.equal(cancelledResponse.statusCode, 200);
  assert.deepEqual(cancelledResponse.body, { success: true });
  assert.equal(await testStorage.getFriendship(sender.id, recipient.id), undefined);
  assert.equal((await testStorage.getOutgoingPendingFriendRequests(sender.id)).length, 0);
  assert.equal((await testStorage.getPendingFriendRequests(recipient.id)).length, 0);

  const acceptedRequest = await testStorage.sendFriendRequest(sender.id, recipient.id);
  await testStorage.acceptFriendRequest(acceptedRequest.id);
  const acceptedCancelResponse = responseRecorder();
  await cancelRequest({ params: { id: String(acceptedRequest.id) }, user: sender }, acceptedCancelResponse);
  assert.equal(acceptedCancelResponse.statusCode, 409);
  assert.equal((await testStorage.getFriendship(sender.id, recipient.id))?.status, "accepted");
  assert.equal((await testStorage.getOutgoingPendingFriendRequests(sender.id)).length, 0);
});
