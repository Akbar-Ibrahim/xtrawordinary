import { eq, desc, and, or, inArray, sql } from "drizzle-orm";
import type { GuildWarsTournament, InsertGuildWarsTournament, GuildWarsRegistration, GuildWarsMatch, InsertGuildWarsMatch, GuildWarsMatchGame, InsertGuildWarsMatchGame, GuildWarsChampion } from "@shared/schema";
import * as schema from "../db-schema";

function toIso(v: any): string | null { return v instanceof Date ? v.toISOString() : (v ? String(v) : null); }

function toGWTournament(r: any): GuildWarsTournament {
  return { id: r.id, name: r.name, gameSlug: r.gameSlug ?? null, scheduledAt: toIso(r.scheduledAt) ?? "", registrationDeadline: toIso(r.registrationDeadline) ?? "", status: r.status, bracketData: r.bracketData ?? null, createdAt: toIso(r.createdAt) ?? "" };
}

function toGWRegistration(r: any): GuildWarsRegistration {
  return { id: r.id, tournamentId: r.tournamentId, groupId: r.groupId, adminId: r.adminId, seed: r.seed ?? null, registeredAt: toIso(r.registeredAt) ?? "" };
}

function toGWMatch(r: any): GuildWarsMatch {
  return { id: r.id, tournamentId: r.tournamentId, round: r.round, matchNumber: r.matchNumber, group1Id: r.group1Id ?? null, group2Id: r.group2Id ?? null, winnerGroupId: r.winnerGroupId ?? null, status: r.status, group1Wins: r.group1Wins ?? 0, group2Wins: r.group2Wins ?? 0, createdAt: toIso(r.createdAt) ?? "" };
}

function toGWMatchGame(r: any): GuildWarsMatchGame {
  return { id: r.id, matchId: r.matchId, gameNumber: r.gameNumber, gameSlug: r.gameSlug, roomCode: r.roomCode ?? null, winnerGroupId: r.winnerGroupId ?? null, status: r.status, createdAt: toIso(r.createdAt) ?? "" };
}

function toGWChampion(r: any): GuildWarsChampion {
  return { id: r.id, tournamentId: r.tournamentId, groupId: r.groupId, wonAt: toIso(r.wonAt) ?? "" };
}

export async function createGuildWarsTournament(db: any, data: InsertGuildWarsTournament): Promise<GuildWarsTournament> {
  const result = await db.insert(schema.guildWarsTournaments).values({ name: data.name, gameSlug: data.gameSlug ?? null, scheduledAt: new Date(data.scheduledAt), registrationDeadline: new Date(data.registrationDeadline), status: data.status ?? "upcoming" });
  return (await getGuildWarsTournament(db, result[0].insertId))!;
}

export async function getGuildWarsTournament(db: any, id: number): Promise<GuildWarsTournament | undefined> {
  const rows = await db.select().from(schema.guildWarsTournaments).where(eq(schema.guildWarsTournaments.id, id)).limit(1);
  return rows[0] ? toGWTournament(rows[0]) : undefined;
}

export async function listGuildWarsTournaments(db: any): Promise<GuildWarsTournament[]> {
  const rows = await db.select().from(schema.guildWarsTournaments).orderBy(desc(schema.guildWarsTournaments.scheduledAt)).limit(50);
  return rows.map((r: any) => toGWTournament(r));
}

export async function updateGuildWarsTournament(db: any, id: number, updates: Partial<InsertGuildWarsTournament> & { bracketData?: any }): Promise<GuildWarsTournament | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.bracketData !== undefined) dbUpdates.bracketData = updates.bracketData;
  if (updates.scheduledAt !== undefined) dbUpdates.scheduledAt = new Date(updates.scheduledAt);
  if (updates.registrationDeadline !== undefined) dbUpdates.registrationDeadline = new Date(updates.registrationDeadline);
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.guildWarsTournaments).set(dbUpdates).where(eq(schema.guildWarsTournaments.id, id));
  return getGuildWarsTournament(db, id);
}

export async function createGuildWarsRegistration(db: any, tournamentId: number, groupId: number, adminId: number, seed?: number): Promise<GuildWarsRegistration> {
  const result = await db.insert(schema.guildWarsRegistrations).values({ tournamentId, groupId, adminId, seed: seed ?? null });
  return (await getGuildWarsRegistration(db, result[0].insertId))!;
}

export async function getGuildWarsRegistration(db: any, id: number): Promise<GuildWarsRegistration | undefined> {
  const rows = await db.select().from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.id, id)).limit(1);
  return rows[0] ? toGWRegistration(rows[0]) : undefined;
}

export async function deleteGuildWarsRegistration(db: any, tournamentId: number, groupId: number): Promise<void> {
  await db.delete(schema.guildWarsRegistrations).where(and(eq(schema.guildWarsRegistrations.tournamentId, tournamentId), eq(schema.guildWarsRegistrations.groupId, groupId)));
}

export async function getGuildWarsRegistrationsForTournament(db: any, tournamentId: number): Promise<Array<GuildWarsRegistration & { group?: { id: number; name: string }; admin?: { id: number; name: string; avatarUrl: string | null } }>> {
  const rows = await db.select().from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.tournamentId, tournamentId));
  if (rows.length === 0) return [];
  const groupIds = [...new Set(rows.map((r: any) => r.groupId))];
  const adminIds = [...new Set(rows.map((r: any) => r.adminId))];
  const groupRows = await db.select({ id: schema.groups.id, name: schema.groups.name }).from(schema.groups).where(inArray(schema.groups.id, groupIds));
  const adminRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, adminIds));
  const groupMap = new Map(groupRows.map((g: any) => [g.id, { id: g.id, name: g.name }]));
  const adminMap = new Map(adminRows.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null }]));
  return rows.map((r: any) => ({ ...toGWRegistration(r), group: groupMap.get(r.groupId), admin: adminMap.get(r.adminId) }));
}

export async function getGuildWarsRegistrationsForGroup(db: any, groupId: number): Promise<GuildWarsRegistration[]> {
  const rows = await db.select().from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.groupId, groupId));
  return rows.map((r: any) => toGWRegistration(r));
}

export async function createGuildWarsMatch(db: any, data: InsertGuildWarsMatch): Promise<GuildWarsMatch> {
  const result = await db.insert(schema.guildWarsMatches).values({ tournamentId: data.tournamentId, round: data.round, matchNumber: data.matchNumber, group1Id: data.group1Id ?? null, group2Id: data.group2Id ?? null, status: data.status ?? "pending" });
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
  const rows = await db.select().from(schema.guildWarsMatches).where(eq(schema.guildWarsMatches.tournamentId, tournamentId)).orderBy(schema.guildWarsMatches.round, schema.guildWarsMatches.matchNumber);
  return rows.map((r: any) => toGWMatch(r));
}

export async function updateGuildWarsMatch(db: any, id: number, updates: Partial<GuildWarsMatch>): Promise<GuildWarsMatch | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerGroupId !== undefined) dbUpdates.winnerGroupId = updates.winnerGroupId;
  if (updates.group1Wins !== undefined) dbUpdates.group1Wins = updates.group1Wins;
  if (updates.group2Wins !== undefined) dbUpdates.group2Wins = updates.group2Wins;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.guildWarsMatches).set(dbUpdates).where(eq(schema.guildWarsMatches.id, id));
  return getGuildWarsMatch(db, id);
}

export async function createGuildWarsMatchGame(db: any, data: InsertGuildWarsMatchGame): Promise<GuildWarsMatchGame> {
  const result = await db.insert(schema.guildWarsMatchGames).values({ matchId: data.matchId, gameNumber: data.gameNumber, gameSlug: data.gameSlug, roomCode: data.roomCode ?? null, status: data.status ?? "pending" });
  return (await getGuildWarsMatchGame(db, result[0].insertId))!;
}

export async function getGuildWarsMatchGame(db: any, id: number): Promise<GuildWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.guildWarsMatchGames).where(eq(schema.guildWarsMatchGames.id, id)).limit(1);
  return rows[0] ? toGWMatchGame(rows[0]) : undefined;
}

export async function getGuildWarsMatchGames(db: any, matchId: number): Promise<GuildWarsMatchGame[]> {
  const rows = await db.select().from(schema.guildWarsMatchGames).where(eq(schema.guildWarsMatchGames.matchId, matchId)).orderBy(schema.guildWarsMatchGames.gameNumber);
  return rows.map((r: any) => toGWMatchGame(r));
}

export async function updateGuildWarsMatchGame(db: any, id: number, updates: Partial<GuildWarsMatchGame>): Promise<GuildWarsMatchGame | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerGroupId !== undefined) dbUpdates.winnerGroupId = updates.winnerGroupId;
  if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.guildWarsMatchGames).set(dbUpdates).where(eq(schema.guildWarsMatchGames.id, id));
  return getGuildWarsMatchGame(db, id);
}

export async function getGuildWarsMatchGameByRoomCode(db: any, roomCode: string): Promise<GuildWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.guildWarsMatchGames).where(eq(schema.guildWarsMatchGames.roomCode, roomCode)).limit(1);
  return rows[0] ? toGWMatchGame(rows[0]) : undefined;
}

export async function createGuildWarsChampion(db: any, tournamentId: number, groupId: number): Promise<GuildWarsChampion> {
  const result = await db.insert(schema.guildWarsChampions).values({ tournamentId, groupId });
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
  const rows = await db.select().from(schema.guildWarsChampions).orderBy(desc(schema.guildWarsChampions.wonAt));
  if (rows.length === 0) return [];
  const groupIds = [...new Set(rows.map((r: any) => r.groupId))];
  const tournamentIds = [...new Set(rows.map((r: any) => r.tournamentId))];
  const groupRows = await db.select({ id: schema.groups.id, name: schema.groups.name }).from(schema.groups).where(inArray(schema.groups.id, groupIds));
  const tournRows = await db.select({ id: schema.guildWarsTournaments.id, name: schema.guildWarsTournaments.name }).from(schema.guildWarsTournaments).where(inArray(schema.guildWarsTournaments.id, tournamentIds));
  const groupMap = new Map(groupRows.map((g: any) => [g.id, { id: g.id, name: g.name }]));
  const tournMap = new Map(tournRows.map((t: any) => [t.id, { id: t.id, name: t.name }]));
  return rows.map((r: any) => ({ ...toGWChampion(r), group: groupMap.get(r.groupId), tournament: tournMap.get(r.tournamentId) }));
}

export async function getGuildWarsStatsForGroup(db: any, groupId: number): Promise<{ wins: number; losses: number; tournamentsWon: number; tournamentsPlayed: number }> {
  const [reg] = await db.select({ count: sql<number>`COUNT(*)` }).from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.groupId, groupId));
  const [champ] = await db.select({ count: sql<number>`COUNT(*)` }).from(schema.guildWarsChampions).where(eq(schema.guildWarsChampions.groupId, groupId));
  const matches = await db.select().from(schema.guildWarsMatches).where(and(or(eq(schema.guildWarsMatches.group1Id, groupId), eq(schema.guildWarsMatches.group2Id, groupId)), eq(schema.guildWarsMatches.status, "completed")));
  const wins = matches.filter((m: any) => m.winnerGroupId === groupId).length;
  return { wins, losses: matches.length - wins, tournamentsWon: Number(champ?.count ?? 0), tournamentsPlayed: Number(reg?.count ?? 0) };
}
