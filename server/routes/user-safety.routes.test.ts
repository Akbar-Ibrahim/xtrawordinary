import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import type { IStorage } from "../storage";
import { initStorage } from "../storage";
import { registerUserSafetyRoutes } from "./user-safety.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getRouteHandler(method: "get" | "post" | "delete" | "patch", routePath: string): Handler {
  const handlers = new Map<string, Handler>();
  const app = {
    get(path: string, ...routeHandlers: Handler[]) {
      handlers.set(`get ${path}`, routeHandlers.at(-1)!);
      return this;
    },
    post(path: string, ...routeHandlers: Handler[]) {
      handlers.set(`post ${path}`, routeHandlers.at(-1)!);
      return this;
    },
    delete(path: string, ...routeHandlers: Handler[]) {
      handlers.set(`delete ${path}`, routeHandlers.at(-1)!);
      return this;
    },
    patch(path: string, ...routeHandlers: Handler[]) {
      handlers.set(`patch ${path}`, routeHandlers.at(-1)!);
      return this;
    },
  };
  registerUserSafetyRoutes(app as unknown as Express);
  const handler = handlers.get(`${method} ${routePath}`);
  assert.ok(handler, `${method.toUpperCase()} ${routePath} route is registered`);
  return handler;
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

async function createUser(storage: IStorage, suffix: string) {
  return storage.createUser({
    email: `safety-route-${suffix}@example.com`,
    name: `Route ${suffix}`,
    username: `route_${suffix}`,
    usernameNormalized: `route_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
}

test("blocking through the authenticated API removes the friendship and can be undone", async () => {
  const storage = await initStorage();
  const blocker = await createUser(storage, "blocker");
  const blocked = await createUser(storage, "blocked");
  const friendship = await storage.sendFriendRequest(blocker.id, blocked.id);
  await storage.acceptFriendRequest(friendship.id);

  const blockHandler = getRouteHandler("post", "/api/users/:id/block");
  const blockResponse = responseRecorder();
  await blockHandler({ params: { id: String(blocked.id) }, user: blocker }, blockResponse);
  assert.equal(blockResponse.statusCode, 200);
  assert.equal((await storage.getFriends(blocker.id)).length, 0);

  const unblockHandler = getRouteHandler("delete", "/api/users/:id/block");
  const unblockResponse = responseRecorder();
  await unblockHandler({ params: { id: String(blocked.id) }, user: blocker }, unblockResponse);
  assert.equal(unblockResponse.statusCode, 200);
  assert.equal(await storage.isBlockedBetween(blocker.id, blocked.id), false);
});

test("user report API validates the target and stores reports without blocking", async () => {
  const storage = await initStorage();
  const reporter = await createUser(storage, "reporter");
  const reported = await createUser(storage, "reported");
  const reportHandler = getRouteHandler("post", "/api/users/:id/report");
  const response = responseRecorder();

  await reportHandler({
    params: { id: String(reported.id) },
    user: reporter,
    body: { reason: "spam", details: "Repeated unwanted messages" },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(await storage.isBlockedBetween(reporter.id, reported.id), false);
  assert.equal((await storage.getUserReports())[0]?.reportedUser?.id, reported.id);
});
