import { eq, desc, asc, and, like, sql, inArray } from "drizzle-orm";
import type { User, LeaderboardEntry } from "@shared/schema";
import * as schema from "../db-schema";
import { toUser } from "./users";
import { getAllUserGameStats, getUserAchievements } from "./stats";

export async function getAllUsers(db: any, limit = 100, offset = 0): Promise<User[]> {
  const rows = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).limit(limit).offset(offset);
  return rows.map((r: any) => toUser(r));
}

export async function deleteUser(db: any, id: number): Promise<void> {
  await db.delete(schema.users).where(eq(schema.users.id, id));
}

export async function searchUsers(db: any, query: string, limit = 20): Promise<User[]> {
  const rows = await db.select().from(schema.users)
    .where(like(schema.users.name, `%${query}%`)).orderBy(asc(schema.users.name)).limit(limit);
  return rows.map((r: any) => toUser(r));
}

export async function getPublicProfile(db: any, userId: number): Promise<{
  user: User;
  stats: Awaited<ReturnType<typeof getAllUserGameStats>>;
  achievements: Awaited<ReturnType<typeof getUserAchievements>>;
} | null> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!rows[0]) return null;
  const user = toUser(rows[0]);
  const [stats, achievements] = await Promise.all([
    getAllUserGameStats(db, userId),
    getUserAchievements(db, userId),
  ]);
  return { user, stats, achievements };
}

export async function getAdminStats(db: any): Promise<{
  totalUsers: number;
  totalGamesPlayed: number;
  totalLeaderboardEntries: number;
  recentUsers: User[];
}> {
  const [[{ total: totalUsers }], [{ total: totalGamesPlayed }], [{ total: totalLeaderboardEntries }], recentRows] = await Promise.all([
    db.select({ total: sql<number>`COUNT(*)` }).from(schema.users),
    db.select({ total: sql<number>`SUM(gamesPlayed)` }).from(schema.userGameStats),
    db.select({ total: sql<number>`COUNT(*)` }).from(schema.leaderboardEntries),
    db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).limit(10),
  ]);
  return {
    totalUsers: Number(totalUsers ?? 0),
    totalGamesPlayed: Number(totalGamesPlayed ?? 0),
    totalLeaderboardEntries: Number(totalLeaderboardEntries ?? 0),
    recentUsers: recentRows.map((r: any) => toUser(r)),
  };
}

export async function getAllLeaderboardEntries(db: any, gameSlug?: string): Promise<LeaderboardEntry[]> {
  const rows = await (gameSlug
    ? db.select().from(schema.leaderboardEntries).where(eq(schema.leaderboardEntries.gameSlug, gameSlug)).orderBy(desc(schema.leaderboardEntries.score)).limit(200)
    : db.select().from(schema.leaderboardEntries).orderBy(desc(schema.leaderboardEntries.score)).limit(200));
  return rows.map((r: any) => ({ id: r.id, userId: r.userId, gameSlug: r.gameSlug, score: r.score, playerName: r.playerName, playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt) }));
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

export async function setSiteSetting(db: any, key: string, value: string): Promise<void> {
  await db.insert(schema.siteSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}
