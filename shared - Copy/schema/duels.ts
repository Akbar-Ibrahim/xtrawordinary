import { z } from "zod";

export const DUEL_TURN_SLUGS = new Set([
  "word-chain",
  "letter-hunt",
  "word-length",
  "letter-frequency",
  "letter-position",
  "letter-balance",
  "letter-dodge",
  "ladder-rush-4",
  "ladder-rush-5",
  "ladder-rush-6",
  "ladder-rush-double-4",
  "ladder-rush-double-5",
  "ladder-rush-double-6",
]);

export const DUEL_RACE_SLUGS = new Set([
  "letter-hunt",
  "word-length",
  "letter-frequency",
  "letter-position",
  "letter-balance",
  "letter-dodge",
  "word-roots",
  "word-scramble",
  "no-repeats",
  "anagram-solver",
  "word-stack",
  "letter-pool",
  "word-maker",
  "word-split",
  "definition-match",
  "ladder-rush-4",
  "ladder-rush-5",
  "ladder-rush-6",
  "ladder-rush-double-4",
  "ladder-rush-double-5",
  "ladder-rush-double-6",
]);

export const DUEL_GAME_SLUGS = new Set([
  ...Array.from(DUEL_TURN_SLUGS),
  ...Array.from(DUEL_RACE_SLUGS),
]);

export const DUEL_HUNT_LETTERS = ["R", "T", "L", "S", "N", "M", "B", "D", "F", "G", "P", "C"] as const;
export const DUEL_WORD_LENGTHS = ["4", "5", "6", "7"] as const;
export const DUEL_POSITIONS = [2, 3, 4, 5] as const;
export const DUEL_BALANCE_CONSTRAINTS = ["2V", "3V", "4V", "2C", "3C", "4C"] as const;
export const DUEL_NO_REPEATS_LENGTHS = ["4", "5", "6", "7"] as const;
export const DUEL_DEFINITION_CATEGORIES = ["ANIMALS", "COLORS", "FOODS", "SPORTS", "SCIENCE"] as const;

export const duelChallengeStatusSchema = z.enum(["pending", "accepted", "declined", "cancelled", "expired", "completed"]);
export type DuelChallengeStatus = z.infer<typeof duelChallengeStatusSchema>;

export const duelChallengeSchema = z.object({
  id: z.number(),
  challengerId: z.number(),
  challengeeId: z.number().nullable(),
  gameSlug: z.string(),
  message: z.string().nullable(),
  status: duelChallengeStatusSchema,
  roomCode: z.string().nullable(),
  seed: z.number().nullable().optional(),
  startWord: z.string().nullable().optional(),
  format: z.enum(["turn", "race"]).optional().default("turn"),
  raceTarget: z.number().nullable().optional(),
  raceTimeLimit: z.number().nullable().optional(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  challengerName: z.string().optional(),
  challengeeName: z.string().optional(),
  challengerAvatarUrl: z.string().nullable().optional(),
  challengeeAvatarUrl: z.string().nullable().optional(),
});
export type DuelChallenge = z.infer<typeof duelChallengeSchema>;

export const insertDuelChallengeSchema = duelChallengeSchema
  .omit({
    id: true,
    createdAt: true,
    challengerName: true,
    challengeeName: true,
    challengerAvatarUrl: true,
    challengeeAvatarUrl: true,
  })
  .extend({ roomCode: z.string().nullable().optional() });
export type InsertDuelChallenge = z.infer<typeof insertDuelChallengeSchema>;

export const duelSessionOutcomeSchema = z.enum([
  "player1_wins",
  "player2_wins",
  "draw",
  "forfeit_player1",
  "forfeit_player2",
]);
export type DuelSessionOutcome = z.infer<typeof duelSessionOutcomeSchema>;

export const duelSessionSchema = z.object({
  id: z.number(),
  roomCode: z.string(),
  challengeId: z.number().nullable(),
  player1Id: z.number(),
  player2Id: z.number(),
  gameSlug: z.string(),
  seed: z.number(),
  format: z.enum(["turn", "race"]).optional().default("turn"),
  raceTarget: z.number().nullable().optional(),
  raceTimeLimit: z.number().nullable().optional(),
  outcome: duelSessionOutcomeSchema.nullable(),
  eloDeltaPlayer1: z.number().nullable(),
  eloDeltaPlayer2: z.number().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type DuelSession = z.infer<typeof duelSessionSchema>;

export const insertDuelSessionSchema = duelSessionSchema.omit({ id: true });
export type InsertDuelSession = z.infer<typeof insertDuelSessionSchema>;

export const duelRatingSchema = z.object({
  id: z.number(),
  userId: z.number(),
  elo: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  updatedAt: z.string(),
});
export type DuelRating = z.infer<typeof duelRatingSchema>;
