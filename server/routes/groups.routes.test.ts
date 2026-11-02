import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Express } from "express";
import type { Response } from "express";
import { initStorage, storage } from "../storage";
import { registerNotifSSE, unregisterNotifSSE } from "../realtime/notification-sse";
import { registerGroupsRoutes } from "./groups.routes";
import {
  configureErrorHandling,
  configureRequestPipeline,
} from "../middleware/request-pipeline";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getDeleteMemberHandler() {
  let handler: Handler | undefined;
  const app = {
    get() { return this; },
    post() { return this; },
    patch() { return this; },
    delete(path: string, ...routeHandlers: Handler[]) {
      if (path === "/api/groups/:id/members/:userId") handler = routeHandlers.at(-1);
      return this;
    },
  };
  registerGroupsRoutes(app as unknown as Express);
  assert.ok(handler, "member-removal route is registered");
  return handler;
}

function getPatchGroupHandler() {
  let handler: Handler | undefined;
  const app = {
    get() { return this; },
    post() { return this; },
    patch(path: string, ...routeHandlers: Handler[]) {
      if (path === "/api/groups/:id") handler = routeHandlers.at(-1);
      return this;
    },
    delete() { return this; },
  };
  registerGroupsRoutes(app as unknown as Express);
  assert.ok(handler, "group-update route is registered");
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
    email: `group-revoke-${suffix}@example.com`,
    name: `Group Revoke ${suffix}`,
    username: `group_revoke_${suffix}`,
    usernameNormalized: `group_revoke_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
}

test("removing a member from a private group sends a live access-revoked event", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const owner = await createUser(`owner-${suffix}`);
  const removedMember = await createUser(`member-${suffix}`);
  const group = await testStorage.createGroup({
    name: `Private group ${suffix}`,
    description: null,
    creatorId: owner.id,
    inviteCode: `revoke${suffix}`,
    isPublic: false,
    isFeatured: false,
    tags: null,
    pinnedAnnouncement: null,
  });
  await testStorage.addGroupMember(group.id, owner.id, "owner");
  await testStorage.addGroupMember(group.id, removedMember.id, "member");

  let streamData = "";
  const streamResponse = {
    write(data: string) {
      streamData += data;
    },
  };
  registerNotifSSE(removedMember.id, streamResponse as unknown as Response);
  try {
    const response = responseRecorder();
    await getDeleteMemberHandler()({
      params: { id: String(group.id), userId: String(removedMember.id) },
      user: owner,
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { success: true });
    assert.match(streamData, /"type":"group_discussion_access_revoked","groupId":\d+/);
    assert.equal(await testStorage.getGroupMember(group.id, removedMember.id), undefined);
  } finally {
    unregisterNotifSSE(removedMember.id, streamResponse as unknown as Response);
  }
});

test("making a public group private revokes open discussions for connected nonmembers only", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const owner = await createUser(`privacy-owner-${suffix}`);
  const member = await createUser(`privacy-member-${suffix}`);
  const nonmember = await createUser(`privacy-outsider-${suffix}`);
  const group = await testStorage.createGroup({
    name: `Public group ${suffix}`,
    description: null,
    creatorId: owner.id,
    inviteCode: `privacy${suffix}`,
    isPublic: true,
    isFeatured: false,
    tags: null,
    pinnedAnnouncement: null,
  });
  await testStorage.addGroupMember(group.id, owner.id, "owner");
  await testStorage.addGroupMember(group.id, member.id, "member");

  const streams = new Map<number, { data: string; response: Response }>();
  for (const user of [owner, member, nonmember]) {
    const stream = { data: "", response: undefined as unknown as Response };
    stream.response = {
      write(data: string) {
        stream.data += data;
      },
    } as unknown as Response;
    streams.set(user.id, stream);
    registerNotifSSE(user.id, stream.response);
  }

  try {
    const response = responseRecorder();
    await getPatchGroupHandler()({
      params: { id: String(group.id) },
      body: { isPublic: false },
      user: owner,
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.isPublic, false);
    assert.equal(streams.get(owner.id)?.data, "", "group owners retain access");
    assert.equal(streams.get(member.id)?.data, "", "group members retain access");
    assert.match(
      streams.get(nonmember.id)?.data ?? "",
      new RegExp(`"type":"group_discussion_access_revoked","groupId":${group.id}`),
    );
  } finally {
    for (const stream of streams.values()) {
      const userId = [...streams.entries()].find(([, entry]) => entry === stream)?.[0];
      if (userId !== undefined) unregisterNotifSSE(userId, stream.response);
    }
  }
});

test("malformed JSON on group creation returns 400 without creating a group", async () => {
  const testStorage = await initStorage();
  const suffix = String(Date.now());
  const owner = await createUser(`malformed-${suffix}`);
  const groupsBefore = await testStorage.getAllGroups();
  const membershipsBefore = await testStorage.getUserGroups(owner.id);

  const app = express();
  configureRequestPipeline(app);
  app.use((req: any, _res, next) => {
    req.isAuthenticated = () => true;
    req.user = owner;
    next();
  });
  registerGroupsRoutes(app);
  configureErrorHandling(app);
  const server = app.listen(0);

  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server port");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/groups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"malformed":',
    });

    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), { error: "Invalid JSON request body" });
    assert.deepEqual(await testStorage.getAllGroups(), groupsBefore);
    assert.deepEqual(await testStorage.getUserGroups(owner.id), membershipsBefore);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
