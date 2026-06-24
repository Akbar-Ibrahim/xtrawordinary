import { eq, desc, asc, like, sql, inArray } from "drizzle-orm";
import type { User, LeaderboardEntry } from "@shared/schema";
import * as schema from "../db-schema";
import { toUser } from "./users";
import { getAllUserGameStats, getUserAchievements } from "./stats";

export async function getAllUsers(db: any): Promise<User[]> {
  const rows = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).limit(500);
  return rows.map((r: any) => toUser(r));
}

export async function deleteUser(db: any, id: number): Promise<void> {
  await db.delete(schema.users).where(eq(schema.users.id, id));
}

export async function searchUsers(db: any, query: string): Promise<Array<{ id: number; name: string; avatarUrl: string | null }>> {
  const rows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
    .from(schema.users)
    .where(like(schema.users.name, `%${query}%`))
    .orderBy(asc(schema.users.name))
    .limit(20);
  return rows.map((r: any) => ({ id: r.id, name: r.name, avatarUrl: r.avatarUrl ?? null }));
}

export async function getPublicProfile(db: any, userId: number): Promise<{
  user: { id: number; name: string; avatarUrl: string | null; createdAt: string; isPremium: boolean; bio: string | null };
  stats: Awaited<ReturnType<typeof getAllUserGameStats>>;
  achievements: Awaited<ReturnType<typeof getUserAchievements>>;
  leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }>;
} | null> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!rows[0]) return null;
  const u = toUser(rows[0]);
  const [stats, achievements, lbRows] = await Promise.all([
    getAllUserGameStats(db, userId),
    getUserAchievements(db, userId),
    db.select().from(schema.leaderboardEntries).where(eq(schema.leaderboardEntries.userId, userId)),
  ]);
  const leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }> = [];
  for (const entry of lbRows) {
    const [{ cnt }] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(schema.leaderboardEntries)
      .where(sql`${schema.leaderboardEntries.gameSlug} = ${entry.gameSlug} AND ${schema.leaderboardEntries.score} > ${entry.score}`);
    leaderboardRankings.push({ gameSlug: entry.gameSlug, rank: Number(cnt) + 1, score: entry.score });
  }
  return {
    user: { id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null, createdAt: u.createdAt, isPremium: u.isPremium, bio: u.bio ?? null },
    stats,
    achievements,
    leaderboardRankings,
  };
}

export async function getAdminStats(db: any): Promise<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }> {
  const [[{ total: totalUsers }], [{ total: totalGamesPlayed }], slugRows] = await Promise.all([
    db.select({ total: sql<number>`COUNT(*)` }).from(schema.users),
    db.select({ total: sql<number>`SUM(gamesPlayed)` }).from(schema.userGameStats),
    db.select({ gameSlug: schema.gamePlayCounts.gameSlug, count: schema.gamePlayCounts.count }).from(schema.gamePlayCounts),
  ]);
  const gamesPerSlug: Record<string, number> = {};
  for (const row of slugRows) gamesPerSlug[row.gameSlug] = Number(row.count);
  return {
    totalUsers: Number(totalUsers ?? 0),
    totalGamesPlayed: Number(totalGamesPlayed ?? 0),
    gamesPerSlug,
  };
}

export async function getAllLeaderboardEntries(db: any): Promise<LeaderboardEntry[]> {
  const rows = await db.select().from(schema.leaderboardEntries).orderBy(desc(schema.leaderboardEntries.score)).limit(500);
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    gameSlug: r.gameSlug,
    score: r.score,
    playerName: r.playerName,
    playerAvatarUrl: r.playerAvatarUrl ?? null,
    playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt),
  }));
}

export async function deleteLeaderboardEntry(db: any, id: number): Promise<void> {
  await db.delete(schema.leaderboardEntries).where(eq(schema.leaderboardEntries.id, id));
}

export async function getSiteSetting(db: any, key: string): Promise<string | null> {
  try {
    const rows = await db.select({ value: schema.siteSettings.value }).from(schema.siteSettings).where(eq(schema.siteSettings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSiteSetting(db: any, key: string, value: string | null): Promise<void> {
  if (value === null) {
    await db.delete(schema.siteSettings).where(eq(schema.siteSettings.key, key));
  } else {
    await db.insert(schema.siteSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  }
}
