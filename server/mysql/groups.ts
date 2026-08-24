import { eq, desc, asc, and, inArray, sql, isNull } from "drizzle-orm";
import type {
  Group, InsertGroup, GroupMember, GroupRound, InsertGroupRound, GroupRoundScore,
  GroupScoreReaction, GroupRoundAttempt, DailyChallengeAttempt, GroupActivityEntry,
  GroupSeason, InsertGroupSeason,
} from "@shared/schema";
import * as schema from "../db-schema";

function tsToIso(d: any): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function toGroup(r: any): Group {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    creatorId: r.creatorId,
    inviteCode: r.inviteCode,
    isPublic: !!r.isPublic,
    isFeatured: !!r.isFeatured,
    tags: r.tags ?? null,
    pinnedAnnouncement: r.pinnedAnnouncement ?? null,
    createdAt: tsToIso(r.createdAt) ?? "",
    memberCount: r.memberCount ?? undefined,
  };
}

function toGroupMember(r: any): GroupMember {
  return {
    id: r.id,
    groupId: r.groupId,
    userId: r.userId,
    role: r.role as GroupMember["role"],
    joinedAt: tsToIso(r.joinedAt) ?? "",
  };
}

function toGroupRound(r: any): GroupRound {
  return {
    id: r.id,
    groupId: r.groupId,
    gameSlug: r.gameSlug,
    seed: r.seed,
    status: r.status as GroupRound["status"],
    createdById: r.createdById,
    closesAt: tsToIso(r.closesAt),
    gameConfig: r.gameConfig ?? null,
    seasonId: r.seasonId ?? null,
    createdAt: tsToIso(r.createdAt) ?? "",
  };
}

function toGroupSeason(r: any): GroupSeason {
  let eligibleMemberIds: number[] = [];
  try { eligibleMemberIds = JSON.parse(r.eligibleMemberIds ?? "[]"); } catch { eligibleMemberIds = []; }
  return {
    id: r.id,
    groupId: r.groupId,
    name: r.name,
    startsAt: tsToIso(r.startsAt) ?? "",
    endsAt: tsToIso(r.endsAt) ?? "",
    status: r.status as GroupSeason["status"],
    createdById: r.createdById,
    winnerId: r.winnerId ?? null,
    winnerName: r.winnerName ?? null,
    eligibleMemberIds,
    createdAt: tsToIso(r.createdAt) ?? "",
  };
}

function toGroupRoundScore(r: any): GroupRoundScore {
  return {
    id: r.id,
    roundId: r.roundId,
    userId: r.userId,
    score: r.score,
    durationMs: r.durationMs ?? null,
    completedAt: tsToIso(r.completedAt) ?? "",
  };
}

function toGroupScoreReaction(r: any): GroupScoreReaction {
  return {
    id: r.id,
    roundId: r.roundId,
    scoreId: r.scoreId,
    userId: r.userId,
    emoji: r.emoji,
    createdAt: tsToIso(r.createdAt) ?? "",
  };
}

// ── Group CRUD ─────────────────────────────────────────────────────────────

export async function createGroup(db: any, group: InsertGroup): Promise<Group> {
  const result = await db.insert(schema.groups).values({
    name: group.name,
    description: group.description ?? null,
    inviteCode: group.inviteCode,
    creatorId: group.creatorId,
    isPublic: group.isPublic ?? true,
    isFeatured: group.isFeatured ?? false,
    tags: group.tags ?? null,
    pinnedAnnouncement: group.pinnedAnnouncement ?? null,
  });
  const rows = await db.select().from(schema.groups).where(eq(schema.groups.id, result[0].insertId)).limit(1);
  return toGroup(rows[0]);
}

export async function getGroup(db: any, id: number): Promise<Group | undefined> {
  const rows = await db
    .select({ group: schema.groups, memberCount: sql<number>`COUNT(${schema.groupMembers.id})` })
    .from(schema.groups)
    .leftJoin(schema.groupMembers, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(eq(schema.groups.id, id))
    .groupBy(schema.groups.id);
  if (!rows[0]) return undefined;
  return toGroup({ ...rows[0].group, memberCount: rows[0].memberCount });
}

export async function getGroupByInviteCode(db: any, code: string): Promise<Group | undefined> {
  const rows = await db.select().from(schema.groups).where(eq(schema.groups.inviteCode, code)).limit(1);
  return rows[0] ? toGroup(rows[0]) : undefined;
}

export async function updateGroup(
  db: any,
  id: number,
  updates: Partial<Pick<Group, "name" | "description" | "isPublic" | "tags" | "pinnedAnnouncement" | "isFeatured">>,
): Promise<Group | undefined> {
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.isPublic !== undefined) dbUpdates.isPublic = updates.isPublic;
  if (updates.isFeatured !== undefined) dbUpdates.isFeatured = updates.isFeatured;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.pinnedAnnouncement !== undefined) dbUpdates.pinnedAnnouncement = updates.pinnedAnnouncement;
  if (Object.keys(dbUpdates).length > 0) {
    await db.update(schema.groups).set(dbUpdates).where(eq(schema.groups.id, id));
  }
  return getGroup(db, id);
}

export async function deleteGroup(db: any, id: number): Promise<void> {
  const roundIds = await db.select({ id: schema.groupRounds.id }).from(schema.groupRounds).where(eq(schema.groupRounds.groupId, id));
  if (roundIds.length > 0) {
    const rids = roundIds.map((r: any) => r.id);
    await db.delete(schema.groupRoundScores).where(inArray(schema.groupRoundScores.roundId, rids));
  }
  await db.delete(schema.groupRounds).where(eq(schema.groupRounds.groupId, id));
  await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, id));
  await db.delete(schema.groups).where(eq(schema.groups.id, id));
}

export async function getUserGroups(db: any, userId: number): Promise<Group[]> {
  const memberRows = await db.select({ groupId: schema.groupMembers.groupId }).from(schema.groupMembers).where(eq(schema.groupMembers.userId, userId));
  if (memberRows.length === 0) return [];
  const groupIds = memberRows.map((r: any) => r.groupId);
  const rows = await db
    .select({ group: schema.groups, memberCount: sql<number>`COUNT(${schema.groupMembers.id})` })
    .from(schema.groups)
    .leftJoin(schema.groupMembers, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(inArray(schema.groups.id, groupIds))
    .groupBy(schema.groups.id)
    .orderBy(desc(schema.groups.createdAt));
  return rows.map((r: any) => toGroup({ ...r.group, memberCount: r.memberCount }));
}

export async function getPublicGroups(db: any): Promise<Group[]> {
  const rows = await db
    .select({ group: schema.groups, memberCount: sql<number>`COUNT(${schema.groupMembers.id})` })
    .from(schema.groups)
    .leftJoin(schema.groupMembers, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(eq(schema.groups.isPublic, true))
    .groupBy(schema.groups.id)
    .orderBy(desc(schema.groups.createdAt));
  return rows.map((r: any) => toGroup({ ...r.group, memberCount: r.memberCount }));
}

export async function getAllGroups(db: any): Promise<Group[]> {
  const rows = await db
    .select({ group: schema.groups, memberCount: sql<number>`COUNT(${schema.groupMembers.id})` })
    .from(schema.groups)
    .leftJoin(schema.groupMembers, eq(schema.groups.id, schema.groupMembers.groupId))
    .groupBy(schema.groups.id)
    .orderBy(desc(schema.groups.createdAt));
  return rows.map((r: any) => toGroup({ ...r.group, memberCount: r.memberCount }));
}

export async function setGroupFeatured(db: any, id: number, isFeatured: boolean): Promise<Group | undefined> {
  await db.update(schema.groups).set({ isFeatured }).where(eq(schema.groups.id, id));
  return getGroup(db, id);
}

// ── Group Members ──────────────────────────────────────────────────────────

export async function addGroupMember(db: any, groupId: number, userId: number, role: string): Promise<GroupMember> {
  const existing = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId))).limit(1);
  if (existing[0]) return toGroupMember(existing[0]);
  const result = await db.insert(schema.groupMembers).values({ groupId, userId, role });
  const rows = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.id, result[0].insertId)).limit(1);
  return toGroupMember(rows[0]);
}

export async function removeGroupMember(db: any, groupId: number, userId: number): Promise<void> {
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
}

export async function getGroupMembers(db: any, groupId: number): Promise<Array<GroupMember & { user: { id: number; username: string; name: string; avatarUrl: string | null } }>> {
  const rows = await db
    .select({ member: schema.groupMembers, user: { id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl } })
    .from(schema.groupMembers)
    .innerJoin(schema.users, eq(schema.groupMembers.userId, schema.users.id))
    .where(eq(schema.groupMembers.groupId, groupId))
    .orderBy(asc(schema.groupMembers.joinedAt));
  return rows.map((r: any) => ({ ...toGroupMember(r.member), user: { id: r.user.id, username: r.user.username, name: r.user.name, avatarUrl: r.user.avatarUrl ?? null } }));
}

export async function getGroupMember(db: any, groupId: number, userId: number): Promise<GroupMember | undefined> {
  const rows = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId))).limit(1);
  return rows[0] ? toGroupMember(rows[0]) : undefined;
}

export async function updateGroupMemberRole(db: any, groupId: number, userId: number, role: string): Promise<GroupMember | undefined> {
  await db.update(schema.groupMembers).set({ role }).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
  return getGroupMember(db, groupId, userId);
}

// ── Group Rounds ───────────────────────────────────────────────────────────

export async function createGroupRound(db: any, round: InsertGroupRound): Promise<GroupRound> {
  const result = await db.insert(schema.groupRounds).values({
    groupId: round.groupId,
    gameSlug: round.gameSlug,
    seed: round.seed,
    status: round.status ?? "active",
    createdById: round.createdById,
    closesAt: round.closesAt ? new Date(round.closesAt) : null,
    gameConfig: round.gameConfig ?? null,
    seasonId: round.seasonId ?? null,
  });
  const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.id, result[0].insertId)).limit(1);
  return toGroupRound(rows[0]);
}

export async function getGroupRound(db: any, id: number): Promise<GroupRound | undefined> {
  const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.id, id)).limit(1);
  return rows[0] ? toGroupRound(rows[0]) : undefined;
}

export async function getGroupRounds(db: any, groupId: number): Promise<GroupRound[]> {
  const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.groupId, groupId)).orderBy(desc(schema.groupRounds.createdAt));
  return rows.map((r: any) => toGroupRound(r));
}

export async function closeGroupRound(db: any, id: number): Promise<GroupRound | undefined> {
  await db.update(schema.groupRounds).set({ status: "closed" }).where(eq(schema.groupRounds.id, id));
  return getGroupRound(db, id);
}

export async function deleteGroupRound(db: any, id: number): Promise<void> {
  await db.delete(schema.groupRoundScores).where(eq(schema.groupRoundScores.roundId, id));
  await db.delete(schema.groupRounds).where(eq(schema.groupRounds.id, id));
}

// ── Group Round Scores ─────────────────────────────────────────────────────

export async function submitGroupRoundScore(db: any, roundId: number, userId: number, score: number, durationMs?: number): Promise<GroupRoundScore> {
  const existing = await db.select().from(schema.groupRoundScores).where(and(eq(schema.groupRoundScores.roundId, roundId), eq(schema.groupRoundScores.userId, userId))).limit(1);
  if (existing[0]) return toGroupRoundScore(existing[0]);
  const result = await db.insert(schema.groupRoundScores).values({ roundId, userId, score, durationMs: durationMs ?? null });
  const rows = await db.select().from(schema.groupRoundScores).where(eq(schema.groupRoundScores.id, result[0].insertId)).limit(1);
  return toGroupRoundScore(rows[0]);
}

export async function getGroupRoundScores(db: any, roundId: number): Promise<Array<GroupRoundScore & { user: { id: number; username: string; name: string; avatarUrl: string | null } }>> {
  const rows = await db
    .select({ score: schema.groupRoundScores, user: { id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl } })
    .from(schema.groupRoundScores)
    .innerJoin(schema.users, eq(schema.groupRoundScores.userId, schema.users.id))
    .where(eq(schema.groupRoundScores.roundId, roundId))
    .orderBy(desc(schema.groupRoundScores.score), sql`COALESCE(${schema.groupRoundScores.durationMs}, 2147483647) ASC`);
  return rows.map((r: any) => ({ ...toGroupRoundScore(r.score), user: { id: r.user.id, username: r.user.username, name: r.user.name, avatarUrl: r.user.avatarUrl ?? null } }));
}

export async function getUserGroupRoundScore(db: any, roundId: number, userId: number): Promise<GroupRoundScore | undefined> {
  const rows = await db.select().from(schema.groupRoundScores).where(and(eq(schema.groupRoundScores.roundId, roundId), eq(schema.groupRoundScores.userId, userId))).limit(1);
  return rows[0] ? toGroupRoundScore(rows[0]) : undefined;
}

export async function getGroupLeaderboard(db: any, groupId: number): Promise<Array<{ userId: number; username: string; name: string; avatarUrl: string | null; totalScore: number; roundsPlayed: number }>> {
  const members = await getGroupMembers(db, groupId);
  if (members.length === 0) return [];
  const memberIds = members.map((m) => m.userId);
  const roundIds = await db.select({ id: schema.groupRounds.id }).from(schema.groupRounds).where(eq(schema.groupRounds.groupId, groupId));
  if (roundIds.length === 0) return members.map((m) => ({ userId: m.userId, username: m.user.username, name: m.user.name, avatarUrl: m.user.avatarUrl, totalScore: 0, roundsPlayed: 0 }));
  const rids = roundIds.map((r: any) => r.id);
  const scoreRows = await db
    .select({ userId: schema.groupRoundScores.userId, totalScore: sql<number>`SUM(${schema.groupRoundScores.score})`, roundsPlayed: sql<number>`COUNT(*)` })
    .from(schema.groupRoundScores)
    .where(and(inArray(schema.groupRoundScores.userId, memberIds), inArray(schema.groupRoundScores.roundId, rids)))
    .groupBy(schema.groupRoundScores.userId);
  const scoreMap = new Map<number, { totalScore: number; roundsPlayed: number }>(scoreRows.map((r: any) => [r.userId as number, { totalScore: Number(r.totalScore), roundsPlayed: Number(r.roundsPlayed) }]));
  return members.map((m) => {
    const s = scoreMap.get(m.userId) ?? { totalScore: 0, roundsPlayed: 0 };
    return { userId: m.userId, username: m.user.username, name: m.user.name, avatarUrl: m.user.avatarUrl, totalScore: s.totalScore, roundsPlayed: s.roundsPlayed };
  }).sort((a, b) => b.totalScore - a.totalScore);
}

// ── Group Reactions ────────────────────────────────────────────────────────

export async function addGroupReaction(db: any, roundId: number, scoreId: number, userId: number, emoji: string): Promise<GroupScoreReaction> {
  await db.delete(schema.groupScoreReactions).where(and(eq(schema.groupScoreReactions.scoreId, scoreId), eq(schema.groupScoreReactions.userId, userId)));
  const result = await db.insert(schema.groupScoreReactions).values({ roundId, scoreId, userId, emoji });
  const rows = await db.select().from(schema.groupScoreReactions).where(eq(schema.groupScoreReactions.id, result[0].insertId)).limit(1);
  return toGroupScoreReaction(rows[0]);
}

export async function removeGroupReaction(db: any, roundId: number, scoreId: number, userId: number, emoji: string): Promise<void> {
  await db.delete(schema.groupScoreReactions).where(and(eq(schema.groupScoreReactions.scoreId, scoreId), eq(schema.groupScoreReactions.userId, userId), eq(schema.groupScoreReactions.emoji, emoji)));
}

export async function getGroupRoundReactions(db: any, roundId: number): Promise<GroupScoreReaction[]> {
  const rows = await db.select().from(schema.groupScoreReactions).where(eq(schema.groupScoreReactions.roundId, roundId));
  return rows.map((r: any) => toGroupScoreReaction(r));
}

// ── Group Activity ─────────────────────────────────────────────────────────

export async function logGroupActivity(db: any, groupId: number, userId: number | null, type: string, metadata?: Record<string, any>): Promise<void> {
  await db.insert(schema.groupActivity).values({ groupId, userId: userId ?? null, type, metadata: metadata ?? {} });
}

export async function getGroupActivity(db: any, groupId: number, limit = 30): Promise<GroupActivityEntry[]> {
  const rows = await db
    .select({ activity: schema.groupActivity, user: { id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl } })
    .from(schema.groupActivity)
    .leftJoin(schema.users, eq(schema.groupActivity.userId, schema.users.id))
    .where(eq(schema.groupActivity.groupId, groupId))
    .orderBy(desc(schema.groupActivity.createdAt))
    .limit(limit);
  return rows.map((r: any): GroupActivityEntry => ({
    id: r.activity.id,
    groupId: r.activity.groupId,
    userId: r.activity.userId ?? null,
    type: r.activity.type,
    metadata: r.activity.metadata ?? {},
    createdAt: tsToIso(r.activity.createdAt) ?? "",
    user: r.user?.id ? { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl ?? null } : undefined,
  }));
}

// ── Attempt tracking ───────────────────────────────────────────────────────

export async function createGroupRoundAttempt(db: any, roundId: number, userId: number): Promise<GroupRoundAttempt> {
  await db.insert(schema.groupRoundAttempts).values({ roundId, userId }).onDuplicateKeyUpdate({ set: { roundId } });
  const rows = await db.select().from(schema.groupRoundAttempts).where(and(eq(schema.groupRoundAttempts.roundId, roundId), eq(schema.groupRoundAttempts.userId, userId))).limit(1);
  return { id: rows[0].id, roundId: rows[0].roundId, userId: rows[0].userId, startedAt: tsToIso(rows[0].startedAt) ?? "" };
}

export async function getGroupRoundAttempt(db: any, roundId: number, userId: number): Promise<GroupRoundAttempt | undefined> {
  const rows = await db.select().from(schema.groupRoundAttempts).where(and(eq(schema.groupRoundAttempts.roundId, roundId), eq(schema.groupRoundAttempts.userId, userId))).limit(1);
  if (!rows[0]) return undefined;
  return { id: rows[0].id, roundId: rows[0].roundId, userId: rows[0].userId, startedAt: tsToIso(rows[0].startedAt) ?? "" };
}

export async function createDailyChallengeAttempt(db: any, userId: number, challengeDate: string): Promise<DailyChallengeAttempt> {
  await db.insert(schema.dailyChallengeAttempts).values({ userId, challengeDate }).onDuplicateKeyUpdate({ set: { userId } });
  const rows = await db.select().from(schema.dailyChallengeAttempts).where(and(eq(schema.dailyChallengeAttempts.userId, userId), eq(schema.dailyChallengeAttempts.challengeDate, challengeDate))).limit(1);
  return { id: rows[0].id, userId: rows[0].userId, challengeDate: rows[0].challengeDate, startedAt: tsToIso(rows[0].startedAt) ?? "" };
}

export async function getDailyChallengeAttempt(db: any, userId: number, challengeDate: string): Promise<DailyChallengeAttempt | undefined> {
  const rows = await db.select().from(schema.dailyChallengeAttempts).where(and(eq(schema.dailyChallengeAttempts.userId, userId), eq(schema.dailyChallengeAttempts.challengeDate, challengeDate))).limit(1);
  if (!rows[0]) return undefined;
  return { id: rows[0].id, userId: rows[0].userId, challengeDate: rows[0].challengeDate, startedAt: tsToIso(rows[0].startedAt) ?? "" };
}

// ── Group Seasons ──────────────────────────────────────────────────────────

export async function createGroupSeason(db: any, data: InsertGroupSeason): Promise<GroupSeason> {
  const members = await db.select({ userId: schema.groupMembers.userId }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, data.groupId));
  const eligibleMemberIds = members.map((m: any) => m.userId);
  const result = await db.insert(schema.groupSeasons).values({
    groupId: data.groupId,
    name: data.name,
    startsAt: new Date(data.startsAt),
    endsAt: new Date(data.endsAt),
    status: data.status ?? "active",
    createdById: data.createdById,
    eligibleMemberIds: JSON.stringify(eligibleMemberIds),
  });
  const rows = await db.select().from(schema.groupSeasons).where(eq(schema.groupSeasons.id, result[0].insertId)).limit(1);
  return toGroupSeason(rows[0]);
}

export async function getGroupSeasons(db: any, groupId: number): Promise<GroupSeason[]> {
  const rows = await db.select().from(schema.groupSeasons).where(eq(schema.groupSeasons.groupId, groupId)).orderBy(desc(schema.groupSeasons.createdAt));
  return rows.map((r: any) => toGroupSeason(r));
}

export async function getGroupSeason(db: any, id: number): Promise<GroupSeason | undefined> {
  const rows = await db.select().from(schema.groupSeasons).where(eq(schema.groupSeasons.id, id)).limit(1);
  return rows[0] ? toGroupSeason(rows[0]) : undefined;
}

export async function endGroupSeason(db: any, id: number, winnerId: number | null, winnerName: string | null): Promise<GroupSeason | undefined> {
  await db.update(schema.groupSeasons).set({ status: "ended", winnerId, winnerName }).where(eq(schema.groupSeasons.id, id));
  return getGroupSeason(db, id);
}

export async function getGroupSeasonLeaderboard(db: any, season: GroupSeason): Promise<Array<{ userId: number; username: string; name: string; avatarUrl: string | null; totalScore: number; roundsPlayed: number }>> {
  if (season.eligibleMemberIds.length === 0) return [];
  const roundRows = await db.select({ id: schema.groupRounds.id }).from(schema.groupRounds).where(eq(schema.groupRounds.seasonId, season.id));
  if (roundRows.length === 0) return [];
  const roundIds = roundRows.map((r: any) => r.id);
  const scoreRows = await db
    .select({
      userId: schema.groupRoundScores.userId,
      totalScore: sql<number>`SUM(${schema.groupRoundScores.score})`,
      roundsPlayed: sql<number>`COUNT(*)`,
    })
    .from(schema.groupRoundScores)
    .where(and(inArray(schema.groupRoundScores.userId, season.eligibleMemberIds), inArray(schema.groupRoundScores.roundId, roundIds)))
    .groupBy(schema.groupRoundScores.userId);
  const userIds = scoreRows.map((r: any) => r.userId as number);
  if (userIds.length === 0) return [];
  const users = await db.select({ id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const userMap = new Map<number, { username: string; name: string; avatarUrl: string | null }>(users.map((u: any) => [u.id, { username: u.username, name: u.name, avatarUrl: u.avatarUrl ?? null }]));
  return scoreRows
    .map((r: any) => {
      const u = userMap.get(r.userId as number);
      return { userId: r.userId as number, username: u?.username ?? "unknown", name: u?.name ?? "Unknown", avatarUrl: u?.avatarUrl ?? null, totalScore: Number(r.totalScore), roundsPlayed: Number(r.roundsPlayed) };
    })
    .sort((a: any, b: any) => b.totalScore - a.totalScore);
}
