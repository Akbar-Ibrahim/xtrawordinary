import { z } from "zod";

export const quizSessionSchema = z.object({
  id: z.number(),
  creatorId: z.number(),
  gameSlug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  shareCode: z.string(),
  params: z.record(z.any()),
  closesAt: z.string().nullable(),
  createdAt: z.string(),
  creatorName: z.string().optional(),
  creatorAvatarUrl: z.string().nullable().optional(),
});
export type QuizSession = z.infer<typeof quizSessionSchema>;

export const insertQuizSessionSchema = quizSessionSchema.omit({ id: true, createdAt: true, creatorName: true, creatorAvatarUrl: true });
export type InsertQuizSession = z.infer<typeof insertQuizSessionSchema>;

export const quizSessionScoreSchema = z.object({
  id: z.number(),
  sessionId: z.number(),
  userId: z.number(),
  guestName: z.string().nullable(),
  score: z.number(),
  completedAt: z.string(),
  playerName: z.string().optional(),
  playerAvatarUrl: z.string().nullable().optional(),
});
export type QuizSessionScore = z.infer<typeof quizSessionScoreSchema>;

export const QUIZ_MASTER_GAME_SLUGS = new Set([
  "letter-hunt",
  "letter-frequency",
  "letter-position",
  "letter-balance",
  "letter-pool",
  "letter-dodge",
  "word-length",
  "definition-match",
  "word-roots",
  "progressive-reveal",
  "anagram-solver",
  "word-scramble",
]);
