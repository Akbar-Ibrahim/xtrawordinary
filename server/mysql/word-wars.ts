import { eq, desc, and, inArray, sql } from "drizzle-orm";
import type { WordWarsTournament, InsertWordWarsTournament, WordWarsRegistration, WordWarsMatch, WordWarsMatchGame, WordWarsChampion } from "@shared/schema";
import * as schema from "../db-schema";

function toIso(v: any): string | null { return v instanceof Date ? v.toISOString() : (v ? String(v) : null); }

function toTournament(r: any): WordWarsTournament {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    registrationDeadline: toIso(r.registrationDeadline) ?? "",
    roundDeadlineHours: r.roundDeadlineHours,
    minPlayers: r.minPlayers,
    maxPlayers: r.maxPlayers ?? null,
    recurringCron: r.recurringCron ?? null,
    createdBy: r.createdBy,
    createdAt: toIso(r.createdAt) ?? "",
  };
}

function toRegistration(r: any): WordWarsRegistration {
  return { id: r.id, tournamentId: r.tournamentId, userId: r.userId, createdAt: toIso(r.createdAt) ?? "" };
}

function toMatch(r: any): WordWarsMatch {
  return {
    id: r.id,
    tournamentId: r.tournamentId,
    round: r.round,
    player1Id: r.player1Id ?? null,
    player2Id: r.player2Id ?? null,
    winnerId: r.winnerId ?? null,
    status: r.status,
    deadline: toIso(r.deadline),
    game1Slug: r.game1Slug,
    game2Slug: r.game2Slug,
    game3Slug: r.game3Slug,
    createdAt: toIso(r.createdAt) ?? "",
  };
}

function toMatchGame(r: any): WordWarsMatchGame {
  return {
    id: r.id,
    matchId: r.matchId,
    gameNumber: r.gameNumber,
    gameSlug: r.gameSlug,
    roomCode: r.roomCode ?? null,
    winnerId: r.winnerId ?? null,
    status: r.status,
  };
}

function toChampion(r: any): WordWarsChampion {
  return { id: r.id, tournamentId: r.tournamentId, userId: r.userId, createdAt: toIso(r.createdAt) ?? "" };
}

export async function createWordWarsTournament(db: any, data: InsertWordWarsTournament): Promise<WordWarsTournament> {
  const result = await db.insert(schema.wordWarsTournaments).values({
    name: data.name,
    registrationDeadline: new Date(data.registrationDeadline),
    roundDeadlineHours: data.roundDeadlineHours ?? 24,
    minPlayers: data.minPlayers ?? 4,
    maxPlayers: data.maxPlayers ?? null,
    recurringCron: data.recurringCron ?? null,
    createdBy: data.createdBy ?? 0,
  });
  return (await getWordWarsTournament(db, result[0].insertId))!;
}

export async function getWordWarsTournament(db: any, id: number): Promise<WordWarsTournament | undefined> {
  const rows = await db.select().from(schema.wordWarsTournaments).where(eq(schema.wordWarsTournaments.id, id)).limit(1);
  return rows[0] ? toTournament(rows[0]) : undefined;
}

export async function listWordWarsTournaments(db: any): Promise<WordWarsTournament[]> {
  const rows = await db.select().from(schema.wordWarsTournaments).orderBy(desc(schema.wordWarsTournaments.registrationDeadline));
  return rows.map((r: any) => toTournament(r));
}

export async function updateWordWarsTournament(db: any, id: number, updates: Partial<Pick<WordWarsTournament, "status" | "name" | "registrationDeadline" | "roundDeadlineHours" | "minPlayers" | "maxPlayers" | "recurringCron">>): Promise<WordWarsTournament | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.registrationDeadline !== undefined) dbUpdates.registrationDeadline = new Date(updates.registrationDeadline);
  if (updates.roundDeadlineHours !== undefined) dbUpdates.roundDeadlineHours = updates.roundDeadlineHours;
  if (updates.minPlayers !== undefined) dbUpdates.minPlayers = updates.minPlayers;
  if (updates.maxPlayers !== undefined) dbUpdates.maxPlayers = updates.maxPlayers;
  if (updates.recurringCron !== undefined) dbUpdates.recurringCron = updates.recurringCron;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.wordWarsTournaments).set(dbUpdates).where(eq(schema.wordWarsTournaments.id, id));
  return getWordWarsTournament(db, id);
}

export async function createWordWarsRegistration(db: any, tournamentId: number, userId: number): Promise<WordWarsRegistration> {
  await db.insert(schema.wordWarsRegistrations).values({ tournamentId, userId }).onDuplicateKeyUpdate({ set: { tournamentId } });
  const rows = await db.select().from(schema.wordWarsRegistrations).where(and(eq(schema.wordWarsRegistrations.tournamentId, tournamentId), eq(schema.wordWarsRegistrations.userId, userId))).limit(1);
  return toRegistration(rows[0]);
}

export async function getWordWarsRegistration(db: any, tournamentId: number, userId: number): Promise<WordWarsRegistration | undefined> {
  const rows = await db.select().from(schema.wordWarsRegistrations).where(and(eq(schema.wordWarsRegistrations.tournamentId, tournamentId), eq(schema.wordWarsRegistrations.userId, userId))).limit(1);
  return rows[0] ? toRegistration(rows[0]) : undefined;
}

export async function deleteWordWarsRegistration(db: any, tournamentId: number, userId: number): Promise<void> {
  await db.delete(schema.wordWarsRegistrations).where(and(eq(schema.wordWarsRegistrations.tournamentId, tournamentId), eq(schema.wordWarsRegistrations.userId, userId)));
}

export async function getWordWarsRegistrationsForTournament(db: any, tournamentId: number): Promise<WordWarsRegistration[]> {
  const rows = await db.select().from(schema.wordWarsRegistrations).where(eq(schema.wordWarsRegistrations.tournamentId, tournamentId));
  return rows.map((r: any) => toRegistration(r));
}

export async function createWordWarsMatch(db: any, data: Omit<WordWarsMatch, "id" | "createdAt">): Promise<WordWarsMatch> {
  const result = await db.insert(schema.wordWarsMatches).values({
    tournamentId: data.tournamentId,
    round: data.round,
    player1Id: data.player1Id ?? null,
    player2Id: data.player2Id ?? null,
    winnerId: data.winnerId ?? null,
    status: data.status ?? "pending",
    deadline: data.deadline ? new Date(data.deadline) : null,
    game1Slug: data.game1Slug,
    game2Slug: data.game2Slug,
    game3Slug: data.game3Slug,
  });
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
  const rows = await db.select().from(schema.wordWarsMatches).where(eq(schema.wordWarsMatches.tournamentId, tournamentId)).orderBy(schema.wordWarsMatches.round);
  return rows.map((r: any) => toMatch(r));
}

export async function updateWordWarsMatch(db: any, id: number, updates: Partial<Pick<WordWarsMatch, "status" | "winnerId" | "deadline">>): Promise<WordWarsMatch | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerId !== undefined) dbUpdates.winnerId = updates.winnerId;
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline ? new Date(updates.deadline) : null;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.wordWarsMatches).set(dbUpdates).where(eq(schema.wordWarsMatches.id, id));
  return getWordWarsMatch(db, id);
}

export async function createWordWarsMatchGame(db: any, data: Omit<WordWarsMatchGame, "id">): Promise<WordWarsMatchGame> {
  const result = await db.insert(schema.wordWarsMatchGames).values({
    matchId: data.matchId,
    gameNumber: data.gameNumber,
    gameSlug: data.gameSlug,
    roomCode: data.roomCode ?? null,
    winnerId: data.winnerId ?? null,
    status: data.status ?? "pending",
  });
  return (await getWordWarsMatchGameById(db, result[0].insertId))!;
}

async function getWordWarsMatchGameById(db: any, id: number): Promise<WordWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.wordWarsMatchGames).where(eq(schema.wordWarsMatchGames.id, id)).limit(1);
  return rows[0] ? toMatchGame(rows[0]) : undefined;
}

export async function getWordWarsMatchGame(db: any, matchId: number, gameNumber: number): Promise<WordWarsMatchGame | undefined> {
  const rows = await db.select().from(schema.wordWarsMatchGames).where(and(eq(schema.wordWarsMatchGames.matchId, matchId), eq(schema.wordWarsMatchGames.gameNumber, gameNumber))).limit(1);
  return rows[0] ? toMatchGame(rows[0]) : undefined;
}

export async function getWordWarsMatchGames(db: any, matchId: number): Promise<WordWarsMatchGame[]> {
  const rows = await db.select().from(schema.wordWarsMatchGames).where(eq(schema.wordWarsMatchGames.matchId, matchId)).orderBy(schema.wordWarsMatchGames.gameNumber);
  return rows.map((r: any) => toMatchGame(r));
}

export async function updateWordWarsMatchGame(db: any, id: number, updates: Partial<Pick<WordWarsMatchGame, "status" | "winnerId" | "roomCode">>): Promise<WordWarsMatchGame | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerId !== undefined) dbUpdates.winnerId = updates.winnerId;
  if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.wordWarsMatchGames).set(dbUpdates).where(eq(schema.wordWarsMatchGames.id, id));
  return getWordWarsMatchGameById(db, id);
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
  const rows = await db.select().from(schema.wordWarsChampions).orderBy(desc(schema.wordWarsChampions.createdAt));
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r: any) => r.userId))] as number[];
  const tournamentIds = [...new Set(rows.map((r: any) => r.tournamentId))] as number[];
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const tournRows = await db.select({ id: schema.wordWarsTournaments.id, name: schema.wordWarsTournaments.name }).from(schema.wordWarsTournaments).where(inArray(schema.wordWarsTournaments.id, tournamentIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null }]));
  const tournMap = new Map(tournRows.map((t: any) => [t.id, { id: t.id, name: t.name }]));
  return rows.map((r: any) => ({ ...toChampion(r), user: userMap.get(r.userId), tournament: tournMap.get(r.tournamentId) }));
}

export async function getWordWarsStatsForUser(db: any, userId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
  const [reg] = await db.select({ count: sql<number>`COUNT(DISTINCT tournament_id)` }).from(schema.wordWarsRegistrations).where(eq(schema.wordWarsRegistrations.userId, userId));
  const matches = await db.select({ winnerId: schema.wordWarsMatches.winnerId }).from(schema.wordWarsMatches)
    .where(sql`(${schema.wordWarsMatches.player1Id} = ${userId} OR ${schema.wordWarsMatches.player2Id} = ${userId}) AND ${schema.wordWarsMatches.status} = 'completed'`);
  const wins = matches.filter((m: any) => m.winnerId === userId).length;
  return { tournamentsEntered: Number(reg?.count ?? 0), matchWins: wins, matchLosses: matches.length - wins };
}

export async function getWordWarsStatsForGroup(db: any, groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
  // Word Wars is individual — return aggregate for all members of the group
  const memberRows = await db.select({ userId: schema.groupMembers.userId }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId));
  if (memberRows.length === 0) return { tournamentsEntered: 0, matchWins: 0, matchLosses: 0 };
  const memberIds = memberRows.map((m: any) => m.userId);
  const [reg] = await db.select({ count: sql<number>`COUNT(DISTINCT tournament_id)` }).from(schema.wordWarsRegistrations).where(inArray(schema.wordWarsRegistrations.userId, memberIds));
  const matches = await db.select({ winnerId: schema.wordWarsMatches.winnerId, player1Id: schema.wordWarsMatches.player1Id, player2Id: schema.wordWarsMatches.player2Id })
    .from(schema.wordWarsMatches)
    .where(sql`(${schema.wordWarsMatches.player1Id} IN (${memberIds.join(",")}) OR ${schema.wordWarsMatches.player2Id} IN (${memberIds.join(",")})) AND ${schema.wordWarsMatches.status} = 'completed'`);
  const wins = matches.filter((m: any) => m.winnerId !== null && memberIds.includes(m.winnerId)).length;
  return { tournamentsEntered: Number(reg?.count ?? 0), matchWins: wins, matchLosses: matches.length - wins };
}
