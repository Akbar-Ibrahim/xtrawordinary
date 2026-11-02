import assert from "node:assert/strict";
import test from "node:test";
import { MemStorage } from "./mem-storage";

async function createUser(storage: MemStorage, suffix: string) {
  return storage.createUser({
    email: `user-safety-${suffix}@example.com`,
    name: `Safety ${suffix}`,
    username: `safety_${suffix}`,
    usernameNormalized: `safety_${suffix}`,
    passwordHash: null,
    googleId: null,
    emailVerified: true,
    avatarUrl: null,
    isAdmin: false,
    isBanned: false,
    isPremium: false,
  });
}

test("blocking removes friendship, cancels pending direct friend challenges, and can be undone", async () => {
  const storage = new MemStorage();
  const blocker = await createUser(storage, "blocker");
  const blocked = await createUser(storage, "blocked");
  const friendship = await storage.sendFriendRequest(blocker.id, blocked.id);
  await storage.acceptFriendRequest(friendship.id);
  const challenge = await storage.createFriendChallenge({
    senderId: blocker.id,
    receiverId: blocked.id,
    gameSlug: "word-length",
    senderScore: 10,
    receiverScore: null,
    status: "pending",
    message: null,
    seed: null,
    gameConfig: null,
    senderViewed: false,
    receiverViewed: false,
  });

  await storage.blockUser(blocker.id, blocked.id);

  assert.equal(await storage.isBlockedBetween(blocker.id, blocked.id), true);
  assert.deepEqual(await storage.getBlockedUserIds(blocked.id, [blocker.id]), [blocker.id]);
  assert.equal((await storage.getFriends(blocker.id)).length, 0);
  assert.equal((await storage.getFriendChallenge(challenge.id))?.status, "cancelled");
  assert.equal((await storage.getBlockedUsers(blocker.id))[0]?.id, blocked.id);

  await storage.unblockUser(blocker.id, blocked.id);
  assert.equal(await storage.isBlockedBetween(blocker.id, blocked.id), false);
  assert.equal((await storage.getFriends(blocker.id)).length, 0, "unblocking must not restore friendship");
});

test("user reports are independent of blocking and appear in the admin review list", async () => {
  const storage = new MemStorage();
  const reporter = await createUser(storage, "reporter");
  const reported = await createUser(storage, "reported");

  await storage.createUserReport(reporter.id, reported.id, {
    reason: "spam",
    details: "Repeated unwanted messages",
  });

  const [report] = await storage.getUserReports();
  assert.equal(report?.reason, "spam");
  assert.equal(report?.details, "Repeated unwanted messages");
  assert.equal(report?.reporter?.id, reporter.id);
  assert.equal(report?.reportedUser?.id, reported.id);
  assert.equal(await storage.isBlockedBetween(reporter.id, reported.id), false);
  assert.equal(await storage.markUserReportRead(report.id), true);
  assert.ok((await storage.getUserReports())[0]?.readAt);
  assert.equal(await storage.markUserReportRead(9999), false);
});

test("pending friend requests preserve optional notes and allow requests without notes", async () => {
  const storage = new MemStorage();
  const requester = await createUser(storage, "note-sender");
  const recipient = await createUser(storage, "note-recipient");
  const otherRecipient = await createUser(storage, "no-note-recipient");

  const withNote = await storage.sendFriendRequest(requester.id, recipient.id, "We play the same games!");
  const withoutNote = await storage.sendFriendRequest(requester.id, otherRecipient.id);

  const requests = await storage.getPendingFriendRequests(recipient.id);
  assert.equal(requests.find((request) => request.id === withNote.id)?.note, "We play the same games!");
  assert.equal((await storage.getPendingFriendRequests(otherRecipient.id))[0]?.note, null);
  assert.equal((await storage.getFriendshipById(withoutNote.id))?.note, null);
});
