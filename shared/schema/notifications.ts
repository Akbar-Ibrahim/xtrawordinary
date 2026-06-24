import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "group_join",
  "comment_reply",
  "group_round_start",
  "duel_accepted",
  "duel_challenge_received",
  "friend_challenge_received",
  "friend_challenge_result",
  "friend_challenge_declined",
  "friend_challenge_cancelled",
  "huddle_challenge_received",
  "huddle_accepted",
  "team_race_challenge_received",
  "team_race_accepted",
  "word_war_matched",
  "word_war_round_start",
  "word_war_champion",
  "word_war_cancelled",
  "guild_war_matched",
  "guild_war_round_start",
  "guild_war_champion",
  "guild_war_cancelled",
  "guild_war_match_ready",
  "friend_request_received",
  "achievement_unlocked",
  "comment_liked",
  "streak_at_risk",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.number(),
  userId: z.number(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  linkUrl: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const insertNotificationSchema = notificationSchema.omit({ id: true, createdAt: true, readAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const notificationPreferenceSchema = z.object({
  id: z.number(),
  userId: z.number(),
  type: notificationTypeSchema,
  enabled: z.boolean(),
});
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  group_join: "New member joined your group",
  comment_reply: "Replies to your comments",
  group_round_start: "New group round started",
  duel_accepted: "Duel challenge accepted",
  duel_challenge_received: "You've been challenged to a duel",
  friend_challenge_received: "Someone challenged you",
  friend_challenge_result: "Friend challenge results",
  friend_challenge_declined: "Friend challenge declined",
  friend_challenge_cancelled: "Friend challenge cancelled",
  huddle_challenge_received: "Your group was challenged to a Huddle",
  huddle_accepted: "Group Huddle challenge accepted",
  team_race_challenge_received: "Your group was challenged to a Team Race",
  team_race_accepted: "Group Team Race challenge accepted",
  word_war_matched: "Word Wars — Your opponent awaits",
  word_war_round_start: "Word Wars — Battle begins now",
  word_war_champion: "Word Wars — You are champion",
  word_war_cancelled: "Word Wars — Tournament cancelled",
  guild_war_matched: "Guild Wars — Your group has been matched",
  guild_war_round_start: "Guild Wars — Battle begins now",
  guild_war_champion: "Guild Wars — Your group is champion",
  guild_war_cancelled: "Guild Wars — Tournament cancelled",
  guild_war_match_ready: "Guild Wars — Your next match is ready",
  friend_request_received: "Someone sent you a friend request",
  achievement_unlocked: "You unlocked a new achievement",
  comment_liked: "Someone liked your comment",
  streak_at_risk: "Your streak is at risk",
};
