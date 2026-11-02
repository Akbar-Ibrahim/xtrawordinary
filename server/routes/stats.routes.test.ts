import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import { initStorage } from "../storage";
import type { IStorage } from "../storage";
import { saveUserAchievement as saveMySqlUserAchievement } from "../mysql/stats";
import { registerStatsRoutes } from "./stats.routes";

process.env.STORAGE_MODE = "memory";

type Handler = (req: any, res: any) => Promise<unknown> | unknown;

function getSaveAchievementHandler(): Handler {
  let handler: Handler | undefined;
  const app = {
    get(_path: string, ..._handlers: Handler[]) {
      return this;
    },
    post(path: string, ...handlers: Handler[]) {
      if (path === "/api/user/achievements") handler = handlers.at(-1);
      return this;
    },
  };
  registerStatsRoutes(app as unknown as Express);
  assert.ok(handler, "POST /api/user/achievements route is registered");
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

function createMysqlAchievementDb() {
  const achievements = new Map<string, { id: number; userId: number; achievementId: string; unlockedAt: Date }>();
  let nextId = 1;
  const insertResults: number[] = [];
  const db = {
    insert() {
      return {
        values(values: { userId: number; achievementId: string; unlockedAt: Date }) {
          return {
            ignore: async () => {
              const key = `${values.userId}:${values.achievementId}`;
              if (achievements.has(key)) {
                insertResults.push(0);
                return [{ affectedRows: 0 }];
              }
              achievements.set(key, { id: nextId++, ...values });
              insertResults.push(1);
              return [{ affectedRows: 1 }];
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => [...achievements.values()],
              };
            },
          };
        },
      };
    },
  };
  return { db, insertResults };
}

async function createUser(storage: IStorage, username: string) {
  return storage.createUser({
    email: `${username}@example.com`,
    name: username,
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

test("new achievements notify accepted friends once and link to the player's profile", async () => {
  const storage = await initStorage();
  const player = await createUser(storage, "achievement_player");
  const friend = await createUser(storage, "achievement_friend");
  const pendingFriend = await createUser(storage, "achievement_pending");
  const acceptedRequest = await storage.sendFriendRequest(player.id, friend.id);
  await storage.acceptFriendRequest(acceptedRequest.id);
  await storage.sendFriendRequest(player.id, pendingFriend.id);

  const handler = getSaveAchievementHandler();
  const request = {
    user: { id: player.id, username: player.username },
    body: { achievementId: "games_bronze" },
  };
  const firstResponse = responseRecorder();
  const simultaneousResponse = responseRecorder();
  await Promise.all([
    handler(request, firstResponse),
    handler(request, simultaneousResponse),
  ]);

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(simultaneousResponse.statusCode, 200);
  const [notification] = await storage.getNotifications(friend.id);
  assert.equal(notification?.type, "friend_achievement_unlocked");
  assert.equal(notification?.title, "A friend unlocked an achievement");
  assert.equal(notification?.body, "@achievement_player earned the \"Games Bronze\" achievement");
  assert.equal(notification?.linkUrl, "/u/achievement_player");
  assert.deepEqual(await storage.getNotifications(pendingFriend.id), []);

  const duplicateResponse = responseRecorder();
  await handler(request, duplicateResponse);
  const friendNotifications = await storage.getNotifications(friend.id);
  assert.equal(friendNotifications.filter((item) => item.type === "friend_achievement_unlocked").length, 1);
});

test("concurrent and repeated MySQL-backed achievement submissions notify friends only once", async () => {
  const storage = await initStorage();
  const player = await createUser(storage, "mysql_achievement_player");
  const friend = await createUser(storage, "mysql_achievement_friend");
  const friendship = await storage.sendFriendRequest(player.id, friend.id);
  await storage.acceptFriendRequest(friendship.id);

  const originalSaveAchievement = storage.saveUserAchievement;
  const { db, insertResults } = createMysqlAchievementDb();
  storage.saveUserAchievement = (userId, achievementId, unlockedAt) =>
    saveMySqlUserAchievement(db, userId, achievementId, unlockedAt);

  try {
    const handler = getSaveAchievementHandler();
    const request = {
      user: { id: player.id, username: player.username },
      body: { achievementId: "games_bronze" },
    };
    const concurrentResponses = [responseRecorder(), responseRecorder()];
    await Promise.all(concurrentResponses.map(response => handler(request, response)));

    const repeatedResponse = responseRecorder();
    await handler(request, repeatedResponse);

    assert.deepEqual(concurrentResponses.map(response => response.statusCode), [200, 200]);
    assert.equal(repeatedResponse.statusCode, 200);
    assert.deepEqual(insertResults.sort(), [0, 0, 1], "only one INSERT IGNORE should insert a row");
    const friendAlerts = (await storage.getNotifications(friend.id))
      .filter(notification => notification.type === "friend_achievement_unlocked");
    assert.equal(friendAlerts.length, 1, "duplicates must not create extra friend achievement alerts");
  } finally {
    storage.saveUserAchievement = originalSaveAchievement;
  }
});

test("friends can turn off achievement milestone notifications", async () => {
  const storage = await initStorage();
  const player = await createUser(storage, "achievement_muted_player");
  const friend = await createUser(storage, "achievement_muted_friend");
  const request = await storage.sendFriendRequest(player.id, friend.id);
  await storage.acceptFriendRequest(request.id);
  await storage.setNotificationPreference(friend.id, "friend_achievement_unlocked", false);

  const handler = getSaveAchievementHandler();
  const response = responseRecorder();
  await handler(
    {
      user: { id: player.id, username: player.username },
      body: { achievementId: "first_win" },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(await storage.getNotifications(friend.id), []);
});

test("players can disable sharing new achievements with friends, and sharing is enabled by default", async () => {
  const storage = await initStorage();
  const player = await createUser(storage, "achievement_sharing_player");
  const friend = await createUser(storage, "achievement_sharing_friend");
  const request = await storage.sendFriendRequest(player.id, friend.id);
  await storage.acceptFriendRequest(request.id);

  assert.equal((await storage.getNotificationPreferences(player.id)).share_achievement_unlocked, true);
  await storage.setAllNotificationPreferences(player.id, false);
  assert.equal((await storage.getNotificationPreferences(player.id)).share_achievement_unlocked, true);
  await storage.setNotificationPreference(player.id, "share_achievement_unlocked", false);
  assert.equal((await storage.getNotificationPreferences(player.id)).share_achievement_unlocked, false);

  const handler = getSaveAchievementHandler();
  const response = responseRecorder();
  await handler(
    {
      user: { id: player.id, username: player.username },
      body: { achievementId: "first_win" },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal((await storage.getUserAchievements(player.id)).length, 1);
  assert.deepEqual(await storage.getNotifications(friend.id), []);
});
