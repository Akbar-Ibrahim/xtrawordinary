import assert from "node:assert/strict";
import test from "node:test";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getFriendActivity, getFriends, sendFriendRequest } from "./friends";
import * as schema from "../db-schema";
import { getUserById, recordUserActivity, toUser, updateUser } from "./users";

function createActivityDb(
  friendshipRows: Record<string, unknown>[],
  userRows: Record<string, unknown>[],
) {
  const queries: Array<{ table: unknown; where?: unknown }> = [];
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: async (condition: unknown) => {
          queries.push({ table, where: condition });
          if (table === schema.friendships) return friendshipRows;
          if (table === schema.users) return userRows;
          throw new Error("Unexpected MySQL table in activity test");
        },
      }),
    }),
  };
  return { db, queries };
}

function mockDb(row: Record<string, unknown>) {
  let insertedValues: Record<string, unknown> | undefined;
  return {
    getInsertedValues: () => insertedValues,
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        insertedValues = values;
        return [{ insertId: 3 }];
      },
    }),
    select: () => {
      const query = {
        from() { return query; },
        where() { return query; },
        limit: async () => [row],
      };
      return query;
    },
  };
}

function mockUserWriteDb(lastActiveAt: Date | null = null) {
  const userRow: Record<string, unknown> = {
    id: 9,
    email: "user@example.com",
    name: "User",
    username: "user",
    usernameNormalized: "user",
    lastActiveAt,
    createdAt: new Date("2026-10-21T10:00:00.000Z"),
  };
  let lastUpdate: Record<string, unknown> | undefined;

  return {
    getLastUpdate: () => lastUpdate,
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          lastUpdate = values;
          Object.assign(userRow, values);
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [userRow],
        }),
      }),
    }),
  };
}

test("MySQL friend requests persist and return an optional note", async () => {
  const createdAt = new Date("2026-10-21T10:00:00.000Z");
  const db = mockDb({
    id: 3,
    requesterId: 10,
    addresseeId: 20,
    note: "We play the same games!",
    status: "pending",
    createdAt,
  });

  const result = await sendFriendRequest(db, 10, 20, "We play the same games!");

  assert.equal(db.getInsertedValues()?.note, "We play the same games!");
  assert.equal(result.note, "We play the same games!");
});

test("MySQL friend requests keep the note nullable when it is omitted", async () => {
  const db = mockDb({
    id: 3,
    requesterId: 10,
    addresseeId: 20,
    note: null,
    status: "pending",
    createdAt: new Date("2026-10-21T10:00:00.000Z"),
  });

  const result = await sendFriendRequest(db, 10, 20);

  assert.equal(db.getInsertedValues()?.note, null);
  assert.equal(result.note, null);
});

test("MySQL friend activity only exposes enabled activity for accepted friends", async () => {
  const activityAt = new Date("2026-10-22T11:12:13.000Z");
  const { db, queries } = createActivityDb(
    [
      { requesterId: 1, addresseeId: 2 },
      { requesterId: 3, addresseeId: 1 },
    ],
    [
      { id: 2, lastActiveAt: activityAt },
      { id: 6, lastActiveAt: null },
    ],
  );

  const activity = await getFriendActivity(db, 1, [1, 2, 3, 4, 5, 6, 2]);

  assert.deepEqual(activity, { 2: "2026-10-22T11:12:13.000Z" });
  assert.equal(queries.length, 2);

  const dialect = new MySqlDialect();
  const friendshipFilter = dialect.sqlToQuery(queries[0].where as any);
  assert.ok(friendshipFilter.sql.includes("status"));
  assert.ok(friendshipFilter.sql.includes("requester_id"));
  assert.ok(friendshipFilter.sql.includes("addressee_id"));
  assert.ok(friendshipFilter.params.includes("accepted"));
  for (const candidateId of [2, 3, 4, 5, 6]) {
    assert.ok(friendshipFilter.params.includes(candidateId));
  }

  const userFilter = dialect.sqlToQuery(queries[1].where as any);
  assert.ok(userFilter.sql.includes("hide_activity"));
  assert.ok(userFilter.params.includes(false));
  assert.ok(userFilter.params.includes(2));
  assert.ok(userFilter.params.includes(3));
});

test("MySQL friends only show enabled activity and serialize dates as ISO strings", async () => {
  const activityAt = new Date("2026-10-22T11:12:13.000Z");
  const createdAt = new Date("2026-10-21T10:00:00.000Z");
  const { db, queries } = createActivityDb(
    [
      { id: 1, requesterId: 10, addresseeId: 20, status: "accepted", createdAt },
      { id: 2, requesterId: 30, addresseeId: 10, status: "accepted", createdAt },
    ],
    [
      { id: 20, username: "visible", name: "Visible", avatarUrl: null, hideActivity: false, lastActiveAt: activityAt },
      { id: 30, username: "hidden", name: "Hidden", avatarUrl: null, hideActivity: true, lastActiveAt: activityAt },
    ],
  );

  const friends = await getFriends(db, 10);

  assert.equal(friends[0].createdAt, "2026-10-21T10:00:00.000Z");
  assert.equal(friends[0].friendUser.lastActiveAt, "2026-10-22T11:12:13.000Z");
  assert.equal(friends[1].friendUser.lastActiveAt, null);
  const friendshipFilter = new MySqlDialect().sqlToQuery(queries[0].where as any);
  assert.ok(friendshipFilter.params.includes("accepted"));
});

test("MySQL user dates serialize consistently as ISO strings", () => {
  const user = toUser({
    id: 9,
    email: "user@example.com",
    name: "User",
    username: "user",
    usernameNormalized: "user",
    lastActiveAt: new Date("2026-10-22T11:12:13.000Z"),
    createdAt: new Date("2026-10-21T10:00:00.000Z"),
  });

  assert.equal(user.lastActiveAt, "2026-10-22T11:12:13.000Z");
  assert.equal(user.createdAt, "2026-10-21T10:00:00.000Z");
});

test("recording MySQL user activity stores and reads back the expected UTC instant", async () => {
  const db = mockUserWriteDb();
  const activityAt = "2026-10-22T11:12:13.000Z";

  await recordUserActivity(db, 9, activityAt);

  const storedAt = db.getLastUpdate()?.lastActiveAt;
  assert.ok(storedAt instanceof Date);
  assert.equal(storedAt.toISOString(), activityAt);
  assert.equal((await getUserById(db, 9))?.lastActiveAt, activityAt);
});

test("updating a MySQL user's activity timestamp preserves its UTC instant on readback", async () => {
  const db = mockUserWriteDb();
  const activityAt = "2026-10-22T18:42:13.000Z";

  const updatedUser = await updateUser(db, 9, { lastActiveAt: activityAt });

  const storedAt = db.getLastUpdate()?.lastActiveAt;
  assert.ok(storedAt instanceof Date);
  assert.equal(storedAt.toISOString(), activityAt);
  assert.equal(updatedUser?.lastActiveAt, activityAt);
});

test("updating an unrelated MySQL user field leaves the activity timestamp unchanged", async () => {
  const activityAt = new Date("2026-10-22T18:42:13.000Z");
  const db = mockUserWriteDb(activityAt);

  const updatedUser = await updateUser(db, 9, { name: "Updated User" });

  assert.equal(db.getLastUpdate()?.name, "Updated User");
  assert.equal("lastActiveAt" in (db.getLastUpdate() ?? {}), false);
  assert.equal(updatedUser?.name, "Updated User");
  assert.equal(updatedUser?.lastActiveAt, activityAt.toISOString());
});

test("clearing a MySQL user's activity timestamp stores and returns null", async () => {
  const db = mockUserWriteDb();
  await updateUser(db, 9, { lastActiveAt: "2026-10-22T11:12:13.000Z" });

  const updatedUser = await updateUser(db, 9, { lastActiveAt: null });

  assert.equal(db.getLastUpdate()?.lastActiveAt, null);
  assert.equal(updatedUser?.lastActiveAt, null);
});
