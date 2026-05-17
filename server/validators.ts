import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const statsInputSchema = z.object({
  gameSlug: z.string().min(1),
  bestScore: z.number().int().min(0).max(100000).default(0),
  gamesPlayed: z.number().int().min(0).max(100000).default(0),
  gamesWon: z.number().int().min(0).max(100000).default(0),
  wordsFound: z.number().int().min(0).max(100000).default(0),
  lastScore: z.number().int().min(0).max(100000).optional(),
});

export const leaderboardInputSchema = z.object({
  gameSlug: z.string().min(1),
  score: z.number().int().min(0).max(100000),
});
