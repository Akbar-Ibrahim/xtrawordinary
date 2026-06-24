import { eq, desc, and, inArray, sql } from "drizzle-orm";
import type { WordWarsTournament, InsertWordWarsTournament, WordWarsRegistration, WordWarsMatch, InsertWordWarsMatch, WordWarsMatchGame, InsertWordWarsMatchGame, WordWarsChampion } from "@shared/schema";
import * as schema from "../db-schema";
import { getGroupMembers } from "./groups";

function toIso(v: any): string | null { return v instanceof Date ? v.toISOString() : (v ? String(v) : null); }

function toTournament(r: any): WordWarsTournament {
  return { id: r.id, name: r.name, gameSlug: r.gameSlug ?? null, scheduledAt: toIso(r.scheduledAt) ?? "", registrationDeadline: toIso(r.registrationDeadline) ?? "", status: r.status, bracketData: r.bracketData ?? null, createdAt: toIso(r.createdAt) ?? "" };
}

function toRegistration(r: any): WordWarsRegistration {
  return { id: r.id, tournamentId: r.tournamentId, userId: r.userId, seed: r.seed ?? null, registeredAt: toIso(r.registeredAt) ?? "" };
}

function toMatch(r: any): WordWarsMatch {
  return { id: r.id, tournamentId: r.tournamentId, round: r.round, matchNumber: r.matchNumber, player1Id: r.player1Id ?? null, player2Id: r.player2Id ?? null, winnerId: r.winnerId ?? null, status: r.status, player1Wins: r.player1Wins ?? 0, player2Wins: r.player2Wins ?? 0, createdAt: toIso(r.createdAt) ?? "" };
}

function toMatchGame(r: any): WordWarsMatchGame {
  return { id: r.id, matchId: r.matchId, gameNumber: r.gameNumber, gameSlug: r.gameSlug, roomCode: r.roomCode ?? null, winnerId: r.winnerId ?? null, status: r.status, createdAt: toIso(r.createdAt) ?? "" };
}

function toChampion(r: any): WordWarsChampion {
  return { id: r.id, tournamentId: r.tournamentId, userId: r.userId, wonAt: toIso(r.wonAt) ?? "" };
}

export async function createWordWarsTournament(db: any, data: InsertWordWarsTournament): Promise<WordWarsTournament> {
  const result = await db.insert(schema.wordWarsTournaments).values({ name: data.name, gameSlug: data.gameSlug ?? null, scheduledAt: new Date(data.scheduledAt), registrationDeadline: new Date(data.registrationDeadline), status: data.status ?? "upcoming" });
  return (await getWordWarsTournament(db, result[0].insertId))!;
}

export async function getWordWarsTournament(db: any, id: number): Promise<WordWarsTournament | undefined> {
  const rows = await db.select().from(schema.wordWarsTournaments).where(eq(schema.wordWarsTournaments.id, id)).limit(1);
  return rows[0] ? toTournament(rows[0]) : undefined;
}

export async function listWordWarsTournaments(db: any): Promise<WordWarsTournament[]> {
  const rows = await db.select().from(schema.wordWarsTournaments).orderBy(desc(schema.wordWarsTournaments.scheduledAt)).limit(50);
  return rows.map((r: any) => toTournament(r));
}

export async function updateWordWarsTournament(db: any, id: number, updates: Partial<InsertWordWarsTournament> & { bracketData?: any }): Promise<WordWarsTournament | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.bracketData !== undefined) dbUpdates.bracketData = updates.bracketData;
  if (updates.scheduledAt !== undefined) dbUpdates.scheduledAt = new Date(updates.scheduledAt);
  if (updates.registrationDeadline !== undefined) dbUpdates.registrationDeadline = new Date(updates.registrationDeadline);
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.wordWarsTournaments).set(dbUpdates).where(eq(schema.wordWarsTournaments.id, id));
  return getWordWarsTournament(db, id);
}

export async function createWordWarsRegistration(db: any, tournamentId: number, userId: number, seed?: number): Promise<WordWarsRegistration> {
  const result = await db.insert(schema.wordWarsRegistrations).values({ tournamentId, userId, seed: seed ?? null });
  return (await getWordWarsRegistration(db, result[0].insertId))!;
}

export async function getWordWarsRegistration(db: any, id: number): Promise<WordWarsRegistration | undefined> {
  const rows = await db.select().from(schema.wordWarsRegistrations).where(eq(schema.wordWarsRegistrations.id, id)).limit(1);
  return rows[0] ? toRegistration(rows[0]) : undefined;
}

export async function deleteWordWarsRegistration(db: any, tournamentId: number, userId: number): Promise<void> {
  await db.delete(schema.wordWarsRegistrations).where(and(eq(schema.wordWarsRegistrations.tournamentId, tournamentId), eq(schema.wordWarsRegistrations.userId, userId)));
}

export async function getWordWarsRegistrationsForTournament(db: any, tournamentId: number): Promise<Array<WordWarsRegistration & { user?: { id: number; name: string; avatarUrl: string | null } }>> {
  const rows = await db.select().from(schema.wordWarsRegistrations).where(eq(schema.wordWarsRegistrations.tournamentId, tournamentId));
  if (rows.length === 0) return [];
  const userIds = rows.map((r: any) => r.userId);
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null }]));
  return rows.map((r: any) => ({ ...toRegistration(r), user: userMap.get(r.userId) }));
}

export async function createWordWarsMatch(db: any, data: InsertWordWarsMatch): Promise<WordWarsMatch> {
  const result = await db.insert(schema.wordWarsMatches).values({ tournamentId: data.tournamentId, round: data.round, matchNumber: data.matchNumber, player1Id: data.player1Id ?? null, player2Id: data.player2Id ?? null, status: data.status ?? "pending" });
  return (await getWordWarsMatch(db, result[0].insertId))!;
}

export async function getWordWarsMatch(db: any, id: number): Promise<WordWarsMatch | undefined> {
  const rows = await db.select().from(schema.wordWarsMatches).where(eq(schema.wordWarsMatches.id, id)).limit(1);
  if (!rows[0]) return undefined;
  const match = toMatch(rows[0]);
  const playerIds = [match.player1Id, match.player2Id].filter(Boolean) as number[];
  const players: Record<number, { id: number; name: string; avatarUrl: string | null }> = {};
  if (playerIds.length > 0) {
    const uRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, playerIds));
    for (const u of uRows) players[u.id] = { id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null };
  }
  return { ...match, players } as any;
}

export async function listWordWarsMatchesForTournament(db: any, tournamentId: number): Promise<WordWarsMatch[]> {
  const rows = await db.select().from(schema.wordWarsMatches).where(eq(schema.wordWarsMatches.tournamentId, tournamentId)).orderBy(schema.wordWarsMatches.round, schema.wordWarsMatches.matchNumber);
  return rows.map((r: any) => toMatch(r));
}

export async function updateWordWarsMatch(db: any, id: number, updates: Partial<WordWarsMatch>): Promise<WordWarsMatch | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerId !== undefined) dbUpdates.winnerId = updates.winnerId;
  if (updates.player1Wins !== undefined) dbUpdates.player1Wins = updates.player1Wins;
  if (updates.player2Wins !== undefined) dbUpdates.player2Wins = updates.player2Wins;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.wordWarsMatches).set(dbUpdates).where(eq(schema.wordWarsMatches.id, id));
  return getWordWarsMatch(db, id);
}

export async function createWordWarsMatchGame(db: any, data: InsertWordWarsMatchGame): Promise<WordWarsMatchGame> {
  const result = await db.insert(schema.wordWarsMatchGames).values({ matchId: data.matchId, gameNumber: data.gameNumber, gameSlug: data.gameSlug, roomCode: data.roomCode ?? null, status: data.status ?? "pending" });
  return (await getWordWarsMatchGame(db, result[0].insertId))!;
}

export async function getWordWarsMatchGame(db: any, id: number): Promise<WordWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.wordWarsMatchGames).where(eq(schema.wordWarsMatchGames.id, id)).limit(1);
  return rows[0] ? toMatchGame(rows[0]) : undefined;
}

export async function getWordWarsMatchGames(db: any, matchId: number): Promise<WordWarsMatchGame[]> {
  const rows = await db.select().from(schema.wordWarsMatchGames).where(eq(schema.wordWarsMatchGames.matchId, matchId)).orderBy(schema.wordWarsMatchGames.gameNumber);
  return rows.map((r: any) => toMatchGame(r));
}

export async function updateWordWarsMatchGame(db: any, id: number, updates: Partial<WordWarsMatchGame>): Promise<WordWarsMatchGame | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerId !== undefined) dbUpdates.winnerId = updates.winnerId;
  if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.wordWarsMatchGames).set(dbUpdates).where(eq(schema.wordWarsMatchGames.id, id));
  return getWordWarsMatchGame(db, id);
}

export async function getMatchGameByRoomCode(db: any, roomCode: string): Promise<WordWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.wordWarsMatchGames).where(eq(schema.wordWarsMatchGames.roomCode, roomCode)).limit(1);
  return rows[0] ? toMatchGame(rows[0]) : undefined;
}

export async function createWordWarsChampion(db: any, tournamentId: number, userId: number): Promise<WordWarsChampion> {
  const result = await db.insert(schema.wordWarsChampions).values({ tournamentId, userId });
  const rows = await db.select().from(schema.wordWarsChampions).where(eq(schema.wordWarsChampions.id, result[0].insertId)).limit(1);
  return toChampion(rows[0]);
}

export async function getChampionsForTournament(db: any, tournamentId: number): Promise<WordWarsChampion[]> {
  const rows = await db.select().from(schema.wordWarsChampions).where(eq(schema.wordWarsChampions.tournamentId, tournamentId));
  return rows.map((r: any) => toChampion(r));
}

export async function getChampionshipsForUser(db: any, userId: number): Promise<WordWarsChampion[]> {
  const rows = await db.select().from(schema.wordWarsChampions).where(eq(schema.wordWarsChampions.userId, userId));
  return rows.map((r: any) => toChampion(r));
}

export async function listAllWordWarsChampions(db: any): Promise<Array<WordWarsChampion & { user?: { id: number; name: string; avatarUrl: string | null }; tournament?: { id: number; name: string } }>> {
  const rows = await db.select().from(schema.wordWarsChampions).orderBy(desc(schema.wordWarsChampions.wonAt));
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r: any) => r.userId))];
  const tournamentIds = [...new Set(rows.map((r: any) => r.tournamentId))];
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const tournRows = await db.select({ id: schema.wordWarsTournaments.id, name: schema.wordWarsTournaments.name }).from(schema.wordWarsTournaments).where(inArray(schema.wordWarsTournaments.id, tournamentIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null }]));
  const tournMap = new Map(tournRows.map((t: any) => [t.id, { id: t.id, name: t.name }]));
  return rows.map((r: any) => ({ ...toChampion(r), user: userMap.get(r.userId), tournament: tournMap.get(r.tournamentId) }));
}

export async function getWordWarsStatsForUser(db: any, userId: number): Promise<{ totalWins: number; totalLosses: number; tournamentsPlayed: number; tournamentsWon: number }> {
  const [reg] = await db.select({ count: sql<number>`COUNT(DISTINCT tournament_id)` }).from(schema.wordWarsRegistrations).where(eq(schema.wordWarsRegistrations.userId, userId));
  const [champ] = await db.select({ count: sql<number>`COUNT(*)` }).from(schema.wordWarsChampions).where(eq(schema.wordWarsChampions.userId, userId));
  const matches = await db.select().from(schema.wordWarsMatches).where(sql`(${schema.wordWarsMatches.player1Id} = ${userId} OR ${schema.wordWarsMatches.player2Id} = ${userId}) AND ${schema.wordWarsMatches.status} = 'completed'`);
  const wins = matches.filter((m: any) => m.winnerId === userId).length;
  return { totalWins: wins, totalLosses: matches.length - wins, tournamentsPlayed: Number(reg?.count ?? 0), tournamentsWon: Number(champ?.count ?? 0) };
}

export async function getWordWarsStatsForGroup(db: any, groupId: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; wins: number; losses: number; tournamentsWon: number }>> {
  const members = await getGroupMembers(db, groupId);
  if (members.length === 0) return [];
  return Promise.all(members.map(async (m) => {
    const stats = await getWordWarsStatsForUser(db, m.userId);
    return { userId: m.userId, name: m.user.name, avatarUrl: m.user.avatarUrl, wins: stats.totalWins, losses: stats.totalLosses, tournamentsWon: stats.tournamentsWon };
  }));
}
