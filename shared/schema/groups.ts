import { z } from "zod";

export const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  creatorId: z.number(),
  inviteCode: z.string(),
  isPublic: z.boolean(),
  isFeatured: z.boolean(),
  tags: z.array(z.string()).nullable(),
  pinnedAnnouncement: z.string().nullable(),
  createdAt: z.string(),
  memberCount: z.number().optional(),
});
export type Group = z.infer<typeof groupSchema>;
export const insertGroupSchema = groupSchema.omit({ id: true, createdAt: true, memberCount: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export const groupMemberSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  userId: z.number(),
  role: z.string(),
  joinedAt: z.string(),
});
export type GroupMember = z.infer<typeof groupMemberSchema>;

export const groupRoundSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  gameSlug: z.string(),
  seed: z.number(),
  status: z.string(),
  createdById: z.number(),
  closesAt: z.string().nullable(),
  gameConfig: z.string().nullable(),
  createdAt: z.string(),
});
export type GroupRound = z.infer<typeof groupRoundSchema>;
export const insertGroupRoundSchema = groupRoundSchema.omit({ id: true, createdAt: true });
export type InsertGroupRound = z.infer<typeof insertGroupRoundSchema>;

export const groupRoundScoreSchema = z.object({
  id: z.number(),
  roundId: z.number(),
  userId: z.number(),
  score: z.number(),
  durationMs: z.number().nullable(),
  completedAt: z.string(),
});
export type GroupRoundScore = z.infer<typeof groupRoundScoreSchema>;

export const groupScoreReactionSchema = z.object({
  id: z.number(),
  roundId: z.number(),
  scoreId: z.number(),
  userId: z.number(),
  emoji: z.string(),
  createdAt: z.string(),
});
export type GroupScoreReaction = z.infer<typeof groupScoreReactionSchema>;

export const groupRoundAttemptSchema = z.object({
  id: z.number(),
  roundId: z.number(),
  userId: z.number(),
  startedAt: z.string(),
});
export type GroupRoundAttempt = z.infer<typeof groupRoundAttemptSchema>;

export const dailyChallengeAttemptSchema = z.object({
  id: z.number(),
  userId: z.number(),
  challengeDate: z.string(),
  startedAt: z.string(),
});
export type DailyChallengeAttempt = z.infer<typeof dailyChallengeAttemptSchema>;

export const dailyChallengeScoreSchema = z.object({
  id: z.number(),
  userId: z.number(),
  challengeDate: z.string(),
  gameSlug: z.string(),
  score: z.number(),
  submittedAt: z.string(),
});
export type DailyChallengeScore = z.infer<typeof dailyChallengeScoreSchema>;

export const dailyLeaderboardEntrySchema = z.object({
  rank: z.number(),
  userId: z.number(),
  playerName: z.string(),
  avatarUrl: z.string().nullable(),
  score: z.number(),
});
export type DailyLeaderboardEntry = z.infer<typeof dailyLeaderboardEntrySchema>;

export const groupActivityEntrySchema = z.object({
  id: z.number(),
  groupId: z.number(),
  userId: z.number().nullable(),
  type: z.string(),
  metadata: z.record(z.any()),
  createdAt: z.string(),
  user: z.object({ id: z.number(), name: z.string(), avatarUrl: z.string().nullable() }).nullable().optional(),
});
export type GroupActivityEntry = z.infer<typeof groupActivityEntrySchema>;

export const groupSeasonSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  name: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.enum(["active", "ended"]),
  winnerId: z.number().nullable(),
  winnerName: z.string().nullable(),
  createdAt: z.string(),
});
export type GroupSeason = z.infer<typeof groupSeasonSchema>;
export const insertGroupSeasonSchema = groupSeasonSchema.omit({ id: true, createdAt: true, winnerId: true, winnerName: true });
export type InsertGroupSeason = z.infer<typeof insertGroupSeasonSchema>;

export const groupSeasonLeaderboardEntrySchema = z.object({
  userId: z.number(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  totalScore: z.number(),
  roundsPlayed: z.number(),
});
export type GroupSeasonLeaderboardEntry = z.infer<typeof groupSeasonLeaderboardEntrySchema>;
