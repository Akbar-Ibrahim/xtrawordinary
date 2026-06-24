import { eq, desc, or } from "drizzle-orm";
import type { TeamRaceChallenge, InsertTeamRaceChallenge } from "@shared/schema";
import * as schema from "../db-schema";

function mapTeamRaceChallenge(r: any): TeamRaceChallenge {
  const toIso = (v: any) => v instanceof Date ? v.toISOString() : (v ? String(v) : null);
  return { id: r.id, challengerGroupId: r.challengerGroupId, challengeeGroupId: r.challengeeGroupId, challengerAdminId: r.challengerAdminId, challengeeAdminId: r.challengeeAdminId ?? null, gameSlug: r.gameSlug, raceTarget: r.raceTarget ?? null, raceTimeLimit: r.raceTimeLimit ?? null, status: r.status, roomCode: r.roomCode ?? null, seed: r.seed ?? null, startWord: r.startWord ?? null, createdAt: toIso(r.createdAt) ?? "", expiresAt: toIso(r.expiresAt), winnerGroupId: r.winnerGroupId ?? null };
}

export async function createTeamRaceChallenge(db: any, data: InsertTeamRaceChallenge): Promise<TeamRaceChallenge> {
  const result = await db.insert(schema.teamRaceChallenges).values({ challengerGroupId: data.challengerGroupId, challengeeGroupId: data.challengeeGroupId, challengerAdminId: data.challengerAdminId, challengeeAdminId: data.challengeeAdminId ?? null, gameSlug: data.gameSlug, raceTarget: data.raceTarget ?? null, raceTimeLimit: data.raceTimeLimit ?? null, status: data.status ?? "pending", roomCode: data.roomCode ?? null, seed: data.seed ?? null, startWord: data.startWord ?? null, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null });
  return (await getTeamRaceChallenge(db, result[0].insertId))!;
}

export async function getTeamRaceChallenge(db: any, id: number): Promise<TeamRaceChallenge | undefined> {
  const rows = await db.select().from(schema.teamRaceChallenges).where(eq(schema.teamRaceChallenges.id, id)).limit(1);
  return rows[0] ? mapTeamRaceChallenge(rows[0]) : undefined;
}

export async function getTeamRaceChallengesForGroup(db: any, groupId: number): Promise<TeamRaceChallenge[]> {
  const rows = await db.select().from(schema.teamRaceChallenges)
    .where(or(eq(schema.teamRaceChallenges.challengerGroupId, groupId), eq(schema.teamRaceChallenges.challengeeGroupId, groupId)))
    .orderBy(desc(schema.teamRaceChallenges.createdAt)).limit(50);
  return rows.map((r: any) => mapTeamRaceChallenge(r));
}

export async function updateTeamRaceChallenge(db: any, id: number, updates: Partial<InsertTeamRaceChallenge>): Promise<TeamRaceChallenge | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
  if (updates.challengeeAdminId !== undefined) dbUpdates.challengeeAdminId = updates.challengeeAdminId;
  if (updates.seed !== undefined) dbUpdates.seed = updates.seed;
  if (updates.startWord !== undefined) dbUpdates.startWord = updates.startWord;
  if (updates.winnerGroupId !== undefined) dbUpdates.winnerGroupId = updates.winnerGroupId;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.teamRaceChallenges).set(dbUpdates).where(eq(schema.teamRaceChallenges.id, id));
  return getTeamRaceChallenge(db, id);
}

export async function getTeamRaceChallengeByRoom(db: any, roomCode: string): Promise<TeamRaceChallenge | undefined> {
  const rows = await db.select().from(schema.teamRaceChallenges).where(eq(schema.teamRaceChallenges.roomCode, roomCode)).limit(1);
  return rows[0] ? mapTeamRaceChallenge(rows[0]) : undefined;
}
