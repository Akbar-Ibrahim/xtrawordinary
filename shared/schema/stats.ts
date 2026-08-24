import { z } from "zod";

export const userGameStatsSchema = z.object({
  id: z.number(),
  userId: z.number(),
  gameSlug: z.string(),
  bestScore: z.number(),
  gamesPlayed: z.number(),
  gamesWon: z.number(),
  wordsFound: z.number(),
  lastPlayedAt: z.string(),
  lastScore: z.number().nullable().optional(),
});
export type UserGameStats = z.infer<typeof userGameStatsSchema>;

export const insertUserGameStatsSchema = userGameStatsSchema.omit({ id: true });
export type InsertUserGameStats = z.infer<typeof insertUserGameStatsSchema>;

export const leaderboardEntrySchema = z.object({
  id: z.number(),
  userId: z.number(),
  gameSlug: z.string(),
  score: z.number(),
  playerName: z.string(),
  username: z.string(),
  playerAvatarUrl: z.string().nullable().optional(),
  playedAt: z.string(),
  gamesPlayed: z.number().optional(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const insertLeaderboardEntrySchema = leaderboardEntrySchema.omit({ id: true, username: true, playerAvatarUrl: true });
export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;

export const userStreakSchema = z.object({
  id: z.number(),
  userId: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastPlayedDate: z.string(),
  dailyChallengeStreak: z.number().default(0),
  longestDailyChallengeStreak: z.number().default(0),
  lastDailyChallengeDate: z.string().nullable().optional(),
});
export type UserStreak = z.infer<typeof userStreakSchema>;

export const userAchievementSchema = z.object({
  id: z.number(),
  userId: z.number(),
  achievementId: z.string(),
  unlockedAt: z.string(),
});
export type UserAchievement = z.infer<typeof userAchievementSchema>;
