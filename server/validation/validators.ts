import { z } from "zod";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, validateUsername } from "@shared/usernames";

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  username: z.string()
    .min(USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH)
    .refine((value) => validateUsername(value) === null, { message: "Choose a valid username." }),
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
