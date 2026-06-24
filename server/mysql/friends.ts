import { eq, desc, and, or, inArray, sql } from "drizzle-orm";
import type { Friendship, InsertFriendship, FriendChallenge, InsertFriendChallenge } from "@shared/schema";
import * as schema from "../db-schema";

function toFriendship(r: any): Friendship {
  return { id: r.id, requesterId: r.requesterId, addresseeId: r.addresseeId, status: r.status as Friendship["status"], createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) };
}

function toChallenge(r: any): FriendChallenge {
  return { id: r.id, senderId: r.senderId, receiverId: r.receiverId, gameSlug: r.gameSlug, senderScore: r.senderScore, receiverScore: r.receiverScore ?? null, status: r.status as FriendChallenge["status"], message: r.message || null, seed: r.seed ?? null, gameConfig: r.gameConfig ?? null, senderViewed: Boolean(r.senderViewed), receiverViewed: Boolean(r.receiverViewed), createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) };
}

export async function getFriendshipById(db: any, id: number): Promise<Friendship | undefined> {
  const rows = await db.select().from(schema.friendships).where(eq(schema.friendships.id, id)).limit(1);
  return rows[0] ? toFriendship(rows[0]) : undefined;
}

export async function sendFriendRequest(db: any, requesterId: number, addresseeId: number): Promise<Friendship> {
  const result = await db.insert(schema.friendships).values({ requesterId, addresseeId, status: "pending" });
  return (await getFriendshipById(db, result[0].insertId))!;
}

export async function acceptFriendRequest(db: any, id: number): Promise<Friendship | undefined> {
  await db.update(schema.friendships).set({ status: "accepted" }).where(eq(schema.friendships.id, id));
  return getFriendshipById(db, id);
}

export async function declineFriendRequest(db: any, id: number): Promise<Friendship | undefined> {
  await db.update(schema.friendships).set({ status: "declined" }).where(eq(schema.friendships.id, id));
  return getFriendshipById(db, id);
}

export async function removeFriend(db: any, id: number): Promise<void> {
  await db.delete(schema.friendships).where(eq(schema.friendships.id, id));
}

export async function getFriends(db: any, userId: number): Promise<Array<Friendship & { friendUser: { id: number; name: string; avatarUrl: string | null } }>> {
  const rows = await db.select().from(schema.friendships).where(and(eq(schema.friendships.status, "accepted"), or(eq(schema.friendships.requesterId, userId), eq(schema.friendships.addresseeId, userId))));
  if (rows.length === 0) return [];
  const friendIds = rows.map((r: any) => r.requesterId === userId ? r.addresseeId : r.requesterId);
  const friendUsers = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, friendIds));
  const userMap = new Map(friendUsers.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
  return rows.map((row: any) => {
    const friendId = row.requesterId === userId ? row.addresseeId : row.requesterId;
    return { ...toFriendship(row), friendUser: userMap.get(friendId) || { id: friendId, name: "Unknown", avatarUrl: null } };
  });
}

export async function getPendingFriendRequests(db: any, userId: number): Promise<Array<Friendship & { requesterUser: { id: number; name: string; avatarUrl: string | null } }>> {
  const rows = await db.select().from(schema.friendships).where(and(eq(schema.friendships.status, "pending"), eq(schema.friendships.addresseeId, userId)));
  if (rows.length === 0) return [];
  const requesterIds = rows.map((r: any) => r.requesterId);
  const requesterUsers = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, requesterIds));
  const userMap = new Map(requesterUsers.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
  return rows.map((row: any) => ({ ...toFriendship(row), requesterUser: userMap.get(row.requesterId) || { id: row.requesterId, name: "Unknown", avatarUrl: null } }));
}

export async function getFriendship(db: any, userId1: number, userId2: number): Promise<Friendship | undefined> {
  const rows = await db.select().from(schema.friendships).where(or(and(eq(schema.friendships.requesterId, userId1), eq(schema.friendships.addresseeId, userId2)), and(eq(schema.friendships.requesterId, userId2), eq(schema.friendships.addresseeId, userId1)))).limit(1);
  return rows[0] ? toFriendship(rows[0]) : undefined;
}

export async function getFriendChallenge(db: any, id: number): Promise<FriendChallenge | undefined> {
  const rows = await db.select().from(schema.friendChallenges).where(eq(schema.friendChallenges.id, id)).limit(1);
  return rows[0] ? toChallenge(rows[0]) : undefined;
}

export async function createFriendChallenge(db: any, challenge: InsertFriendChallenge): Promise<FriendChallenge> {
  const result = await db.insert(schema.friendChallenges).values({
    senderId: challenge.senderId, receiverId: challenge.receiverId, gameSlug: challenge.gameSlug,
    senderScore: challenge.senderScore, receiverScore: challenge.receiverScore, status: challenge.status,
    message: challenge.message, seed: challenge.seed ?? null, gameConfig: challenge.gameConfig ?? null, senderViewed: challenge.senderViewed ?? false,
  });
  return (await getFriendChallenge(db, result[0].insertId))!;
}

export async function getFriendChallenges(db: any, userId: number): Promise<FriendChallenge[]> {
  const rows = await db.select().from(schema.friendChallenges)
    .where(or(eq(schema.friendChallenges.senderId, userId), eq(schema.friendChallenges.receiverId, userId)))
    .orderBy(desc(schema.friendChallenges.createdAt));
  const challenges = rows.map((r: any) => toChallenge(r));
  const userIds = new Set<number>();
  for (const c of challenges) { userIds.add(c.senderId); userIds.add(c.receiverId); }
  if (userIds.size === 0) return challenges;
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, Array.from(userIds)));
  const userMap = new Map<number, { name: string; avatarUrl: string | null }>();
  for (const u of userRows) userMap.set(u.id, { name: u.name, avatarUrl: u.avatarUrl });
  return challenges.map((c: any) => ({ ...c, senderName: userMap.get(c.senderId)?.name, receiverName: userMap.get(c.receiverId)?.name, senderAvatarUrl: userMap.get(c.senderId)?.avatarUrl ?? null, receiverAvatarUrl: userMap.get(c.receiverId)?.avatarUrl ?? null }));
}

export async function getPendingFriendChallenge(db: any, senderId: number, receiverId: number, gameSlug: string): Promise<FriendChallenge | undefined> {
  const rows = await db.select().from(schema.friendChallenges).where(and(eq(schema.friendChallenges.senderId, senderId), eq(schema.friendChallenges.receiverId, receiverId), eq(schema.friendChallenges.gameSlug, gameSlug), eq(schema.friendChallenges.status, "pending"))).limit(1);
  return rows[0] ? toChallenge(rows[0]) : undefined;
}

export async function completeFriendChallenge(db: any, id: number, score: number): Promise<FriendChallenge | undefined> {
  await db.update(schema.friendChallenges).set({ receiverScore: score, status: "completed", senderViewed: false }).where(eq(schema.friendChallenges.id, id));
  return getFriendChallenge(db, id);
}

export async function cancelFriendChallenge(db: any, id: number): Promise<FriendChallenge | undefined> {
  await db.update(schema.friendChallenges).set({ status: "cancelled" }).where(eq(schema.friendChallenges.id, id));
  return getFriendChallenge(db, id);
}

export async function declineFriendChallenge(db: any, id: number): Promise<FriendChallenge | undefined> {
  await db.update(schema.friendChallenges).set({ status: "declined" }).where(eq(schema.friendChallenges.id, id));
  return getFriendChallenge(db, id);
}

export async function markChallengeViewed(db: any, id: number): Promise<void> {
  await db.update(schema.friendChallenges).set({ senderViewed: true }).where(eq(schema.friendChallenges.id, id));
}

export async function markChallengeReceiverViewed(db: any, id: number): Promise<void> {
  await db.update(schema.friendChallenges).set({ receiverViewed: true }).where(eq(schema.friendChallenges.id, id));
}

export async function expireFriendChallenges(db: any): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await db.update(schema.friendChallenges).set({ status: "cancelled" }).where(and(eq(schema.friendChallenges.status, "pending"), sql`${schema.friendChallenges.createdAt} < ${cutoff}`));
  return (result as any)[0]?.affectedRows ?? 0;
}
