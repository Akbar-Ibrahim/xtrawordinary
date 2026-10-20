import { z } from "zod";

export const huddleChallengeStatusSchema = z.enum(["pending", "accepted", "declined", "cancelled", "completed"]);
export type HuddleChallengeStatus = z.infer<typeof huddleChallengeStatusSchema>;

export const huddleChallengeSchema = z.object({
  id: z.number(),
  challengerGroupId: z.number(),
  challengeeGroupId: z.number(),
  challengerAdminId: z.number(),
  challengeeAdminId: z.number().nullable(),
  gameSlug: z.string(),
  format: z.enum(["turn", "race"]).default("turn"),
  raceTarget: z.number().nullable(),
  raceTimeLimit: z.number().nullable(),
  status: huddleChallengeStatusSchema,
  roomCode: z.string().nullable(),
  seed: z.number().nullable(),
  startWord: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
});
export type HuddleChallenge = z.infer<typeof huddleChallengeSchema>;

export const insertHuddleChallengeSchema = huddleChallengeSchema.omit({ id: true, createdAt: true });
export type InsertHuddleChallenge = z.infer<typeof insertHuddleChallengeSchema>;
