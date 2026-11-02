import assert from "node:assert/strict";
import test from "node:test";
import { MemStorage } from "./mem-storage";

async function createUser(storage: MemStorage) {
  return storage.createUser({
    email: "activity-update@example.com",
    name: "Original Name",
    username: "activity_update",
    usernameNormalized: "activity_update",
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
    lastActiveAt: "2026-10-22T18:42:13.000Z",
  });
}

test("updating an unrelated in-memory user field leaves activity unchanged", async () => {
  const storage = new MemStorage();
  const user = await createUser(storage);

  const updatedUser = await storage.updateUser(user.id, { name: "Updated Name" });

  assert.equal(updatedUser?.name, "Updated Name");
  assert.equal(updatedUser?.lastActiveAt, "2026-10-22T18:42:13.000Z");
});

test("clearing an in-memory user's activity timestamp stores and returns null", async () => {
  const storage = new MemStorage();
  const user = await createUser(storage);

  const updatedUser = await storage.updateUser(user.id, { lastActiveAt: null });

  assert.equal(updatedUser?.lastActiveAt, null);
  assert.equal((await storage.getUserById(user.id))?.lastActiveAt, null);
});
