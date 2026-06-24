import { eq, desc, and, or, inArray, sql } from "drizzle-orm";
import type { GuildWarsTournament, InsertGuildWarsTournament, GuildWarsRegistration, GuildWarsMatch, GuildWarsMatchGame, GuildWarsChampion } from "@shared/schema";
import * as schema from "../db-schema";

function toIso(v: any): string | null { return v instanceof Date ? v.toISOString() : (v ? String(v) : null); }

function toGWTournament(r: any): GuildWarsTournament {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    registrationDeadline: toIso(r.registrationDeadline) ?? "",
    roundDeadlineHours: r.roundDeadlineHours,
    minGroups: r.minGroups,
    maxGroups: r.maxGroups ?? null,
    createdBy: r.createdBy,
    createdAt: toIso(r.createdAt) ?? "",
  };
}

function toGWRegistration(r: any): GuildWarsRegistration {
  return { id: r.id, tournamentId: r.tournamentId, groupId: r.groupId, registeredBy: r.registeredBy, createdAt: toIso(r.createdAt) ?? "" };
}

function toGWMatch(r: any): GuildWarsMatch {
  return {
    id: r.id,
    tournamentId: r.tournamentId,
    round: r.round,
    group1Id: r.group1Id ?? null,
    group2Id: r.group2Id ?? null,
    winnerGroupId: r.winnerGroupId ?? null,
    status: r.status,
    deadline: toIso(r.deadline),
    game1Slug: r.game1Slug,
    game2Slug: r.game2Slug,
    game3Slug: r.game3Slug,
    createdAt: toIso(r.createdAt) ?? "",
  };
}

function toGWMatchGame(r: any): GuildWarsMatchGame {
  return {
    id: r.id,
    matchId: r.matchId,
    gameNumber: r.gameNumber,
    gameSlug: r.gameSlug,
    roomCode: r.roomCode ?? null,
    winnerGroupId: r.winnerGroupId ?? null,
    status: r.status,
  };
}

function toGWChampion(r: any): GuildWarsChampion {
  return { id: r.id, tournamentId: r.tournamentId, groupId: r.groupId, tournamentName: r.tournamentName ?? "", createdAt: toIso(r.createdAt) ?? "" };
}

export async function createGuildWarsTournament(db: any, data: InsertGuildWarsTournament): Promise<GuildWarsTournament> {
  const result = await db.insert(schema.guildWarsTournaments).values({
    name: data.name,
    registrationDeadline: new Date(data.registrationDeadline),
    roundDeadlineHours: data.roundDeadlineHours ?? 24,
    minGroups: data.minGroups ?? 2,
    maxGroups: data.maxGroups ?? null,
    createdBy: data.createdBy ?? 0,
  });
  return (await getGuildWarsTournament(db, result[0].insertId))!;
}

export async function getGuildWarsTournament(db: any, id: number): Promise<GuildWarsTournament | undefined> {
  const rows = await db.select().from(schema.guildWarsTournaments).where(eq(schema.guildWarsTournaments.id, id)).limit(1);
  return rows[0] ? toGWTournament(rows[0]) : undefined;
}

export async function listGuildWarsTournaments(db: any): Promise<GuildWarsTournament[]> {
  const rows = await db.select().from(schema.guildWarsTournaments).orderBy(desc(schema.guildWarsTournaments.createdAt));
  return rows.map((r: any) => toGWTournament(r));
}

export async function updateGuildWarsTournament(db: any, id: number, updates: Partial<Pick<GuildWarsTournament, "status" | "name" | "registrationDeadline" | "roundDeadlineHours" | "minGroups" | "maxGroups">>): Promise<GuildWarsTournament | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.registrationDeadline !== undefined) dbUpdates.registrationDeadline = new Date(updates.registrationDeadline);
  if (updates.roundDeadlineHours !== undefined) dbUpdates.roundDeadlineHours = updates.roundDeadlineHours;
  if (updates.minGroups !== undefined) dbUpdates.minGroups = updates.minGroups;
  if (updates.maxGroups !== undefined) dbUpdates.maxGroups = updates.maxGroups;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.guildWarsTournaments).set(dbUpdates).where(eq(schema.guildWarsTournaments.id, id));
  return getGuildWarsTournament(db, id);
}

export async function createGuildWarsRegistration(db: any, tournamentId: number, groupId: number, registeredBy: number): Promise<GuildWarsRegistration> {
  const result = await db.insert(schema.guildWarsRegistrations).values({ tournamentId, groupId, registeredBy });
  const rows = await db.select().from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.id, result[0].insertId)).limit(1);
  return toGWRegistration(rows[0]);
}

export async function getGuildWarsRegistration(db: any, tournamentId: number, groupId: number): Promise<GuildWarsRegistration | undefined> {
  const rows = await db.select().from(schema.guildWarsRegistrations).where(and(eq(schema.guildWarsRegistrations.tournamentId, tournamentId), eq(schema.guildWarsRegistrations.groupId, groupId))).limit(1);
  return rows[0] ? toGWRegistration(rows[0]) : undefined;
}

export async function deleteGuildWarsRegistration(db: any, tournamentId: number, groupId: number): Promise<void> {
  await db.delete(schema.guildWarsRegistrations).where(and(eq(schema.guildWarsRegistrations.tournamentId, tournamentId), eq(schema.guildWarsRegistrations.groupId, groupId)));
}

export async function getGuildWarsRegistrationsForTournament(db: any, tournamentId: number): Promise<GuildWarsRegistration[]> {
  const rows = await db.select().from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.tournamentId, tournamentId));
  return rows.map((r: any) => toGWRegistration(r));
}

export async function getGuildWarsRegistrationsForGroup(db: any, groupId: number): Promise<GuildWarsRegistration[]> {
  const rows = await db.select().from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.groupId, groupId));
  return rows.map((r: any) => toGWRegistration(r));
}

export async function createGuildWarsMatch(db: any, data: Omit<GuildWarsMatch, "id" | "createdAt">): Promise<GuildWarsMatch> {
  const result = await db.insert(schema.guildWarsMatches).values({
    tournamentId: data.tournamentId,
    round: data.round,
    group1Id: data.group1Id ?? null,
    group2Id: data.group2Id ?? null,
    winnerGroupId: data.winnerGroupId ?? null,
    status: data.status ?? "pending",
    deadline: data.deadline ? new Date(data.deadline) : null,
    game1Slug: data.game1Slug,
    game2Slug: data.game2Slug,
    game3Slug: data.game3Slug,
  });
  return (await getGuildWarsMatch(db, result[0].insertId))!;
}

export async function getGuildWarsMatch(db: any, id: number): Promise<GuildWarsMatch | undefined> {
  const rows = await db.select().from(schema.guildWarsMatches).where(eq(schema.guildWarsMatches.id, id)).limit(1);
  if (!rows[0]) return undefined;
  const match = toGWMatch(rows[0]);
  const groupIds = [match.group1Id, match.group2Id].filter(Boolean) as number[];
  const groups: Record<number, { id: number; name: string }> = {};
  if (groupIds.length > 0) {
    const gRows = await db.select({ id: schema.groups.id, name: schema.groups.name }).from(schema.groups).where(inArray(schema.groups.id, groupIds));
    for (const g of gRows) groups[g.id] = { id: g.id, name: g.name };
  }
  return { ...match, groups } as any;
}

export async function listGuildWarsMatchesForTournament(db: any, tournamentId: number): Promise<GuildWarsMatch[]> {
  const rows = await db.select().from(schema.guildWarsMatches).where(eq(schema.guildWarsMatches.tournamentId, tournamentId)).orderBy(schema.guildWarsMatches.round);
  return rows.map((r: any) => toGWMatch(r));
}

export async function updateGuildWarsMatch(db: any, id: number, updates: Partial<Pick<GuildWarsMatch, "status" | "winnerGroupId" | "deadline">>): Promise<GuildWarsMatch | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerGroupId !== undefined) dbUpdates.winnerGroupId = updates.winnerGroupId;
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline ? new Date(updates.deadline) : null;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.guildWarsMatches).set(dbUpdates).where(eq(schema.guildWarsMatches.id, id));
  return getGuildWarsMatch(db, id);
}

export async function createGuildWarsMatchGame(db: any, data: Omit<GuildWarsMatchGame, "id">): Promise<GuildWarsMatchGame> {
  const result = await db.insert(schema.guildWarsMatchGames).values({
    matchId: data.matchId,
    gameNumber: data.gameNumber,
    gameSlug: data.gameSlug,
    roomCode: data.roomCode ?? null,
    winnerGroupId: data.winnerGroupId ?? null,
    status: data.status ?? "pending",
  });
  return (await getGuildWarsMatchGameById(db, result[0].insertId))!;
}

async function getGuildWarsMatchGameById(db: any, id: number): Promise<GuildWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.guildWarsMatchGames).where(eq(schema.guildWarsMatchGames.id, id)).limit(1);
  return rows[0] ? toGWMatchGame(rows[0]) : undefined;
}

export async function getGuildWarsMatchGame(db: any, matchId: number, gameNumber: number): Promise<GuildWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.guildWarsMatchGames).where(and(eq(schema.guildWarsMatchGames.matchId, matchId), eq(schema.guildWarsMatchGames.gameNumber, gameNumber))).limit(1);
  return rows[0] ? toGWMatchGame(rows[0]) : undefined;
}

export async function getGuildWarsMatchGames(db: any, matchId: number): Promise<GuildWarsMatchGame[]> {
  const rows = await db.select().from(schema.guildWarsMatchGames).where(eq(schema.guildWarsMatchGames.matchId, matchId)).orderBy(schema.guildWarsMatchGames.gameNumber);
  return rows.map((r: any) => toGWMatchGame(r));
}

export async function updateGuildWarsMatchGame(db: any, id: number, updates: Partial<Pick<GuildWarsMatchGame, "status" | "winnerGroupId" | "roomCode">>): Promise<GuildWarsMatchGame | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerGroupId !== undefined) dbUpdates.winnerGroupId = updates.winnerGroupId;
  if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.guildWarsMatchGames).set(dbUpdates).where(eq(schema.guildWarsMatchGames.id, id));
  return getGuildWarsMatchGameById(db, id);
}

export async function getGuildWarsMatchGameByRoomCode(db: any, roomCode: string): Promise<GuildWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.guildWarsMatchGames).where(eq(schema.guildWarsMatchGames.roomCode, roomCode)).limit(1);
  return rows[0] ? toGWMatchGame(rows[0]) : undefined;
}

export async function createGuildWarsChampion(db: any, tournamentId: number, groupId: number, tournamentName: string): Promise<GuildWarsChampion> {
  const result = await db.insert(schema.guildWarsChampions).values({ tournamentId, groupId, tournamentName });
  const rows = await db.select().from(schema.guildWarsChampions).where(eq(schema.guildWarsChampions.id, result[0].insertId)).limit(1);
  return toGWChampion(rows[0]);
}

export async function getGuildWarsChampionsForTournament(db: any, tournamentId: number): Promise<GuildWarsChampion[]> {
  const rows = await db.select().from(schema.guildWarsChampions).where(eq(schema.guildWarsChampions.tournamentId, tournamentId));
  return rows.map((r: any) => toGWChampion(r));
}

export async function getGuildWarsChampionshipsForGroup(db: any, groupId: number): Promise<GuildWarsChampion[]> {
  const rows = await db.select().from(schema.guildWarsChampions).where(eq(schema.guildWarsChampions.groupId, groupId));
  return rows.map((r: any) => toGWChampion(r));
}

export async function listAllGuildWarsChampions(db: any): Promise<Array<GuildWarsChampion & { group?: { id: number; name: string }; tournament?: { id: number; name: string } }>> {
  const rows = await db.select().from(schema.guildWarsChampions).orderBy(desc(schema.guildWarsChampions.createdAt));
  if (rows.length === 0) return [];
  const groupIds = [...new Set(rows.map((r: any) => r.groupId))] as number[];
  const tournamentIds = [...new Set(rows.map((r: any) => r.tournamentId))] as number[];
  const groupRows = await db.select({ id: schema.groups.id, name: schema.groups.name }).from(schema.groups).where(inArray(schema.groups.id, groupIds));
  const tournRows = await db.select({ id: schema.guildWarsTournaments.id, name: schema.guildWarsTournaments.name }).from(schema.guildWarsTournaments).where(inArray(schema.guildWarsTournaments.id, tournamentIds));
  const groupMap = new Map(groupRows.map((g: any) => [g.id, { id: g.id, name: g.name }]));
  const tournMap = new Map(tournRows.map((t: any) => [t.id, { id: t.id, name: t.name }]));
  return rows.map((r: any) => ({ ...toGWChampion(r), group: groupMap.get(r.groupId), tournament: tournMap.get(r.tournamentId) }));
}

export async function getGuildWarsStatsForGroup(db: any, groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
  const [reg] = await db.select({ count: sql<number>`COUNT(*)` }).from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.groupId, groupId));
  const matches = await db.select({ winnerGroupId: schema.guildWarsMatches.winnerGroupId }).from(schema.guildWarsMatches)
    .where(and(or(eq(schema.guildWarsMatches.group1Id, groupId), eq(schema.guildWarsMatches.group2Id, groupId)), eq(schema.guildWarsMatches.status, "completed")));
  const wins = matches.filter((m: any) => m.winnerGroupId === groupId).length;
  return { tournamentsEntered: Number(reg?.count ?? 0), matchWins: wins, matchLosses: matches.length - wins };
}

export async function getWordWarsStatsForGroup(db: any, groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
  // Aggregate Word Wars stats for all members of a group
  const memberRows = await db.select({ userId: schema.groupMembers.userId }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId));
  if (memberRows.length === 0) return { tournamentsEntered: 0, matchWins: 0, matchLosses: 0 };
  const memberIds = memberRows.map((m: any) => m.userId);
  const [reg] = await db.select({ count: sql<number>`COUNT(DISTINCT tournament_id)` }).from(schema.wordWarsRegistrations).where(inArray(schema.wordWarsRegistrations.userId, memberIds));
  const matches = await db.select({ winnerId: schema.wordWarsMatches.winnerId }).from(schema.wordWarsMatches)
    .where(sql`(${schema.wordWarsMatches.player1Id} IN (${memberIds.join(",")}) OR ${schema.wordWarsMatches.player2Id} IN (${memberIds.join(",")})) AND ${schema.wordWarsMatches.status} = 'completed'`);
  const wins = matches.filter((m: any) => m.winnerId !== null && memberIds.includes(m.winnerId)).length;
  return { tournamentsEntered: Number(reg?.count ?? 0), matchWins: wins, matchLosses: matches.length - wins };
}
