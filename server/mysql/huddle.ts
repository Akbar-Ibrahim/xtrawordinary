import { eq, desc, and, or, inArray } from "drizzle-orm";
import type { HuddleChallenge, InsertHuddleChallenge } from "@shared/schema";
import * as schema from "../db-schema";

function mapHuddleChallenge(r: any): HuddleChallenge {
  const toIso = (v: any) => v instanceof Date ? v.toISOString() : (v ? String(v) : null);
  return { id: r.id, challengerGroupId: r.challengerGroupId, challengeeGroupId: r.challengeeGroupId, challengerAdminId: r.challengerAdminId, challengeeAdminId: r.challengeeAdminId ?? null, gameSlug: r.gameSlug, format: r.format ?? "turn", raceTarget: r.raceTarget ?? null, raceTimeLimit: r.raceTimeLimit ?? null, status: r.status, roomCode: r.roomCode ?? null, seed: r.seed ?? null, startWord: r.startWord ?? null, createdAt: toIso(r.createdAt) ?? "", expiresAt: toIso(r.expiresAt) };
}

export async function createHuddleChallenge(db: any, data: InsertHuddleChallenge): Promise<HuddleChallenge> {
  const result = await db.insert(schema.huddleChallenges).values({ challengerGroupId: data.challengerGroupId, challengeeGroupId: data.challengeeGroupId, challengerAdminId: data.challengerAdminId, challengeeAdminId: data.challengeeAdminId ?? null, gameSlug: data.gameSlug, format: data.format ?? "turn", raceTarget: data.raceTarget ?? null, raceTimeLimit: data.raceTimeLimit ?? null, status: data.status ?? "pending", roomCode: data.roomCode ?? null, seed: data.seed ?? null, startWord: data.startWord ?? null, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null });
  return (await getHuddleChallenge(db, result[0].insertId))!;
}

export async function getHuddleChallenge(db: any, id: number): Promise<HuddleChallenge | undefined> {
  const rows = await db.select().from(schema.huddleChallenges).where(eq(schema.huddleChallenges.id, id)).limit(1);
  return rows[0] ? mapHuddleChallenge(rows[0]) : undefined;
}

export async function getHuddleChallengesForGroup(db: any, groupId: number): Promise<HuddleChallenge[]> {
  const rows = await db.select().from(schema.huddleChallenges)
    .where(or(eq(schema.huddleChallenges.challengerGroupId, groupId), eq(schema.huddleChallenges.challengeeGroupId, groupId)))
    .orderBy(desc(schema.huddleChallenges.createdAt));
  if (rows.length === 0) return [];
  const groupIds = [...new Set([...rows.map((r: any) => r.challengerGroupId), ...rows.map((r: any) => r.challengeeGroupId)])];
  const userIds = [...new Set([...rows.map((r: any) => r.challengerAdminId), ...rows.filter((r: any) => r.challengeeAdminId).map((r: any) => r.challengeeAdminId)])];
  const groupRows = await db.select({ id: schema.groups.id, name: schema.groups.name }).from(schema.groups).where(inArray(schema.groups.id, groupIds));
  const userRows = userIds.length > 0 ? await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  const groupMap = new Map(groupRows.map((g: any) => [g.id, g]));
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  return rows.map((r: any) => ({ ...mapHuddleChallenge(r), challengerGroup: groupMap.get(r.challengerGroupId), challengeeGroup: groupMap.get(r.challengeeGroupId), challengerAdmin: userMap.get(r.challengerAdminId), challengeeAdmin: r.challengeeAdminId ? userMap.get(r.challengeeAdminId) : null }));
}

export async function updateHuddleChallenge(db: any, id: number, updates: Partial<InsertHuddleChallenge>): Promise<HuddleChallenge | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
  if (updates.challengeeAdminId !== undefined) dbUpdates.challengeeAdminId = updates.challengeeAdminId;
  if (updates.seed !== undefined) dbUpdates.seed = updates.seed;
  if (updates.startWord !== undefined) dbUpdates.startWord = updates.startWord;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.huddleChallenges).set(dbUpdates).where(eq(schema.huddleChallenges.id, id));
  return getHuddleChallenge(db, id);
}

export async function getHuddleChallengeByRoom(db: any, roomCode: string): Promise<HuddleChallenge | undefined> {
  const rows = await db.select().from(schema.huddleChallenges).where(eq(schema.huddleChallenges.roomCode, roomCode)).limit(1);
  return rows[0] ? mapHuddleChallenge(rows[0]) : undefined;
}
