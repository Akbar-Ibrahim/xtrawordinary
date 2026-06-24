import { z } from "zod";

export const TEAM_RACE_GAME_SLUGS = new Set([
  "no-repeats",
  "anagram-solver",
  "word-maker",
  "definition-match",
  "letter-hunt",
  "letter-frequency",
  "word-length",
  "letter-dodge",
  "word-roots",
]);

export const teamRaceChallengeStatusSchema = z.enum(["pending", "accepted", "declined", "cancelled", "completed"]);
export type TeamRaceChallengeStatus = z.infer<typeof teamRaceChallengeStatusSchema>;

export const teamRaceChallengeSchema = z.object({
  id: z.number(),
  challengerGroupId: z.number(),
  challengeeGroupId: z.number(),
  challengerAdminId: z.number(),
  challengeeAdminId: z.number().nullable(),
  gameSlug: z.string(),
  raceTarget: z.number(),
  raceTimeLimit: z.number(),
  status: teamRaceChallengeStatusSchema,
  roomCode: z.string().nullable(),
  seed: z.number().nullable(),
  startWord: z.string().nullable(),
  winnerGroupId: z.number().nullable(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
});
export type TeamRaceChallenge = z.infer<typeof teamRaceChallengeSchema>;
export const insertTeamRaceChallengeSchema = teamRaceChallengeSchema.omit({ id: true, createdAt: true });
export type InsertTeamRaceChallenge = z.infer<typeof insertTeamRaceChallengeSchema>;
