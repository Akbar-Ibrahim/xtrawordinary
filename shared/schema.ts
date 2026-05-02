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

export const duelChallengeStatusSchema = z.enum(["pending", "accepted", "declined", "cancelled", "expired"]);
export type DuelChallengeStatus = z.infer<typeof duelChallengeStatusSchema>;

export const duelChallengeSchema = z.object({
  id: z.number(),
  challengerId: z.number(),
  challengeeId: z.number(),
  gameSlug: z.string(),
  message: z.string().nullable(),
  status: duelChallengeStatusSchema,
  roomCode: z.string().nullable(),
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
  "shell-words",
  "word-bloom",
  "word-ladder",
  "word-length",
  "word-maker",
  "word-roots",
  "word-scramble",
  "word-stretch",
  "word-sweep",
]);
