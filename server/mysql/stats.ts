import { eq, desc, asc, sql, and, or, inArray } from "drizzle-orm";
import type { UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement } from "@shared/schema";
import type { DailyLeaderboardEntry } from "@shared/schema";
import * as schema from "../db-schema";

function timeFilterCutoff(timeFilter?: string): Date | null {
  if (timeFilter === "today") {
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d;
  }
  if (timeFilter === "week") {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - 7); d.setUTCHours(0, 0, 0, 0); return d;
  }
  return null;
}

export async function saveUserGameStats(db: any, stats: InsertUserGameStats): Promise<UserGameStats> {
  const existing = await getUserGameStats(db, stats.userId, stats.gameSlug);
  if (existing) {
    await db.update(schema.userGameStats).set({
      bestScore: stats.bestScore, gamesPlayed: stats.gamesPlayed, gamesWon: stats.gamesWon,
      wordsFound: stats.wordsFound, lastPlayedAt: new Date(stats.lastPlayedAt), lastScore: stats.lastScore ?? null,
    }).where(eq(schema.userGameStats.id, existing.id));
    return { ...existing, ...stats };
  }
  const result = await db.insert(schema.userGameStats).values({
    userId: stats.userId, gameSlug: stats.gameSlug, bestScore: stats.bestScore,
    gamesPlayed: stats.gamesPlayed, gamesWon: stats.gamesWon, wordsFound: stats.wordsFound,
    lastPlayedAt: new Date(stats.lastPlayedAt), lastScore: stats.lastScore ?? null,
  });
  return { ...stats, id: result[0].insertId };
}

export async function getUserGameStats(db: any, userId: number, gameSlug: string): Promise<UserGameStats | undefined> {
  const rows = await db.select().from(schema.userGameStats)
    .where(and(eq(schema.userGameStats.userId, userId), eq(schema.userGameStats.gameSlug, gameSlug))).limit(1);
  if (!rows[0]) return undefined;
  const r = rows[0];
  return { id: r.id, userId: r.userId, gameSlug: r.gameSlug, bestScore: r.bestScore, gamesPlayed: r.gamesPlayed, gamesWon: r.gamesWon, wordsFound: r.wordsFound, lastPlayedAt: r.lastPlayedAt instanceof Date ? r.lastPlayedAt.toISOString() : String(r.lastPlayedAt), lastScore: r.lastScore ?? null };
}

export async function getAllUserGameStats(db: any, userId: number): Promise<UserGameStats[]> {
  const rows = await db.select().from(schema.userGameStats).where(eq(schema.userGameStats.userId, userId));
  return rows.map((r: any) => ({ id: r.id, userId: r.userId, gameSlug: r.gameSlug, bestScore: r.bestScore, gamesPlayed: r.gamesPlayed, gamesWon: r.gamesWon, wordsFound: r.wordsFound, lastPlayedAt: r.lastPlayedAt instanceof Date ? r.lastPlayedAt.toISOString() : String(r.lastPlayedAt), lastScore: r.lastScore ?? null }));
}

export async function saveLeaderboardEntry(db: any, entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
  const existing = await db.select().from(schema.leaderboardEntries)
    .where(and(eq(schema.leaderboardEntries.userId, entry.userId), eq(schema.leaderboardEntries.gameSlug, entry.gameSlug))).limit(1);
  if (existing.length > 0) {
    if (entry.score > existing[0].score) {
      await db.update(schema.leaderboardEntries).set({
        score: entry.score,
        playerName: entry.playerName,
        playedAt: new Date(entry.playedAt),
      }).where(and(eq(schema.leaderboardEntries.userId, entry.userId), eq(schema.leaderboardEntries.gameSlug, entry.gameSlug)));
    }
  } else {
    await db.insert(schema.leaderboardEntries).values({
      userId: entry.userId, gameSlug: entry.gameSlug, score: entry.score,
      playerName: entry.playerName, playedAt: new Date(entry.playedAt),
    });
  }
  const saved = await db.select().from(schema.leaderboardEntries)
    .where(and(eq(schema.leaderboardEntries.userId, entry.userId), eq(schema.leaderboardEntries.gameSlug, entry.gameSlug))).limit(1);
  const row = saved[0];
  const userRows = await db.select({ username: schema.users.username }).from(schema.users).where(eq(schema.users.id, row.userId)).limit(1);
  return { id: row.id, userId: row.userId, gameSlug: row.gameSlug, score: row.score, playerName: row.playerName, username: userRows[0]?.username ?? "unknown", playedAt: row.playedAt instanceof Date ? row.playedAt.toISOString() : String(row.playedAt) };
}

export async function getLeaderboard(db: any, gameSlug: string, limit = 50, timeFilter?: string): Promise<LeaderboardEntry[]> {
  const cutoff = timeFilterCutoff(timeFilter);
  const baseWhere = cutoff
    ? and(eq(schema.leaderboardEntries.gameSlug, gameSlug), sql`${schema.leaderboardEntries.playedAt} >= ${cutoff}`)
    : eq(schema.leaderboardEntries.gameSlug, gameSlug);
  const maxScorePerUser = db.select({ userId: schema.leaderboardEntries.userId, maxScore: sql<number>`MAX(${schema.leaderboardEntries.score})`.as("max_score") })
    .from(schema.leaderboardEntries).where(baseWhere).groupBy(schema.leaderboardEntries.userId).as("max_score_per_user");
  const bestRowIds = db.select({ userId: schema.leaderboardEntries.userId, bestId: sql<number>`MIN(${schema.leaderboardEntries.id})`.as("best_id") })
    .from(schema.leaderboardEntries)
    .innerJoin(maxScorePerUser, and(eq(schema.leaderboardEntries.userId, maxScorePerUser.userId), eq(schema.leaderboardEntries.score, maxScorePerUser.maxScore)))
    .where(baseWhere).groupBy(schema.leaderboardEntries.userId).as("best_row_ids");
  const rows = await db.select({ id: schema.leaderboardEntries.id, userId: schema.leaderboardEntries.userId, gameSlug: schema.leaderboardEntries.gameSlug, score: schema.leaderboardEntries.score, playerName: schema.leaderboardEntries.playerName, playedAt: schema.leaderboardEntries.playedAt })
    .from(schema.leaderboardEntries).innerJoin(bestRowIds, eq(schema.leaderboardEntries.id, bestRowIds.bestId))
    .orderBy(desc(schema.leaderboardEntries.score)).limit(limit);
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r: any) => r.userId).filter(Boolean))] as number[];
  const userRows = userIds.length > 0 ? await db.select({ id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  const statsRows = userIds.length > 0 ? await db.select({ userId: schema.userGameStats.userId, gamesPlayed: schema.userGameStats.gamesPlayed }).from(schema.userGameStats).where(and(inArray(schema.userGameStats.userId, userIds), eq(schema.userGameStats.gameSlug, gameSlug))) : [];
  const statsMap = new Map(statsRows.map((s: any) => [s.userId, s.gamesPlayed]));
  return rows.map((r: any) => {
    const user: any = userMap.get(r.userId);
    return { id: r.id, userId: r.userId, gameSlug: r.gameSlug, score: r.score, playerName: user?.name ?? r.playerName, username: user?.username ?? "unknown", playerAvatarUrl: user?.avatarUrl ?? null, playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt), gamesPlayed: statsMap.get(r.userId) ?? undefined };
  });
}

export async function getOverallLeaderboard(db: any, limit = 50, timeFilter?: string): Promise<LeaderboardEntry[]> {
  const cutoff = timeFilterCutoff(timeFilter);
  const baseQuery = db.select({ userId: schema.leaderboardEntries.userId, totalScore: sql<number>`SUM(${schema.leaderboardEntries.score})`, latestPlayedAt: sql<string>`MAX(${schema.leaderboardEntries.playedAt})` }).from(schema.leaderboardEntries);
  const totals = await (cutoff ? baseQuery.where(sql`${schema.leaderboardEntries.playedAt} >= ${cutoff}`) : baseQuery)
    .groupBy(schema.leaderboardEntries.userId).orderBy(sql`SUM(${schema.leaderboardEntries.score}) DESC`).limit(limit);
  if (totals.length === 0) return [];
  const userIds = totals.map((t: any) => t.userId);
  const userRows = await db.select({ id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  const statsRows = await db.select({ userId: schema.userGameStats.userId, gamesPlayed: sql<number>`SUM(${schema.userGameStats.gamesPlayed})` }).from(schema.userGameStats).where(inArray(schema.userGameStats.userId, userIds)).groupBy(schema.userGameStats.userId);
  const statsMap = new Map(statsRows.map((s: any) => [s.userId, Number(s.gamesPlayed)]));
  return totals.map((r: any, i: number) => ({ id: i + 1, userId: r.userId, playerName: (userMap.get(r.userId) as any)?.name || "Unknown", username: (userMap.get(r.userId) as any)?.username ?? "unknown", playerAvatarUrl: (userMap.get(r.userId) as any)?.avatarUrl ?? null, score: Number(r.totalScore), playedAt: r.latestPlayedAt instanceof Date ? r.latestPlayedAt.toISOString() : String(r.latestPlayedAt), gameSlug: "overall", gamesPlayed: statsMap.get(r.userId) ?? undefined }));
}

export async function getPlayerRank(db: any, gameSlug: string, userId: number, timeFilter?: string): Promise<{ rank: number; score: number; totalPlayers: number } | null> {
  const cutoff = timeFilterCutoff(timeFilter);
  if (gameSlug === "overall") {
    const whereClause = cutoff ? sql`${schema.leaderboardEntries.playedAt} >= ${cutoff}` : undefined;
    const totals = await (whereClause
      ? db.select({ userId: schema.leaderboardEntries.userId, total: sql<number>`SUM(${schema.leaderboardEntries.score})` }).from(schema.leaderboardEntries).where(whereClause)
      : db.select({ userId: schema.leaderboardEntries.userId, total: sql<number>`SUM(${schema.leaderboardEntries.score})` }).from(schema.leaderboardEntries))
      .groupBy(schema.leaderboardEntries.userId);
    const userRow = totals.find((t: any) => t.userId === userId);
    if (!userRow) return null;
    const userScore = Number(userRow.total);
    return { rank: totals.filter((t: any) => Number(t.total) > userScore).length + 1, score: userScore, totalPlayers: totals.length };
  }
  const baseWhere = cutoff
    ? and(eq(schema.leaderboardEntries.gameSlug, gameSlug), sql`${schema.leaderboardEntries.playedAt} >= ${cutoff}`)
    : eq(schema.leaderboardEntries.gameSlug, gameSlug);
  const scores = await db.select({ userId: schema.leaderboardEntries.userId, best: sql<number>`MAX(${schema.leaderboardEntries.score})` }).from(schema.leaderboardEntries).where(baseWhere).groupBy(schema.leaderboardEntries.userId);
  const userRow = scores.find((s: any) => s.userId === userId);
  if (!userRow) return null;
  const userScore = Number(userRow.best);
  return { rank: scores.filter((s: any) => Number(s.best) > userScore).length + 1, score: userScore, totalPlayers: scores.length };
}

export async function getFriendsLeaderboard(db: any, gameSlug: string, userId: number): Promise<LeaderboardEntry[]> {
  const friendships = await db.select({ requesterId: schema.friendships.requesterId, addresseeId: schema.friendships.addresseeId })
    .from(schema.friendships).where(and(eq(schema.friendships.status, "accepted"), or(eq(schema.friendships.requesterId, userId), eq(schema.friendships.addresseeId, userId))));
  const friendIds = friendships.map((f: any) => f.requesterId === userId ? f.addresseeId : f.requesterId);
  const allowedIds = [userId, ...friendIds];
  if (allowedIds.length === 0) return [];
  if (gameSlug === "overall") {
    const totals = await db.select({ userId: schema.leaderboardEntries.userId, totalScore: sql<number>`SUM(${schema.leaderboardEntries.score})`, latestPlayedAt: sql<string>`MAX(${schema.leaderboardEntries.playedAt})` }).from(schema.leaderboardEntries).where(inArray(schema.leaderboardEntries.userId, allowedIds)).groupBy(schema.leaderboardEntries.userId).orderBy(sql`SUM(${schema.leaderboardEntries.score}) DESC`);
    if (totals.length === 0) return [];
    const uIds = totals.map((t: any) => t.userId);
    const userRows = await db.select({ id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, uIds));
    const userMap = new Map(userRows.map((u: any) => [u.id, u]));
    return totals.map((r: any, i: number) => ({ id: i + 1, userId: r.userId, playerName: (userMap.get(r.userId) as any)?.name || "Unknown", username: (userMap.get(r.userId) as any)?.username ?? "unknown", playerAvatarUrl: (userMap.get(r.userId) as any)?.avatarUrl ?? null, score: Number(r.totalScore), playedAt: r.latestPlayedAt instanceof Date ? (r.latestPlayedAt as Date).toISOString() : String(r.latestPlayedAt), gameSlug: "overall" }));
  }
  const baseWhere = and(eq(schema.leaderboardEntries.gameSlug, gameSlug), inArray(schema.leaderboardEntries.userId, allowedIds));
  const maxScorePerUser = db.select({ userId: schema.leaderboardEntries.userId, maxScore: sql<number>`MAX(${schema.leaderboardEntries.score})`.as("max_score") }).from(schema.leaderboardEntries).where(baseWhere).groupBy(schema.leaderboardEntries.userId).as("max_score_per_user");
  const bestRowIds = db.select({ userId: schema.leaderboardEntries.userId, bestId: sql<number>`MIN(${schema.leaderboardEntries.id})`.as("best_id") }).from(schema.leaderboardEntries).innerJoin(maxScorePerUser, and(eq(schema.leaderboardEntries.userId, maxScorePerUser.userId), eq(schema.leaderboardEntries.score, maxScorePerUser.maxScore))).where(baseWhere).groupBy(schema.leaderboardEntries.userId).as("best_row_ids");
  const rows = await db.select({ id: schema.leaderboardEntries.id, userId: schema.leaderboardEntries.userId, gameSlug: schema.leaderboardEntries.gameSlug, score: schema.leaderboardEntries.score, playerName: schema.leaderboardEntries.playerName, playedAt: schema.leaderboardEntries.playedAt }).from(schema.leaderboardEntries).innerJoin(bestRowIds, eq(schema.leaderboardEntries.id, bestRowIds.bestId)).orderBy(desc(schema.leaderboardEntries.score));
  if (rows.length === 0) return [];
  const uIds = [...new Set(rows.map((r: any) => r.userId))] as number[];
  const userRows = await db.select({ id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, uIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  const statsRows = await db.select({ userId: schema.userGameStats.userId, gamesPlayed: schema.userGameStats.gamesPlayed }).from(schema.userGameStats).where(and(inArray(schema.userGameStats.userId, uIds), eq(schema.userGameStats.gameSlug, gameSlug)));
  const statsMap = new Map(statsRows.map((s: any) => [s.userId, s.gamesPlayed]));
  return rows.map((r: any) => ({ id: r.id, userId: r.userId, gameSlug: r.gameSlug, score: r.score, playerName: (userMap.get(r.userId) as any)?.name ?? r.playerName, username: (userMap.get(r.userId) as any)?.username ?? "unknown", playerAvatarUrl: (userMap.get(r.userId) as any)?.avatarUrl ?? null, playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt), gamesPlayed: statsMap.get(r.userId) ?? undefined }));
}

export async function incrementGamePlayCount(db: any, gameSlug: string): Promise<void> {
  await db.insert(schema.gamePlayCounts).values({ gameSlug, count: 1 }).onDuplicateKeyUpdate({ set: { count: sql`count + 1` } });
}

export async function getGamePlayCount(db: any, gameSlug: string): Promise<number> {
  const rows = await db.select({ count: schema.gamePlayCounts.count }).from(schema.gamePlayCounts).where(eq(schema.gamePlayCounts.gameSlug, gameSlug));
  return Number(rows[0]?.count ?? 0);
}

export async function getAllGamePlayCounts(db: any): Promise<Record<string, number>> {
  const rows = await db.select().from(schema.gamePlayCounts);
  const result: Record<string, number> = {};
  for (const row of rows) result[row.gameSlug] = Number(row.count);
  return result;
}

export async function getUserStreak(db: any, userId: number): Promise<UserStreak | undefined> {
  const rows = await db.select().from(schema.userStreaks).where(eq(schema.userStreaks.userId, userId)).limit(1);
  if (!rows[0]) return undefined;
  const r = rows[0];
  return { id: r.id, userId: r.userId, currentStreak: r.currentStreak, longestStreak: r.longestStreak, lastPlayedDate: r.lastPlayedDate, dailyChallengeStreak: r.dailyChallengeStreak ?? 0, longestDailyChallengeStreak: r.longestDailyChallengeStreak ?? 0, lastDailyChallengeDate: r.lastDailyChallengeDate ?? null };
}

export async function saveUserStreak(db: any, userId: number, currentStreak: number, longestStreak: number, lastPlayedDate: string): Promise<UserStreak> {
  const existing = await getUserStreak(db, userId);
  if (existing) {
    await db.update(schema.userStreaks).set({ currentStreak, longestStreak, lastPlayedDate }).where(eq(schema.userStreaks.userId, userId));
    return { ...existing, currentStreak, longestStreak, lastPlayedDate };
  }
  const result = await db.insert(schema.userStreaks).values({ userId, currentStreak, longestStreak, lastPlayedDate });
  return { id: result[0].insertId, userId, currentStreak, longestStreak, lastPlayedDate, dailyChallengeStreak: 0, longestDailyChallengeStreak: 0 };
}

export async function getTopStreaks(db: any, limit: number): Promise<Array<{ userId: number; username: string; name: string; avatarUrl: string | null; currentStreak: number; longestStreak: number }>> {
  const rows = await db.select({ userId: schema.userStreaks.userId, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl, currentStreak: schema.userStreaks.currentStreak, longestStreak: schema.userStreaks.longestStreak })
    .from(schema.userStreaks).innerJoin(schema.users, eq(schema.userStreaks.userId, schema.users.id))
    .where(sql`${schema.userStreaks.currentStreak} > 0`).orderBy(desc(schema.userStreaks.currentStreak)).limit(limit);
  return rows.map((r: any) => ({ userId: r.userId, username: r.username, name: r.name, avatarUrl: r.avatarUrl ?? null, currentStreak: r.currentStreak, longestStreak: r.longestStreak }));
}

export async function getStreakBatch(db: any, userIds: number[]): Promise<Record<number, number>> {
  if (userIds.length === 0) return {};
  const rows = await db.select({ userId: schema.userStreaks.userId, currentStreak: schema.userStreaks.currentStreak }).from(schema.userStreaks).where(inArray(schema.userStreaks.userId, userIds));
  const result: Record<number, number> = {};
  for (const row of rows) result[row.userId] = row.currentStreak;
  return result;
}

export async function updateDailyChallengeStreak(db: any, userId: number, date: string): Promise<{ streak: number; longest: number; alreadyDone: boolean }> {
  const existing = await getUserStreak(db, userId);
  if (existing && existing.lastDailyChallengeDate === date) {
    return { streak: existing.dailyChallengeStreak ?? 0, longest: existing.longestDailyChallengeStreak ?? 0, alreadyDone: true };
  }
  let newStreak = 1;
  if (existing?.lastDailyChallengeDate) {
    const prev = new Date(existing.lastDailyChallengeDate + "T00:00:00");
    const cur = new Date(date + "T00:00:00");
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) newStreak = (existing.dailyChallengeStreak ?? 0) + 1;
  }
  const newLongest = Math.max(existing?.longestDailyChallengeStreak ?? 0, newStreak);
  if (existing) {
    await db.update(schema.userStreaks).set({ dailyChallengeStreak: newStreak, longestDailyChallengeStreak: newLongest, lastDailyChallengeDate: date }).where(eq(schema.userStreaks.userId, userId));
  } else {
    await db.insert(schema.userStreaks).values({ userId, currentStreak: 0, longestStreak: 0, lastPlayedDate: date, dailyChallengeStreak: newStreak, longestDailyChallengeStreak: newLongest, lastDailyChallengeDate: date });
  }
  return { streak: newStreak, longest: newLongest, alreadyDone: false };
}

export async function getLeaderboardPercentile(db: any, gameSlug: string, score: number): Promise<{ percentile: number; totalPlayers: number }> {
  const [totalRow] = await (db.execute(sql`SELECT COUNT(DISTINCT user_id) as total FROM (SELECT user_id, MAX(score) as best FROM leaderboard_entries WHERE game_slug = ${gameSlug} GROUP BY user_id) t`) as Promise<any[]>);
  const total = Number((totalRow as any)[0]?.total ?? 0);
  if (total === 0) return { percentile: 100, totalPlayers: 0 };
  const [belowRow] = await (db.execute(sql`SELECT COUNT(DISTINCT user_id) as below FROM (SELECT user_id, MAX(score) as best FROM leaderboard_entries WHERE game_slug = ${gameSlug} GROUP BY user_id) t WHERE t.best < ${score}`) as Promise<any[]>);
  const below = Number((belowRow as any)[0]?.below ?? 0);
  return { percentile: Math.round((below / total) * 100), totalPlayers: total };
}

export async function getUserAchievements(db: any, userId: number): Promise<UserAchievement[]> {
  const rows = await db.select().from(schema.userAchievements).where(eq(schema.userAchievements.userId, userId));
  return rows.map((r: any) => ({ id: r.id, userId: r.userId, achievementId: r.achievementId, unlockedAt: r.unlockedAt instanceof Date ? r.unlockedAt.toISOString() : String(r.unlockedAt) }));
}

export async function saveUserAchievement(db: any, userId: number, achievementId: string, unlockedAt: string): Promise<UserAchievement> {
  const existing = await db.select().from(schema.userAchievements).where(and(eq(schema.userAchievements.userId, userId), eq(schema.userAchievements.achievementId, achievementId))).limit(1);
  if (existing[0]) {
    const r = existing[0];
    return { id: r.id, userId: r.userId, achievementId: r.achievementId, unlockedAt: r.unlockedAt instanceof Date ? r.unlockedAt.toISOString() : String(r.unlockedAt) };
  }
  const result = await db.insert(schema.userAchievements).values({ userId, achievementId, unlockedAt: new Date(unlockedAt) });
  return { id: result[0].insertId, userId, achievementId, unlockedAt };
}

export async function getAchievementRarities(db: any): Promise<Record<string, number>> {
  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(schema.users);
  const totalUsers = Number(total);
  if (totalUsers === 0) return {};
  const rows = await db.select({ achievementId: schema.userAchievements.achievementId, count: sql<number>`COUNT(*)` }).from(schema.userAchievements).groupBy(schema.userAchievements.achievementId);
  const result: Record<string, number> = {};
  for (const r of rows) result[r.achievementId] = Math.round((Number(r.count) / totalUsers) * 100 * 10) / 10;
  return result;
}

export async function getUsersWithStreakAtRisk(db: any): Promise<Array<{ userId: number; currentStreak: number }>> {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  const rows = await db.select({ userId: schema.userStreaks.userId, currentStreak: schema.userStreaks.currentStreak })
    .from(schema.userStreaks).where(and(sql`${schema.userStreaks.currentStreak} > 0`, eq(schema.userStreaks.lastPlayedDate, yesterdayStr)));
  return rows.map((r: any) => ({ userId: r.userId, currentStreak: r.currentStreak }));
}

export async function getFriendsWhoPlayGame(db: any, gameSlug: string, userId: number): Promise<Array<{ id: number; username: string; name: string; avatarUrl: string | null; gamesPlayed: number }>> {
  const friendships = await db.select({ requesterId: schema.friendships.requesterId, addresseeId: schema.friendships.addresseeId })
    .from(schema.friendships).where(and(eq(schema.friendships.status, "accepted"), or(eq(schema.friendships.requesterId, userId), eq(schema.friendships.addresseeId, userId))));
  const friendIds = friendships.map((f: any) => f.requesterId === userId ? f.addresseeId : f.requesterId);
  if (friendIds.length === 0) return [];
  const statsRows = await db.select({ userId: schema.userGameStats.userId, gamesPlayed: schema.userGameStats.gamesPlayed })
    .from(schema.userGameStats).where(and(inArray(schema.userGameStats.userId, friendIds), eq(schema.userGameStats.gameSlug, gameSlug), sql`${schema.userGameStats.gamesPlayed} > 0`));
  if (statsRows.length === 0) return [];
  const playedIds = statsRows.map((s: any) => s.userId);
  const userRows = await db.select({ id: schema.users.id, username: schema.users.username, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, playedIds));
  return userRows.map((u: any) => ({ id: u.id, username: u.username, name: u.name, avatarUrl: u.avatarUrl ?? null, gamesPlayed: statsRows.find((s: any) => s.userId === u.id)?.gamesPlayed ?? 0 }))
    .sort((a: any, b: any) => b.gamesPlayed - a.gamesPlayed);
}

export async function saveDailyChallengeScore(db: any, userId: number, challengeDate: string, gameSlug: string, score: number): Promise<void> {
  await db.execute(sql`INSERT INTO daily_challenge_scores (user_id, challenge_date, game_slug, score) VALUES (${userId}, ${challengeDate}, ${gameSlug}, ${score}) ON DUPLICATE KEY UPDATE score = GREATEST(score, ${score})`);
}

export async function getDailyLeaderboard(db: any, challengeDate: string, gameSlug: string, requestingUserId?: number): Promise<{ entries: DailyLeaderboardEntry[]; myRank?: number; myScore?: number }> {
  const rows = await db.select({ userId: schema.dailyChallengeScores.userId, score: schema.dailyChallengeScores.score, playerName: schema.users.name, avatarUrl: schema.users.avatarUrl })
    .from(schema.dailyChallengeScores).innerJoin(schema.users, eq(schema.dailyChallengeScores.userId, schema.users.id))
    .where(and(eq(schema.dailyChallengeScores.challengeDate, challengeDate), eq(schema.dailyChallengeScores.gameSlug, gameSlug)))
    .orderBy(desc(schema.dailyChallengeScores.score)).limit(20);
  const entries: DailyLeaderboardEntry[] = rows.map((r: any, i: number) => ({ rank: i + 1, userId: r.userId, playerName: r.playerName, avatarUrl: r.avatarUrl || null, score: r.score }));
  let myRank: number | undefined;
  let myScore: number | undefined;
  if (requestingUserId) {
    const myEntry = entries.find(e => e.userId === requestingUserId);
    if (myEntry) { myRank = myEntry.rank; myScore = myEntry.score; }
    else {
      const myRow = await db.select().from(schema.dailyChallengeScores).where(and(eq(schema.dailyChallengeScores.userId, requestingUserId), eq(schema.dailyChallengeScores.challengeDate, challengeDate), eq(schema.dailyChallengeScores.gameSlug, gameSlug))).limit(1);
      if (myRow[0]) {
        const countAbove = await db.select({ cnt: sql<number>`count(*)` }).from(schema.dailyChallengeScores).where(and(eq(schema.dailyChallengeScores.challengeDate, challengeDate), eq(schema.dailyChallengeScores.gameSlug, gameSlug), sql`${schema.dailyChallengeScores.score} > ${myRow[0].score}`));
        myRank = (Number(countAbove[0]?.cnt) || 0) + 1;
        myScore = myRow[0].score;
      }
    }
  }
  return { entries, myRank, myScore };
}
