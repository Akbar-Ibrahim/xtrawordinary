import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

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

// Definition Match words (word + definition)
export const definitionWordSchema = z.object({
  word: z.string(),
  definition: z.string(),
  partOfSpeech: z.string(),
  synonyms: z.array(z.string()).optional(),
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

// Word Ladder puzzle
export const wordLadderPuzzleSchema = z.object({
  start: z.string(),
  target: z.string(),
  par: z.number(),
  optimalPaths: z.array(z.array(z.string())),
});
export type WordLadderPuzzle = z.infer<typeof wordLadderPuzzleSchema>;
export const wordLadderPuzzlesSchema = z.array(wordLadderPuzzleSchema);

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
  playedAt: z.string(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const insertLeaderboardEntrySchema = leaderboardEntrySchema.omit({ id: true });
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
  createdAt: z.string(),
});
export type FriendChallenge = z.infer<typeof friendChallengeSchema>;

export const insertFriendChallengeSchema = friendChallengeSchema.omit({ id: true, createdAt: true });
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
