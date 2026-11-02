import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { Express } from "express";
import { initStorage } from "../storage";
import { errorHandler } from "../middleware/error-handler";
import { registerAdminRoutes } from "./admin.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getRouteHandlers() {
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
    patch(path: string, ...routeHandlers: Handler[]) {
      handlers.set(`patch ${path}`, routeHandlers.at(-1)!);
      return this;
    },
    delete(path: string, ...routeHandlers: Handler[]) {
      handlers.set(`delete ${path}`, routeHandlers.at(-1)!);
      return this;
    },
  };

  registerAdminRoutes(app as unknown as Express);
  return handlers;
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

test("achievement sharing preference can be updated and read through the settings API", async () => {
  const storage = await initStorage();
  const user = await storage.createUser({
    email: "achievement-preferences@example.com",
    name: "Achievement Preferences",
    username: "achievement_preferences",
    usernameNormalized: "achievement_preferences",
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });

  const handlers = getRouteHandlers();
  const updateHandler = handlers.get("patch /api/notification-preferences/:type");
  const getHandler = handlers.get("get /api/notification-preferences");
  assert.ok(updateHandler, "PATCH notification preference route is registered");
  assert.ok(getHandler, "GET notification preferences route is registered");

  const updateResponse = responseRecorder();
  await updateHandler(
    {
      params: { type: "share_achievement_unlocked" },
      body: { enabled: false },
      user,
    },
    updateResponse,
  );

  assert.equal(updateResponse.statusCode, 200);
  assert.deepEqual(updateResponse.body, { ok: true });

  const getResponse = responseRecorder();
  await getHandler({ user }, getResponse);

  assert.equal(getResponse.statusCode, 200);
  assert.equal(
    (getResponse.body as Record<string, boolean>).share_achievement_unlocked,
    false,
  );

  const unsupportedResponse = responseRecorder();
  await updateHandler(
    {
      params: { type: "unsupported_preference" },
      body: { enabled: false },
      user,
    },
    unsupportedResponse,
  );
  assert.equal(unsupportedResponse.statusCode, 400);
});

test("notification preference mutation returns a clear 400 for malformed JSON over HTTP", async () => {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.isAuthenticated = () => true;
    req.user = { id: 9867968 };
    next();
  });
  registerAdminRoutes(app);
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/notification-preferences/share_achievement_unlocked`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: '{"enabled":',
      },
    );
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
