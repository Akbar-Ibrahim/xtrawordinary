import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const gameModeSchema = z.object({
  label: z.string(),
  slug: z.string(),
});
export type GameMode = z.infer<typeof gameModeSchema>;

export const gameSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  longDescription: z.string(),
  rules: z.array(z.string()),
  difficulty: difficultySchema,
  estimatedTime: z.string(),
  icon: z.string(),
  color: z.string(),
  playCount: z.number(),
  isActive: z.boolean().optional(),
  hasSurvival: z.boolean().optional(),
  modes: z.array(gameModeSchema).optional(),
});

export type Game = z.infer<typeof gameSchema>;

export const gamesListSchema = z.array(gameSchema);

// Word Guessing game words
export const wordGuessingWordsSchema = z.array(z.string());
export type WordGuessingWords = z.infer<typeof wordGuessingWordsSchema>;

// Anagram Solver word sets (new structure with multiple anagrams)
export const anagramWordSetSchema = z.object({
  original: z.string(),
  anagrams: z.array(z.string()),
});
export type AnagramWordSet = z.infer<typeof anagramWordSetSchema>;
export const anagramWordSetsSchema = z.array(anagramWordSetSchema);

// Word Scramble words
export const scrambleWordSchema = z.object({
  word: z.string(),
  category: z.string(),
});
export type ScrambleWord = z.infer<typeof scrambleWordSchema>;
export const scrambleWordsSchema = z.array(scrambleWordSchema);

// Definition Match words (word + three graded definitions, cryptic → obvious)
export const definitionWordSchema = z.object({
  word: z.string(),
  definitions: z.tuple([z.string(), z.string(), z.string()]),
  partOfSpeech: z.string(),
});
export type DefinitionWord = z.infer<typeof definitionWordSchema>;
export const definitionWordsSchema = z.array(definitionWordSchema);

// Letter Pool words (word with locked first/last, pool of letters including decoys)
export const letterPoolWordSchema = z.object({
  word: z.string(),
  hint: z.string(),
  category: z.string(),
  letterPool: z.array(z.string()),
});
export type LetterPoolWord = z.infer<typeof letterPoolWordSchema>;
export const letterPoolWordsSchema = z.array(letterPoolWordSchema);

// Word Maker words (base word + possible derivatives)
export const makerWordSchema = z.object({
  baseWord: z.string(),
  derivatives: z.array(z.string()),
  maxWords: z.number(),
});
export type MakerWord = z.infer<typeof makerWordSchema>;
export const makerWordsSchema = z.array(makerWordSchema);

export const wordRootsPuzzleSchema = z.object({
  canonicalWord: z.string(),
  derivatives: z.array(z.string()),
});
export type WordRootsPuzzle = z.infer<typeof wordRootsPuzzleSchema>;

// Shared word dictionary for validation-based games
export const wordDictionarySchema = z.array(z.string());
export type WordDictionary = z.infer<typeof wordDictionarySchema>;

// Word validation response
export const wordValidationResponseSchema = z.object({
  valid: z.boolean(),
  message: z.string().optional(),
});
export type WordValidationResponse = z.infer<typeof wordValidationResponseSchema>;

// Word Length game configuration
export const wordLengthConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(), // seconds
});
export type WordLengthConfig = z.infer<typeof wordLengthConfigSchema>;

// Letter Position game configuration  
export const letterPositionConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(), // seconds
});
export type LetterPositionConfig = z.infer<typeof letterPositionConfigSchema>;

// Letter Hunt game configuration
export const letterHuntConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(), // seconds
  letterSets: z.array(z.array(z.string())), // groups of letters for the game
});
export type LetterHuntConfig = z.infer<typeof letterHuntConfigSchema>;

// Beginning and End game configuration
export const wordChainConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerWord: z.number(), // seconds per word entry
});
export type WordChainConfig = z.infer<typeof wordChainConfigSchema>;

// Consonants and Vowels game configuration
export const vowelConsonantConfigSchema = z.object({
  wordsPerRound: z.number(),
  timePerWord: z.number(), // seconds per word entry
});
export type VowelConsonantConfig = z.infer<typeof vowelConsonantConfigSchema>;

// Word Stack puzzle (build from 2-letter word up to target word)
export const wordStackPuzzleSchema = z.object({
  targetWord: z.string(),
  startWord: z.string(), // 2-letter starting word
  hint: z.string(),
});
export type WordStackPuzzle = z.infer<typeof wordStackPuzzleSchema>;
export const wordStackPuzzlesSchema = z.array(wordStackPuzzleSchema);

// Word Split puzzle (split target word into smaller valid words)
export const wordSplitPuzzleSchema = z.object({
  targetWord: z.string(),
  hint: z.string(),
});
export type WordSplitPuzzle = z.infer<typeof wordSplitPuzzleSchema>;
export const wordSplitPuzzlesSchema = z.array(wordSplitPuzzleSchema);

// Progressive Reveal words (word + subcategory for clue, no definition)
export const progressiveRevealWordSchema = z.object({
  word: z.string(),
  subcategory: z.string(),
});
export type ProgressiveRevealWord = z.infer<typeof progressiveRevealWordSchema>;
export const progressiveRevealWordsSchema = z.array(progressiveRevealWordSchema);

// Word Sweep grid cell
export const wordSweepGridSchema = z.object({
  grid: z.array(z.array(z.string())),
  size: z.number(),
});
export type WordSweepGrid = z.infer<typeof wordSweepGridSchema>;

// Word Unpack puzzle
export const wordUnpackPuzzleSchema = z.object({
  grid: z.array(z.array(z.string())),
  size: z.number(),
  words: z.array(z.string()),
});
export type WordUnpackPuzzle = z.infer<typeof wordUnpackPuzzleSchema>;

// Word Ladder puzzle
export const wordLadderPuzzleSchema = z.object({
  start: z.string(),
  target: z.string(),
  par: z.number(),
  optimalPaths: z.array(z.array(z.string())),
});
export type WordLadderPuzzle = z.infer<typeof wordLadderPuzzleSchema>;
export const wordLadderPuzzlesSchema = z.array(wordLadderPuzzleSchema);

// Ladder Rush puzzle
export const ladderRushPuzzleSchema = z.object({
  start: z.string(),
  wordLength: z.number(),
});
export type LadderRushPuzzle = z.infer<typeof ladderRushPuzzleSchema>;
export const ladderRushPuzzlesSchema = z.array(ladderRushPuzzleSchema);

export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  passwordHash: z.string().nullable(),
  googleId: z.string().nullable(),
  emailVerified: z.boolean(),
  avatarUrl: z.string().nullable(),
  isAdmin: z.boolean(),
  isBanned: z.boolean(),
  isPremium: z.boolean(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const insertUserSchema = userSchema.omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;

export const publicUserSchema = userSchema.omit({ passwordHash: true });
export type PublicUser = z.infer<typeof publicUserSchema>;

export const emailVerificationTokenSchema = z.object({
  id: z.number(),
  userId: z.number(),
  token: z.string(),
  expiresAt: z.string(),
});
export type EmailVerificationToken = z.infer<typeof emailVerificationTokenSchema>;

export const passwordResetTokenSchema = z.object({
  id: z.number(),
  userId: z.number(),
  token: z.string(),
  expiresAt: z.string(),
});
export type PasswordResetToken = z.infer<typeof passwordResetTokenSchema>;

export const userGameStatsSchema = z.object({
  id: z.number(),
  userId: z.number(),
  gameSlug: z.string(),
  bestScore: z.number(),
  gamesPlayed: z.number(),
  gamesWon: z.number(),
  wordsFound: z.number(),
  lastPlayedAt: z.string(),
});
export type UserGameStats = z.infer<typeof userGameStatsSchema>;

export const insertUserGameStatsSchema = userGameStatsSchema.omit({ id: true });
export type InsertUserGameStats = z.infer<typeof insertUserGameStatsSchema>;

export const leaderboardEntrySchema = z.object({
  id: z.number(),
  userId: z.number(),
  gameSlug: z.string(),
  score: z.number(),
  playerName: z.string(),
  playerAvatarUrl: z.string().nullable().optional(),
  playedAt: z.string(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const insertLeaderboardEntrySchema = leaderboardEntrySchema.omit({ id: true, playerAvatarUrl: true });
export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;

export const userStreakSchema = z.object({
  id: z.number(),
  userId: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastPlayedDate: z.string(),
});
export type UserStreak = z.infer<typeof userStreakSchema>;

export const userAchievementSchema = z.object({
  id: z.number(),
  userId: z.number(),
  achievementId: z.string(),
  unlockedAt: z.string(),
});
export type UserAchievement = z.infer<typeof userAchievementSchema>;

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

export const challengeStatusSchema = z.enum(["pending", "completed"]);
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
  createdAt: z.string(),
  senderName: z.string().optional(),
  receiverName: z.string().optional(),
  senderAvatarUrl: z.string().nullable().optional(),
  receiverAvatarUrl: z.string().nullable().optional(),
});
export type FriendChallenge = z.infer<typeof friendChallengeSchema>;

export const insertFriendChallengeSchema = friendChallengeSchema.omit({ id: true, createdAt: true, senderName: true, receiverName: true, senderAvatarUrl: true, receiverAvatarUrl: true });
export type InsertFriendChallenge = z.infer<typeof insertFriendChallengeSchema>;

// ==================== GROUPS ====================

export const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  creatorId: z.number(),
  inviteCode: z.string(),
  isPublic: z.boolean(),
  isFeatured: z.boolean(),
  tags: z.array(z.string()).nullable(),
  pinnedAnnouncement: z.string().nullable(),
  createdAt: z.string(),
  memberCount: z.number().optional(),
});
export type Group = z.infer<typeof groupSchema>;
export const insertGroupSchema = groupSchema.omit({ id: true, createdAt: true, memberCount: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export const groupMemberSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  userId: z.number(),
  role: z.string(),
  joinedAt: z.string(),
});
export type GroupMember = z.infer<typeof groupMemberSchema>;

export const groupRoundSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  gameSlug: z.string(),
  seed: z.number(),
  status: z.string(),
  createdById: z.number(),
  closesAt: z.string().nullable(),
  gameConfig: z.string().nullable(),
  createdAt: z.string(),
});
export type GroupRound = z.infer<typeof groupRoundSchema>;
export const insertGroupRoundSchema = groupRoundSchema.omit({ id: true, createdAt: true });
export type InsertGroupRound = z.infer<typeof insertGroupRoundSchema>;

export const groupRoundScoreSchema = z.object({
  id: z.number(),
  roundId: z.number(),
  userId: z.number(),
  score: z.number(),
  durationMs: z.number().nullable(),
  completedAt: z.string(),
});
export type GroupRoundScore = z.infer<typeof groupRoundScoreSchema>;

export const groupScoreReactionSchema = z.object({
  id: z.number(),
  roundId: z.number(),
  scoreId: z.number(),
  userId: z.number(),
  emoji: z.string(),
  createdAt: z.string(),
});
export type GroupScoreReaction = z.infer<typeof groupScoreReactionSchema>;

export const groupRoundAttemptSchema = z.object({
  id: z.number(),
  roundId: z.number(),
  userId: z.number(),
  startedAt: z.string(),
});
export type GroupRoundAttempt = z.infer<typeof groupRoundAttemptSchema>;

export const dailyChallengeAttemptSchema = z.object({
  id: z.number(),
  userId: z.number(),
  challengeDate: z.string(),
  startedAt: z.string(),
});
export type DailyChallengeAttempt = z.infer<typeof dailyChallengeAttemptSchema>;

export const groupActivityEntrySchema = z.object({
  id: z.number(),
  groupId: z.number(),
  userId: z.number().nullable(),
  type: z.string(),
  metadata: z.record(z.any()),
  createdAt: z.string(),
  user: z.object({ id: z.number(), name: z.string(), avatarUrl: z.string().nullable() }).nullable().optional(),
});
export type GroupActivityEntry = z.infer<typeof groupActivityEntrySchema>;

// ==================== COMMENTS ====================

export const commentTargetTypeSchema = z.enum(["game", "group_round"]);
export type CommentTargetType = z.infer<typeof commentTargetTypeSchema>;

export type Comment = {
  id: number;
  targetType: CommentTargetType;
  targetId: string;
  userId: number;
  parentId: number | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  user?: { id: number; name: string; avatarUrl: string | null };
  replies?: Comment[];
  likeCount?: number;
  likedByMe?: boolean;
};

export const commentSchema: z.ZodType<Comment> = z.object({
  id: z.number(),
  targetType: commentTargetTypeSchema,
  targetId: z.string(),
  userId: z.number(),
  parentId: z.number().nullable(),
  content: z.string(),
  isDeleted: z.boolean(),
  createdAt: z.string(),
  user: z.object({ id: z.number(), name: z.string(), avatarUrl: z.string().nullable() }).optional(),
  replies: z.array(z.lazy(() => commentSchema)).optional(),
  likeCount: z.number().optional(),
  likedByMe: z.boolean().optional(),
});
export const insertCommentSchema = z.object({
  targetType: commentTargetTypeSchema,
  targetId: z.string(),
  userId: z.number(),
  parentId: z.number().nullable(),
  content: z.string(),
});
export type InsertComment = z.infer<typeof insertCommentSchema>;

export const commentReportSchema = z.object({
  id: z.number(),
  commentId: z.number(),
  reportingUserId: z.number(),
  reason: z.string(),
  createdAt: z.string(),
  comment: commentSchema.optional(),
  reporter: z.object({ id: z.number(), name: z.string() }).optional(),
});
export type CommentReport = z.infer<typeof commentReportSchema>;

// ==================== LIKES ====================

export const likeTargetTypeSchema = z.enum(["game", "comment"]);
export type LikeTargetType = z.infer<typeof likeTargetTypeSchema>;

// ==================== QUIZ MASTER ====================

export const quizSessionSchema = z.object({
  id: z.number(),
  creatorId: z.number(),
  gameSlug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  shareCode: z.string(),
  params: z.record(z.any()),
  closesAt: z.string().nullable(),
  createdAt: z.string(),
  creatorName: z.string().optional(),
  creatorAvatarUrl: z.string().nullable().optional(),
});
export type QuizSession = z.infer<typeof quizSessionSchema>;

export const insertQuizSessionSchema = quizSessionSchema.omit({ id: true, createdAt: true, creatorName: true, creatorAvatarUrl: true });
export type InsertQuizSession = z.infer<typeof insertQuizSessionSchema>;

export const quizSessionScoreSchema = z.object({
  id: z.number(),
  sessionId: z.number(),
  userId: z.number(),
  guestName: z.string().nullable(),
  score: z.number(),
  completedAt: z.string(),
  playerName: z.string().optional(),
  playerAvatarUrl: z.string().nullable().optional(),
});
export type QuizSessionScore = z.infer<typeof quizSessionScoreSchema>;

export const QUIZ_MASTER_GAME_SLUGS = new Set([
  "letter-hunt",
  "letter-frequency",
  "letter-position",
  "letter-balance",
  "letter-pool",
  "letter-dodge",
  "word-length",
  "definition-match",
  "word-roots",
  "progressive-reveal",
  "anagram-solver",
  "word-scramble",
]);

// ==================== DUELS ====================

/** Games supporting the turn-based format (including word-chain). */
export const DUEL_TURN_SLUGS = new Set([
  "word-chain",
  "letter-hunt",
  "word-length",
  "letter-frequency",
  "letter-position",
  "letter-balance",
  "letter-dodge",
  "ladder-rush-4",
  "ladder-rush-5",
  "ladder-rush-6",
  "ladder-rush-double-4",
  "ladder-rush-double-5",
  "ladder-rush-double-6",
]);

/** Games supporting the simultaneous race format (excludes word-chain). */
export const DUEL_RACE_SLUGS = new Set([
  "letter-hunt",
  "word-length",
  "letter-frequency",
  "letter-position",
  "letter-balance",
  "letter-dodge",
  "word-roots",
  "word-scramble",
  "no-repeats",
  "anagram-solver",
  "word-stack",
  "letter-pool",
  "word-maker",
  "word-split",
  "definition-match",
  "ladder-rush-4",
  "ladder-rush-5",
  "ladder-rush-6",
  "ladder-rush-double-4",
  "ladder-rush-double-5",
  "ladder-rush-double-6",
]);

/** Union of all duel-enabled games (both formats). */
export const DUEL_GAME_SLUGS = new Set([
  ...Array.from(DUEL_TURN_SLUGS),
  ...Array.from(DUEL_RACE_SLUGS),
]);

/** Picker option constants — shared by the client dialog UI and server-side validation. */
export const DUEL_HUNT_LETTERS = ["R", "T", "L", "S", "N", "M", "B", "D", "F", "G", "P", "C"] as const;
export const DUEL_WORD_LENGTHS = ["4", "5", "6", "7"] as const;
export const DUEL_POSITIONS = [2, 3, 4, 5] as const;
export const DUEL_BALANCE_CONSTRAINTS = ["2V", "3V", "4V", "2C", "3C", "4C"] as const;
export const DUEL_NO_REPEATS_LENGTHS = ["4", "5", "6", "7"] as const;
export const DUEL_DEFINITION_CATEGORIES = ["ANIMALS", "COLORS", "FOODS", "SPORTS", "SCIENCE"] as const;

export const duelChallengeStatusSchema = z.enum(["pending", "accepted", "declined", "cancelled", "expired", "completed"]);
export type DuelChallengeStatus = z.infer<typeof duelChallengeStatusSchema>;

export const duelChallengeSchema = z.object({
  id: z.number(),
  challengerId: z.number(),
  challengeeId: z.number().nullable(),
  gameSlug: z.string(),
  message: z.string().nullable(),
  status: duelChallengeStatusSchema,
  roomCode: z.string().nullable(),
  /** Persisted seed so restoreRoom is deterministic after process restart. */
  seed: z.number().nullable().optional(),
  startWord: z.string().nullable().optional(),
  /** "turn" or "race" — defaults to "turn" */
  format: z.enum(["turn", "race"]).optional().default("turn"),
  /** Target word count for race format */
  raceTarget: z.number().nullable().optional(),
  /** Race time limit in seconds */
  raceTimeLimit: z.number().nullable().optional(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  challengerName: z.string().optional(),
  challengeeName: z.string().optional(),
  challengerAvatarUrl: z.string().nullable().optional(),
  challengeeAvatarUrl: z.string().nullable().optional(),
});
export type DuelChallenge = z.infer<typeof duelChallengeSchema>;

export const insertDuelChallengeSchema = duelChallengeSchema
  .omit({
    id: true,
    createdAt: true,
    challengerName: true,
    challengeeName: true,
    challengerAvatarUrl: true,
    challengeeAvatarUrl: true,
  })
  .extend({ roomCode: z.string().nullable().optional() });
export type InsertDuelChallenge = z.infer<typeof insertDuelChallengeSchema>;

export const duelSessionOutcomeSchema = z.enum([
  "player1_wins",
  "player2_wins",
  "draw",
  "forfeit_player1",
  "forfeit_player2",
]);
export type DuelSessionOutcome = z.infer<typeof duelSessionOutcomeSchema>;

export const duelSessionSchema = z.object({
  id: z.number(),
  roomCode: z.string(),
  challengeId: z.number().nullable(),
  player1Id: z.number(),
  player2Id: z.number(),
  gameSlug: z.string(),
  seed: z.number(),
  format: z.enum(["turn", "race"]).optional().default("turn"),
  /** Target word count for race sessions (null for turn-based). */
  raceTarget: z.number().nullable().optional(),
  /** Race time limit in seconds (null for turn-based). */
  raceTimeLimit: z.number().nullable().optional(),
  outcome: duelSessionOutcomeSchema.nullable(),
  eloDeltaPlayer1: z.number().nullable(),
  eloDeltaPlayer2: z.number().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type DuelSession = z.infer<typeof duelSessionSchema>;

export const insertDuelSessionSchema = duelSessionSchema.omit({ id: true });
export type InsertDuelSession = z.infer<typeof insertDuelSessionSchema>;

export const duelRatingSchema = z.object({
  id: z.number(),
  userId: z.number(),
  elo: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  updatedAt: z.string(),
});
export type DuelRating = z.infer<typeof duelRatingSchema>;

// ==================== HUDDLE (GROUP vs GROUP) ====================

export const huddleChallengeStatusSchema = z.enum(["pending", "accepted", "declined", "cancelled", "completed"]);
export type HuddleChallengeStatus = z.infer<typeof huddleChallengeStatusSchema>;

export const huddleChallengeSchema = z.object({
  id: z.number(),
  challengerGroupId: z.number(),
  challengeeGroupId: z.number(),
  /** User who created the challenge (typist for challenger group) */
  challengerAdminId: z.number(),
  /** User who accepted (typist for challengee group) */
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

// ==================== NOTIFICATIONS ====================

export const notificationTypeSchema = z.enum([
  "group_join",
  "comment_reply",
  "group_round_start",
  "duel_accepted",
  "duel_challenge_received",
  "friend_challenge_result",
  "huddle_challenge_received",
  "huddle_accepted",
  "word_war_matched",
  "word_war_round_start",
  "word_war_champion",
  "word_war_cancelled",
  "guild_war_matched",
  "guild_war_round_start",
  "guild_war_champion",
  "guild_war_cancelled",
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

// ==================== NOTIFICATION PREFERENCES ====================

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
  friend_challenge_result: "Friend challenge results",
  huddle_challenge_received: "Your group was challenged to a Huddle",
  huddle_accepted: "Group Huddle challenge accepted",
  word_war_matched: "Word Wars — Your opponent awaits",
  word_war_round_start: "Word Wars — Battle begins now",
  word_war_champion: "Word Wars — You are champion",
  word_war_cancelled: "Word Wars — Tournament cancelled",
  guild_war_matched: "Guild Wars — Your group has been matched",
  guild_war_round_start: "Guild Wars — Battle begins now",
  guild_war_champion: "Guild Wars — Your group is champion",
  guild_war_cancelled: "Guild Wars — Tournament cancelled",
};

// ==================== WORD WARS ====================

/** All duel game slugs eligible for use in Word Wars matches. */
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

// ==================== WORD WARS CHAMPIONS ====================

export const wordWarsChampionSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  userId: z.number(),
  createdAt: z.string(),
});
export type WordWarsChampion = z.infer<typeof wordWarsChampionSchema>;

// ==================== GUILD WARS ====================

export const guildWarsTournamentStatusSchema = z.enum(["registration", "active", "completed", "cancelled"]);
export type GuildWarsTournamentStatus = z.infer<typeof guildWarsTournamentStatusSchema>;

export const guildWarsTournamentSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: guildWarsTournamentStatusSchema,
  registrationDeadline: z.string(),
  roundDeadlineHours: z.number(),
  minGroups: z.number(),
  maxGroups: z.number().nullable(),
  createdBy: z.number(),
  createdAt: z.string(),
});
export type GuildWarsTournament = z.infer<typeof guildWarsTournamentSchema>;

export const insertGuildWarsTournamentSchema = guildWarsTournamentSchema.omit({ id: true, createdAt: true, status: true });
export type InsertGuildWarsTournament = z.infer<typeof insertGuildWarsTournamentSchema>;

export const guildWarsRegistrationSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  groupId: z.number(),
  registeredBy: z.number(),
  createdAt: z.string(),
});
export type GuildWarsRegistration = z.infer<typeof guildWarsRegistrationSchema>;
export const insertGuildWarsRegistrationSchema = guildWarsRegistrationSchema.omit({ id: true, createdAt: true });
export type InsertGuildWarsRegistration = z.infer<typeof insertGuildWarsRegistrationSchema>;

export const guildWarsMatchStatusSchema = z.enum(["pending", "active", "completed", "forfeited", "bye"]);
export type GuildWarsMatchStatus = z.infer<typeof guildWarsMatchStatusSchema>;

export const guildWarsMatchSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  round: z.number(),
  group1Id: z.number().nullable(),
  group2Id: z.number().nullable(),
  winnerGroupId: z.number().nullable(),
  status: guildWarsMatchStatusSchema,
  deadline: z.string().nullable(),
  game1Slug: z.string(),
  game2Slug: z.string(),
  game3Slug: z.string(),
  createdAt: z.string(),
});
export type GuildWarsMatch = z.infer<typeof guildWarsMatchSchema>;
export const insertGuildWarsMatchSchema = guildWarsMatchSchema.omit({ id: true, createdAt: true });
export type InsertGuildWarsMatch = z.infer<typeof insertGuildWarsMatchSchema>;

export const guildWarsMatchGameStatusSchema = z.enum(["pending", "active", "completed"]);
export type GuildWarsMatchGameStatus = z.infer<typeof guildWarsMatchGameStatusSchema>;

export const guildWarsMatchGameSchema = z.object({
  id: z.number(),
  matchId: z.number(),
  gameNumber: z.number(),
  gameSlug: z.string(),
  roomCode: z.string().nullable(),
  winnerGroupId: z.number().nullable(),
  status: guildWarsMatchGameStatusSchema,
});
export type GuildWarsMatchGame = z.infer<typeof guildWarsMatchGameSchema>;
export const insertGuildWarsMatchGameSchema = guildWarsMatchGameSchema.omit({ id: true });
export type InsertGuildWarsMatchGame = z.infer<typeof insertGuildWarsMatchGameSchema>;

export const guildWarsChampionSchema = z.object({
  id: z.number(),
  tournamentId: z.number(),
  groupId: z.number(),
  tournamentName: z.string(),
  createdAt: z.string(),
});
export type GuildWarsChampion = z.infer<typeof guildWarsChampionSchema>;
export const insertGuildWarsChampionSchema = guildWarsChampionSchema.omit({ id: true, createdAt: true });
export type InsertGuildWarsChampion = z.infer<typeof insertGuildWarsChampionSchema>;

// ==================== CHALLENGES ====================

export const SEEDED_GAME_SLUGS = new Set([
  "anagram-solver",
  "deep-shell-words",
  "definition-match",
  "ladder-rush",
  "letter-balance",
  "letter-dodge",
  "letter-frequency",
  "letter-hunt",
  "letter-pool",
  "letter-position",
  "no-repeats",
  "shell-words",
  "word-bloom",
  "word-chain",
  "word-ladder",
  "word-length",
  "word-maker",
  "word-roots",
  "word-scramble",
  "word-split",
  "word-stack",
  "word-stretch",
  "word-sweep",
]);
