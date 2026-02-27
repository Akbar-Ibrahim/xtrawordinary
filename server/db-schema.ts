import { mysqlTable, int, varchar, text, boolean, timestamp, json, bigint } from "drizzle-orm/mysql-core";

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailVerificationTokens = mysqlTable("email_verification_tokens", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const userGameStats = mysqlTable("user_game_stats", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  bestScore: int("best_score").notNull().default(0),
  gamesPlayed: int("games_played").notNull().default(0),
  gamesWon: int("games_won").notNull().default(0),
  wordsFound: int("words_found").notNull().default(0),
  lastPlayedAt: timestamp("last_played_at").notNull().defaultNow(),
});

export const leaderboardEntries = mysqlTable("leaderboard_entries", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  score: int("score").notNull(),
  playerName: varchar("player_name", { length: 255 }).notNull(),
  playedAt: timestamp("played_at").notNull().defaultNow(),
});

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
});
