import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordRootsPuzzle, WordLengthConfig, LetterPositionConfig, LetterHuntConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid, WordLadderPuzzle, LadderRushPuzzle, User, InsertUser, EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement, Friendship, InsertFriendship, FriendChallenge, InsertFriendChallenge, Group, InsertGroup, GroupMember, GroupRound, InsertGroupRound, GroupRoundScore, GroupScoreReaction, GroupActivityEntry, GroupRoundAttempt, DailyChallengeAttempt } from "@shared/schema";

export type LengthConstraint = {
  length: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

export type PositionConstraint = {
  position: number;
  letter: string;
};

export type ContainsConstraint = {
  letters: string[];
};

export interface IStorage {
  getGames(): Promise<Game[]>;
  getAllGames(): Promise<Game[]>;
  setGameActive(slug: string, isActive: boolean): Promise<void>;
  getGameBySlug(slug: string): Promise<Game | undefined>;
  getWordLadderPuzzles(): Promise<WordLadderPuzzle[]>;
  getLadderRushPuzzles(wordLength: number): Promise<LadderRushPuzzle[]>;
  getAnagramWordSets(): Promise<AnagramWordSet[]>;
  getScrambleWords(): Promise<ScrambleWord[]>;
  getDefinitionWords(): Promise<DefinitionWord[]>;
  getLetterPoolWords(): Promise<LetterPoolWord[]>;
  getMakerWords(): Promise<MakerWord[]>;
  getWordRootsPuzzles(): Promise<WordRootsPuzzle[]>;
  getWordStackPuzzles(): Promise<WordStackPuzzle[]>;
  getWordSplitPuzzles(): Promise<WordSplitPuzzle[]>;
  getWordDictionary(): Promise<string[]>;
  validateWord(word: string): Promise<boolean>;
  getWordLengthConfig(): Promise<WordLengthConfig>;
  getLetterPositionConfig(): Promise<LetterPositionConfig>;
  getLetterHuntConfig(): Promise<LetterHuntConfig>;
  getWordChainConfig(): Promise<WordChainConfig>;
  getVowelConsonantConfig(): Promise<VowelConsonantConfig>;
  generateLengthConstraint(level: number): Promise<LengthConstraint>;
  generatePositionConstraint(): Promise<PositionConstraint>;
  generateContainsConstraint(): Promise<ContainsConstraint>;
  getWordChainStartWord(variation: number, level: number): Promise<string | null>;
  getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null>;
  getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]>;
  generateWordSweepGrid(seed?: number): Promise<WordSweepGrid>;

  createUser(user: InsertUser): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;

  createEmailVerificationToken(userId: number, token: string, expiresAt: string): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationToken(token: string): Promise<void>;

  createPasswordResetToken(userId: number, token: string, expiresAt: string): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deletePasswordResetToken(token: string): Promise<void>;

  saveUserGameStats(stats: InsertUserGameStats): Promise<UserGameStats>;
  getUserGameStats(userId: number, gameSlug: string): Promise<UserGameStats | undefined>;
  getAllUserGameStats(userId: number): Promise<UserGameStats[]>;

  saveLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;
  getLeaderboard(gameSlug: string, limit?: number): Promise<LeaderboardEntry[]>;
  getOverallLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;

  getUserStreak(userId: number): Promise<UserStreak | undefined>;
  saveUserStreak(userId: number, currentStreak: number, longestStreak: number, lastPlayedDate: string): Promise<UserStreak>;

  getUserAchievements(userId: number): Promise<UserAchievement[]>;
  saveUserAchievement(userId: number, achievementId: string, unlockedAt: string): Promise<UserAchievement>;

  getAllUsers(): Promise<User[]>;
  deleteLeaderboardEntry(id: number): Promise<void>;
  getAdminStats(): Promise<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }>;
  getAllLeaderboardEntries(): Promise<LeaderboardEntry[]>;

  searchUsers(query: string): Promise<Array<{ id: number; name: string; avatarUrl: string | null }>>;
  getPublicProfile(userId: number): Promise<{ user: { id: number; name: string; avatarUrl: string | null; createdAt: string }; stats: UserGameStats[]; achievements: UserAchievement[]; leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }> } | null>;

  getFriendshipById(id: number): Promise<Friendship | undefined>;
  sendFriendRequest(requesterId: number, addresseeId: number): Promise<Friendship>;
  acceptFriendRequest(id: number): Promise<Friendship | undefined>;
  declineFriendRequest(id: number): Promise<Friendship | undefined>;
  removeFriend(id: number): Promise<void>;
  getFriends(userId: number): Promise<Array<Friendship & { friendUser: { id: number; name: string; avatarUrl: string | null } }>>;
  getPendingFriendRequests(userId: number): Promise<Array<Friendship & { requesterUser: { id: number; name: string; avatarUrl: string | null } }>>;
  getFriendship(userId1: number, userId2: number): Promise<Friendship | undefined>;

  createFriendChallenge(challenge: InsertFriendChallenge): Promise<FriendChallenge>;
  getFriendChallenges(userId: number): Promise<FriendChallenge[]>;
  getFriendChallenge(id: number): Promise<FriendChallenge | undefined>;
  completeFriendChallenge(id: number, score: number): Promise<FriendChallenge | undefined>;

  // Groups
  createGroup(group: InsertGroup): Promise<Group>;
  getGroup(id: number): Promise<Group | undefined>;
  getGroupByInviteCode(code: string): Promise<Group | undefined>;
  updateGroup(id: number, updates: Partial<Pick<Group, "name" | "description" | "isPublic" | "tags" | "pinnedAnnouncement" | "isFeatured">>): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<void>;
  getUserGroups(userId: number): Promise<Group[]>;
  getPublicGroups(): Promise<Group[]>;
  getAllGroups(): Promise<Group[]>;
  setGroupFeatured(groupId: number, isFeatured: boolean): Promise<Group | undefined>;

  addGroupMember(groupId: number, userId: number, role: string): Promise<GroupMember>;
  removeGroupMember(groupId: number, userId: number): Promise<void>;
  getGroupMembers(groupId: number): Promise<Array<GroupMember & { user: { id: number; name: string; avatarUrl: string | null } }>>;
  getGroupMember(groupId: number, userId: number): Promise<GroupMember | undefined>;
  updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<GroupMember | undefined>;

  createGroupRound(round: InsertGroupRound): Promise<GroupRound>;
  getGroupRound(id: number): Promise<GroupRound | undefined>;
  getGroupRounds(groupId: number): Promise<GroupRound[]>;
  closeGroupRound(id: number): Promise<GroupRound | undefined>;

  submitGroupRoundScore(roundId: number, userId: number, score: number, durationMs?: number): Promise<GroupRoundScore>;
  getGroupRoundScores(roundId: number): Promise<Array<GroupRoundScore & { user: { id: number; name: string; avatarUrl: string | null } }>>;
  getUserGroupRoundScore(roundId: number, userId: number): Promise<GroupRoundScore | undefined>;
  getGroupLeaderboard(groupId: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; totalScore: number; roundsPlayed: number }>>;

  addGroupReaction(roundId: number, scoreId: number, userId: number, emoji: string): Promise<GroupScoreReaction>;
  removeGroupReaction(roundId: number, scoreId: number, userId: number, emoji: string): Promise<void>;
  getGroupRoundReactions(roundId: number): Promise<GroupScoreReaction[]>;

  logGroupActivity(groupId: number, userId: number | null, type: string, metadata?: Record<string, any>): Promise<void>;
  getGroupActivity(groupId: number, limit?: number): Promise<GroupActivityEntry[]>;

  // Attempt tracking
  createGroupRoundAttempt(roundId: number, userId: number): Promise<GroupRoundAttempt>;
  getGroupRoundAttempt(roundId: number, userId: number): Promise<GroupRoundAttempt | undefined>;
  createDailyChallengeAttempt(userId: number, challengeDate: string): Promise<DailyChallengeAttempt>;
  getDailyChallengeAttempt(userId: number, challengeDate: string): Promise<DailyChallengeAttempt | undefined>;
}

export { MemStorage } from "./mem-storage";

let _storage: IStorage | null = null;

export function getStorage(): IStorage {
  if (!_storage) {
    throw new Error("Storage not initialized. Call initStorage() first.");
  }
  return _storage;
}

export async function initStorage(): Promise<IStorage> {
  if (_storage) return _storage;
  
  if (process.env.MYSQL_DATABASE_URL) {
    console.log("[Storage] Using MySQL storage");
    const { MySQLStorage } = await import("./mysql-storage");
    _storage = new MySQLStorage();
  } else {
    console.log("[Storage] Using in-memory storage");
    const { MemStorage } = await import("./mem-storage");
    _storage = new MemStorage();
  }
  return _storage;
}

export const storage: IStorage = new Proxy({} as IStorage, {
  get(_target, prop) {
    const s = _storage;
    if (!s) {
      throw new Error(`Storage not initialized when accessing '${String(prop)}'. Call initStorage() first.`);
    }
    const val = (s as any)[prop];
    if (typeof val === "function") {
      return val.bind(s);
    }
    return val;
  }
});
