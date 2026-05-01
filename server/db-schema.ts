import { mysqlTable, int, varchar, text, boolean, timestamp, json, bigint, index, uniqueIndex } from "drizzle-orm/mysql-core";
import type { GameMode } from "@shared/schema";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash"),
  googleId: varchar("google_id", { length: 255 }).unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailVerificationTokens = mysqlTable("email_verification_tokens", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  index("evt_user_id_idx").on(table.userId),
]);

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  index("prt_user_id_idx").on(table.userId),
]);

export const userGameStats = mysqlTable("user_game_stats", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  bestScore: int("best_score").notNull().default(0),
  gamesPlayed: int("games_played").notNull().default(0),
  gamesWon: int("games_won").notNull().default(0),
  wordsFound: int("words_found").notNull().default(0),
  lastPlayedAt: timestamp("last_played_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ugs_user_game_idx").on(table.userId, table.gameSlug),
]);

export const leaderboardEntries = mysqlTable("leaderboard_entries", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  score: int("score").notNull(),
  playerName: varchar("player_name", { length: 255 }).notNull(),
  playedAt: timestamp("played_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("lb_user_game_idx").on(table.userId, table.gameSlug),
  index("lb_game_score_idx").on(table.gameSlug, table.score),
  index("lb_played_at_idx").on(table.playedAt),
]);

export const userStreaks = mysqlTable("user_streaks", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().unique(),
  currentStreak: int("current_streak").notNull().default(0),
  longestStreak: int("longest_streak").notNull().default(0),
  lastPlayedDate: varchar("last_played_date", { length: 20 }).notNull(),
});

export const userAchievements = mysqlTable("user_achievements", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  achievementId: varchar("achievement_id", { length: 100 }).notNull(),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
}, (table) => [
  index("ua_user_id_idx").on(table.userId),
  uniqueIndex("ua_user_achievement_idx").on(table.userId, table.achievementId),
]);

export const friendships = mysqlTable("friendships", {
  id: int("id").primaryKey().autoincrement(),
  requesterId: int("requester_id").notNull(),
  addresseeId: int("addressee_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fr_requester_idx").on(table.requesterId),
  index("fr_addressee_idx").on(table.addresseeId),
  index("fr_status_addressee_idx").on(table.status, table.addresseeId),
]);

export const friendChallenges = mysqlTable("friend_challenges", {
  id: int("id").primaryKey().autoincrement(),
  senderId: int("sender_id").notNull(),
  receiverId: int("receiver_id").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  senderScore: int("sender_score").notNull(),
  receiverScore: int("receiver_score"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  message: text("message"),
  seed: int("seed"),
  senderViewed: boolean("sender_viewed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fc_sender_idx").on(table.senderId),
  index("fc_receiver_idx").on(table.receiverId),
  index("fc_created_at_idx").on(table.createdAt),
]);

export const words = mysqlTable("words", {
  id: int("id").primaryKey().autoincrement(),
  word: varchar("word", { length: 100 }).notNull().unique(),
});

export const groups = mysqlTable("groups", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  creatorId: int("creator_id").notNull(),
  inviteCode: varchar("invite_code", { length: 20 }).notNull().unique(),
  isPublic: boolean("is_public").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  tags: json("tags"),
  pinnedAnnouncement: text("pinned_announcement"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("grp_creator_idx").on(table.creatorId),
  index("grp_featured_idx").on(table.isFeatured),
]);

export const groupMembers = mysqlTable("group_members", {
  id: int("id").primaryKey().autoincrement(),
  groupId: int("group_id").notNull(),
  userId: int("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  index("gm_group_idx").on(table.groupId),
  index("gm_user_idx").on(table.userId),
  uniqueIndex("gm_group_user_idx").on(table.groupId, table.userId),
]);

export const groupRounds = mysqlTable("group_rounds", {
  id: int("id").primaryKey().autoincrement(),
  groupId: int("group_id").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  seed: int("seed").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdById: int("created_by_id").notNull(),
  closesAt: timestamp("closes_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("gr_group_idx").on(table.groupId),
  index("gr_status_idx").on(table.status),
]);

export const groupRoundScores = mysqlTable("group_round_scores", {
  id: int("id").primaryKey().autoincrement(),
  roundId: int("round_id").notNull(),
  userId: int("user_id").notNull(),
  score: int("score").notNull(),
  durationMs: int("duration_ms"),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
}, (table) => [
  index("grs_round_idx").on(table.roundId),
  index("grs_user_idx").on(table.userId),
  uniqueIndex("grs_round_user_idx").on(table.roundId, table.userId),
]);

export const groupScoreReactions = mysqlTable("group_score_reactions", {
  id: int("id").primaryKey().autoincrement(),
  roundId: int("round_id").notNull(),
  scoreId: int("score_id").notNull(),
  userId: int("user_id").notNull(),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("gsr_round_idx").on(table.roundId),
  index("gsr_score_idx").on(table.scoreId),
  uniqueIndex("gsr_score_user_emoji_idx").on(table.scoreId, table.userId, table.emoji),
]);

export const groupActivity = mysqlTable("group_activity", {
  id: int("id").primaryKey().autoincrement(),
  groupId: int("group_id").notNull(),
  userId: int("user_id"),
  type: varchar("type", { length: 50 }).notNull(),
  metadata: json("metadata").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("ga_group_idx").on(table.groupId),
  index("ga_created_at_idx").on(table.createdAt),
]);

export const groupRoundAttempts = mysqlTable("group_round_attempts", {
  id: int("id").primaryKey().autoincrement(),
  roundId: int("round_id").notNull(),
  userId: int("user_id").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
}, (table) => [
  index("gra_round_idx").on(table.roundId),
  index("gra_user_idx").on(table.userId),
  uniqueIndex("gra_round_user_idx").on(table.roundId, table.userId),
]);

export const dailyChallengeAttempts = mysqlTable("daily_challenge_attempts", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  challengeDate: varchar("challenge_date", { length: 20 }).notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
}, (table) => [
  index("dca_user_idx").on(table.userId),
  uniqueIndex("dca_user_date_idx").on(table.userId, table.challengeDate),
]);

export const games = mysqlTable("games", {
  id: int("id").primaryKey().autoincrement(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  longDescription: text("long_description").notNull(),
  rules: json("rules").notNull(),
  difficulty: varchar("difficulty", { length: 20 }).notNull(),
  estimatedTime: varchar("estimated_time", { length: 50 }).notNull(),
  icon: varchar("icon", { length: 100 }).notNull(),
  color: varchar("color", { length: 100 }).notNull(),
  playCount: int("play_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  hasSurvival: boolean("has_survival").notNull().default(false),
  modes: json("modes").$type<GameMode[]>(),
});

export const wordCategories = mysqlTable("word_categories", {
  id: int("id").primaryKey().autoincrement(),
  word: varchar("word", { length: 100 }).notNull().unique(),
  subcategory: varchar("subcategory", { length: 255 }).notNull(),
  wordLength: int("word_length").notNull(),
});

export const comments = mysqlTable("comments", {
  id: int("id").primaryKey().autoincrement(),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: varchar("target_id", { length: 100 }).notNull(),
  userId: int("user_id").notNull(),
  parentId: int("parent_id"),
  content: text("content").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("cmt_target_idx").on(table.targetType, table.targetId),
  index("cmt_user_idx").on(table.userId),
  index("cmt_parent_idx").on(table.parentId),
  index("cmt_created_at_idx").on(table.createdAt),
]);

export const commentReports = mysqlTable("comment_reports", {
  id: int("id").primaryKey().autoincrement(),
  commentId: int("comment_id").notNull(),
  reportingUserId: int("reporting_user_id").notNull(),
  reason: varchar("reason", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("cr_comment_idx").on(table.commentId),
  index("cr_user_idx").on(table.reportingUserId),
]);

export const likes = mysqlTable("likes", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  targetType: varchar("target_type", { length: 20 }).notNull(),
  targetId: varchar("target_id", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("likes_user_target_idx").on(table.userId, table.targetType, table.targetId),
  index("likes_target_idx").on(table.targetType, table.targetId),
]);

export const quizSessions = mysqlTable("quiz_sessions", {
  id: int("id").primaryKey().autoincrement(),
  creatorId: int("creator_id").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  shareCode: varchar("share_code", { length: 8 }).notNull().unique(),
  params: json("params").notNull().default({}),
  closesAt: timestamp("closes_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("qs_share_code_idx").on(table.shareCode),
  index("qs_creator_idx").on(table.creatorId),
]);

export const quizSessionScores = mysqlTable("quiz_session_scores", {
  id: int("id").primaryKey().autoincrement(),
  sessionId: int("session_id").notNull(),
  userId: int("user_id").notNull(),
  guestName: varchar("guest_name", { length: 100 }),
  score: int("score").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
}, (table) => [
  index("qss_session_idx").on(table.sessionId),
  index("qss_user_idx").on(table.userId),
  uniqueIndex("qss_session_user_idx").on(table.sessionId, table.userId),
]);
