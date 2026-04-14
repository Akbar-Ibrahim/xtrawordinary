import { eq, desc, asc, sql, and, or, like, inArray } from "drizzle-orm";
import type { Game, GameMode, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordRootsPuzzle, WordLengthConfig, LetterPositionConfig, LetterHuntConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid, WordUnpackPuzzle, WordLadderPuzzle, LadderRushPuzzle, User, InsertUser, EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement, Friendship, InsertFriendship, FriendChallenge, InsertFriendChallenge, Group, InsertGroup, GroupMember, GroupRound, InsertGroupRound, GroupRoundScore, GroupScoreReaction, GroupActivityEntry, GroupRoundAttempt, DailyChallengeAttempt } from "@shared/schema";
import type { IStorage, LengthConstraint, PositionConstraint, ContainsConstraint } from "./storage";
import { MemStorage } from "./mem-storage";
import * as schema from "./db-schema";

export class MySQLStorage implements IStorage {
  private gameData: MemStorage;
  private dbPromise: Promise<any>;
  private wordSet: Set<string> = new Set();

  constructor() {
    this.gameData = new MemStorage();
    if (!process.env.MYSQL_DATABASE_URL) {
      throw new Error("MYSQL_DATABASE_URL is required");
    }
    this.dbPromise = import("./db").then(async (m) => {
      const db = m.db;
      const rows = await db.select({ word: schema.words.word }).from(schema.words);
      for (const row of rows) {
        this.wordSet.add(row.word.toUpperCase());
      }
      console.log(`[MySQLStorage] Loaded ${this.wordSet.size} words into Set from MySQL`);
      return db;
    });
  }

  private async getDb() {
    return this.dbPromise;
  }

  private static readonly GAME_MODES: Record<string, GameMode[]> = {
    "word-sweep": [
      { label: "Classic", slug: "word-sweep" },
      { label: "Guided", slug: "word-unpack" },
    ],
    "ladder-rush": [
      { label: "Easy (4L)", slug: "ladder-rush-4" },
      { label: "Medium (5L)", slug: "ladder-rush-5" },
      { label: "Hard (6L)", slug: "ladder-rush-6" },
    ],
    "ladder-rush-double": [
      { label: "Easy (4L)", slug: "ladder-rush-double-4" },
      { label: "Medium (5L)", slug: "ladder-rush-double-5" },
      { label: "Hard (6L)", slug: "ladder-rush-double-6" },
    ],
  };

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

    const modes = MySQLStorage.GAME_MODES[row.slug];
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
      isActive: row.isActive,
      hasSurvival: row.hasSurvival,
      ...(modes ? { modes } : {}),
    };
  }

  async getGames(): Promise<Game[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.games).where(eq(schema.games.isActive, true));
    return rows.map((row: typeof schema.games.$inferSelect) => this.mapDbRowToGame(row));
  }

  async getAllGames(): Promise<Game[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.games);
    return rows.map((row: typeof schema.games.$inferSelect) => this.mapDbRowToGame(row));
  }

  async setGameActive(slug: string, isActive: boolean): Promise<void> {
    const db = await this.getDb();
    await db.update(schema.games).set({ isActive }).where(eq(schema.games.slug, slug));
  }

  async getGameBySlug(slug: string): Promise<Game | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.games).where(eq(schema.games.slug, slug));
    if (rows.length === 0) return undefined;
    return this.mapDbRowToGame(rows[0]);
  }
  async getWordLadderPuzzles(): Promise<WordLadderPuzzle[]> { return this.gameData.getWordLadderPuzzles(); }
  async getLadderRushPuzzles(wordLength: number): Promise<LadderRushPuzzle[]> { return this.gameData.getLadderRushPuzzles(wordLength); }
  async getAnagramWordSets(): Promise<AnagramWordSet[]> { return this.gameData.getAnagramWordSets(); }
  async getScrambleWords(): Promise<ScrambleWord[]> { return this.gameData.getScrambleWords(); }
  async getDefinitionWords(): Promise<DefinitionWord[]> { return this.gameData.getDefinitionWords(); }
  async getLetterPoolWords(): Promise<LetterPoolWord[]> { return this.gameData.getLetterPoolWords(); }
  async getMakerWords(): Promise<MakerWord[]> { return this.gameData.getMakerWords(); }
  async getWordRootsPuzzles(): Promise<WordRootsPuzzle[]> { return this.gameData.getWordRootsPuzzles(); }
  async getWordStackPuzzles(): Promise<WordStackPuzzle[]> { return this.gameData.getWordStackPuzzles(); }
  async getWordSplitPuzzles(): Promise<WordSplitPuzzle[]> { return this.gameData.getWordSplitPuzzles(); }
  async getWordDictionary(): Promise<string[]> { await this.getDb(); return Array.from(this.wordSet); }
  async validateWord(word: string): Promise<boolean> { await this.getDb(); return this.wordSet.has(word.toUpperCase()); }
  async getWordLengthConfig(): Promise<WordLengthConfig> { return this.gameData.getWordLengthConfig(); }
  async getLetterPositionConfig(): Promise<LetterPositionConfig> { return this.gameData.getLetterPositionConfig(); }
  async getLetterHuntConfig(): Promise<LetterHuntConfig> { return this.gameData.getLetterHuntConfig(); }
  async getWordChainConfig(): Promise<WordChainConfig> { return this.gameData.getWordChainConfig(); }
  async getVowelConsonantConfig(): Promise<VowelConsonantConfig> { return this.gameData.getVowelConsonantConfig(); }
  async generateLengthConstraint(level: number): Promise<LengthConstraint> { return this.gameData.generateLengthConstraint(level); }
  async generatePositionConstraint(): Promise<PositionConstraint> { return this.gameData.generatePositionConstraint(); }
  async generateContainsConstraint(): Promise<ContainsConstraint> { return this.gameData.generateContainsConstraint(); }
  async getWordChainStartWord(variation: number, level: number): Promise<string | null> { return this.gameData.getWordChainStartWord(variation, level); }
  async getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null> { return this.gameData.getWordChainComputerWord(playerWord, variation, level, usedWords); }
  async getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]> { return this.gameData.getProgressiveRevealWords(); }
  async generateWordSweepGrid(seed?: number): Promise<WordSweepGrid> { return this.gameData.generateWordSweepGrid(seed); }
  async generateWordUnpackPuzzle(seed?: number): Promise<WordUnpackPuzzle> { return this.gameData.generateWordUnpackPuzzle(seed); }

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
    const totals = await db.select({
      userId: schema.leaderboardEntries.userId,
      totalScore: sql<number>`SUM(${schema.leaderboardEntries.score})`,
      latestPlayedAt: sql<string>`MAX(${schema.leaderboardEntries.playedAt})`,
    }).from(schema.leaderboardEntries)
      .groupBy(schema.leaderboardEntries.userId)
      .orderBy(sql`SUM(${schema.leaderboardEntries.score}) DESC`)
      .limit(limit);
    if (totals.length === 0) return [];
    const userIds = totals.map(t => t.userId);
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users).where(inArray(schema.users.id, userIds));
    const nameMap = new Map(userRows.map(u => [u.id, u.name]));
    return totals.map((r: any, i: number) => ({
      id: i + 1,
      userId: r.userId,
      playerName: nameMap.get(r.userId) || "Unknown",
      score: Number(r.totalScore),
      playedAt: r.latestPlayedAt instanceof Date ? r.latestPlayedAt.toISOString() : String(r.latestPlayedAt),
      gameSlug: "overall",
    }));
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
    const slugStats = await db.select({
      gameSlug: schema.userGameStats.gameSlug,
      totalPlayed: sql<number>`SUM(${schema.userGameStats.gamesPlayed})`,
    }).from(schema.userGameStats)
      .groupBy(schema.userGameStats.gameSlug);
    let totalGamesPlayed = 0;
    const gamesPerSlug: Record<string, number> = {};
    for (const row of slugStats) {
      const count = Number(row.totalPlayed);
      totalGamesPlayed += count;
      gamesPerSlug[row.gameSlug] = count;
    }
    return { totalUsers: Number(usersCount[0]?.count || 0), totalGamesPlayed, gamesPerSlug };
  }

  async getAllLeaderboardEntries(): Promise<LeaderboardEntry[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.leaderboardEntries).orderBy(desc(schema.leaderboardEntries.playedAt));
    return rows.map((r: any) => ({ id: r.id, userId: r.userId, gameSlug: r.gameSlug, score: r.score, playerName: r.playerName, playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt) }));
  }

  async searchUsers(query: string): Promise<Array<{ id: number; name: string; avatarUrl: string | null }>> {
    const db = await this.getDb();
    const sanitized = query.slice(0, 50).replace(/[%_\\]/g, "\\$&");
    const rows = await db.select({
      id: schema.users.id,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
    }).from(schema.users)
      .where(like(schema.users.name, `%${sanitized}%`))
      .limit(20);
    return rows.map((r: any) => ({ id: r.id, name: r.name, avatarUrl: r.avatarUrl || null }));
  }

  async getPublicProfile(userId: number): Promise<{ user: { id: number; name: string; avatarUrl: string | null; createdAt: string }; stats: UserGameStats[]; achievements: UserAchievement[]; leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }> } | null> {
    const db = await this.getDb();
    const userRows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!userRows[0]) return null;
    const u = userRows[0];
    const user = { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null, createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt) };

    const stats = await this.getAllUserGameStats(userId);
    const achievements = await this.getUserAchievements(userId);

    const userEntries = await db.select().from(schema.leaderboardEntries).where(eq(schema.leaderboardEntries.userId, userId));
    const slugBest = new Map<string, number>();
    for (const e of userEntries) {
      const existing = slugBest.get(e.gameSlug);
      if (!existing || e.score > existing) slugBest.set(e.gameSlug, e.score);
    }

    const leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }> = [];
    const slugEntries = Array.from(slugBest.entries());
    if (slugEntries.length > 0) {
      const allEntries = await db.select({
        gameSlug: schema.leaderboardEntries.gameSlug,
        maxScore: sql<number>`max(${schema.leaderboardEntries.score})`,
      }).from(schema.leaderboardEntries)
        .where(inArray(schema.leaderboardEntries.gameSlug, slugEntries.map(([s]) => s)))
        .groupBy(schema.leaderboardEntries.gameSlug, schema.leaderboardEntries.userId);

      const perSlugScores = new Map<string, number[]>();
      for (const row of allEntries) {
        const scores = perSlugScores.get(row.gameSlug) || [];
        scores.push(Number(row.maxScore));
        perSlugScores.set(row.gameSlug, scores);
      }

      for (const [gameSlug, score] of slugEntries) {
        const allScores = perSlugScores.get(gameSlug) || [];
        const rank = allScores.filter(s => s > score).length + 1;
        leaderboardRankings.push({ gameSlug, rank, score });
      }
    }

    return { user, stats, achievements, leaderboardRankings };
  }

  private toFriendship(r: any): Friendship {
    return {
      id: r.id,
      requesterId: r.requesterId,
      addresseeId: r.addresseeId,
      status: r.status as Friendship["status"],
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

  async getFriendshipById(id: number): Promise<Friendship | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendships).where(eq(schema.friendships.id, id)).limit(1);
    return rows[0] ? this.toFriendship(rows[0]) : undefined;
  }

  async sendFriendRequest(requesterId: number, addresseeId: number): Promise<Friendship> {
    const db = await this.getDb();
    const result = await db.insert(schema.friendships).values({ requesterId, addresseeId, status: "pending" });
    const created = await this.getFriendshipById(result[0].insertId);
    return created!;
  }

  async acceptFriendRequest(id: number): Promise<Friendship | undefined> {
    const db = await this.getDb();
    await db.update(schema.friendships).set({ status: "accepted" }).where(eq(schema.friendships.id, id));
    return this.getFriendshipById(id);
  }

  async declineFriendRequest(id: number): Promise<Friendship | undefined> {
    const db = await this.getDb();
    await db.update(schema.friendships).set({ status: "declined" }).where(eq(schema.friendships.id, id));
    return this.getFriendshipById(id);
  }

  async removeFriend(id: number): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.friendships).where(eq(schema.friendships.id, id));
  }

  async getFriends(userId: number): Promise<Array<Friendship & { friendUser: { id: number; name: string; avatarUrl: string | null } }>> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendships).where(
      and(
        eq(schema.friendships.status, "accepted"),
        or(eq(schema.friendships.requesterId, userId), eq(schema.friendships.addresseeId, userId))
      )
    );
    if (rows.length === 0) return [];
    const friendIds = rows.map(r => r.requesterId === userId ? r.addresseeId : r.requesterId);
    const friendUsers = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
      .from(schema.users).where(inArray(schema.users.id, friendIds));
    const userMap = new Map(friendUsers.map(u => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
    return rows.map(row => {
      const friendId = row.requesterId === userId ? row.addresseeId : row.requesterId;
      return {
        ...this.toFriendship(row),
        friendUser: userMap.get(friendId) || { id: friendId, name: "Unknown", avatarUrl: null },
      };
    });
  }

  async getPendingFriendRequests(userId: number): Promise<Array<Friendship & { requesterUser: { id: number; name: string; avatarUrl: string | null } }>> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendships).where(
      and(eq(schema.friendships.status, "pending"), eq(schema.friendships.addresseeId, userId))
    );
    if (rows.length === 0) return [];
    const requesterIds = rows.map(r => r.requesterId);
    const requesterUsers = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
      .from(schema.users).where(inArray(schema.users.id, requesterIds));
    const userMap = new Map(requesterUsers.map(u => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
    return rows.map(row => ({
      ...this.toFriendship(row),
      requesterUser: userMap.get(row.requesterId) || { id: row.requesterId, name: "Unknown", avatarUrl: null },
    }));
  }

  async getFriendship(userId1: number, userId2: number): Promise<Friendship | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendships).where(
      or(
        and(eq(schema.friendships.requesterId, userId1), eq(schema.friendships.addresseeId, userId2)),
        and(eq(schema.friendships.requesterId, userId2), eq(schema.friendships.addresseeId, userId1))
      )
    ).limit(1);
    return rows[0] ? this.toFriendship(rows[0]) : undefined;
  }

  private toChallenge(r: any): FriendChallenge {
    return {
      id: r.id,
      senderId: r.senderId,
      receiverId: r.receiverId,
      gameSlug: r.gameSlug,
      senderScore: r.senderScore,
      receiverScore: r.receiverScore ?? null,
      status: r.status as FriendChallenge["status"],
      message: r.message || null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

  async createFriendChallenge(challenge: InsertFriendChallenge): Promise<FriendChallenge> {
    const db = await this.getDb();
    const result = await db.insert(schema.friendChallenges).values({
      senderId: challenge.senderId,
      receiverId: challenge.receiverId,
      gameSlug: challenge.gameSlug,
      senderScore: challenge.senderScore,
      receiverScore: challenge.receiverScore,
      status: challenge.status,
      message: challenge.message,
    });
    const created = await this.getFriendChallenge(result[0].insertId);
    return created!;
  }

  async getFriendChallenges(userId: number): Promise<FriendChallenge[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendChallenges)
      .where(or(eq(schema.friendChallenges.senderId, userId), eq(schema.friendChallenges.receiverId, userId)))
      .orderBy(desc(schema.friendChallenges.createdAt));
    return rows.map((r: any) => this.toChallenge(r));
  }

  async getFriendChallenge(id: number): Promise<FriendChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendChallenges).where(eq(schema.friendChallenges.id, id)).limit(1);
    return rows[0] ? this.toChallenge(rows[0]) : undefined;
  }

  async completeFriendChallenge(id: number, score: number): Promise<FriendChallenge | undefined> {
    const db = await this.getDb();
    await db.update(schema.friendChallenges).set({ receiverScore: score, status: "completed" }).where(eq(schema.friendChallenges.id, id));
    return this.getFriendChallenge(id);
  }

  private toGroup(r: any): Group {
    let tags: string[] | null = null;
    if (r.tags) {
      if (typeof r.tags === "string") { try { tags = JSON.parse(r.tags); } catch { tags = null; } }
      else if (Array.isArray(r.tags)) { tags = r.tags; }
    }
    return {
      id: r.id,
      name: r.name,
      description: r.description || null,
      creatorId: r.creatorId,
      inviteCode: r.inviteCode,
      isPublic: Boolean(r.isPublic),
      isFeatured: Boolean(r.isFeatured),
      tags,
      pinnedAnnouncement: r.pinnedAnnouncement || null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

  private toGroupMember(r: any): GroupMember {
    return {
      id: r.id,
      groupId: r.groupId,
      userId: r.userId,
      role: r.role,
      joinedAt: r.joinedAt instanceof Date ? r.joinedAt.toISOString() : String(r.joinedAt),
    };
  }

  private toGroupRound(r: any): GroupRound {
    return {
      id: r.id,
      groupId: r.groupId,
      gameSlug: r.gameSlug,
      seed: r.seed,
      status: r.status,
      createdById: r.createdById,
      closesAt: r.closesAt ? (r.closesAt instanceof Date ? r.closesAt.toISOString() : String(r.closesAt)) : null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  }

  private toGroupRoundScore(r: any): GroupRoundScore {
    return {
      id: r.id,
      roundId: r.roundId,
      userId: r.userId,
      score: r.score,
      durationMs: r.durationMs ?? null,
      completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : String(r.completedAt),
    };
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const db = await this.getDb();
    const result = await db.insert(schema.groups).values({
      name: group.name,
      description: group.description,
      creatorId: group.creatorId,
      inviteCode: group.inviteCode,
      isPublic: group.isPublic,
      isFeatured: group.isFeatured ?? false,
      tags: group.tags ? JSON.stringify(group.tags) : null,
      pinnedAnnouncement: group.pinnedAnnouncement ?? null,
    });
    const rows = await db.select().from(schema.groups).where(eq(schema.groups.id, result[0].insertId)).limit(1);
    return this.toGroup(rows[0]);
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groups).where(eq(schema.groups.id, id)).limit(1);
    return rows[0] ? this.toGroup(rows[0]) : undefined;
  }

  async getGroupByInviteCode(code: string): Promise<Group | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groups).where(eq(schema.groups.inviteCode, code)).limit(1);
    return rows[0] ? this.toGroup(rows[0]) : undefined;
  }

  async updateGroup(id: number, updates: Partial<Pick<Group, "name" | "description" | "isPublic" | "tags" | "pinnedAnnouncement" | "isFeatured">>): Promise<Group | undefined> {
    const db = await this.getDb();
    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.isPublic !== undefined) dbUpdates.isPublic = updates.isPublic;
    if (updates.isFeatured !== undefined) dbUpdates.isFeatured = updates.isFeatured;
    if (updates.pinnedAnnouncement !== undefined) dbUpdates.pinnedAnnouncement = updates.pinnedAnnouncement;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags ? JSON.stringify(updates.tags) : null;
    if (Object.keys(dbUpdates).length === 0) return this.getGroup(id);
    await db.update(schema.groups).set(dbUpdates).where(eq(schema.groups.id, id));
    return this.getGroup(id);
  }

  async deleteGroup(id: number): Promise<void> {
    const db = await this.getDb();
    const rounds = await db.select({ id: schema.groupRounds.id }).from(schema.groupRounds).where(eq(schema.groupRounds.groupId, id));
    if (rounds.length > 0) {
      const roundIds = rounds.map((r: any) => r.id);
      await db.delete(schema.groupRoundScores).where(inArray(schema.groupRoundScores.roundId, roundIds));
      await db.delete(schema.groupRounds).where(eq(schema.groupRounds.groupId, id));
    }
    await db.delete(schema.groupMembers).where(eq(schema.groupMembers.groupId, id));
    await db.delete(schema.groups).where(eq(schema.groups.id, id));
  }

  async getUserGroups(userId: number): Promise<Group[]> {
    const db = await this.getDb();
    const memberships = await db.select({ groupId: schema.groupMembers.groupId }).from(schema.groupMembers).where(eq(schema.groupMembers.userId, userId));
    if (memberships.length === 0) return [];
    const groupIds = memberships.map((m: any) => m.groupId);
    const rows = await db.select().from(schema.groups).where(inArray(schema.groups.id, groupIds));
    const countRows = await db.select({ groupId: schema.groupMembers.groupId, count: sql<number>`count(*)` }).from(schema.groupMembers).where(inArray(schema.groupMembers.groupId, groupIds)).groupBy(schema.groupMembers.groupId);
    const countMap = new Map(countRows.map((r: any) => [r.groupId, Number(r.count)]));
    return rows.map((r: any) => ({ ...this.toGroup(r), memberCount: countMap.get(r.id) ?? 0 }));
  }

  async getPublicGroups(): Promise<Group[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groups).where(eq(schema.groups.isPublic, true)).orderBy(desc(schema.groups.createdAt));
    if (rows.length === 0) return [];
    const groupIds = rows.map((r: any) => r.id);
    const countRows = await db.select({ groupId: schema.groupMembers.groupId, count: sql<number>`count(*)` }).from(schema.groupMembers).where(inArray(schema.groupMembers.groupId, groupIds)).groupBy(schema.groupMembers.groupId);
    const countMap = new Map(countRows.map((r: any) => [r.groupId, Number(r.count)]));
    return rows.map((r: any) => ({ ...this.toGroup(r), memberCount: countMap.get(r.id) ?? 0 }));
  }

  async getAllGroups(): Promise<Group[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groups).orderBy(desc(schema.groups.createdAt));
    if (rows.length === 0) return [];
    const groupIds = rows.map((r: any) => r.id);
    const countRows = await db.select({ groupId: schema.groupMembers.groupId, count: sql<number>`count(*)` }).from(schema.groupMembers).where(inArray(schema.groupMembers.groupId, groupIds)).groupBy(schema.groupMembers.groupId);
    const countMap = new Map(countRows.map((r: any) => [r.groupId, Number(r.count)]));
    return rows.map((r: any) => ({ ...this.toGroup(r), memberCount: countMap.get(r.id) ?? 0 }));
  }

  async addGroupMember(groupId: number, userId: number, role: string): Promise<GroupMember> {
    const db = await this.getDb();
    const result = await db.insert(schema.groupMembers).values({ groupId, userId, role });
    const rows = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.id, result[0].insertId)).limit(1);
    return this.toGroupMember(rows[0]);
  }

  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
  }

  async getGroupMembers(groupId: number): Promise<Array<GroupMember & { user: { id: number; name: string; avatarUrl: string | null } }>> {
    const db = await this.getDb();
    const members = await db.select().from(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId));
    if (members.length === 0) return [];
    const userIds = members.map((m: any) => m.userId);
    const users = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
    const userMap = new Map(users.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
    return members.map((m: any) => ({ ...this.toGroupMember(m), user: userMap.get(m.userId) || { id: m.userId, name: "Unknown", avatarUrl: null } }));
  }

  async getGroupMember(groupId: number, userId: number): Promise<GroupMember | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId))).limit(1);
    return rows[0] ? this.toGroupMember(rows[0]) : undefined;
  }

  async updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<GroupMember | undefined> {
    const db = await this.getDb();
    await db.update(schema.groupMembers).set({ role }).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId)));
    return this.getGroupMember(groupId, userId);
  }

  async createGroupRound(round: InsertGroupRound): Promise<GroupRound> {
    const db = await this.getDb();
    const result = await db.insert(schema.groupRounds).values({
      groupId: round.groupId,
      gameSlug: round.gameSlug,
      seed: round.seed,
      status: round.status,
      createdById: round.createdById,
      closesAt: round.closesAt ? new Date(round.closesAt) : null,
    });
    const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.id, result[0].insertId)).limit(1);
    return this.toGroupRound(rows[0]);
  }

  async getGroupRound(id: number): Promise<GroupRound | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.id, id)).limit(1);
    return rows[0] ? this.toGroupRound(rows[0]) : undefined;
  }

  async getGroupRounds(groupId: number): Promise<GroupRound[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groupRounds).where(eq(schema.groupRounds.groupId, groupId)).orderBy(desc(schema.groupRounds.createdAt));
    return rows.map((r: any) => this.toGroupRound(r));
  }

  async closeGroupRound(id: number): Promise<GroupRound | undefined> {
    const db = await this.getDb();
    await db.update(schema.groupRounds).set({ status: "closed" }).where(eq(schema.groupRounds.id, id));
    return this.getGroupRound(id);
  }

  async submitGroupRoundScore(roundId: number, userId: number, score: number, durationMs?: number): Promise<GroupRoundScore> {
    const db = await this.getDb();
    const existing = await this.getUserGroupRoundScore(roundId, userId);
    if (existing) return existing;
    const result = await db.insert(schema.groupRoundScores).values({ roundId, userId, score, durationMs: durationMs ?? null });
    const rows = await db.select().from(schema.groupRoundScores).where(eq(schema.groupRoundScores.id, result[0].insertId)).limit(1);
    return this.toGroupRoundScore(rows[0]);
  }

  async getGroupRoundScores(roundId: number): Promise<Array<GroupRoundScore & { user: { id: number; name: string; avatarUrl: string | null } }>> {
    const db = await this.getDb();
    const scores = await db.select().from(schema.groupRoundScores).where(eq(schema.groupRoundScores.roundId, roundId)).orderBy(desc(schema.groupRoundScores.score), asc(sql`COALESCE(${schema.groupRoundScores.durationMs}, 2147483647)`));
    if (scores.length === 0) return [];
    const userIds = scores.map((s: any) => s.userId);
    const users = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
    const userMap = new Map(users.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
    return scores.map((s: any) => ({ ...this.toGroupRoundScore(s), user: userMap.get(s.userId) || { id: s.userId, name: "Unknown", avatarUrl: null } }));
  }

  async getUserGroupRoundScore(roundId: number, userId: number): Promise<GroupRoundScore | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groupRoundScores).where(and(eq(schema.groupRoundScores.roundId, roundId), eq(schema.groupRoundScores.userId, userId))).limit(1);
    return rows[0] ? this.toGroupRoundScore(rows[0]) : undefined;
  }

  async getGroupLeaderboard(groupId: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; totalScore: number; roundsPlayed: number }>> {
    const db = await this.getDb();
    const rows = await db.select({
      userId: schema.groupRoundScores.userId,
      totalScore: sql<number>`SUM(${schema.groupRoundScores.score})`,
      roundsPlayed: sql<number>`COUNT(*)`,
    })
      .from(schema.groupRoundScores)
      .innerJoin(schema.groupRounds, eq(schema.groupRoundScores.roundId, schema.groupRounds.id))
      .where(eq(schema.groupRounds.groupId, groupId))
      .groupBy(schema.groupRoundScores.userId)
      .orderBy(desc(sql`SUM(${schema.groupRoundScores.score})`));
    if (rows.length === 0) return [];
    const userIds = rows.map((r: any) => r.userId);
    const users = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
    const userMap = new Map(users.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
    return rows.map((r: any) => ({
      userId: r.userId,
      name: userMap.get(r.userId)?.name || "Unknown",
      avatarUrl: userMap.get(r.userId)?.avatarUrl || null,
      totalScore: Number(r.totalScore),
      roundsPlayed: Number(r.roundsPlayed),
    }));
  }

  async setGroupFeatured(groupId: number, isFeatured: boolean): Promise<Group | undefined> {
    const db = await this.getDb();
    await db.update(schema.groups).set({ isFeatured }).where(eq(schema.groups.id, groupId));
    return this.getGroup(groupId);
  }

  async addGroupReaction(roundId: number, scoreId: number, userId: number, emoji: string): Promise<GroupScoreReaction> {
    const db = await this.getDb();
    // Enforce single emoji per user per score — remove any prior reaction first
    await db.delete(schema.groupScoreReactions).where(and(eq(schema.groupScoreReactions.scoreId, scoreId), eq(schema.groupScoreReactions.userId, userId)));
    const result = await db.insert(schema.groupScoreReactions).values({ roundId, scoreId, userId, emoji });
    const rows = await db.select().from(schema.groupScoreReactions).where(eq(schema.groupScoreReactions.id, result[0].insertId)).limit(1);
    const r = rows[0];
    return { id: r.id, roundId: r.roundId, scoreId: r.scoreId, userId: r.userId, emoji: r.emoji, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) };
  }

  async removeGroupReaction(roundId: number, scoreId: number, userId: number, emoji: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.groupScoreReactions).where(and(eq(schema.groupScoreReactions.scoreId, scoreId), eq(schema.groupScoreReactions.userId, userId), eq(schema.groupScoreReactions.emoji, emoji)));
  }

  async getGroupRoundReactions(roundId: number): Promise<GroupScoreReaction[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groupScoreReactions).where(eq(schema.groupScoreReactions.roundId, roundId));
    return rows.map((r: any) => ({ id: r.id, roundId: r.roundId, scoreId: r.scoreId, userId: r.userId, emoji: r.emoji, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) }));
  }

  async logGroupActivity(groupId: number, userId: number | null, type: string, metadata: Record<string, any> = {}): Promise<void> {
    const db = await this.getDb();
    await db.insert(schema.groupActivity).values({ groupId, userId: userId ?? undefined, type, metadata: JSON.stringify(metadata) });
  }

  async getGroupActivity(groupId: number, limit = 30): Promise<GroupActivityEntry[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groupActivity).where(eq(schema.groupActivity.groupId, groupId)).orderBy(desc(schema.groupActivity.createdAt)).limit(limit);
    if (rows.length === 0) return [];
    const userIds = [...new Set(rows.filter((r: any) => r.userId).map((r: any) => r.userId))];
    const users = userIds.length > 0 ? await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds)) : [];
    const userMap = new Map(users.map((u: any) => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
    return rows.map((r: any) => {
      let meta: Record<string, any> = {};
      if (r.metadata) { if (typeof r.metadata === "string") { try { meta = JSON.parse(r.metadata); } catch {} } else { meta = r.metadata as Record<string, any>; } }
      return {
        id: r.id,
        groupId: r.groupId,
        userId: r.userId ?? null,
        type: r.type,
        metadata: meta,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        user: r.userId ? (userMap.get(r.userId) ?? null) : null,
      };
    });
  }

  async createGroupRoundAttempt(roundId: number, userId: number): Promise<GroupRoundAttempt> {
    const db = await this.getDb();
    const existing = await this.getGroupRoundAttempt(roundId, userId);
    if (existing) return existing;
    try {
      const result = await db.insert(schema.groupRoundAttempts).values({ roundId, userId });
      const rows = await db.select().from(schema.groupRoundAttempts).where(eq(schema.groupRoundAttempts.id, result[0].insertId)).limit(1);
      const r = rows[0];
      return { id: r.id, roundId: r.roundId, userId: r.userId, startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt) };
    } catch (err: unknown) {
      const isDuplicateKey = (err as { code?: string })?.code === "ER_DUP_ENTRY";
      if (isDuplicateKey) {
        const row = await this.getGroupRoundAttempt(roundId, userId);
        if (row) return row;
      }
      throw err;
    }
  }

  async getGroupRoundAttempt(roundId: number, userId: number): Promise<GroupRoundAttempt | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.groupRoundAttempts).where(and(eq(schema.groupRoundAttempts.roundId, roundId), eq(schema.groupRoundAttempts.userId, userId))).limit(1);
    if (!rows[0]) return undefined;
    const r = rows[0];
    return { id: r.id, roundId: r.roundId, userId: r.userId, startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt) };
  }

  async createDailyChallengeAttempt(userId: number, challengeDate: string): Promise<DailyChallengeAttempt> {
    const db = await this.getDb();
    const existing = await this.getDailyChallengeAttempt(userId, challengeDate);
    if (existing) return existing;
    try {
      const result = await db.insert(schema.dailyChallengeAttempts).values({ userId, challengeDate });
      const rows = await db.select().from(schema.dailyChallengeAttempts).where(eq(schema.dailyChallengeAttempts.id, result[0].insertId)).limit(1);
      const r = rows[0];
      return { id: r.id, userId: r.userId, challengeDate: r.challengeDate, startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt) };
    } catch (err: unknown) {
      const isDuplicateKey = (err as { code?: string })?.code === "ER_DUP_ENTRY";
      if (isDuplicateKey) {
        const row = await this.getDailyChallengeAttempt(userId, challengeDate);
        if (row) return row;
      }
      throw err;
    }
  }

  async getDailyChallengeAttempt(userId: number, challengeDate: string): Promise<DailyChallengeAttempt | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.dailyChallengeAttempts).where(and(eq(schema.dailyChallengeAttempts.userId, userId), eq(schema.dailyChallengeAttempts.challengeDate, challengeDate))).limit(1);
    if (!rows[0]) return undefined;
    const r = rows[0];
    return { id: r.id, userId: r.userId, challengeDate: r.challengeDate, startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt) };
  }
}
