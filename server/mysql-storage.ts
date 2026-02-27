import { eq, desc, sql, and } from "drizzle-orm";
import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordLengthConfig, LetterPositionConfig, ContainsConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid, WordLadderPuzzle, User, InsertUser, EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement } from "@shared/schema";
import type { IStorage, LengthConstraint, PositionConstraint, ContainsConstraint } from "./storage";
import { MemStorage } from "./mem-storage";
import * as schema from "./db-schema";

export class MySQLStorage implements IStorage {
  private gameData: MemStorage;
  private dbPromise: Promise<any>;

  constructor() {
    this.gameData = new MemStorage();
    if (!process.env.MYSQL_DATABASE_URL) {
      throw new Error("MYSQL_DATABASE_URL is required");
    }
    this.dbPromise = import("./db").then(m => m.db);
  }

  private async getDb() {
    return this.dbPromise;
  }

  private mapDbRowToGame(row: typeof schema.games.$inferSelect): Game {
    let rules: string[];
    if (typeof row.rules === "string") {
      rules = JSON.parse(row.rules);
    } else if (Array.isArray(row.rules)) {
      rules = row.rules;
    } else {
      rules = [];
    }

    const validDifficulties = ["easy", "medium", "hard"] as const;
    const difficulty = validDifficulties.includes(row.difficulty as any)
      ? (row.difficulty as Game["difficulty"])
      : "medium";

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      longDescription: row.longDescription,
      rules,
      difficulty,
      estimatedTime: row.estimatedTime,
      icon: row.icon,
      color: row.color,
      playCount: row.playCount,
    };
  }

  async getGames(): Promise<Game[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.games);
    return rows.map((row: typeof schema.games.$inferSelect) => this.mapDbRowToGame(row));
  }

  async getGameBySlug(slug: string): Promise<Game | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.games).where(eq(schema.games.slug, slug));
    if (rows.length === 0) return undefined;
    return this.mapDbRowToGame(rows[0]);
  }
  async getWordLadderPuzzles(): Promise<WordLadderPuzzle[]> { return this.gameData.getWordLadderPuzzles(); }
  async getAnagramWordSets(): Promise<AnagramWordSet[]> { return this.gameData.getAnagramWordSets(); }
  async getScrambleWords(): Promise<ScrambleWord[]> { return this.gameData.getScrambleWords(); }
  async getDefinitionWords(): Promise<DefinitionWord[]> { return this.gameData.getDefinitionWords(); }
  async getLetterPoolWords(): Promise<LetterPoolWord[]> { return this.gameData.getLetterPoolWords(); }
  async getMakerWords(): Promise<MakerWord[]> { return this.gameData.getMakerWords(); }
  async getWordStackPuzzles(): Promise<WordStackPuzzle[]> { return this.gameData.getWordStackPuzzles(); }
  async getWordSplitPuzzles(): Promise<WordSplitPuzzle[]> { return this.gameData.getWordSplitPuzzles(); }
  async getWordDictionary(): Promise<string[]> { return this.gameData.getWordDictionary(); }
  async validateWord(word: string): Promise<boolean> { return this.gameData.validateWord(word); }
  async getWordLengthConfig(): Promise<WordLengthConfig> { return this.gameData.getWordLengthConfig(); }
  async getLetterPositionConfig(): Promise<LetterPositionConfig> { return this.gameData.getLetterPositionConfig(); }
  async getContainsConfig(): Promise<ContainsConfig> { return this.gameData.getContainsConfig(); }
  async getWordChainConfig(): Promise<WordChainConfig> { return this.gameData.getWordChainConfig(); }
  async getVowelConsonantConfig(): Promise<VowelConsonantConfig> { return this.gameData.getVowelConsonantConfig(); }
  async generateLengthConstraint(level: number): Promise<LengthConstraint> { return this.gameData.generateLengthConstraint(level); }
  async generatePositionConstraint(): Promise<PositionConstraint> { return this.gameData.generatePositionConstraint(); }
  async generateContainsConstraint(): Promise<ContainsConstraint> { return this.gameData.generateContainsConstraint(); }
  async getWordChainStartWord(variation: number, level: number): Promise<string | null> { return this.gameData.getWordChainStartWord(variation, level); }
  async getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null> { return this.gameData.getWordChainComputerWord(playerWord, variation, level, usedWords); }
  async getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]> { return this.gameData.getProgressiveRevealWords(); }
  async generateWordSweepGrid(): Promise<WordSweepGrid> { return this.gameData.generateWordSweepGrid(); }

  private toUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.passwordHash || null,
      googleId: row.googleId || null,
      emailVerified: !!row.emailVerified,
      avatarUrl: row.avatarUrl || null,
      isAdmin: !!row.isAdmin,
      isBanned: !!row.isBanned,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  async createUser(user: InsertUser): Promise<User> {
    const db = await this.getDb();
    const result = await db.insert(schema.users).values({
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      googleId: user.googleId,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin ?? false,
      isBanned: user.isBanned ?? false,
    });
    const id = result[0].insertId;
    const created = await this.getUserById(id);
    return created!;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return rows[0] ? this.toUser(rows[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return rows[0] ? this.toUser(rows[0]) : undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.users).where(eq(schema.users.googleId, googleId)).limit(1);
    return rows[0] ? this.toUser(rows[0]) : undefined;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const db = await this.getDb();
    const dbUpdates: any = {};
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.passwordHash !== undefined) dbUpdates.passwordHash = updates.passwordHash;
    if (updates.googleId !== undefined) dbUpdates.googleId = updates.googleId;
    if (updates.emailVerified !== undefined) dbUpdates.emailVerified = updates.emailVerified;
    if (updates.avatarUrl !== undefined) dbUpdates.avatarUrl = updates.avatarUrl;
    if (updates.isAdmin !== undefined) dbUpdates.isAdmin = updates.isAdmin;
    if (updates.isBanned !== undefined) dbUpdates.isBanned = updates.isBanned;
    await db.update(schema.users).set(dbUpdates).where(eq(schema.users.id, id));
    return this.getUserById(id);
  }

  async createEmailVerificationToken(userId: number, token: string, expiresAt: string): Promise<EmailVerificationToken> {
    const db = await this.getDb();
    const result = await db.insert(schema.emailVerificationTokens).values({
      userId, token, expiresAt: new Date(expiresAt),
    });
    return { id: result[0].insertId, userId, token, expiresAt };
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.emailVerificationTokens).where(eq(schema.emailVerificationTokens.token, token)).limit(1);
    if (!rows[0]) return undefined;
    return { id: rows[0].id, userId: rows[0].userId, token: rows[0].token, expiresAt: rows[0].expiresAt instanceof Date ? rows[0].expiresAt.toISOString() : String(rows[0].expiresAt) };
  }

  async deleteEmailVerificationToken(token: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.emailVerificationTokens).where(eq(schema.emailVerificationTokens.token, token));
  }

  async createPasswordResetToken(userId: number, token: string, expiresAt: string): Promise<PasswordResetToken> {
    const db = await this.getDb();
    const result = await db.insert(schema.passwordResetTokens).values({
      userId, token, expiresAt: new Date(expiresAt),
    });
    return { id: result[0].insertId, userId, token, expiresAt };
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.token, token)).limit(1);
    if (!rows[0]) return undefined;
    return { id: rows[0].id, userId: rows[0].userId, token: rows[0].token, expiresAt: rows[0].expiresAt instanceof Date ? rows[0].expiresAt.toISOString() : String(rows[0].expiresAt) };
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.token, token));
  }

  async saveUserGameStats(stats: InsertUserGameStats): Promise<UserGameStats> {
    const db = await this.getDb();
    const existing = await this.getUserGameStats(stats.userId, stats.gameSlug);
    if (existing) {
      await db.update(schema.userGameStats).set({
        bestScore: stats.bestScore,
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        wordsFound: stats.wordsFound,
        lastPlayedAt: new Date(stats.lastPlayedAt),
      }).where(eq(schema.userGameStats.id, existing.id));
      return { ...existing, ...stats };
    }
    const result = await db.insert(schema.userGameStats).values({
      userId: stats.userId,
      gameSlug: stats.gameSlug,
      bestScore: stats.bestScore,
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      wordsFound: stats.wordsFound,
      lastPlayedAt: new Date(stats.lastPlayedAt),
    });
    return { ...stats, id: result[0].insertId };
  }

  async getUserGameStats(userId: number, gameSlug: string): Promise<UserGameStats | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.userGameStats)
      .where(and(eq(schema.userGameStats.userId, userId), eq(schema.userGameStats.gameSlug, gameSlug)))
      .limit(1);
    if (!rows[0]) return undefined;
    const r = rows[0];
    return { id: r.id, userId: r.userId, gameSlug: r.gameSlug, bestScore: r.bestScore, gamesPlayed: r.gamesPlayed, gamesWon: r.gamesWon, wordsFound: r.wordsFound, lastPlayedAt: r.lastPlayedAt instanceof Date ? r.lastPlayedAt.toISOString() : String(r.lastPlayedAt) };
  }

  async getAllUserGameStats(userId: number): Promise<UserGameStats[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.userGameStats).where(eq(schema.userGameStats.userId, userId));
    return rows.map((r: any) => ({ id: r.id, userId: r.userId, gameSlug: r.gameSlug, bestScore: r.bestScore, gamesPlayed: r.gamesPlayed, gamesWon: r.gamesWon, wordsFound: r.wordsFound, lastPlayedAt: r.lastPlayedAt instanceof Date ? r.lastPlayedAt.toISOString() : String(r.lastPlayedAt) }));
  }

  async saveLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
    const db = await this.getDb();
    const result = await db.insert(schema.leaderboardEntries).values({
      userId: entry.userId,
      gameSlug: entry.gameSlug,
      score: entry.score,
      playerName: entry.playerName,
      playedAt: new Date(entry.playedAt),
    });
    return { ...entry, id: result[0].insertId };
  }

  async getLeaderboard(gameSlug: string, limit = 50): Promise<LeaderboardEntry[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.leaderboardEntries)
      .where(eq(schema.leaderboardEntries.gameSlug, gameSlug))
      .orderBy(desc(schema.leaderboardEntries.score))
      .limit(limit);
    return rows.map((r: any) => ({ id: r.id, userId: r.userId, gameSlug: r.gameSlug, score: r.score, playerName: r.playerName, playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt) }));
  }

  async getOverallLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.leaderboardEntries);
    const playerTotals = new Map<number, { userId: number; playerName: string; score: number; playedAt: string }>();
    for (const entry of rows) {
      const playedAt = entry.playedAt instanceof Date ? entry.playedAt.toISOString() : String(entry.playedAt);
      const existing = playerTotals.get(entry.userId);
      if (existing) {
        existing.score += entry.score;
        if (playedAt > existing.playedAt) existing.playedAt = playedAt;
      } else {
        playerTotals.set(entry.userId, { userId: entry.userId, playerName: entry.playerName, score: entry.score, playedAt });
      }
    }
    return Array.from(playerTotals.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((p, i) => ({ id: i + 1, ...p, gameSlug: "overall" }));
  }

  async getUserStreak(userId: number): Promise<UserStreak | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.userStreaks).where(eq(schema.userStreaks.userId, userId)).limit(1);
    if (!rows[0]) return undefined;
    const r = rows[0];
    return { id: r.id, userId: r.userId, currentStreak: r.currentStreak, longestStreak: r.longestStreak, lastPlayedDate: r.lastPlayedDate };
  }

  async saveUserStreak(userId: number, currentStreak: number, longestStreak: number, lastPlayedDate: string): Promise<UserStreak> {
    const db = await this.getDb();
    const existing = await this.getUserStreak(userId);
    if (existing) {
      await db.update(schema.userStreaks).set({ currentStreak, longestStreak, lastPlayedDate }).where(eq(schema.userStreaks.userId, userId));
      return { ...existing, currentStreak, longestStreak, lastPlayedDate };
    }
    const result = await db.insert(schema.userStreaks).values({ userId, currentStreak, longestStreak, lastPlayedDate });
    return { id: result[0].insertId, userId, currentStreak, longestStreak, lastPlayedDate };
  }

  async getUserAchievements(userId: number): Promise<UserAchievement[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.userAchievements).where(eq(schema.userAchievements.userId, userId));
    return rows.map((r: any) => ({ id: r.id, userId: r.userId, achievementId: r.achievementId, unlockedAt: r.unlockedAt instanceof Date ? r.unlockedAt.toISOString() : String(r.unlockedAt) }));
  }

  async saveUserAchievement(userId: number, achievementId: string, unlockedAt: string): Promise<UserAchievement> {
    const db = await this.getDb();
    const existing = await db.select().from(schema.userAchievements)
      .where(and(eq(schema.userAchievements.userId, userId), eq(schema.userAchievements.achievementId, achievementId)))
      .limit(1);
    if (existing[0]) {
      const r = existing[0];
      return { id: r.id, userId: r.userId, achievementId: r.achievementId, unlockedAt: r.unlockedAt instanceof Date ? r.unlockedAt.toISOString() : String(r.unlockedAt) };
    }
    const result = await db.insert(schema.userAchievements).values({ userId, achievementId, unlockedAt: new Date(unlockedAt) });
    return { id: result[0].insertId, userId, achievementId, unlockedAt };
  }

  async getAllUsers(): Promise<User[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
    return rows.map((r: any) => this.toUser(r));
  }

  async deleteLeaderboardEntry(id: number): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.leaderboardEntries).where(eq(schema.leaderboardEntries.id, id));
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }> {
    const db = await this.getDb();
    const usersCount = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const statsRows = await db.select().from(schema.userGameStats);
    let totalGamesPlayed = 0;
    const gamesPerSlug: Record<string, number> = {};
    for (const row of statsRows) {
      totalGamesPlayed += row.gamesPlayed;
      gamesPerSlug[row.gameSlug] = (gamesPerSlug[row.gameSlug] || 0) + row.gamesPlayed;
    }
    return { totalUsers: Number(usersCount[0]?.count || 0), totalGamesPlayed, gamesPerSlug };
  }

  async getAllLeaderboardEntries(): Promise<LeaderboardEntry[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.leaderboardEntries).orderBy(desc(schema.leaderboardEntries.playedAt));
    return rows.map((r: any) => ({ id: r.id, userId: r.userId, gameSlug: r.gameSlug, score: r.score, playerName: r.playerName, playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt) }));
  }
}
