import { mysqlTable, int, varchar, text, boolean, timestamp, json, bigint, index, uniqueIndex, primaryKey, mysqlEnum, tinyint, char } from "drizzle-orm/mysql-core";
import type { GameMode } from "@shared/schema";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  username: varchar("username", { length: 20 }).notNull(),
  usernameNormalized: varchar("username_normalized", { length: 20 }).notNull(),
  passwordHash: text("password_hash"),
  googleId: varchar("google_id", { length: 255 }).unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_username_normalized_idx").on(table.usernameNormalized),
]);

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
  lastScore: int("last_score").default(0),
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

export const gamePlayCounts = mysqlTable("game_play_counts", {
  gameSlug: varchar("game_slug", { length: 100 }).primaryKey(),
  count: int("count").notNull().default(0),
});

export const userStreaks = mysqlTable("user_streaks", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().unique(),
  currentStreak: int("current_streak").notNull().default(0),
  longestStreak: int("longest_streak").notNull().default(0),
  lastPlayedDate: varchar("last_played_date", { length: 20 }).notNull(),
  dailyChallengeStreak: int("daily_challenge_streak").notNull().default(0),
  longestDailyChallengeStreak: int("longest_daily_challenge_streak").notNull().default(0),
  lastDailyChallengeDate: varchar("last_daily_challenge_date", { length: 20 }),
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
  gameConfig: text("game_config"),
  senderViewed: boolean("sender_viewed").notNull().default(false),
  receiverViewed: boolean("receiver_viewed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fc_sender_idx").on(table.senderId),
  index("fc_receiver_idx").on(table.receiverId),
  index("fc_created_at_idx").on(table.createdAt),
]);

export const words = mysqlTable("words", {
  id: int("id").primaryKey().autoincrement(),
  word: varchar("word", { length: 100 }).notNull().unique(),
  wordLength: int("word_length").notNull().default(0),
  isAnagram: boolean("is_anagram").notNull().default(false),
  isWordStack: boolean("is_word_stack").notNull().default(false),
  // Production migration required before deploying: ALTER TABLE words MODIFY COLUMN hint JSON;
  hint: json("hint").$type<string[]>(),
  category: varchar("category", { length: 100 }),
  isWordSplit: boolean("is_word_split").notNull().default(false),
  frequencyLevel: mysqlEnum("frequency_level", ["very_low", "low", "medium_low", "medium", "medium_high", "high", "very_high"]),
  isIsogram: boolean("is_isogram").notNull().default(false),
  consonantCount: int("consonant_count"),
  vowelCount: int("vowel_count"),
  meta: json("meta"),
  isPalindrome: boolean("is_palindrome").notNull().default(false),
}, (table) => [
  index("words_length_idx").on(table.wordLength),
  index("words_anagram_idx").on(table.isAnagram),
  index("words_stack_idx").on(table.isWordStack),
  index("words_frequency_idx").on(table.frequencyLevel),
  index("words_isogram_idx").on(table.isIsogram),
  index("words_consonant_idx").on(table.consonantCount),
  index("words_vowel_idx").on(table.vowelCount),
  index("words_palindrome_idx").on(table.isPalindrome),
]);

export const wordAnagrams = mysqlTable("word_anagrams", {
  wordId: int("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
  anagramId: int("anagram_id").notNull().references(() => words.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.wordId, table.anagramId] }),
  index("idx_anagram_to_word").on(table.anagramId, table.wordId),
]);

export const wordDerivatives = mysqlTable("word_derivatives", {
  wordId: int("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
  derivativeId: int("derivative_id").notNull().references(() => words.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.wordId, table.derivativeId] }),
  index("idx_derivative_to_word").on(table.derivativeId, table.wordId),
]);

export const letterFrequency = mysqlTable("letter_frequency", {
  wordId: int("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
  letter: char("letter", { length: 1 }).notNull(),
  frequency: int("frequency").notNull(),
}, (table) => [
  primaryKey({ columns: [table.wordId, table.letter] }),
  index("idx_letter_frequency").on(table.letter, table.frequency),
]);

export const shellWords = mysqlTable("shell_words", {
  shellWordId: int("shell_word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
  innerWordId: int("inner_word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
  depth: int("depth").notNull(),
}, (table) => [
  primaryKey({ columns: [table.shellWordId, table.depth] }),
  index("shell_words_inner_depth_idx").on(table.innerWordId, table.depth),
]);

export const wordLetterPositions = mysqlTable("word_letter_positions", {
  wordId: int("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
  position: tinyint("position").notNull(),
  letter: char("letter", { length: 1 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.wordId, table.position] }),
  index("wlp_letter_idx").on(table.letter),
  index("wlp_position_idx").on(table.position),
  index("wlp_letter_position_idx").on(table.letter, table.position),
]);

export const partsOfSpeech = mysqlTable("parts_of_speech", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 50 }).notNull().unique(),
});

export const wordDefinitions = mysqlTable("word_definitions", {
  id: int("id").primaryKey().autoincrement(),
  wordId: int("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
  partOfSpeechId: int("part_of_speech_id").notNull().references(() => partsOfSpeech.id),
  definition: text("definition").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
}, (table) => [
  index("wd_word_id_idx").on(table.wordId),
  index("wd_pos_id_idx").on(table.partOfSpeechId),
  index("wd_word_sort_idx").on(table.wordId, table.sortOrder),
]);

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
  gameConfig: text("game_config"),
  seasonId: int("season_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("gr_group_idx").on(table.groupId),
  index("gr_status_idx").on(table.status),
  index("gr_season_idx").on(table.seasonId),
]);

export const groupSeasons = mysqlTable("group_seasons", {
  id: int("id").primaryKey().autoincrement(),
  groupId: int("group_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdById: int("created_by_id").notNull(),
  winnerId: int("winner_id"),
  winnerName: varchar("winner_name", { length: 255 }),
  eligibleMemberIds: text("eligible_member_ids").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("gs_group_idx").on(table.groupId),
  index("gs_status_idx").on(table.status),
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

export const dailyChallengeScores = mysqlTable("daily_challenge_scores", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  challengeDate: varchar("challenge_date", { length: 20 }).notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  score: int("score").notNull().default(0),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
}, (table) => [
  index("dcs_date_slug_idx").on(table.challengeDate, table.gameSlug),
  index("dcs_user_idx").on(table.userId),
  uniqueIndex("dcs_user_date_idx").on(table.userId, table.challengeDate),
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
  timeLimitSeconds: int("time_limit_seconds"),
  wordTarget: int("word_target"),
  livesCount: int("lives_count"),
  survivalSecondsPerWord: int("survival_seconds_per_word"),
});

export const wordCategories = mysqlTable("word_categories", {
  id: int("id").primaryKey().autoincrement(),
  word: varchar("word", { length: 100 }).notNull().unique(),
  definitions: json("definitions").$type<string[]>().notNull(),
  wordLength: int("word_length").notNull(),
  partOfSpeechId: int("part_of_speech_id").references(() => partsOfSpeech.id),
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
  updatedAt: timestamp("updated_at"),
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

export const duelChallenges = mysqlTable("duel_challenges", {
  id: int("id").primaryKey().autoincrement(),
  challengerId: int("challenger_id").notNull(),
  challengeeId: int("challengee_id"),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  message: text("message"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  roomCode: varchar("room_code", { length: 12 }),
  /** Persisted so restoreRoom is deterministic after process restart. */
  seed: int("seed"),
  startWord: varchar("start_word", { length: 60 }),
  /** "turn" or "race" */
  format: varchar("format", { length: 10 }).notNull().default("turn"),
  /** Target word count for race format (e.g. 15 = first to 15 wins). */
  raceTarget: int("race_target"),
  /** Race time limit in seconds (fallback winner-by-count if no one hits target). */
  raceTimeLimit: int("race_time_limit"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("dc_challenger_idx").on(table.challengerId),
  index("dc_challengee_idx").on(table.challengeeId),
  index("dc_status_idx").on(table.status),
  index("dc_created_at_idx").on(table.createdAt),
]);

export const duelSessions = mysqlTable("duel_sessions", {
  id: int("id").primaryKey().autoincrement(),
  roomCode: varchar("room_code", { length: 12 }).notNull().unique(),
  challengeId: int("challenge_id"),
  player1Id: int("player1_id").notNull(),
  player2Id: int("player2_id").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  seed: int("seed").notNull(),
  /** "turn" or "race" */
  format: varchar("format", { length: 10 }).notNull().default("turn"),
  /** Target word count for race sessions. */
  raceTarget: int("race_target"),
  /** Race time limit in seconds. */
  raceTimeLimit: int("race_time_limit"),
  outcome: varchar("outcome", { length: 30 }),
  eloDeltaPlayer1: int("elo_delta_player1"),
  eloDeltaPlayer2: int("elo_delta_player2"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
}, (table) => [
  index("ds_player1_idx").on(table.player1Id),
  index("ds_player2_idx").on(table.player2Id),
  index("ds_room_code_idx").on(table.roomCode),
  index("ds_started_at_idx").on(table.startedAt),
]);

export const duelRatings = mysqlTable("duel_ratings", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull().unique(),
  elo: int("elo").notNull().default(1200),
  wins: int("wins").notNull().default(0),
  losses: int("losses").notNull().default(0),
  draws: int("draws").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("dr_user_id_idx").on(table.userId),
]);

export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
}, (table) => [
  uniqueIndex("np_user_type_idx").on(table.userId, table.type),
  index("np_user_idx").on(table.userId),
]);

export const huddleChallenges = mysqlTable("huddle_challenges", {
  id: int("id").primaryKey().autoincrement(),
  challengerGroupId: int("challenger_group_id").notNull(),
  challengeeGroupId: int("challengee_group_id").notNull(),
  challengerAdminId: int("challenger_admin_id").notNull(),
  challengeeAdminId: int("challengee_admin_id"),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  format: varchar("format", { length: 10 }).notNull().default("turn"),
  raceTarget: int("race_target"),
  raceTimeLimit: int("race_time_limit"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  roomCode: varchar("room_code", { length: 12 }),
  seed: int("seed"),
  startWord: varchar("start_word", { length: 60 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("hc_challenger_group_idx").on(table.challengerGroupId),
  index("hc_challengee_group_idx").on(table.challengeeGroupId),
  index("hc_status_idx").on(table.status),
  index("hc_room_code_idx").on(table.roomCode),
]);

export const wordWarsTournaments = mysqlTable("word_wars_tournaments", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("registration"),
  registrationDeadline: timestamp("registration_deadline").notNull(),
  roundDeadlineHours: int("round_deadline_hours").notNull().default(24),
  minPlayers: int("min_players").notNull().default(2),
  maxPlayers: int("max_players"),
  recurringCron: varchar("recurring_cron", { length: 100 }),
  createdBy: int("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("wt_status_idx").on(table.status),
  index("wt_deadline_idx").on(table.registrationDeadline),
  index("wt_created_by_idx").on(table.createdBy),
]);

export const wordWarsRegistrations = mysqlTable("word_wars_registrations", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id").notNull(),
  userId: int("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("wr_tournament_idx").on(table.tournamentId),
  index("wr_user_idx").on(table.userId),
  uniqueIndex("wr_tournament_user_idx").on(table.tournamentId, table.userId),
]);

export const wordWarsMatches = mysqlTable("word_wars_matches", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id").notNull(),
  round: int("round").notNull(),
  player1Id: int("player1_id"),
  player2Id: int("player2_id"),
  winnerId: int("winner_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  deadline: timestamp("deadline"),
  game1Slug: varchar("game1_slug", { length: 100 }).notNull(),
  game2Slug: varchar("game2_slug", { length: 100 }).notNull(),
  game3Slug: varchar("game3_slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("wm_tournament_idx").on(table.tournamentId),
  index("wm_round_idx").on(table.tournamentId, table.round),
  index("wm_player1_idx").on(table.player1Id),
  index("wm_player2_idx").on(table.player2Id),
  index("wm_status_idx").on(table.status),
]);

export const wordWarsMatchGames = mysqlTable("word_wars_match_games", {
  id: int("id").primaryKey().autoincrement(),
  matchId: int("match_id").notNull(),
  gameNumber: int("game_number").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  roomCode: varchar("room_code", { length: 12 }),
  winnerId: int("winner_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
}, (table) => [
  index("wmg_match_idx").on(table.matchId),
  uniqueIndex("wmg_match_game_idx").on(table.matchId, table.gameNumber),
  index("wmg_room_code_idx").on(table.roomCode),
]);

export const wordWarsChampions = mysqlTable("word_wars_champions", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id").notNull(),
  userId: int("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("wc_tournament_idx").on(table.tournamentId),
  index("wc_user_idx").on(table.userId),
  uniqueIndex("wc_tournament_user_idx").on(table.tournamentId, table.userId),
]);

export const guildWarsTournaments = mysqlTable("guild_wars_tournaments", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("registration"),
  registrationDeadline: timestamp("registration_deadline").notNull(),
  roundDeadlineHours: int("round_deadline_hours").notNull().default(24),
  minGroups: int("min_groups").notNull().default(2),
  maxGroups: int("max_groups"),
  createdBy: int("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("gt_status_idx").on(table.status),
  index("gt_deadline_idx").on(table.registrationDeadline),
  index("gt_created_by_idx").on(table.createdBy),
]);

export const guildWarsRegistrations = mysqlTable("guild_wars_registrations", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id").notNull(),
  groupId: int("group_id").notNull(),
  registeredBy: int("registered_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("gr_tournament_idx").on(table.tournamentId),
  index("gr_group_idx").on(table.groupId),
  uniqueIndex("gr_tournament_group_idx").on(table.tournamentId, table.groupId),
]);

export const guildWarsMatches = mysqlTable("guild_wars_matches", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id").notNull(),
  round: int("round").notNull(),
  group1Id: int("group1_id"),
  group2Id: int("group2_id"),
  winnerGroupId: int("winner_group_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  deadline: timestamp("deadline"),
  game1Slug: varchar("game1_slug", { length: 100 }).notNull(),
  game2Slug: varchar("game2_slug", { length: 100 }).notNull(),
  game3Slug: varchar("game3_slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("gm_tournament_idx").on(table.tournamentId),
  index("gm_round_idx").on(table.tournamentId, table.round),
  index("gm_status_idx").on(table.status),
]);

export const guildWarsMatchGames = mysqlTable("guild_wars_match_games", {
  id: int("id").primaryKey().autoincrement(),
  matchId: int("match_id").notNull(),
  gameNumber: int("game_number").notNull(),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  roomCode: varchar("room_code", { length: 12 }),
  winnerGroupId: int("winner_group_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
}, (table) => [
  index("gmg_match_idx").on(table.matchId),
  uniqueIndex("gmg_match_game_idx").on(table.matchId, table.gameNumber),
  index("gmg_room_code_idx").on(table.roomCode),
]);

export const guildWarsChampions = mysqlTable("guild_wars_champions", {
  id: int("id").primaryKey().autoincrement(),
  tournamentId: int("tournament_id").notNull(),
  groupId: int("group_id").notNull(),
  tournamentName: varchar("tournament_name", { length: 255 }).notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("gc_tournament_idx").on(table.tournamentId),
  index("gc_group_idx").on(table.groupId),
  uniqueIndex("gc_tournament_group_idx").on(table.tournamentId, table.groupId),
]);

export const teamRaceChallenges = mysqlTable("team_race_challenges", {
  id: int("id").primaryKey().autoincrement(),
  challengerGroupId: int("challenger_group_id").notNull(),
  challengeeGroupId: int("challengee_group_id").notNull(),
  challengerAdminId: int("challenger_admin_id").notNull(),
  challengeeAdminId: int("challengee_admin_id"),
  gameSlug: varchar("game_slug", { length: 100 }).notNull(),
  raceTarget: int("race_target").notNull().default(20),
  raceTimeLimit: int("race_time_limit").notNull().default(300),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  roomCode: varchar("room_code", { length: 12 }),
  seed: int("seed"),
  startWord: varchar("start_word", { length: 100 }),
  winnerGroupId: int("winner_group_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("tr_challenger_group_idx").on(table.challengerGroupId),
  index("tr_challengee_group_idx").on(table.challengeeGroupId),
  index("tr_status_idx").on(table.status),
  index("tr_room_code_idx").on(table.roomCode),
]);

export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  linkUrl: varchar("link_url", { length: 500 }),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("notif_user_id_idx").on(table.userId),
  index("notif_user_read_idx").on(table.userId, table.readAt),
  index("notif_created_at_idx").on(table.createdAt),
]);

export const siteSettings = mysqlTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
