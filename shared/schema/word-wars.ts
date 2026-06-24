import { z } from "zod";
import { DUEL_GAME_SLUGS } from "./duels";

export const WORD_WARS_ELIGIBLE_SLUGS = Array.from(DUEL_GAME_SLUGS);

export const wordWarsTournamentStatusSchema = z.enum(["registration", "active", "completed", "cancelled"]);
export type WordWarsTournamentStatus = z.infer<typeof wordWarsTournamentStatusSchema>;

export const wordWarsTournamentSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: wordWarsTournamentStatusSchema,
  registrationDeadline: z.string(),
  roundDeadlineHours: z.number(),
  minPlayers: z.number(),
  maxPlayers: z.number().nullable(),
  recurringCron: z.string().nullable(),
  createdBy: z.number(),
  createdAt: z.string(),
});
export type WordWarsTournament = z.infer<typeof wordWarsTournamentSchema>;

export const insertWordWarsTournamentSchema = wordWarsTournamentSchema.omit({ id: true, createdAt: true, status: true });
export type InsertWordWarsTournament = z.infer<typeof insertWordWarsTournamentSchema>;

export const wordWarsRegistrationSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  userId: z.number(),
  createdAt: z.string(),
});
export type WordWarsRegistration = z.infer<typeof wordWarsRegistrationSchema>;

export const wordWarsMatchStatusSchema = z.enum(["pending", "active", "completed", "forfeited", "bye"]);
export type WordWarsMatchStatus = z.infer<typeof wordWarsMatchStatusSchema>;

export const wordWarsMatchSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  round: z.number(),
  player1Id: z.number().nullable(),
  player2Id: z.number().nullable(),
  winnerId: z.number().nullable(),
  status: wordWarsMatchStatusSchema,
  deadline: z.string().nullable(),
  game1Slug: z.string(),
  game2Slug: z.string(),
  game3Slug: z.string(),
  createdAt: z.string(),
});
export type WordWarsMatch = z.infer<typeof wordWarsMatchSchema>;

export const wordWarsMatchGameStatusSchema = z.enum(["pending", "active", "completed"]);
export type WordWarsMatchGameStatus = z.infer<typeof wordWarsMatchGameStatusSchema>;

export const wordWarsMatchGameSchema = z.object({
  id: z.number(),
  matchId: z.number(),
  gameNumber: z.number(),
  gameSlug: z.string(),
  roomCode: z.string().nullable(),
  winnerId: z.number().nullable(),
  status: wordWarsMatchGameStatusSchema,
});
export type WordWarsMatchGame = z.infer<typeof wordWarsMatchGameSchema>;

export const wordWarsChampionSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  userId: z.number(),
  createdAt: z.string(),
});
export type WordWarsChampion = z.infer<typeof wordWarsChampionSchema>;
