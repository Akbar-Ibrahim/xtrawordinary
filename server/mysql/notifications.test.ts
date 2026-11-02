import assert from "node:assert/strict";
import test from "node:test";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  getNotificationPreferences,
  setNotificationPreference,
  setAllNotificationPreferences,
} from "./notifications";

function createPreferenceDb() {
  const preferences = new Map<string, { userId: number; type: string; enabled: number }>();
  const dialect = new MySqlDialect();
  const db = {
    select() {
      return {
        from() {
          return {
            where(condition: unknown) {
              const query = dialect.sqlToQuery(condition as any);
              assert.match(
                query.sql,
                /`notification_preferences`\.`user_id` = \?/,
                "preference lookups should be scoped to a user",
              );
              assert.equal(query.params.length, 1, "the user ID should be the only lookup parameter");
              const userId = query.params[0];
              return Promise.resolve(
                [...preferences.values()].filter((preference) => preference.userId === userId),
              );
            },
          };
        },
      };
    },
    insert() {
      return {
        values(value: { userId: number; type: string; enabled: boolean }) {
          return {
            onDuplicateKeyUpdate({ set }: { set: { enabled: boolean } }) {
              preferences.set(`${value.userId}:${value.type}`, {
                userId: value.userId,
                type: value.type,
                enabled: set.enabled ? 1 : 0,
              });
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
  return { db, preferences };
}

test("achievement-sharing preferences remain isolated between MySQL users", async () => {
  const { db, preferences } = createPreferenceDb();
  const firstUserId = 42;
  const secondUserId = 73;
  const preferenceType = "share_achievement_unlocked";

  assert.equal((await getNotificationPreferences(db, firstUserId))[preferenceType], true);
  assert.equal((await getNotificationPreferences(db, secondUserId))[preferenceType], true);

  await setNotificationPreference(db, firstUserId, preferenceType, false);
  assert.equal((await getNotificationPreferences(db, firstUserId))[preferenceType], false);
  assert.equal((await getNotificationPreferences(db, secondUserId))[preferenceType], true);

  await setNotificationPreference(db, secondUserId, preferenceType, false);
  assert.equal((await getNotificationPreferences(db, firstUserId))[preferenceType], false);
  assert.equal((await getNotificationPreferences(db, secondUserId))[preferenceType], false);

  await setNotificationPreference(db, firstUserId, preferenceType, true);
  assert.equal((await getNotificationPreferences(db, firstUserId))[preferenceType], true);
  assert.equal((await getNotificationPreferences(db, secondUserId))[preferenceType], false);

  assert.deepEqual(
    [...preferences.keys()].sort(),
    [
      `${firstUserId}:${preferenceType}`,
      `${secondUserId}:${preferenceType}`,
    ].sort(),
    "each user's preference should occupy a separate user/type record",
  );
});

test("bulk notification preferences remain isolated between MySQL users", async () => {
  const { db } = createPreferenceDb();
  const firstUserId = 42;
  const secondUserId = 73;
  const preferenceType = "achievement_unlocked";

  await setAllNotificationPreferences(db, firstUserId, false);
  await setAllNotificationPreferences(db, secondUserId, true);
  await setNotificationPreference(db, firstUserId, "share_achievement_unlocked", false);

  const firstInitialState = await getNotificationPreferences(db, firstUserId);
  const secondInitialState = await getNotificationPreferences(db, secondUserId);
  assert.notDeepEqual(firstInitialState, secondInitialState, "users should start with different saved states");
  assert.ok(Object.values(firstInitialState).every((enabled) => !enabled));
  assert.ok(Object.values(secondInitialState).every(Boolean));

  await setNotificationPreference(db, firstUserId, preferenceType, true);
  const secondStateBeforeFirstBulkUpdate = await getNotificationPreferences(db, secondUserId);
  await setAllNotificationPreferences(db, firstUserId, false);

  assert.ok(
    Object.values(await getNotificationPreferences(db, firstUserId)).every((enabled) => !enabled),
    "the first user's bulk update should change all of their preferences",
  );
  assert.deepEqual(
    await getNotificationPreferences(db, secondUserId),
    secondStateBeforeFirstBulkUpdate,
    "updating the first user should leave the second user's saved values unchanged",
  );

  await setNotificationPreference(db, secondUserId, preferenceType, false);
  const firstStateBeforeSecondBulkUpdate = await getNotificationPreferences(db, firstUserId);
  await setAllNotificationPreferences(db, secondUserId, true);

  assert.ok(
    Object.values(await getNotificationPreferences(db, secondUserId)).every(Boolean),
    "the second user's bulk update should change all of their preferences",
  );
  assert.deepEqual(
    await getNotificationPreferences(db, firstUserId),
    firstStateBeforeSecondBulkUpdate,
    "updating the second user should leave the first user's saved values unchanged",
  );
});
