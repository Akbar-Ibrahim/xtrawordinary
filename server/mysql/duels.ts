import { eq, desc, and, or, inArray, sql, lt } from "drizzle-orm";
import type { DuelChallenge, InsertDuelChallenge, DuelSession, InsertDuelSession, DuelRating, LeaderboardEntry } from "@shared/schema";
import * as schema from "../db-schema";

export function tsToIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function mapDuelChallenge(r: any): DuelChallenge {
  return { id: r.id, challengerId: r.challengerId, challengeeId: r.challengeeId ?? null, gameSlug: r.gameSlug, format: r.format ?? "turn-based", raceTarget: r.raceTarget ?? null, raceTimeLimit: r.raceTimeLimit ?? null, status: r.status, roomCode: r.roomCode ?? null, seed: r.seed ?? null, startWord: r.startWord ?? null, isOpen: !!r.isOpen, expiresAt: tsToIso(r.expiresAt), createdAt: tsToIso(r.createdAt) ?? "" };
}

function mapDuelSession(r: any): DuelSession {
  return { id: r.id, challengeId: r.challengeId ?? null, roomCode: r.roomCode, player1Id: r.player1Id, player2Id: r.player2Id, gameSlug: r.gameSlug, format: r.format ?? "turn-based", raceTarget: r.raceTarget ?? null, raceTimeLimit: r.raceTimeLimit ?? null, status: r.status, winnerId: r.winnerId ?? null, player1Score: r.player1Score ?? 0, player2Score: r.player2Score ?? 0, seed: r.seed ?? null, startWord: r.startWord ?? null, player1Lives: r.player1Lives ?? null, player2Lives: r.player2Lives ?? null, metadata: r.metadata ?? null, createdAt: tsToIso(r.createdAt) ?? "", completedAt: tsToIso(r.completedAt) };
}

function mapDuelRating(r: any): DuelRating {
  return { id: r.id, userId: r.userId, gameSlug: r.gameSlug, rating: r.rating, wins: r.wins, losses: r.losses, draws: r.draws, updatedAt: tsToIso(r.updatedAt) ?? "" };
}

export async function createDuelChallenge(db: any, c: InsertDuelChallenge): Promise<DuelChallenge> {
  const result = await db.insert(schema.duelChallenges).values({ challengerId: c.challengerId, challengeeId: c.challengeeId ?? null, gameSlug: c.gameSlug, format: c.format ?? "turn-based", raceTarget: c.raceTarget ?? null, raceTimeLimit: c.raceTimeLimit ?? null, status: c.status ?? "pending", roomCode: c.roomCode ?? null, seed: c.seed ?? null, startWord: c.startWord ?? null, isOpen: c.isOpen ?? false, expiresAt: c.expiresAt ? new Date(c.expiresAt) : null });
  return (await getDuelChallenge(db, result[0].insertId))!;
}

export async function getDuelChallenge(db: any, id: number): Promise<DuelChallenge | undefined> {
  const rows = await db.select().from(schema.duelChallenges).where(eq(schema.duelChallenges.id, id)).limit(1);
  return rows[0] ? mapDuelChallenge(rows[0]) : undefined;
}

export async function getDuelChallengeByRoom(db: any, roomCode: string): Promise<DuelChallenge | undefined> {
  const rows = await db.select().from(schema.duelChallenges).where(eq(schema.duelChallenges.roomCode, roomCode)).limit(1);
  return rows[0] ? mapDuelChallenge(rows[0]) : undefined;
}

export async function updateDuelChallengeStatus(db: any, id: number, status: DuelChallenge["status"], roomCode?: string): Promise<DuelChallenge | undefined> {
  const updates: any = { status };
  if (roomCode) updates.roomCode = roomCode;
  await db.update(schema.duelChallenges).set(updates).where(eq(schema.duelChallenges.id, id));
  return getDuelChallenge(db, id);
}

export async function getDuelChallengesForUser(db: any, userId: number): Promise<DuelChallenge[]> {
  const rows = await db.select().from(schema.duelChallenges).where(or(eq(schema.duelChallenges.challengerId, userId), eq(schema.duelChallenges.challengeeId, userId))).orderBy(desc(schema.duelChallenges.createdAt)).limit(50);
  return rows.map((r: any) => mapDuelChallenge(r));
}

export async function updateDuelChallengeChallengee(db: any, id: number, challengeeId: number): Promise<DuelChallenge | undefined> {
  await db.update(schema.duelChallenges).set({ challengeeId }).where(eq(schema.duelChallenges.id, id));
  return getDuelChallenge(db, id);
}

export async function acceptOpenDuelChallenge(db: any, id: number, challengeeId: number, roomCode: string): Promise<DuelChallenge | undefined> {
  await db.update(schema.duelChallenges).set({ challengeeId, status: "accepted", roomCode }).where(eq(schema.duelChallenges.id, id));
  return getDuelChallenge(db, id);
}

export async function getOpenDuelChallenges(db: any, gameSlug?: string): Promise<DuelChallenge[]> {
  const now = new Date();
  const whereClause = gameSlug
    ? and(eq(schema.duelChallenges.isOpen, true), eq(schema.duelChallenges.status, "pending"), sql`${schema.duelChallenges.expiresAt} > ${now}`, eq(schema.duelChallenges.gameSlug, gameSlug))
    : and(eq(schema.duelChallenges.isOpen, true), eq(schema.duelChallenges.status, "pending"), sql`${schema.duelChallenges.expiresAt} > ${now}`);
  const rows = await db.select().from(schema.duelChallenges).where(whereClause).orderBy(desc(schema.duelChallenges.createdAt)).limit(20);
  if (rows.length === 0) return [];
  const challengerIds = [...new Set(rows.map((r: any) => r.challengerId))];
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, challengerIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  return rows.map((r: any) => ({ ...mapDuelChallenge(r), challengerName: (userMap.get(r.challengerId) as any)?.name, challengerAvatarUrl: (userMap.get(r.challengerId) as any)?.avatarUrl ?? null }));
}

export async function expireOpenChallenges(db: any): Promise<number> {
  const now = new Date();
  const result = await db.update(schema.duelChallenges).set({ status: "expired" }).where(and(eq(schema.duelChallenges.isOpen, true), eq(schema.duelChallenges.status, "pending"), lt(schema.duelChallenges.expiresAt, now)));
  return result[0]?.affectedRows ?? 0;
}

export async function createDuelSession(db: any, session: InsertDuelSession): Promise<DuelSession> {
  const result = await db.insert(schema.duelSessions).values({ challengeId: session.challengeId ?? null, roomCode: session.roomCode, player1Id: session.player1Id, player2Id: session.player2Id, gameSlug: session.gameSlug, format: session.format ?? "turn-based", raceTarget: session.raceTarget ?? null, raceTimeLimit: session.raceTimeLimit ?? null, status: session.status ?? "waiting", seed: session.seed ?? null, startWord: session.startWord ?? null, player1Lives: session.player1Lives ?? null, player2Lives: session.player2Lives ?? null, metadata: session.metadata ?? null });
  return (await getDuelSession(db, result[0].insertId))!;
}

export async function getDuelSession(db: any, id: number): Promise<DuelSession | undefined> {
  const rows = await db.select().from(schema.duelSessions).where(eq(schema.duelSessions.id, id)).limit(1);
  return rows[0] ? mapDuelSession(rows[0]) : undefined;
}

export async function getDuelSessionByRoom(db: any, roomCode: string): Promise<DuelSession | undefined> {
  const rows = await db.select().from(schema.duelSessions).where(eq(schema.duelSessions.roomCode, roomCode)).limit(1);
  return rows[0] ? mapDuelSession(rows[0]) : undefined;
}

export async function updateDuelSession(db: any, id: number, updates: Partial<InsertDuelSession> & { completedAt?: string | null }): Promise<DuelSession | undefined> {
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerId !== undefined) dbUpdates.winnerId = updates.winnerId;
  if (updates.player1Score !== undefined) dbUpdates.player1Score = updates.player1Score;
  if (updates.player2Score !== undefined) dbUpdates.player2Score = updates.player2Score;
  if (updates.player1Lives !== undefined) dbUpdates.player1Lives = updates.player1Lives;
  if (updates.player2Lives !== undefined) dbUpdates.player2Lives = updates.player2Lives;
  if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;
  if (updates.completedAt !== undefined) dbUpdates.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;
  if (Object.keys(dbUpdates).length > 0) await db.update(schema.duelSessions).set(dbUpdates).where(eq(schema.duelSessions.id, id));
  return getDuelSession(db, id);
}

export async function getDuelSessionsForUser(db: any, userId: number, limit = 20): Promise<DuelSession[]> {
  const rows = await db.select().from(schema.duelSessions).where(and(or(eq(schema.duelSessions.player1Id, userId), eq(schema.duelSessions.player2Id, userId)), eq(schema.duelSessions.status, "completed"))).orderBy(desc(schema.duelSessions.createdAt)).limit(limit);
  return rows.map((r: any) => mapDuelSession(r));
}

export async function getDuelRating(db: any, userId: number, gameSlug: string): Promise<DuelRating | undefined> {
  const rows = await db.select().from(schema.duelRatings).where(and(eq(schema.duelRatings.userId, userId), eq(schema.duelRatings.gameSlug, gameSlug))).limit(1);
  return rows[0] ? mapDuelRating(rows[0]) : undefined;
}

export async function getDuelLeaderboard(db: any, gameSlug: string, limit = 50): Promise<LeaderboardEntry[]> {
  const whereClause = gameSlug === "overall"
    ? undefined
    : eq(schema.duelRatings.gameSlug, gameSlug);
  let rows: any[];
  if (gameSlug === "overall") {
    rows = await db.select({ userId: schema.duelRatings.userId, rating: sql<number>`AVG(${schema.duelRatings.rating})`, wins: sql<number>`SUM(${schema.duelRatings.wins})`, updatedAt: sql<string>`MAX(${schema.duelRatings.updatedAt})` }).from(schema.duelRatings).groupBy(schema.duelRatings.userId).orderBy(sql`AVG(${schema.duelRatings.rating}) DESC`).limit(limit);
  } else {
    rows = await db.select().from(schema.duelRatings).where(whereClause!).orderBy(desc(schema.duelRatings.rating)).limit(limit);
  }
  if (rows.length === 0) return [];
  const userIds = rows.map((r: any) => r.userId);
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  return rows.map((r: any, i: number) => ({ id: i + 1, userId: r.userId, gameSlug, score: Math.round(Number(r.rating)), playerName: (userMap.get(r.userId) as any)?.name ?? "Unknown", playerAvatarUrl: (userMap.get(r.userId) as any)?.avatarUrl ?? null, playedAt: r.updatedAt instanceof Date ? (r.updatedAt as Date).toISOString() : String(r.updatedAt), gamesPlayed: r.wins ?? undefined }));
}

export async function upsertDuelRating(db: any, userId: number, gameSlug: string, rating: number, outcome: "win" | "loss" | "draw"): Promise<DuelRating> {
  const wins = outcome === "win" ? 1 : 0;
  const losses = outcome === "loss" ? 1 : 0;
  const draws = outcome === "draw" ? 1 : 0;
  await db.insert(schema.duelRatings).values({ userId, gameSlug, rating, wins, losses, draws })
    .onDuplicateKeyUpdate({ set: { rating, wins: sql`wins + ${wins}`, losses: sql`losses + ${losses}`, draws: sql`draws + ${draws}`, updatedAt: new Date() } });
  return (await getDuelRating(db, userId, gameSlug))!;
}

export async function getDuelRankContext(db: any, userId: number, gameSlug: string): Promise<{ rank: number; totalPlayers: number; rating: number } | null> {
  const rating = await getDuelRating(db, userId, gameSlug);
  if (!rating) return null;
  const all = gameSlug === "overall"
    ? await db.select({ userId: schema.duelRatings.userId, avgRating: sql<number>`AVG(${schema.duelRatings.rating})` }).from(schema.duelRatings).groupBy(schema.duelRatings.userId).orderBy(sql`AVG(${schema.duelRatings.rating}) DESC`)
    : await db.select({ userId: schema.duelRatings.userId, avgRating: schema.duelRatings.rating }).from(schema.duelRatings).where(eq(schema.duelRatings.gameSlug, gameSlug)).orderBy(desc(schema.duelRatings.rating));
  const rank = all.findIndex((r: any) => r.userId === userId) + 1;
  return rank > 0 ? { rank, totalPlayers: all.length, rating: rating.rating } : null;
}
