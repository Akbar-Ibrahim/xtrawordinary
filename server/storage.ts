import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordLengthConfig, LetterPositionConfig, ContainsConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid, WordLadderPuzzle, User, InsertUser, EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement } from "@shared/schema";

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
  getGameBySlug(slug: string): Promise<Game | undefined>;
  getWordLadderPuzzles(): Promise<WordLadderPuzzle[]>;
  getAnagramWordSets(): Promise<AnagramWordSet[]>;
  getScrambleWords(): Promise<ScrambleWord[]>;
  getDefinitionWords(): Promise<DefinitionWord[]>;
  getLetterPoolWords(): Promise<LetterPoolWord[]>;
  getMakerWords(): Promise<MakerWord[]>;
  getWordStackPuzzles(): Promise<WordStackPuzzle[]>;
  getWordSplitPuzzles(): Promise<WordSplitPuzzle[]>;
  getWordDictionary(): Promise<string[]>;
  validateWord(word: string): Promise<boolean>;
  getWordLengthConfig(): Promise<WordLengthConfig>;
  getLetterPositionConfig(): Promise<LetterPositionConfig>;
  getContainsConfig(): Promise<ContainsConfig>;
  getWordChainConfig(): Promise<WordChainConfig>;
  getVowelConsonantConfig(): Promise<VowelConsonantConfig>;
  generateLengthConstraint(level: number): Promise<LengthConstraint>;
  generatePositionConstraint(): Promise<PositionConstraint>;
  generateContainsConstraint(): Promise<ContainsConstraint>;
  getWordChainStartWord(variation: number, level: number): Promise<string | null>;
  getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null>;
  getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]>;
  generateWordSweepGrid(): Promise<WordSweepGrid>;

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
