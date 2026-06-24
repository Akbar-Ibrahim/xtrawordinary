import { eq, desc, asc, and, or, inArray, sql, isNull, ne } from "drizzle-orm";
import type { Group, InsertGroup, GroupMember, GroupRound, InsertGroupRound, GroupRoundScore, InsertGroupRoundScore } from "@shared/schema";
import * as schema from "../db-schema";

function toGroup(r: any): Group {
  return { id: r.id, name: r.name, description: r.description ?? null, inviteCode: r.inviteCode, ownerId: r.ownerId, isPublic: !!r.isPublic, isFeatured: !!r.isFeatured, avatarUrl: r.avatarUrl ?? null, memberCount: r.memberCount ?? 0, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) };
}

function toGroupMember(r: any): GroupMember {
  return { id: r.id, groupId: r.groupId, userId: r.userId, role: r.role as GroupMember["role"], joinedAt: r.joinedAt instanceof Date ? r.joinedAt.toISOString() : String(r.joinedAt) };
}

function toGroupRound(r: any): GroupRound {
  return { id: r.id, groupId: r.groupId, gameSlug: r.gameSlug, createdBy: r.createdBy, seed: r.seed, startWord: r.startWord ?? null, status: r.status as GroupRound["status"], gameConfig: r.gameConfig ?? null, closedAt: r.closedAt instanceof Date ? r.closedAt.toISOString() : (r.closedAt ?? null), createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) };
}

function toGroupRoundScore(r: any): GroupRoundScore {
  return { id: r.id, roundId: r.roundId, userId: r.userId, score: r.score, submittedAt: r.submittedAt instanceof Date ? r.submittedAt.toISOString() : String(r.submittedAt) };
}

export async function createGroup(db: any, group: InsertGroup): Promise<Group> {
  const result = await db.insert(schema.groups).values({ name: group.name, description: group.description ?? null, inviteCode: group.inviteCode, ownerId: group.ownerId, isPublic: group.isPublic ?? true, avatarUrl: group.avatarUrl ?? null });
  const rows = await db.select().from(schema.groups).where(eq(schema.groups.id, result[0].insertId)).limit(1);
  return toGroup(rows[0]);
}

export async function getGroup(db: any, id: number): Promise<Group | undefined> {
  const rows = await db.select({ group: schema.groups, memberCount: sql<number>`COUNT(${schema.groupMembers.id})` }).from(schema.groups).leftJoin(schema.groupMembers, eq(schema.groups.id, schema.groupMembers.groupId)).where(eq(schema.groups.id, id)).groupBy(schema.groups.id);
  if (!rows[0]) return undefined;
  return toGroup({ ...rows[0].group, memberCount: rows[0].memberCount });
}

export async function getGroupByInviteCode(db: any, code: string): Promise<Group | undefined> {
  const rows = await db.select().from(schema.groups).where(eq(schema.groups.inviteCode, code)).limit(1);
  return rows[0] ? toGroup(rows[0]) : undefined;
}

export async function updateGroup(db: any, id: number, updates: Partial<InsertGroup>): Promise<Group | undefined> {
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.isPublic !== undefined) dbUpdates.isPublic = updates.isPublic;
  if (updates.avatarUrl !== undefined) dbUpdates.avatarUrl = updates.avatarUrl;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.groups).set(dbUpdates).where(eq(schema.groups.id, id));
  return getGroup(db, id);
}

export async function deleteGroup(db: any, id: number): Promise<void> {
  await db.delete(schema.groupRoundScores).where(inArray(schema.groupRoundScores.roundId, db.select({ id: schema.groupRounds.id }).from(schema.groupRounds).where(eq(schema.groupRounds.groupId, id))));
  await db.delete(schema.groupRounds).where(eq(schema.groupRounds.groupId, id));
  await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, id));
  await db.delete(schema.groups).where(eq(schema.groups.id, id));
}

export async function getUserGroups(db: any, userId: number): Promise<Group[]> {
  const memberRows = await db.select({ groupId: schema.groupMembers.groupId }).from(schema.groupMembers).where(eq(schema.groupMembers.userId, userId));
  if (memberRows.length === 0) return [];
  const groupIds = memberRows.map((r: any) => r.groupId);
  const rows = await db.select({ group: schema.groups, memberCount: sql<number>`COUNT(${schema.groupMembers.id})` }).from(schema.groups).leftJoin(schema.groupMembers, eq(schema.groups.id, schema.groupMembers.groupId)).where(inArray(schema.groups.id, groupIds)).groupBy(schema.groups.id).orderBy(desc(schema.groups.createdAt));
  return rows.map((r: any) => toGroup({ ...r.group, memberCount: r.memberCount }));
}

export async function getPublicGroups(db: any, limit = 20): Promise<Group[]> {
  const rows = await db.select({ group: schema.groups, memberCount: sql<number>`COUNT(${schema.groupMembers.id})` }).from(schema.groups).leftJoin(schema.groupMembers, eq(schema.groups.id, schema.groupMembers.groupId)).where(eq(schema.groups.isPublic, true)).groupBy(schema.groups.id).orderBy(desc(sql`COUNT(${schema.groupMembers.id})`)).limit(limit);
  return rows.map((r: any) => toGroup({ ...r.group, memberCount: r.memberCount }));
}

export async function getAllGroups(db: any): Promise<Group[]> {
  const rows = await db.select({ group: schema.groups, memberCount: sql<number>`COUNT(${schema.groupMembers.id})` }).from(schema.groups).leftJoin(schema.groupMembers, eq(schema.groups.id, schema.groupMembers.groupId)).groupBy(schema.groups.id).orderBy(desc(schema.groups.createdAt));
  return rows.map((r: any) => toGroup({ ...r.group, memberCount: r.memberCount }));
}

export async function addGroupMember(db: any, groupId: number, userId: number, role: GroupMember["role"]): Promise<GroupMember> {
  const existing = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId))).limit(1);
  if (existing[0]) return toGroupMember(existing[0]);
  const result = await db.insert(schema.groupMembers).values({ groupId, userId, role });
  const rows = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.id, result[0].insertId)).limit(1);
  return toGroupMember(rows[0]);
}

export async function removeGroupMember(db: any, groupId: number, userId: number): Promise<void> {
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
}

export async function getGroupMembers(db: any, groupId: number): Promise<Array<GroupMember & { user: { id: number; name: string; avatarUrl: string | null } }>> {
  const rows = await db.select({ member: schema.groupMembers, user: { id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl } }).from(schema.groupMembers).innerJoin(schema.users, eq(schema.groupMembers.userId, schema.users.id)).where(eq(schema.groupMembers.groupId, groupId)).orderBy(asc(schema.groupMembers.joinedAt));
  return rows.map((r: any) => ({ ...toGroupMember(r.member), user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl || null } }));
}

export async function getGroupMember(db: any, groupId: number, userId: number): Promise<GroupMember | undefined> {
  const rows = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId))).limit(1);
  return rows[0] ? toGroupMember(rows[0]) : undefined;
}

export async function updateGroupMemberRole(db: any, groupId: number, userId: number, role: GroupMember["role"]): Promise<GroupMember | undefined> {
  await db.update(schema.groupMembers).set({ role }).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
  return getGroupMember(db, groupId, userId);
}

export async function createGroupRound(db: any, round: InsertGroupRound): Promise<GroupRound> {
  const result = await db.insert(schema.groupRounds).values({ groupId: round.groupId, gameSlug: round.gameSlug, createdBy: round.createdBy, seed: round.seed, startWord: round.startWord ?? null, status: round.status ?? "active", gameConfig: round.gameConfig ?? null });
  const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.id, result[0].insertId)).limit(1);
  return toGroupRound(rows[0]);
}

export async function getGroupRound(db: any, id: number): Promise<GroupRound | undefined> {
  const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.id, id)).limit(1);
  return rows[0] ? toGroupRound(rows[0]) : undefined;
}

export async function getGroupRounds(db: any, groupId: number, limit = 20): Promise<GroupRound[]> {
  const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.groupId, groupId)).orderBy(desc(schema.groupRounds.createdAt)).limit(limit);
  return rows.map((r: any) => toGroupRound(r));
}

export async function closeGroupRound(db: any, id: number): Promise<GroupRound | undefined> {
  await db.update(schema.groupRounds).set({ status: "closed", closedAt: new Date() }).where(eq(schema.groupRounds.id, id));
  return getGroupRound(db, id);
}

export async function submitGroupRoundScore(db: any, score: InsertGroupRoundScore): Promise<GroupRoundScore> {
  const existing = await db.select().from(schema.groupRoundScores).where(and(eq(schema.groupRoundScores.roundId, score.roundId), eq(schema.groupRoundScores.userId, score.userId))).limit(1);
  if (existing[0]) {
    if (score.score > existing[0].score) {
      await db.update(schema.groupRoundScores).set({ score: score.score, submittedAt: new Date() }).where(eq(schema.groupRoundScores.id, existing[0].id));
      return toGroupRoundScore({ ...existing[0], score: score.score, submittedAt: new Date() });
    }
    return toGroupRoundScore(existing[0]);
  }
  const result = await db.insert(schema.groupRoundScores).values({ roundId: score.roundId, userId: score.userId, score: score.score });
  const rows = await db.select().from(schema.groupRoundScores).where(eq(schema.groupRoundScores.id, result[0].insertId)).limit(1);
  return toGroupRoundScore(rows[0]);
}

export async function getGroupRoundScores(db: any, roundId: number): Promise<Array<GroupRoundScore & { user: { id: number; name: string; avatarUrl: string | null } }>> {
  const rows = await db.select({ score: schema.groupRoundScores, user: { id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl } }).from(schema.groupRoundScores).innerJoin(schema.users, eq(schema.groupRoundScores.userId, schema.users.id)).where(eq(schema.groupRoundScores.roundId, roundId)).orderBy(desc(schema.groupRoundScores.score));
  return rows.map((r: any) => ({ ...toGroupRoundScore(r.score), user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl || null } }));
}

export async function getUserGroupRoundScore(db: any, roundId: number, userId: number): Promise<GroupRoundScore | undefined> {
  const rows = await db.select().from(schema.groupRoundScores).where(and(eq(schema.groupRoundScores.roundId, roundId), eq(schema.groupRoundScores.userId, userId))).limit(1);
  return rows[0] ? toGroupRoundScore(rows[0]) : undefined;
}

export async function getGroupLeaderboard(db: any, groupId: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; totalScore: number; gamesPlayed: number }>> {
  const members = await getGroupMembers(db, groupId);
  if (members.length === 0) return [];
  const memberIds = members.map((m) => m.userId);
  const roundIds = await db.select({ id: schema.groupRounds.id }).from(schema.groupRounds).where(eq(schema.groupRounds.groupId, groupId));
  if (roundIds.length === 0) return members.map((m) => ({ userId: m.userId, name: m.user.name, avatarUrl: m.user.avatarUrl, totalScore: 0, gamesPlayed: 0 }));
  const rids = roundIds.map((r: any) => r.id);
  const scoreRows = await db.select({ userId: schema.groupRoundScores.userId, totalScore: sql<number>`SUM(${schema.groupRoundScores.score})`, gamesPlayed: sql<number>`COUNT(*)` }).from(schema.groupRoundScores).where(and(inArray(schema.groupRoundScores.userId, memberIds), inArray(schema.groupRoundScores.roundId, rids))).groupBy(schema.groupRoundScores.userId);
  const scoreMap = new Map(scoreRows.map((r: any) => [r.userId, { totalScore: Number(r.totalScore), gamesPlayed: Number(r.gamesPlayed) }]));
  return members.map((m) => ({ userId: m.userId, name: m.user.name, avatarUrl: m.user.avatarUrl, ...(scoreMap.get(m.userId) ?? { totalScore: 0, gamesPlayed: 0 }) })).sort((a, b) => b.totalScore - a.totalScore);
}

export async function setGroupFeatured(db: any, id: number, isFeatured: boolean): Promise<void> {
  await db.update(schema.groups).set({ isFeatured }).where(eq(schema.groups.id, id));
}

export async function addGroupReaction(db: any, roundId: number, userId: number, emoji: string): Promise<void> {
  await db.insert(schema.groupRoundReactions).values({ roundId, userId, emoji });
}

export async function removeGroupReaction(db: any, roundId: number, userId: number, emoji: string): Promise<void> {
  await db.delete(schema.groupRoundReactions).where(and(eq(schema.groupRoundReactions.roundId, roundId), eq(schema.groupRoundReactions.userId, userId), eq(schema.groupRoundReactions.emoji, emoji)));
}

export async function getGroupRoundReactions(db: any, roundId: number): Promise<Record<string, number[]>> {
  const rows = await db.select().from(schema.groupRoundReactions).where(eq(schema.groupRoundReactions.roundId, roundId));
  const result: Record<string, number[]> = {};
  for (const r of rows) {
    if (!result[r.emoji]) result[r.emoji] = [];
    result[r.emoji].push(r.userId);
  }
  return result;
}

export async function logGroupActivity(db: any, groupId: number, userId: number, type: string, data?: Record<string, unknown>): Promise<void> {
  await db.insert(schema.groupActivity).values({ groupId, userId, type, data: data ?? null });
}

export async function getGroupActivity(db: any, groupId: number, limit = 20): Promise<Array<{ id: number; groupId: number; userId: number; type: string; data: Record<string, unknown> | null; createdAt: string; user: { id: number; name: string; avatarUrl: string | null } }>> {
  const rows = await db.select({ activity: schema.groupActivity, user: { id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl } }).from(schema.groupActivity).innerJoin(schema.users, eq(schema.groupActivity.userId, schema.users.id)).where(eq(schema.groupActivity.groupId, groupId)).orderBy(desc(schema.groupActivity.createdAt)).limit(limit);
  return rows.map((r: any) => ({ id: r.activity.id, groupId: r.activity.groupId, userId: r.activity.userId, type: r.activity.type, data: r.activity.data ?? null, createdAt: r.activity.createdAt instanceof Date ? r.activity.createdAt.toISOString() : String(r.activity.createdAt), user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl || null } }));
}

export async function createGroupRoundAttempt(db: any, roundId: number, userId: number): Promise<void> {
  await db.insert(schema.groupRoundAttempts).values({ roundId, userId }).onDuplicateKeyUpdate({ set: { roundId } });
}

export async function getGroupRoundAttempt(db: any, roundId: number, userId: number): Promise<boolean> {
  const rows = await db.select({ id: schema.groupRoundAttempts.id }).from(schema.groupRoundAttempts).where(and(eq(schema.groupRoundAttempts.roundId, roundId), eq(schema.groupRoundAttempts.userId, userId))).limit(1);
  return rows.length > 0;
}

export async function createDailyChallengeAttempt(db: any, userId: number, challengeDate: string, gameSlug: string): Promise<void> {
  await db.insert(schema.dailyChallengeAttempts).values({ userId, challengeDate, gameSlug }).onDuplicateKeyUpdate({ set: { userId } });
}

export async function getDailyChallengeAttempt(db: any, userId: number, challengeDate: string, gameSlug: string): Promise<boolean> {
  const rows = await db.select({ id: schema.dailyChallengeAttempts.id }).from(schema.dailyChallengeAttempts).where(and(eq(schema.dailyChallengeAttempts.userId, userId), eq(schema.dailyChallengeAttempts.challengeDate, challengeDate), eq(schema.dailyChallengeAttempts.gameSlug, gameSlug))).limit(1);
  return rows.length > 0;
}
