import assert from "node:assert/strict";
import express from "express";
import type { Express } from "express";
import test from "node:test";
import { initStorage, storage } from "../storage";
import * as schema from "../db-schema";
import { getFriendActivity } from "../mysql/friends";
import { errorHandler } from "../middleware/error-handler";
import { registerFriendsRoutes } from "./friends.routes";
import { registerProfileRoutes } from "./profile.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

const handlers = new Map<string, Handler>();
function createRouteApp(registry: Map<string, Handler>) {
  return {
    get(path: string, ...routeHandlers: Handler[]) {
      registry.set(`get ${path}`, routeHandlers.at(-1)!);
      return this;
    },
    post(path: string, ...routeHandlers: Handler[]) {
      registry.set(`post ${path}`, routeHandlers.at(-1)!);
      return this;
    },
    patch(path: string, ...routeHandlers: Handler[]) {
      registry.set(`patch ${path}`, routeHandlers.at(-1)!);
      return this;
    },
    delete(path: string, ...routeHandlers: Handler[]) {
      registry.set(`delete ${path}`, routeHandlers.at(-1)!);
      return this;
    },
    use() {
      return this;
    },
  };
}

const routeApp = createRouteApp(handlers);
registerProfileRoutes(routeApp as unknown as Express);
registerFriendsRoutes(routeApp as unknown as Express);

function route(method: "get" | "patch", path: string, routeHandlers = handlers): Handler {
  const handler = routeHandlers.get(`${method} ${path}`);
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

test("profile mutation returns a clear 400 for malformed JSON over HTTP", async () => {
  const app = express();
  app.use(express.json());
  registerProfileRoutes(app);
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users/me`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: '{"bio":',
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
    email: `activity-${suffix}@example.com`,
    name: `Activity ${suffix}`,
    username: `activity_${suffix}`,
    usernameNormalized: `activity_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
}

test("friend activity is returned only to friends while the owner allows it", async () => {
  await initStorage();
  const suffix = String(Date.now());
  const viewer = await createUser(`v${suffix}`);
  const friend = await createUser(`f${suffix}`);
  const stranger = await createUser(`s${suffix}`);
  const friendship = await storage.sendFriendRequest(viewer.id, friend.id);
  await storage.acceptFriendRequest(friendship.id);
  const lastActiveAt = new Date(Date.now() - 3 * 60_000).toISOString();
  await storage.recordUserActivity(friend.id, lastActiveAt);
  await storage.recordUserActivity(stranger.id, lastActiveAt);

  const getFriends = route("get", "/api/friends");
  const friendsResponse = responseRecorder();
  await getFriends({ user: viewer }, friendsResponse);
  assert.equal(friendsResponse.body[0].friendUser.lastActiveAt, lastActiveAt);

  const search = route("get", "/api/friends/search");
  const searchResponse = responseRecorder();
  await search({ user: viewer, query: { q: "activity" } }, searchResponse);
  const friendSearchResult = searchResponse.body.find((user: any) => user.id === friend.id);
  const strangerSearchResult = searchResponse.body.find((user: any) => user.id === stranger.id);
  assert.equal(friendSearchResult.lastActiveAt, lastActiveAt);
  assert.equal(strangerSearchResult.lastActiveAt, null);

  const getProfile = route("get", "/api/users/:id/profile");
  const getActivity = route("get", "/api/users/:id/activity");
  const profileResponse = responseRecorder();
  await getProfile({ params: { id: String(friend.id) }, user: viewer }, profileResponse);
  assert.equal(profileResponse.body.user.lastActiveAt, lastActiveAt);

  const friendActivityResponse = responseRecorder();
  await getActivity({ params: { id: String(friend.id) }, user: viewer }, friendActivityResponse);
  assert.equal(friendActivityResponse.body.lastActiveAt, lastActiveAt);

  const strangerActivityResponse = responseRecorder();
  await getActivity({ params: { id: String(stranger.id) }, user: viewer }, strangerActivityResponse);
  assert.equal(strangerActivityResponse.body.lastActiveAt, null);

  const anonymousActivityResponse = responseRecorder();
  await getActivity({ params: { id: String(friend.id) } }, anonymousActivityResponse);
  assert.equal(anonymousActivityResponse.body.lastActiveAt, null);

  const strangerProfileResponse = responseRecorder();
  await getProfile({ params: { id: String(stranger.id) }, user: viewer }, strangerProfileResponse);
  assert.equal(strangerProfileResponse.body.user.lastActiveAt, null);

  const anonymousProfileResponse = responseRecorder();
  await getProfile({ params: { id: String(friend.id) } }, anonymousProfileResponse);
  assert.equal(anonymousProfileResponse.body.user.lastActiveAt, null);

  const globalSearch = route("get", "/api/users/search");
  const globalSearchResponse = responseRecorder();
  await globalSearch({ user: viewer, query: { q: "activity" } }, globalSearchResponse);
  assert.equal(globalSearchResponse.body.find((user: any) => user.id === friend.id).lastActiveAt, lastActiveAt);
  assert.equal(globalSearchResponse.body.find((user: any) => user.id === stranger.id).lastActiveAt, null);

  const updateProfile = route("patch", "/api/users/me");
  const hideResponse = responseRecorder();
  await updateProfile({ user: friend, body: { hideActivity: true } }, hideResponse);
  assert.equal(hideResponse.statusCode, 200);
  assert.equal(hideResponse.body.hideActivity, true);

  const hiddenFriendsResponse = responseRecorder();
  await getFriends({ user: viewer }, hiddenFriendsResponse);
  assert.equal(hiddenFriendsResponse.body[0].friendUser.lastActiveAt, null);

  const hiddenSearchResponse = responseRecorder();
  await search({ user: viewer, query: { q: "activity" } }, hiddenSearchResponse);
  assert.equal(hiddenSearchResponse.body.find((user: any) => user.id === friend.id).lastActiveAt, null);

  const hiddenGlobalSearchResponse = responseRecorder();
  await globalSearch({ user: viewer, query: { q: "activity" } }, hiddenGlobalSearchResponse);
  assert.equal(hiddenGlobalSearchResponse.body.find((user: any) => user.id === friend.id).lastActiveAt, null);

  const hiddenProfileResponse = responseRecorder();
  await getProfile({ params: { id: String(friend.id) }, user: viewer }, hiddenProfileResponse);
  assert.equal(hiddenProfileResponse.body.user.lastActiveAt, null);

  const hiddenActivityResponse = responseRecorder();
  await getActivity({ params: { id: String(friend.id) }, user: viewer }, hiddenActivityResponse);
  assert.equal(hiddenActivityResponse.body.lastActiveAt, null);

  const showResponse = responseRecorder();
  await updateProfile({ user: friend, body: { hideActivity: false } }, showResponse);
  assert.equal(showResponse.statusCode, 200);
  assert.equal(showResponse.body.hideActivity, false);
  assert.equal((await storage.getFriendActivity(viewer.id, [friend.id]))[friend.id], lastActiveAt);
});

test("MySQL-backed profile, search, and activity responses only expose enabled activity to accepted friends", async () => {
  await initStorage();
  const suffix = String(Date.now());
  const viewer = await createUser(`mysql-v${suffix}`);
  const visible = await createUser(`mysql-visible${suffix}`);
  const hidden = await createUser(`mysql-hidden${suffix}`);
  const pending = await createUser(`mysql-pending${suffix}`);
  const unrelated = await createUser(`mysql-unrelated${suffix}`);

  const visibleFriendship = await storage.sendFriendRequest(viewer.id, visible.id);
  await storage.acceptFriendRequest(visibleFriendship.id);
  const hiddenFriendship = await storage.sendFriendRequest(viewer.id, hidden.id);
  await storage.acceptFriendRequest(hiddenFriendship.id);
  await storage.sendFriendRequest(viewer.id, pending.id);

  const lastActiveAt = new Date("2026-10-22T12:34:56.000Z").toISOString();
  for (const user of [visible, hidden, pending, unrelated]) {
    await storage.recordUserActivity(user.id, lastActiveAt);
  }
  await storage.updateUser(hidden.id, { hideActivity: true });

  const friendshipRows = [
    { requesterId: viewer.id, addresseeId: visible.id, status: "accepted" },
    { requesterId: viewer.id, addresseeId: hidden.id, status: "accepted" },
    { requesterId: viewer.id, addresseeId: pending.id, status: "pending" },
  ];
  const acceptedFriendIds = new Set(
    friendshipRows
      .filter((friendship) => friendship.status === "accepted")
      .map((friendship) => friendship.addresseeId),
  );
  const mysqlUserRows = [
    { id: visible.id, hideActivity: false, lastActiveAt: new Date(lastActiveAt) },
    { id: hidden.id, hideActivity: true, lastActiveAt: new Date(lastActiveAt) },
    { id: pending.id, hideActivity: false, lastActiveAt: new Date(lastActiveAt) },
    { id: unrelated.id, hideActivity: false, lastActiveAt: new Date(lastActiveAt) },
  ];
  const mysqlDb = {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => table === schema.friendships
          ? friendshipRows.filter((friendship) => friendship.status === "accepted")
          : mysqlUserRows.filter((user) => acceptedFriendIds.has(user.id) && !user.hideActivity),
      }),
    }),
  };
  const mysqlActivityStorage = {
    getFriendActivity: (viewerId: number, candidateIds: number[]) =>
      getFriendActivity(mysqlDb, viewerId, candidateIds),
  };
  const mysqlHandlers = new Map<string, Handler>();
  registerProfileRoutes(createRouteApp(mysqlHandlers) as unknown as Express, mysqlActivityStorage);

  const globalSearch = route("get", "/api/users/search", mysqlHandlers);
  const searchResponse = responseRecorder();
  await globalSearch({ user: viewer, query: { q: "mysql-" } }, searchResponse);
  const searchResults = new Map(searchResponse.body.map((user: any) => [user.id, user]));
  assert.equal((searchResults.get(visible.id) as any).lastActiveAt, lastActiveAt);
  for (const user of [hidden, pending, unrelated]) {
    assert.equal((searchResults.get(user.id) as any).lastActiveAt, null);
  }

  const profileRoute = route("get", "/api/users/:id/profile", mysqlHandlers);
  const usernameProfileRoute = route("get", "/api/usernames/:username/profile", mysqlHandlers);
  const activityRoute = route("get", "/api/users/:id/activity", mysqlHandlers);
  const visibleProfile = responseRecorder();
  await profileRoute({ params: { id: String(visible.id) }, user: viewer }, visibleProfile);
  assert.equal(visibleProfile.body.user.lastActiveAt, lastActiveAt);

  const visibleUsernameProfile = responseRecorder();
  await usernameProfileRoute({ params: { username: visible.username }, user: viewer }, visibleUsernameProfile);
  assert.equal(visibleUsernameProfile.body.user.lastActiveAt, lastActiveAt);

  for (const user of [hidden, pending, unrelated]) {
    const profile = responseRecorder();
    await profileRoute({ params: { id: String(user.id) }, user: viewer }, profile);
    assert.equal(profile.body.user.lastActiveAt, null);

    const usernameProfile = responseRecorder();
    await usernameProfileRoute({ params: { username: user.username }, user: viewer }, usernameProfile);
    assert.equal(usernameProfile.body.user.lastActiveAt, null);

    const activity = responseRecorder();
    await activityRoute({ params: { id: String(user.id) }, user: viewer }, activity);
    assert.equal(activity.body.lastActiveAt, null);
  }

  const anonymousProfile = responseRecorder();
  await profileRoute({ params: { id: String(visible.id) } }, anonymousProfile);
  assert.equal(anonymousProfile.body.user.lastActiveAt, null);

  const anonymousUsernameProfile = responseRecorder();
  await usernameProfileRoute({ params: { username: visible.username } }, anonymousUsernameProfile);
  assert.equal(anonymousUsernameProfile.body.user.lastActiveAt, null);

  const anonymousActivity = responseRecorder();
  await activityRoute({ params: { id: String(visible.id) } }, anonymousActivity);
  assert.equal(anonymousActivity.body.lastActiveAt, null);
});
