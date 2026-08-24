import { eq, desc, and, or, inArray, sql, lt } from "drizzle-orm";
import type { DuelChallenge, InsertDuelChallenge, DuelSession, InsertDuelSession, DuelRating, DuelChallengeStatus } from "@shared/schema";
import * as schema from "../db-schema";
import { getOpenChallengeFallbackCutoff } from "../challenge-expiry";

export function tsToIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function mapDuelChallenge(r: any): DuelChallenge {
  return {
    id: r.id,
    challengerId: r.challengerId,
    challengeeId: r.challengeeId ?? null,
    gameSlug: r.gameSlug,
    message: r.message ?? null,
    status: r.status,
    roomCode: r.roomCode ?? null,
    seed: r.seed ?? null,
    startWord: r.startWord ?? null,
    format: r.format ?? "turn",
    raceTarget: r.raceTarget ?? null,
    raceTimeLimit: r.raceTimeLimit ?? null,
    expiresAt: tsToIso(r.expiresAt),
    createdAt: tsToIso(r.createdAt) ?? "",
  };
}

function mapDuelSession(r: any): DuelSession {
  return {
    id: r.id,
    roomCode: r.roomCode,
    challengeId: r.challengeId ?? null,
    player1Id: r.player1Id,
    player2Id: r.player2Id,
    gameSlug: r.gameSlug,
    seed: r.seed,
    format: r.format ?? "turn",
    raceTarget: r.raceTarget ?? null,
    raceTimeLimit: r.raceTimeLimit ?? null,
    outcome: r.outcome ?? null,
    eloDeltaPlayer1: r.eloDeltaPlayer1 ?? null,
    eloDeltaPlayer2: r.eloDeltaPlayer2 ?? null,
    startedAt: tsToIso(r.startedAt) ?? "",
    endedAt: tsToIso(r.endedAt),
  };
}

function mapDuelRating(r: any): DuelRating {
  return {
    id: r.id,
    userId: r.userId,
    elo: r.elo,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    updatedAt: tsToIso(r.updatedAt) ?? "",
  };
}

// ── Duel Challenges ────────────────────────────────────────────────────────

export async function createDuelChallenge(db: any, c: InsertDuelChallenge): Promise<DuelChallenge> {
  const result = await db.insert(schema.duelChallenges).values({
    challengerId: c.challengerId,
    challengeeId: c.challengeeId ?? null,
    gameSlug: c.gameSlug,
    message: (c as any).message ?? null,
    format: c.format ?? "turn",
    raceTarget: c.raceTarget ?? null,
    raceTimeLimit: c.raceTimeLimit ?? null,
    status: c.status ?? "pending",
    roomCode: c.roomCode ?? null,
    seed: c.seed ?? null,
    startWord: c.startWord ?? null,
    expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
  });
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

export async function updateDuelChallengeStatus(db: any, id: number, status: DuelChallengeStatus, roomCode?: string, seed?: number | null, startWord?: string | null): Promise<DuelChallenge | undefined> {
  const updates: any = { status };
  if (roomCode !== undefined) updates.roomCode = roomCode;
  if (seed !== undefined) updates.seed = seed;
  if (startWord !== undefined) updates.startWord = startWord;
  await db.update(schema.duelChallenges).set(updates).where(eq(schema.duelChallenges.id, id));
  return getDuelChallenge(db, id);
}

export async function updateDuelChallengeChallengee(db: any, id: number, challengeeId: number): Promise<DuelChallenge | undefined> {
  await db.update(schema.duelChallenges).set({ challengeeId }).where(eq(schema.duelChallenges.id, id));
  return getDuelChallenge(db, id);
}

export async function acceptOpenDuelChallenge(db: any, id: number, challengeeId: number): Promise<DuelChallenge | null> {
  // Atomically accept: only update if still pending with no challengee
  const result = await db.update(schema.duelChallenges)
    .set({ challengeeId, status: "accepted" })
    .where(and(eq(schema.duelChallenges.id, id), eq(schema.duelChallenges.status, "pending"), sql`${schema.duelChallenges.challengeeId} IS NULL`));
  if (!result[0]?.affectedRows) return null;
  return (await getDuelChallenge(db, id)) ?? null;
}

export async function getDuelChallengesForUser(db: any, userId: number): Promise<DuelChallenge[]> {
  const rows = await db.select().from(schema.duelChallenges)
    .where(or(eq(schema.duelChallenges.challengerId, userId), eq(schema.duelChallenges.challengeeId, userId)))
    .orderBy(desc(schema.duelChallenges.createdAt));
  return rows.map((r: any) => mapDuelChallenge(r));
}

export async function getOpenDuelChallenges(db: any, excludeUserId: number, gameSlug?: string): Promise<DuelChallenge[]> {
  const baseWhere = and(
    sql`${schema.duelChallenges.challengeeId} IS NULL`,
    eq(schema.duelChallenges.status, "pending"),
    sql`${schema.duelChallenges.challengerId} != ${excludeUserId}`,
  );
  const whereClause = gameSlug ? and(baseWhere, eq(schema.duelChallenges.gameSlug, gameSlug)) : baseWhere;
  const rows = await db.select().from(schema.duelChallenges).where(whereClause as any).orderBy(desc(schema.duelChallenges.createdAt));
  if (rows.length === 0) return [];
  const challengerIds = Array.from(new Set(rows.map((r: any) => r.challengerId as number))) as number[];
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, challengerIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  return rows.map((r: any) => ({
    ...mapDuelChallenge(r),
    challengerName: (userMap.get(r.challengerId) as any)?.name,
    challengerAvatarUrl: (userMap.get(r.challengerId) as any)?.avatarUrl ?? null,
  }));
}

export async function expireOpenChallenges(db: any): Promise<number> {
  const now = new Date();
  const fallbackCutoff = getOpenChallengeFallbackCutoff(now);
  const baseCondition = and(
    sql`${schema.duelChallenges.challengeeId} IS NULL`,
    eq(schema.duelChallenges.status, "pending"),
  );
  const result = await db.update(schema.duelChallenges)
    .set({ status: "expired" })
    .where(and(baseCondition, sql`(${schema.duelChallenges.expiresAt} IS NOT NULL AND ${schema.duelChallenges.expiresAt} < ${now}) OR (${schema.duelChallenges.expiresAt} IS NULL AND ${schema.duelChallenges.createdAt} < ${fallbackCutoff})`));
  return result[0]?.affectedRows ?? 0;
}

// ── Duel Sessions ──────────────────────────────────────────────────────────

export async function createDuelSession(db: any, session: InsertDuelSession): Promise<DuelSession> {
  const result = await db.insert(schema.duelSessions).values({
    challengeId: session.challengeId ?? null,
    roomCode: session.roomCode,
    player1Id: session.player1Id,
    player2Id: session.player2Id,
    gameSlug: session.gameSlug,
    seed: session.seed,
    format: session.format ?? "turn",
    raceTarget: session.raceTarget ?? null,
    raceTimeLimit: session.raceTimeLimit ?? null,
    outcome: session.outcome ?? null,
    eloDeltaPlayer1: session.eloDeltaPlayer1 ?? null,
    eloDeltaPlayer2: session.eloDeltaPlayer2 ?? null,
  });
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

export async function updateDuelSession(db: any, id: number, updates: Partial<Pick<DuelSession, "outcome" | "eloDeltaPlayer1" | "eloDeltaPlayer2" | "endedAt">>): Promise<DuelSession | undefined> {
  const dbUpdates: any = {};
  if (updates.outcome !== undefined) dbUpdates.outcome = updates.outcome;
  if (updates.eloDeltaPlayer1 !== undefined) dbUpdates.eloDeltaPlayer1 = updates.eloDeltaPlayer1;
  if (updates.eloDeltaPlayer2 !== undefined) dbUpdates.eloDeltaPlayer2 = updates.eloDeltaPlayer2;
  if (updates.endedAt !== undefined) dbUpdates.endedAt = updates.endedAt ? new Date(updates.endedAt) : null;
  if (Object.keys(dbUpdates).length > 0) {
    await db.update(schema.duelSessions).set(dbUpdates).where(eq(schema.duelSessions.id, id));
  }
  return getDuelSession(db, id);
}

export async function getDuelSessionsForUser(db: any, userId: number): Promise<DuelSession[]> {
  const rows = await db.select().from(schema.duelSessions)
    .where(or(eq(schema.duelSessions.player1Id, userId), eq(schema.duelSessions.player2Id, userId)))
    .orderBy(desc(schema.duelSessions.startedAt));
  return rows.map((r: any) => mapDuelSession(r));
}

// ── Duel Ratings ───────────────────────────────────────────────────────────

export async function getDuelRating(db: any, userId: number): Promise<DuelRating | undefined> {
  const rows = await db.select().from(schema.duelRatings).where(eq(schema.duelRatings.userId, userId)).limit(1);
  return rows[0] ? mapDuelRating(rows[0]) : undefined;
}

export async function upsertDuelRating(db: any, userId: number, updates: Partial<Pick<DuelRating, "elo" | "wins" | "losses" | "draws">>): Promise<DuelRating> {
  const elo = updates.elo ?? 1200;
  const wins = updates.wins ?? 0;
  const losses = updates.losses ?? 0;
  const draws = updates.draws ?? 0;
  await db.insert(schema.duelRatings).values({ userId, elo, wins, losses, draws })
    .onDuplicateKeyUpdate({
      set: {
        elo: updates.elo !== undefined ? updates.elo : schema.duelRatings.elo,
        wins: updates.wins !== undefined ? updates.wins : schema.duelRatings.wins,
        losses: updates.losses !== undefined ? updates.losses : schema.duelRatings.losses,
        draws: updates.draws !== undefined ? updates.draws : schema.duelRatings.draws,
        updatedAt: new Date(),
      },
    });
  return (await getDuelRating(db, userId))!;
}

export async function getDuelLeaderboard(db: any, limit = 50, format?: "turn" | "race"): Promise<Array<{ rank: number; userId: number; username: string; displayName: string; avatarUrl: string | null; elo: number; wins: number; losses: number; draws: number; winRate: number }>> {
  let ratingRows = await db.select().from(schema.duelRatings).orderBy(desc(schema.duelRatings.elo));
  if (format) {
    const sessionRows = await db.select({ player1Id: schema.duelSessions.player1Id, player2Id: schema.duelSessions.player2Id })
      .from(schema.duelSessions).where(eq(schema.duelSessions.format, format));
    const userIdsInFormat = new Set<number>();
    sessionRows.forEach((s: any) => { userIdsInFormat.add(s.player1Id); userIdsInFormat.add(s.player2Id); });
    ratingRows = ratingRows.filter((r: any) => userIdsInFormat.has(r.userId));
  }
  const rows = ratingRows.slice(0, limit);
  if (rows.length === 0) return [];
  const userIds = rows.map((r: any) => r.userId as number);
  const userRows = await db.select({ id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  return rows.map((r: any, i: number) => {
    const total = r.wins + r.losses + r.draws;
    return {
      rank: i + 1,
      userId: r.userId,
      username: (userMap.get(r.userId) as any)?.username ?? "unknown",
      displayName: (userMap.get(r.userId) as any)?.name ?? `User #${r.userId}`,
      avatarUrl: (userMap.get(r.userId) as any)?.avatarUrl ?? null,
      elo: r.elo,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      winRate: total > 0 ? Math.round((r.wins / total) * 100) : 0,
    };
  });
}

export async function getDuelRankContext(db: any, userId: number): Promise<{ rank: number; totalPlayers: number } | null> {
  const rating = await getDuelRating(db, userId);
  if (!rating) return null;
  const all = await db.select({ userId: schema.duelRatings.userId }).from(schema.duelRatings).orderBy(desc(schema.duelRatings.elo));
  const rank = all.findIndex((r: any) => r.userId === userId) + 1;
  return rank > 0 ? { rank, totalPlayers: all.length } : null;
}
