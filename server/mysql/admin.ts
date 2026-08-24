import { eq, desc, asc, like, sql, or, inArray } from "drizzle-orm";
import type { User, LeaderboardEntry } from "@shared/schema";
import * as schema from "../db-schema";
import { toUser } from "./users";
import { getAllUserGameStats, getUserAchievements } from "./stats";

export async function getAllUsers(db: any): Promise<User[]> {
  const rows = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  return rows.map((r: any) => toUser(r));
}

export async function deleteUser(db: any, id: number): Promise<void> {
  await Promise.all([
    db.delete(schema.leaderboardEntries).where(eq(schema.leaderboardEntries.userId, id)),
    db.delete(schema.userAchievements).where(eq(schema.userAchievements.userId, id)),
    db.delete(schema.userStreaks).where(eq(schema.userStreaks.userId, id)),
    db.delete(schema.userGameStats).where(eq(schema.userGameStats.userId, id)),
    db.delete(schema.friendships).where(or(eq(schema.friendships.requesterId, id), eq(schema.friendships.addresseeId, id))),
    db.delete(schema.friendChallenges).where(or(eq(schema.friendChallenges.senderId, id), eq(schema.friendChallenges.receiverId, id))),
    db.delete(schema.notifications).where(eq(schema.notifications.userId, id)),
    db.delete(schema.comments).where(eq(schema.comments.userId, id)),
    db.delete(schema.likes).where(eq(schema.likes.userId, id)),
    db.delete(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, id)),
    db.delete(schema.emailVerificationTokens).where(eq(schema.emailVerificationTokens.userId, id)),
    db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, id)),
  ]);
  await db.delete(schema.users).where(eq(schema.users.id, id));
}

export async function searchUsers(db: any, query: string): Promise<Array<{ id: number; username: string; name: string; avatarUrl: string | null }>> {
  const sanitized = query.slice(0, 50).replace(/[%_\\]/g, (c) => `\\${c}`);
  const normalized = sanitized.toLowerCase();
  const rows = await db.select({ id: schema.users.id, username: schema.users.username, usernameNormalized: schema.users.usernameNormalized, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
    .from(schema.users)
    .where(or(like(schema.users.usernameNormalized, `${normalized}%`), like(schema.users.name, `%${sanitized}%`)))
    .limit(20);
  return rows
    .sort((a: any, b: any) => {
      const aExact = a.usernameNormalized === normalized ? 0 : a.usernameNormalized.startsWith(normalized) ? 1 : 2;
      const bExact = b.usernameNormalized === normalized ? 0 : b.usernameNormalized.startsWith(normalized) ? 1 : 2;
      return aExact - bExact || a.username.localeCompare(b.username);
    })
    .map((r: any) => ({ id: r.id, username: r.username, name: r.name, avatarUrl: r.avatarUrl ?? null }));
}

export async function getPublicProfile(db: any, userId: number): Promise<{
  user: { id: number; username: string; name: string; avatarUrl: string | null; createdAt: string; isPremium: boolean; bio: string | null };
  stats: Awaited<ReturnType<typeof getAllUserGameStats>>;
  achievements: Awaited<ReturnType<typeof getUserAchievements>>;
  leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }>;
} | null> {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!rows[0]) return null;
  const u = toUser(rows[0]);
  const [stats, achievements, allUserEntries] = await Promise.all([
    getAllUserGameStats(db, userId),
    getUserAchievements(db, userId),
    db.select().from(schema.leaderboardEntries).where(eq(schema.leaderboardEntries.userId, userId)),
  ]);
  const slugBestScore = new Map<string, number>();
  for (const e of allUserEntries) {
    const existing = slugBestScore.get(e.gameSlug);
    if (!existing || e.score > existing) slugBestScore.set(e.gameSlug, e.score);
  }
  const leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }> = [];
  for (const [slug, score] of slugBestScore) {
    const [{ cnt }] = await db.select({ cnt: sql<number>`COUNT(DISTINCT ${schema.leaderboardEntries.userId})` })
      .from(schema.leaderboardEntries)
      .where(sql`${schema.leaderboardEntries.gameSlug} = ${slug} AND ${schema.leaderboardEntries.score} > ${score}`);
    leaderboardRankings.push({ gameSlug: slug, rank: Number(cnt) + 1, score });
  }
  return {
    user: { id: u.id, username: u.username, name: u.name, avatarUrl: u.avatarUrl ?? null, createdAt: u.createdAt, isPremium: u.isPremium, bio: u.bio ?? null },
    stats,
    achievements,
    leaderboardRankings,
  };
}

export async function getAdminStats(db: any): Promise<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }> {
  const [[{ total: totalUsers }], slugRows] = await Promise.all([
    db.select({ total: sql<number>`COUNT(*)` }).from(schema.users),
    db.select({ gameSlug: schema.userGameStats.gameSlug, total: sql<number>`SUM(${schema.userGameStats.gamesPlayed})` })
      .from(schema.userGameStats).groupBy(schema.userGameStats.gameSlug),
  ]);
  const gamesPerSlug: Record<string, number> = {};
  let totalGamesPlayed = 0;
  for (const row of slugRows) {
    const n = Number(row.total ?? 0);
    gamesPerSlug[row.gameSlug] = n;
    totalGamesPlayed += n;
  }
  return {
    totalUsers: Number(totalUsers ?? 0),
    totalGamesPlayed,
    gamesPerSlug,
  };
}

export async function getAllLeaderboardEntries(db: any): Promise<LeaderboardEntry[]> {
  const rows = await db.select().from(schema.leaderboardEntries).orderBy(desc(schema.leaderboardEntries.playedAt));
  const userIds = [...new Set<number>(rows.map((r: any) => Number(r.userId)))];
  const users = userIds.length ? await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  const usernames = new Map(users.map((user: any) => [user.id, user.username]));
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    gameSlug: r.gameSlug,
    score: r.score,
    playerName: r.playerName,
    username: usernames.get(r.userId) ?? "unknown",
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
