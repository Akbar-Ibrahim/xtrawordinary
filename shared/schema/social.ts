import { z } from "zod";

export const friendshipStatusSchema = z.enum(["pending", "accepted", "declined"]);
export type FriendshipStatus = z.infer<typeof friendshipStatusSchema>;

export const friendshipSchema = z.object({
  id: z.number(),
  requesterId: z.number(),
  addresseeId: z.number(),
  status: friendshipStatusSchema,
  createdAt: z.string(),
});
export type Friendship = z.infer<typeof friendshipSchema>;

export const insertFriendshipSchema = friendshipSchema.omit({ id: true, createdAt: true });
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;

export const challengeStatusSchema = z.enum(["pending", "completed", "declined", "cancelled"]);
export type ChallengeStatus = z.infer<typeof challengeStatusSchema>;

export const friendChallengeSchema = z.object({
  id: z.number(),
  senderId: z.number(),
  receiverId: z.number(),
  gameSlug: z.string(),
  senderScore: z.number(),
  receiverScore: z.number().nullable(),
  status: challengeStatusSchema,
  message: z.string().nullable(),
  seed: z.number().nullable(),
  gameConfig: z.string().nullable().optional(),
  senderViewed: z.boolean(),
  receiverViewed: z.boolean(),
  createdAt: z.string(),
  senderName: z.string().optional(),
  receiverName: z.string().optional(),
  senderAvatarUrl: z.string().nullable().optional(),
  receiverAvatarUrl: z.string().nullable().optional(),
});
export type FriendChallenge = z.infer<typeof friendChallengeSchema>;

export const insertFriendChallengeSchema = friendChallengeSchema.omit({ id: true, createdAt: true, senderName: true, receiverName: true, senderAvatarUrl: true, receiverAvatarUrl: true });
export type InsertFriendChallenge = z.infer<typeof insertFriendChallengeSchema>;
