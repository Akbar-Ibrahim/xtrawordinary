import { eq, desc, asc, sql, and, or, like, inArray, isNull, isNotNull, ne, between } from "drizzle-orm";
import type { Game, GameMode, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordRootsPuzzle, WordLengthConfig, LetterPositionConfig, LetterHuntConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid, WordUnpackPuzzle, WordLadderPuzzle, LadderRushPuzzle, User, InsertUser, EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement, Friendship, InsertFriendship, FriendChallenge, InsertFriendChallenge, Group, InsertGroup, GroupMember, GroupRound, InsertGroupRound, GroupRoundScore, GroupScoreReaction, GroupActivityEntry, GroupRoundAttempt, DailyChallengeAttempt, Comment, InsertComment, CommentReport, CommentTargetType, LikeTargetType, QuizSession, InsertQuizSession, QuizSessionScore, DuelChallenge, InsertDuelChallenge, DuelChallengeStatus, DuelSession, InsertDuelSession, DuelRating, Notification, InsertNotification, NotificationType, WordWarsTournament, InsertWordWarsTournament, WordWarsRegistration, WordWarsMatch, WordWarsMatchGame, WordWarsChampion, GuildWarsTournament, InsertGuildWarsTournament, GuildWarsRegistration, GuildWarsMatch, GuildWarsMatchGame, GuildWarsChampion } from "@shared/schema";
import { notificationTypeSchema } from "@shared/schema";
import type { IStorage, LengthConstraint, PositionConstraint, ContainsConstraint } from "./storage";
import { MemStorage } from "./mem-storage";
import * as schema from "./db-schema";
import { generateLetterPool } from "./game-data";
import type { HuddleChallenge, InsertHuddleChallenge, TeamRaceChallenge, InsertTeamRaceChallenge } from "@shared/schema";

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

    let modes: GameMode[] | undefined;
    if (typeof row.modes === "string") {
      modes = JSON.parse(row.modes);
    } else if (Array.isArray(row.modes)) {
      modes = row.modes;
    }

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
      ...(modes && modes.length > 0 ? { modes } : {}),
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
  async getDefinitionWords(): Promise<DefinitionWord[]> {
    try {
      const db = await this.getDb();
      const pool = await db.select()
        .from(schema.wordCategories)
        .orderBy(sql`RAND()`)
        .limit(50);

      const words: DefinitionWord[] = pool
        .filter(w => Array.isArray(w.definitions) && w.definitions.length > 0)
        .map(w => ({
          word: w.word,
          partOfSpeech: w.partOfSpeech ?? "",
          definitions: w.definitions as string[],
        }));

      if (words.length > 0) return words;
    } catch {
      // fall through to hardcoded data
    }
    return this.gameData.getDefinitionWords();
  }
  async getLetterPoolWords(): Promise<LetterPoolWord[]> {
    try {
      const db = await this.getDb();
      const pool = await db.select()
        .from(schema.words)
        .where(isNotNull(schema.words.category))
        .orderBy(sql`RAND()`)
        .limit(50);

      const words: LetterPoolWord[] = pool.map(w => ({
        word: w.word,
        hint: w.hint ?? "",
        category: w.category!,
        letterPool: generateLetterPool(w.word),
      }));

      if (words.length > 0) return words;
    } catch {
      // fall through to hardcoded data
    }
    return this.gameData.getLetterPoolWords();
  }
  async getMakerWords(): Promise<MakerWord[]> {
    try {
      const db = await this.getDb();
      const pool = await db.select()
        .from(schema.words)
        .where(and(
          between(schema.words.wordLength, 6, 10),
          isNotNull(schema.words.derivatives)
        ))
        .orderBy(sql`RAND()`)
        .limit(50);

      const makerWords: MakerWord[] = pool
        .filter(w => Array.isArray(w.derivatives) && w.derivatives.length > 0)
        .map(w => {
          const filtered = (w.derivatives as string[]).filter(d => d.length >= 3);
          return {
            baseWord: w.word,
            derivatives: filtered,
            maxWords: Math.min(filtered.length, 10),
          };
        })
        .filter(m => m.derivatives.length > 0);

      if (makerWords.length > 0) return makerWords;
    } catch {
      // fall through to hardcoded data
    }
    return this.gameData.getMakerWords();
  }
  async getWordRootsPuzzles(): Promise<WordRootsPuzzle[]> {
    try {
      const db = await this.getDb();
      const pool = await db.select()
        .from(schema.words)
        .where(and(
          between(schema.words.wordLength, 6, 10),
          isNotNull(schema.words.derivatives)
        ))
        .orderBy(sql`RAND()`)
        .limit(50);

      const puzzles: WordRootsPuzzle[] = pool
        .filter(w => Array.isArray(w.derivatives) && w.derivatives.length > 0)
        .map(w => ({
          canonicalWord: w.word,
          derivatives: (w.derivatives as string[]).filter(d => d.length >= 3),
        }))
        .filter(p => p.derivatives.length > 0);

      if (puzzles.length > 0) return puzzles;
    } catch {
      // fall through to hardcoded data
    }
    return this.gameData.getWordRootsPuzzles();
  }
  async getWordStackPuzzles(): Promise<WordStackPuzzle[]> {
    try {
      const db = await this.getDb();
      const pool = await db.select()
        .from(schema.words)
        .where(sql`${schema.words.isWordStack} = 1`)
        .orderBy(sql`RAND()`)
        .limit(50);

      const puzzles: WordStackPuzzle[] = pool.map(w => ({
        targetWord: w.word,
        startWord: "",
        hint: w.hint ?? "",
      }));

      if (puzzles.length > 0) return puzzles;
    } catch {
      // fall through to hardcoded data
    }
    return this.gameData.getWordStackPuzzles();
  }
  async getWordSplitPuzzles(): Promise<WordSplitPuzzle[]> {
    try {
      const db = await this.getDb();
      const pool = await db.select()
        .from(schema.words)
        .where(sql`${schema.words.isWordSplit} = 1`)
        .orderBy(sql`RAND()`)
        .limit(50);

      const puzzles: WordSplitPuzzle[] = pool.map(w => ({
        targetWord: w.word,
        hint: w.hint ?? "",
      }));

      if (puzzles.length > 0) return puzzles;
    } catch {
      // fall through to hardcoded data
    }
    return this.gameData.getWordSplitPuzzles();
  }
  async getWordDictionary(): Promise<string[]> { await this.getDb(); return Array.from(this.wordSet); }
  async validateWord(word: string): Promise<boolean> { await this.getDb(); return this.wordSet.has(word.toUpperCase()); }
  async countLetterPositionWords(letter: string, position: number): Promise<number> {
    await this.getDb();
    const upper = letter.toUpperCase();
    const idx = position - 1;
    let count = 0;
    for (const word of this.wordSet) {
      if (word.length > idx && word[idx] === upper) count++;
    }
    return count;
  }

  async countWordLengthWords(length: number, startsWith?: string, endsWith?: string, contains?: string): Promise<number> {
    await this.getDb();
    let count = 0;
    const sw = startsWith?.toUpperCase();
    const ew = endsWith?.toUpperCase();
    const ct = contains?.toUpperCase();
    for (const word of this.wordSet) {
      if (word.length !== length) continue;
      if (sw && !word.startsWith(sw)) continue;
      if (ew && !word.endsWith(ew)) continue;
      if (ct && !word.includes(ct)) continue;
      count++;
    }
    return count;
  }
  async getWordLengthConfig(): Promise<WordLengthConfig> { return this.gameData.getWordLengthConfig(); }
  async getLetterPositionConfig(): Promise<LetterPositionConfig> { return this.gameData.getLetterPositionConfig(); }
  async getLetterHuntConfig(): Promise<LetterHuntConfig> { return this.gameData.getLetterHuntConfig(); }
  async getWordChainConfig(): Promise<WordChainConfig> { return this.gameData.getWordChainConfig(); }
  async getVowelConsonantConfig(): Promise<VowelConsonantConfig> { return this.gameData.getVowelConsonantConfig(); }
  async generateLengthConstraint(level: number): Promise<LengthConstraint> { return this.gameData.generateLengthConstraint(level); }
  async generatePositionConstraint(): Promise<PositionConstraint> { return this.gameData.generatePositionConstraint(); }
  async generateContainsConstraint(): Promise<ContainsConstraint> { return this.gameData.generateContainsConstraint(); }
  async getWordChainStartWord(variation: number, level: number, seed?: number): Promise<string | null> {
    try {
      const db = await this.getDb();
      if (seed !== undefined) {
        const all = await db.select({ word: schema.words.word }).from(schema.words);
        if (all.length > 0) return all[seed % all.length].word;
      }
      const rows = await db.select({ word: schema.words.word })
        .from(schema.words)
        .orderBy(sql`RAND()`)
        .limit(1);
      if (rows.length > 0) return rows[0].word;
    } catch {
      // fall through
    }
    return this.gameData.getWordChainStartWord(variation, level, seed);
  }

  async getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null> {
    try {
      const db = await this.getDb();
      const upper = playerWord.toUpperCase();
      const startsWith = variation === 1 ? upper[upper.length - 1] : upper.slice(-2);
      const usedSet = usedWords.map(w => w.toUpperCase());

      // Build WHERE dynamically using raw sql to avoid type gymnastics
      let whereClause = sql`${schema.words.word} LIKE ${startsWith + '%'}`;
      if (usedSet.length > 0) {
        whereClause = sql`${whereClause} AND ${schema.words.word} NOT IN (${sql.join(usedSet.map(w => sql`${w}`), sql`, `)})`;
      }
      if (level === 2) {
        whereClause = sql`${whereClause} AND ${schema.words.wordLength} BETWEEN 3 AND 8`;
      }

      const rows = await db.select({ word: schema.words.word })
        .from(schema.words)
        .where(whereClause)
        .orderBy(sql`RAND()`)
        .limit(1);

      if (rows.length > 0) return rows[0].word;
    } catch {
      // fall through
    }
    return this.gameData.getWordChainComputerWord(playerWord, variation, level, usedWords);
  }
  async getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]> { return this.gameData.getProgressiveRevealWords(); }
  async generateWordSweepGrid(seed?: number): Promise<WordSweepGrid> { return this.gameData.generateWordSweepGrid(seed); }
  async generateWordUnpackPuzzle(seed?: number): Promise<WordUnpackPuzzle> { return this.gameData.generateWordUnpackPuzzle(seed); }
  async validateShellWord(word: string): Promise<{ valid: boolean; innerWord: string | null }> {
    const upper = word.toUpperCase().trim();
    if (upper.length < 4) return { valid: false, innerWord: null };
    const inner = upper.slice(1, -1);
    if (this.wordSet.size > 0) {
      return this.wordSet.has(upper) && this.wordSet.has(inner)
        ? { valid: true, innerWord: inner }
        : { valid: false, innerWord: null };
    }
    return this.gameData.validateShellWord(word);
  }

  async getShellWordPuzzle(seed: number): Promise<{ middle: string; count: number } | null> {
    try {
      const db = await this.getDb();
      const groups = await db.select({
        innerWord: schema.shellWords.innerWord,
        cnt: sql<number>`COUNT(*)`,
      })
        .from(schema.shellWords)
        .where(eq(schema.shellWords.shellDepth, 1))
        .groupBy(schema.shellWords.innerWord)
        .having(sql`COUNT(*) >= 3`)
        .orderBy(schema.shellWords.innerWord);
      if (groups.length === 0) return this.gameData.getShellWordPuzzle(seed);
      const idx = ((seed % groups.length) + groups.length) % groups.length;
      return { middle: groups[idx].innerWord, count: groups[idx].cnt };
    } catch {
      return this.gameData.getShellWordPuzzle(seed);
    }
  }

  async getCrackPuzzle(seed: number): Promise<{ first: string; last: string } | null> {
    try {
      const db = await this.getDb();
      const pairs = await db.select({
        first: sql<string>`LEFT(${schema.shellWords.outerWord}, 1)`,
        last: sql<string>`RIGHT(${schema.shellWords.outerWord}, 1)`,
      })
        .from(schema.shellWords)
        .where(eq(schema.shellWords.shellDepth, 1))
        .groupBy(sql`LEFT(${schema.shellWords.outerWord}, 1)`, sql`RIGHT(${schema.shellWords.outerWord}, 1)`)
        .having(sql`COUNT(*) >= 2`)
        .orderBy(sql`LEFT(${schema.shellWords.outerWord}, 1)`, sql`RIGHT(${schema.shellWords.outerWord}, 1)`);
      if (pairs.length === 0) return this.gameData.getCrackPuzzle(seed);
      const idx = ((seed % pairs.length) + pairs.length) % pairs.length;
      return pairs[idx];
    } catch {
      return this.gameData.getCrackPuzzle(seed);
    }
  }

  async validateDeepShellWord(word: string): Promise<{ valid: boolean; innerWord: string | null }> {
    const upper = word.toUpperCase().trim();
    if (upper.length < 7) return { valid: false, innerWord: null };
    const inner = upper.slice(2, -2);
    if (this.wordSet.size > 0) {
      return this.wordSet.has(upper) && this.wordSet.has(inner)
        ? { valid: true, innerWord: inner }
        : { valid: false, innerWord: null };
    }
    return this.gameData.validateDeepShellWord(word);
  }

  async getDeepShellWordPuzzle(seed: number): Promise<{ middle: string; count: number } | null> {
    try {
      const db = await this.getDb();
      const groups = await db.select({
        innerWord: schema.shellWords.innerWord,
        cnt: sql<number>`COUNT(*)`,
      })
        .from(schema.shellWords)
        .where(eq(schema.shellWords.shellDepth, 2))
        .groupBy(schema.shellWords.innerWord)
        .having(sql`COUNT(*) >= 3`)
        .orderBy(schema.shellWords.innerWord);
      if (groups.length === 0) return this.gameData.getDeepShellWordPuzzle(seed);
      const idx = ((seed % groups.length) + groups.length) % groups.length;
      return { middle: groups[idx].innerWord, count: groups[idx].cnt };
    } catch {
      return this.gameData.getDeepShellWordPuzzle(seed);
    }
  }

  async getDeepCrackPuzzle(seed: number): Promise<{ first: string; last: string } | null> {
    try {
      const db = await this.getDb();
      const pairs = await db.select({
        first: sql<string>`LEFT(${schema.shellWords.outerWord}, 2)`,
        last: sql<string>`RIGHT(${schema.shellWords.outerWord}, 2)`,
      })
        .from(schema.shellWords)
        .where(eq(schema.shellWords.shellDepth, 2))
        .groupBy(sql`LEFT(${schema.shellWords.outerWord}, 2)`, sql`RIGHT(${schema.shellWords.outerWord}, 2)`)
        .having(sql`COUNT(*) >= 2`)
        .orderBy(sql`LEFT(${schema.shellWords.outerWord}, 2)`, sql`RIGHT(${schema.shellWords.outerWord}, 2)`);
      if (pairs.length === 0) return this.gameData.getDeepCrackPuzzle(seed);
      const idx = ((seed % pairs.length) + pairs.length) % pairs.length;
      return pairs[idx];
    } catch {
      return this.gameData.getDeepCrackPuzzle(seed);
    }
  }

  async getDeepCrackAnswer(seed: number): Promise<string | null> {
    try {
      const db = await this.getDb();
      const pair = await this.getDeepCrackPuzzle(seed);
      if (!pair) return null;
      const rows = await db.select({ innerWord: schema.shellWords.innerWord })
        .from(schema.shellWords)
        .where(and(
          eq(schema.shellWords.shellDepth, 2),
          sql`LEFT(${schema.shellWords.outerWord}, 2) = ${pair.first}`,
          sql`RIGHT(${schema.shellWords.outerWord}, 2) = ${pair.last}`
        ))
        .limit(1);
      return rows.length > 0 ? rows[0].innerWord : null;
    } catch {
      return this.gameData.getDeepCrackAnswer(seed);
    }
  }
  async getWordStretchPuzzle(seed: number): Promise<{ word: string; totalSolutions: number }> { return this.gameData.getWordStretchPuzzle(seed); }
  async validateWordStretch(stretched: string, seedWord: string): Promise<{ valid: boolean; isMiddle: boolean }> { return this.gameData.validateWordStretch(stretched, seedWord); }
  async getWordStretchSolutions(seed: number): Promise<string[]> { return this.gameData.getWordStretchSolutions(seed); }
  async getWordBloomPuzzle(seed: number): Promise<{ seed: string; maxDepth: number }> { return this.gameData.getWordBloomPuzzle(seed); }
  async validateWordBloom(currentWord: string, nextWord: string): Promise<{ valid: boolean; isMiddle: boolean }> { return this.gameData.validateWordBloom(currentWord, nextWord); }

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
      isPremium: !!row.isPremium,
      bio: row.bio || null,
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
      isPremium: user.isPremium ?? false,
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
    if (updates.isPremium !== undefined) dbUpdates.isPremium = updates.isPremium;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
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
        lastScore: stats.lastScore ?? null,
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
      lastScore: stats.lastScore ?? null,
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
    return { id: r.id, userId: r.userId, gameSlug: r.gameSlug, bestScore: r.bestScore, gamesPlayed: r.gamesPlayed, gamesWon: r.gamesWon, wordsFound: r.wordsFound, lastPlayedAt: r.lastPlayedAt instanceof Date ? r.lastPlayedAt.toISOString() : String(r.lastPlayedAt), lastScore: r.lastScore ?? null };
  }

  async getAllUserGameStats(userId: number): Promise<UserGameStats[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.userGameStats).where(eq(schema.userGameStats.userId, userId));
    return rows.map((r: any) => ({ id: r.id, userId: r.userId, gameSlug: r.gameSlug, bestScore: r.bestScore, gamesPlayed: r.gamesPlayed, gamesWon: r.gamesWon, wordsFound: r.wordsFound, lastPlayedAt: r.lastPlayedAt instanceof Date ? r.lastPlayedAt.toISOString() : String(r.lastPlayedAt), lastScore: r.lastScore ?? null }));
  }

  async saveLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
    const db = await this.getDb();
    await db.insert(schema.leaderboardEntries).values({
      userId: entry.userId,
      gameSlug: entry.gameSlug,
      score: entry.score,
      playerName: entry.playerName,
      playedAt: new Date(entry.playedAt),
    }).onDuplicateKeyUpdate({
      set: {
        score: sql`IF(VALUES(score) > score, VALUES(score), score)`,
        playerName: sql`IF(VALUES(score) > score, VALUES(player_name), player_name)`,
        playedAt: sql`IF(VALUES(score) > score, VALUES(played_at), played_at)`,
      },
    });
    const saved = await db.select().from(schema.leaderboardEntries)
      .where(and(
        eq(schema.leaderboardEntries.userId, entry.userId),
        eq(schema.leaderboardEntries.gameSlug, entry.gameSlug),
      )).limit(1);
    const row: typeof schema.leaderboardEntries.$inferSelect = saved[0];
    return {
      id: row.id,
      userId: row.userId,
      gameSlug: row.gameSlug,
      score: row.score,
      playerName: row.playerName,
      playedAt: row.playedAt instanceof Date ? row.playedAt.toISOString() : String(row.playedAt),
    };
  }

  private _timeFilterCutoff(timeFilter?: string): Date | null {
    if (timeFilter === "today") {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    if (timeFilter === "week") {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 7);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }

  async getLeaderboard(gameSlug: string, limit = 50, timeFilter?: string): Promise<LeaderboardEntry[]> {
    const db = await this.getDb();
    const cutoff = this._timeFilterCutoff(timeFilter);

    const baseWhere = cutoff
      ? and(eq(schema.leaderboardEntries.gameSlug, gameSlug), sql`${schema.leaderboardEntries.playedAt} >= ${cutoff}`)
      : eq(schema.leaderboardEntries.gameSlug, gameSlug);

    // Step 1: MAX(score) per user for this game (within time window)
    const maxScorePerUser = db.select({
      userId: schema.leaderboardEntries.userId,
      maxScore: sql<number>`MAX(${schema.leaderboardEntries.score})`.as("max_score"),
    }).from(schema.leaderboardEntries)
      .where(baseWhere)
      .groupBy(schema.leaderboardEntries.userId)
      .as("max_score_per_user");

    // Step 2: Among rows that match (userId, maxScore), pick MIN(id) as the canonical row
    const bestRowIds = db.select({
      userId: schema.leaderboardEntries.userId,
      bestId: sql<number>`MIN(${schema.leaderboardEntries.id})`.as("best_id"),
    }).from(schema.leaderboardEntries)
      .innerJoin(maxScorePerUser, and(
        eq(schema.leaderboardEntries.userId, maxScorePerUser.userId),
        eq(schema.leaderboardEntries.score, maxScorePerUser.maxScore),
      ))
      .where(baseWhere)
      .groupBy(schema.leaderboardEntries.userId)
      .as("best_row_ids");

    // Step 3: Fetch the full canonical rows
    const rows = await db.select({
      id: schema.leaderboardEntries.id,
      userId: schema.leaderboardEntries.userId,
      gameSlug: schema.leaderboardEntries.gameSlug,
      score: schema.leaderboardEntries.score,
      playerName: schema.leaderboardEntries.playerName,
      playedAt: schema.leaderboardEntries.playedAt,
    }).from(schema.leaderboardEntries)
      .innerJoin(bestRowIds, eq(schema.leaderboardEntries.id, bestRowIds.bestId))
      .orderBy(desc(schema.leaderboardEntries.score))
      .limit(limit);

    if (rows.length === 0) return [];
    const userIds = [...new Set(rows.map(r => r.userId).filter(Boolean))];
    const userRows = userIds.length > 0
      ? await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
          .from(schema.users).where(inArray(schema.users.id, userIds))
      : [];
    const userMap = new Map(userRows.map(u => [u.id, u]));

    const statsRows = userIds.length > 0
      ? await db.select({ userId: schema.userGameStats.userId, gamesPlayed: schema.userGameStats.gamesPlayed })
          .from(schema.userGameStats)
          .where(and(inArray(schema.userGameStats.userId, userIds), eq(schema.userGameStats.gameSlug, gameSlug)))
      : [];
    const statsMap = new Map(statsRows.map(s => [s.userId, s.gamesPlayed]));

    return rows.map(r => {
      const user = userMap.get(r.userId);
      return {
        id: r.id,
        userId: r.userId,
        gameSlug: r.gameSlug,
        score: r.score,
        playerName: user?.name ?? r.playerName,
        playerAvatarUrl: user?.avatarUrl ?? null,
        playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt),
        gamesPlayed: statsMap.get(r.userId) ?? undefined,
      };
    });
  }

  async getOverallLeaderboard(limit = 50, timeFilter?: string): Promise<LeaderboardEntry[]> {
    const db = await this.getDb();
    const cutoff = this._timeFilterCutoff(timeFilter);

    const baseQuery = db.select({
      userId: schema.leaderboardEntries.userId,
      totalScore: sql<number>`SUM(${schema.leaderboardEntries.score})`,
      latestPlayedAt: sql<string>`MAX(${schema.leaderboardEntries.playedAt})`,
    }).from(schema.leaderboardEntries);

    const totals = await (cutoff
      ? baseQuery.where(sql`${schema.leaderboardEntries.playedAt} >= ${cutoff}`)
      : baseQuery)
      .groupBy(schema.leaderboardEntries.userId)
      .orderBy(sql`SUM(${schema.leaderboardEntries.score}) DESC`)
      .limit(limit);

    if (totals.length === 0) return [];
    const userIds = totals.map(t => t.userId);
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
      .from(schema.users).where(inArray(schema.users.id, userIds));
    const userMap = new Map(userRows.map(u => [u.id, u]));
    const statsRows = await db.select({
      userId: schema.userGameStats.userId,
      gamesPlayed: sql<number>`SUM(${schema.userGameStats.gamesPlayed})`,
    }).from(schema.userGameStats)
      .where(inArray(schema.userGameStats.userId, userIds))
      .groupBy(schema.userGameStats.userId);
    const statsMap = new Map(statsRows.map(s => [s.userId, Number(s.gamesPlayed)]));
    return totals.map((r: any, i: number) => ({
      id: i + 1,
      userId: r.userId,
      playerName: userMap.get(r.userId)?.name || "Unknown",
      playerAvatarUrl: userMap.get(r.userId)?.avatarUrl ?? null,
      score: Number(r.totalScore),
      playedAt: r.latestPlayedAt instanceof Date ? r.latestPlayedAt.toISOString() : String(r.latestPlayedAt),
      gameSlug: "overall",
      gamesPlayed: statsMap.get(r.userId) ?? undefined,
    }));
  }

  async getPlayerRank(gameSlug: string, userId: number, timeFilter?: string): Promise<{ rank: number; score: number; totalPlayers: number } | null> {
    const db = await this.getDb();
    const cutoff = this._timeFilterCutoff(timeFilter);

    if (gameSlug === "overall") {
      const whereClause = cutoff ? sql`${schema.leaderboardEntries.playedAt} >= ${cutoff}` : undefined;
      const totals = await (whereClause
        ? db.select({ userId: schema.leaderboardEntries.userId, total: sql<number>`SUM(${schema.leaderboardEntries.score})` })
            .from(schema.leaderboardEntries).where(whereClause)
        : db.select({ userId: schema.leaderboardEntries.userId, total: sql<number>`SUM(${schema.leaderboardEntries.score})` })
            .from(schema.leaderboardEntries))
        .groupBy(schema.leaderboardEntries.userId);

      const userRow = totals.find(t => t.userId === userId);
      if (!userRow) return null;
      const userScore = Number(userRow.total);
      const rank = totals.filter(t => Number(t.total) > userScore).length + 1;
      return { rank, score: userScore, totalPlayers: totals.length };
    }

    const baseWhere = cutoff
      ? and(eq(schema.leaderboardEntries.gameSlug, gameSlug), sql`${schema.leaderboardEntries.playedAt} >= ${cutoff}`)
      : eq(schema.leaderboardEntries.gameSlug, gameSlug);

    const scores = await db.select({
      userId: schema.leaderboardEntries.userId,
      best: sql<number>`MAX(${schema.leaderboardEntries.score})`,
    }).from(schema.leaderboardEntries)
      .where(baseWhere)
      .groupBy(schema.leaderboardEntries.userId);

    const userRow = scores.find(s => s.userId === userId);
    if (!userRow) return null;
    const userScore = Number(userRow.best);
    const rank = scores.filter(s => Number(s.best) > userScore).length + 1;
    return { rank, score: userScore, totalPlayers: scores.length };
  }

  async getFriendsLeaderboard(gameSlug: string, userId: number): Promise<LeaderboardEntry[]> {
    const db = await this.getDb();

    const friendships = await db.select({
      requesterId: schema.friendships.requesterId,
      addresseeId: schema.friendships.addresseeId,
    }).from(schema.friendships)
      .where(and(
        eq(schema.friendships.status, "accepted"),
        or(eq(schema.friendships.requesterId, userId), eq(schema.friendships.addresseeId, userId)),
      ));

    const friendIds = friendships.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
    const allowedIds = [userId, ...friendIds];

    if (allowedIds.length === 0) return [];

    if (gameSlug === "overall") {
      const totals = await db.select({
        userId: schema.leaderboardEntries.userId,
        totalScore: sql<number>`SUM(${schema.leaderboardEntries.score})`,
        latestPlayedAt: sql<string>`MAX(${schema.leaderboardEntries.playedAt})`,
      }).from(schema.leaderboardEntries)
        .where(inArray(schema.leaderboardEntries.userId, allowedIds))
        .groupBy(schema.leaderboardEntries.userId)
        .orderBy(sql`SUM(${schema.leaderboardEntries.score}) DESC`);

      if (totals.length === 0) return [];
      const uIds = totals.map(t => t.userId);
      const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
        .from(schema.users).where(inArray(schema.users.id, uIds));
      const userMap = new Map(userRows.map(u => [u.id, u]));
      return totals.map((r, i) => ({
        id: i + 1,
        userId: r.userId,
        playerName: userMap.get(r.userId)?.name || "Unknown",
        playerAvatarUrl: userMap.get(r.userId)?.avatarUrl ?? null,
        score: Number(r.totalScore),
        playedAt: r.latestPlayedAt instanceof Date ? (r.latestPlayedAt as Date).toISOString() : String(r.latestPlayedAt),
        gameSlug: "overall",
      }));
    }

    const baseWhere = and(eq(schema.leaderboardEntries.gameSlug, gameSlug), inArray(schema.leaderboardEntries.userId, allowedIds));
    const maxScorePerUser = db.select({
      userId: schema.leaderboardEntries.userId,
      maxScore: sql<number>`MAX(${schema.leaderboardEntries.score})`.as("max_score"),
    }).from(schema.leaderboardEntries).where(baseWhere).groupBy(schema.leaderboardEntries.userId).as("max_score_per_user");

    const bestRowIds = db.select({
      userId: schema.leaderboardEntries.userId,
      bestId: sql<number>`MIN(${schema.leaderboardEntries.id})`.as("best_id"),
    }).from(schema.leaderboardEntries)
      .innerJoin(maxScorePerUser, and(eq(schema.leaderboardEntries.userId, maxScorePerUser.userId), eq(schema.leaderboardEntries.score, maxScorePerUser.maxScore)))
      .where(baseWhere)
      .groupBy(schema.leaderboardEntries.userId)
      .as("best_row_ids");

    const rows = await db.select({
      id: schema.leaderboardEntries.id,
      userId: schema.leaderboardEntries.userId,
      gameSlug: schema.leaderboardEntries.gameSlug,
      score: schema.leaderboardEntries.score,
      playerName: schema.leaderboardEntries.playerName,
      playedAt: schema.leaderboardEntries.playedAt,
    }).from(schema.leaderboardEntries)
      .innerJoin(bestRowIds, eq(schema.leaderboardEntries.id, bestRowIds.bestId))
      .orderBy(desc(schema.leaderboardEntries.score));

    if (rows.length === 0) return [];
    const uIds = [...new Set(rows.map(r => r.userId))];
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
      .from(schema.users).where(inArray(schema.users.id, uIds));
    const userMap = new Map(userRows.map(u => [u.id, u]));
    const statsRows = await db.select({ userId: schema.userGameStats.userId, gamesPlayed: schema.userGameStats.gamesPlayed })
      .from(schema.userGameStats)
      .where(and(inArray(schema.userGameStats.userId, uIds), eq(schema.userGameStats.gameSlug, gameSlug)));
    const statsMap = new Map(statsRows.map(s => [s.userId, s.gamesPlayed]));
    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      gameSlug: r.gameSlug,
      score: r.score,
      playerName: userMap.get(r.userId)?.name ?? r.playerName,
      playerAvatarUrl: userMap.get(r.userId)?.avatarUrl ?? null,
      playedAt: r.playedAt instanceof Date ? r.playedAt.toISOString() : String(r.playedAt),
      gamesPlayed: statsMap.get(r.userId) ?? undefined,
    }));
  }

  async incrementGamePlayCount(gameSlug: string): Promise<void> {
    const db = await this.getDb();
    await db.insert(schema.gamePlayCounts)
      .values({ gameSlug, count: 1 })
      .onDuplicateKeyUpdate({ set: { count: sql`count + 1` } });
  }

  async getGamePlayCount(gameSlug: string): Promise<number> {
    const db = await this.getDb();
    const rows = await db.select({ count: schema.gamePlayCounts.count })
      .from(schema.gamePlayCounts)
      .where(eq(schema.gamePlayCounts.gameSlug, gameSlug));
    return Number(rows[0]?.count ?? 0);
  }

  async getAllGamePlayCounts(): Promise<Record<string, number>> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.gamePlayCounts);
    const result: Record<string, number> = {};
    for (const row of rows) result[row.gameSlug] = Number(row.count);
    return result;
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

  async getTopStreaks(limit: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; currentStreak: number; longestStreak: number }>> {
    const db = await this.getDb();
    const rows = await db
      .select({
        userId: schema.userStreaks.userId,
        name: schema.users.name,
        avatarUrl: schema.users.avatarUrl,
        currentStreak: schema.userStreaks.currentStreak,
        longestStreak: schema.userStreaks.longestStreak,
      })
      .from(schema.userStreaks)
      .innerJoin(schema.users, eq(schema.userStreaks.userId, schema.users.id))
      .where(sql`${schema.userStreaks.currentStreak} > 0`)
      .orderBy(desc(schema.userStreaks.currentStreak))
      .limit(limit);
    return rows.map(r => ({ userId: r.userId, name: r.name, avatarUrl: r.avatarUrl ?? null, currentStreak: r.currentStreak, longestStreak: r.longestStreak }));
  }

  async getStreakBatch(userIds: number[]): Promise<Record<number, number>> {
    if (userIds.length === 0) return {};
    const db = await this.getDb();
    const rows = await db
      .select({ userId: schema.userStreaks.userId, currentStreak: schema.userStreaks.currentStreak })
      .from(schema.userStreaks)
      .where(inArray(schema.userStreaks.userId, userIds));
    const result: Record<number, number> = {};
    for (const row of rows) result[row.userId] = row.currentStreak;
    return result;
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
    const user = { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null, createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt), isPremium: u.isPremium ?? false, bio: u.bio || null };

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
      seed: r.seed ?? null,
      gameConfig: r.gameConfig ?? null,
      senderViewed: Boolean(r.senderViewed),
      receiverViewed: Boolean(r.receiverViewed),
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
      seed: challenge.seed ?? null,
      gameConfig: challenge.gameConfig ?? null,
      senderViewed: challenge.senderViewed ?? false,
    });
    const created = await this.getFriendChallenge(result[0].insertId);
    return created!;
  }

  async getFriendChallenges(userId: number): Promise<FriendChallenge[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendChallenges)
      .where(or(eq(schema.friendChallenges.senderId, userId), eq(schema.friendChallenges.receiverId, userId)))
      .orderBy(desc(schema.friendChallenges.createdAt));

    const challenges = rows.map((r: any) => this.toChallenge(r));

    const userIds = new Set<number>();
    for (const c of challenges) {
      userIds.add(c.senderId);
      userIds.add(c.receiverId);
    }
    if (userIds.size === 0) return challenges;

    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
      .from(schema.users)
      .where(inArray(schema.users.id, Array.from(userIds)));
    const userMap = new Map<number, { name: string; avatarUrl: string | null }>();
    for (const u of userRows) userMap.set(u.id, { name: u.name, avatarUrl: u.avatarUrl });

    return challenges.map(c => ({
      ...c,
      senderName: userMap.get(c.senderId)?.name,
      receiverName: userMap.get(c.receiverId)?.name,
      senderAvatarUrl: userMap.get(c.senderId)?.avatarUrl ?? null,
      receiverAvatarUrl: userMap.get(c.receiverId)?.avatarUrl ?? null,
    }));
  }

  async getFriendChallenge(id: number): Promise<FriendChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendChallenges).where(eq(schema.friendChallenges.id, id)).limit(1);
    return rows[0] ? this.toChallenge(rows[0]) : undefined;
  }

  async getPendingFriendChallenge(senderId: number, receiverId: number, gameSlug: string): Promise<FriendChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.friendChallenges)
      .where(and(
        eq(schema.friendChallenges.senderId, senderId),
        eq(schema.friendChallenges.receiverId, receiverId),
        eq(schema.friendChallenges.gameSlug, gameSlug),
        eq(schema.friendChallenges.status, "pending"),
      ))
      .limit(1);
    return rows[0] ? this.toChallenge(rows[0]) : undefined;
  }

  async completeFriendChallenge(id: number, score: number): Promise<FriendChallenge | undefined> {
    const db = await this.getDb();
    await db.update(schema.friendChallenges).set({ receiverScore: score, status: "completed", senderViewed: false }).where(eq(schema.friendChallenges.id, id));
    return this.getFriendChallenge(id);
  }

  async cancelFriendChallenge(id: number): Promise<FriendChallenge | undefined> {
    const db = await this.getDb();
    await db.update(schema.friendChallenges).set({ status: "cancelled" }).where(eq(schema.friendChallenges.id, id));
    return this.getFriendChallenge(id);
  }

  async declineFriendChallenge(id: number): Promise<FriendChallenge | undefined> {
    const db = await this.getDb();
    await db.update(schema.friendChallenges).set({ status: "declined" }).where(eq(schema.friendChallenges.id, id));
    return this.getFriendChallenge(id);
  }

  async markChallengeViewed(id: number): Promise<void> {
    const db = await this.getDb();
    await db.update(schema.friendChallenges).set({ senderViewed: true }).where(eq(schema.friendChallenges.id, id));
  }

  async markChallengeReceiverViewed(id: number): Promise<void> {
    const db = await this.getDb();
    await db.update(schema.friendChallenges).set({ receiverViewed: true }).where(eq(schema.friendChallenges.id, id));
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
      gameConfig: r.gameConfig ?? null,
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
      gameConfig: round.gameConfig ?? null,
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

  async saveDailyChallengeScore(userId: number, challengeDate: string, gameSlug: string, score: number): Promise<void> {
    const db = await this.getDb();
    await db.execute(
      sql`INSERT INTO daily_challenge_scores (user_id, challenge_date, game_slug, score)
          VALUES (${userId}, ${challengeDate}, ${gameSlug}, ${score})
          ON DUPLICATE KEY UPDATE score = GREATEST(score, ${score})`
    );
  }

  async getDailyLeaderboard(challengeDate: string, gameSlug: string, requestingUserId?: number): Promise<{ entries: import("@shared/schema").DailyLeaderboardEntry[]; myRank?: number; myScore?: number }> {
    const db = await this.getDb();
    const rows = await db.select({
      userId: schema.dailyChallengeScores.userId,
      score: schema.dailyChallengeScores.score,
      playerName: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
    })
      .from(schema.dailyChallengeScores)
      .innerJoin(schema.users, eq(schema.dailyChallengeScores.userId, schema.users.id))
      .where(and(
        eq(schema.dailyChallengeScores.challengeDate, challengeDate),
        eq(schema.dailyChallengeScores.gameSlug, gameSlug),
      ))
      .orderBy(desc(schema.dailyChallengeScores.score))
      .limit(20);

    const entries = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      playerName: r.playerName,
      avatarUrl: r.avatarUrl || null,
      score: r.score,
    }));

    let myRank: number | undefined;
    let myScore: number | undefined;
    if (requestingUserId) {
      const myEntry = entries.find(e => e.userId === requestingUserId);
      if (myEntry) {
        myRank = myEntry.rank;
        myScore = myEntry.score;
      } else {
        const myRow = await db.select().from(schema.dailyChallengeScores)
          .where(and(
            eq(schema.dailyChallengeScores.userId, requestingUserId),
            eq(schema.dailyChallengeScores.challengeDate, challengeDate),
            eq(schema.dailyChallengeScores.gameSlug, gameSlug),
          ))
          .limit(1);
        if (myRow[0]) {
          const countAbove = await db.select({ cnt: sql<number>`count(*)` }).from(schema.dailyChallengeScores)
            .where(and(
              eq(schema.dailyChallengeScores.challengeDate, challengeDate),
              eq(schema.dailyChallengeScores.gameSlug, gameSlug),
              sql`${schema.dailyChallengeScores.score} > ${myRow[0].score}`,
            ));
          myRank = (Number(countAbove[0]?.cnt) || 0) + 1;
          myScore = myRow[0].score;
        }
      }
    }
    return { entries, myRank, myScore };
  }

  private mapDbRowToComment(r: typeof schema.comments.$inferSelect, user?: { id: number; name: string; avatarUrl: string | null }): Comment {
    return {
      id: r.id,
      targetType: r.targetType as CommentTargetType,
      targetId: r.targetId,
      userId: r.userId,
      parentId: r.parentId ?? null,
      content: r.isDeleted ? "" : r.content,
      isDeleted: r.isDeleted,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt ? String(r.updatedAt) : null),
      user,
    };
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const db = await this.getDb();
    const result = await db.insert(schema.comments).values({
      targetType: comment.targetType,
      targetId: comment.targetId,
      userId: comment.userId,
      parentId: comment.parentId ?? null,
      content: comment.content,
    });
    const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, result[0].insertId)).limit(1);
    const r = rows[0];
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(eq(schema.users.id, r.userId)).limit(1);
    const user = userRows[0] ? { id: userRows[0].id, name: userRows[0].name, avatarUrl: userRows[0].avatarUrl || null } : undefined;
    return this.mapDbRowToComment(r, user);
  }

  async getComments(targetType: CommentTargetType, targetId: string, userId?: number): Promise<Comment[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.comments)
      .where(and(eq(schema.comments.targetType, targetType), eq(schema.comments.targetId, targetId)))
      .orderBy(asc(schema.comments.createdAt));
    if (rows.length === 0) return [];
    const userIds = [...new Set(rows.map(r => r.userId))];
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
    const userMap = new Map(userRows.map(u => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
    const commentIdStrings = rows.map(r => String(r.id));
    const countRows = await db
      .select({ targetId: schema.likes.targetId, count: sql<number>`COUNT(*)` })
      .from(schema.likes)
      .where(and(eq(schema.likes.targetType, "comment"), inArray(schema.likes.targetId, commentIdStrings)))
      .groupBy(schema.likes.targetId);
    const countMap = new Map(countRows.map(r => [r.targetId, Number(r.count)]));
    let likedSet = new Set<string>();
    if (userId) {
      const likedRows = await db.select({ targetId: schema.likes.targetId }).from(schema.likes)
        .where(and(eq(schema.likes.targetType, "comment"), eq(schema.likes.userId, userId), inArray(schema.likes.targetId, commentIdStrings)));
      likedSet = new Set(likedRows.map(r => r.targetId));
    }
    const allComments = rows.map(r => ({
      ...this.mapDbRowToComment(r, userMap.get(r.userId)),
      likeCount: countMap.get(String(r.id)) ?? 0,
      likedByMe: likedSet.has(String(r.id)),
    }));
    const roots = allComments.filter(c => c.parentId === null);
    const replies = allComments.filter(c => c.parentId !== null);
    return roots.map(root => ({ ...root, replies: replies.filter(r => r.parentId === root.id) }));
  }

  async toggleLike(userId: number, targetType: LikeTargetType, targetId: string): Promise<{ liked: boolean; count: number }> {
    const db = await this.getDb();
    const existing = await db.select().from(schema.likes)
      .where(and(eq(schema.likes.userId, userId), eq(schema.likes.targetType, targetType), eq(schema.likes.targetId, targetId)))
      .limit(1);
    if (existing.length > 0) {
      await db.delete(schema.likes)
        .where(and(eq(schema.likes.userId, userId), eq(schema.likes.targetType, targetType), eq(schema.likes.targetId, targetId)));
    } else {
      await db.insert(schema.likes).values({ userId, targetType, targetId });
    }
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(schema.likes)
      .where(and(eq(schema.likes.targetType, targetType), eq(schema.likes.targetId, targetId)));
    return { liked: existing.length === 0, count: Number(count) };
  }

  async getLikeCounts(targetType: LikeTargetType, targetIds: string[]): Promise<Record<string, number>> {
    if (targetIds.length === 0) return {};
    const db = await this.getDb();
    const rows = await db
      .select({ targetId: schema.likes.targetId, count: sql<number>`COUNT(*)` })
      .from(schema.likes)
      .where(and(eq(schema.likes.targetType, targetType), inArray(schema.likes.targetId, targetIds)))
      .groupBy(schema.likes.targetId);
    const result: Record<string, number> = {};
    for (const id of targetIds) result[id] = 0;
    for (const r of rows) result[r.targetId] = Number(r.count);
    return result;
  }

  async getUserLikes(userId: number, targetType: LikeTargetType, targetIds: string[]): Promise<Set<string>> {
    if (targetIds.length === 0) return new Set();
    const db = await this.getDb();
    const rows = await db.select({ targetId: schema.likes.targetId }).from(schema.likes)
      .where(and(eq(schema.likes.userId, userId), eq(schema.likes.targetType, targetType), inArray(schema.likes.targetId, targetIds)));
    return new Set(rows.map(r => r.targetId));
  }

  async getCommentById(id: number): Promise<Comment | null> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
    if (!rows[0]) return null;
    return this.mapDbRowToComment(rows[0], undefined);
  }

  async deleteComment(id: number, userId: number, isAdmin = false): Promise<boolean> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
    if (!rows[0]) return false;
    if (!isAdmin && rows[0].userId !== userId) return false;
    await db.update(schema.comments).set({ isDeleted: true, content: "" }).where(eq(schema.comments.id, id));
    return true;
  }

  async reportComment(commentId: number, reportingUserId: number, reason: string): Promise<CommentReport> {
    const db = await this.getDb();
    const result = await db.insert(schema.commentReports).values({ commentId, reportingUserId, reason });
    const rows = await db.select().from(schema.commentReports).where(eq(schema.commentReports.id, result[0].insertId)).limit(1);
    const r = rows[0];
    return { id: r.id, commentId: r.commentId, reportingUserId: r.reportingUserId, reason: r.reason, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) };
  }

  async getCommentReports(): Promise<CommentReport[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.commentReports).orderBy(desc(schema.commentReports.createdAt));
    if (rows.length === 0) return [];
    const commentIds = [...new Set(rows.map(r => r.commentId))];
    const reporterIds = [...new Set(rows.map(r => r.reportingUserId))];
    const commentRows = await db.select().from(schema.comments).where(inArray(schema.comments.id, commentIds));
    const userIds = [...new Set([...reporterIds, ...commentRows.map(c => c.userId)])];
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
    const userMap = new Map(userRows.map(u => [u.id, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
    const commentMap = new Map(commentRows.map(c => [c.id, this.mapDbRowToComment(c, userMap.get(c.userId))]));
    return rows.map(r => ({
      id: r.id, commentId: r.commentId, reportingUserId: r.reportingUserId, reason: r.reason,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      reporter: userMap.get(r.reportingUserId) ? { id: userMap.get(r.reportingUserId)!.id, name: userMap.get(r.reportingUserId)!.name } : undefined,
      comment: commentMap.get(r.commentId),
    }));
  }

  async updateComment(id: number, userId: number, content: string): Promise<Comment | null> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
    if (!rows[0] || rows[0].isDeleted || rows[0].userId !== userId) return null;
    const now = new Date();
    await db.update(schema.comments).set({ content, updatedAt: now }).where(eq(schema.comments.id, id));
    const updated = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const user = userRows[0] ? { id: userRows[0].id, name: userRows[0].name, avatarUrl: userRows[0].avatarUrl || null } : undefined;
    return this.mapDbRowToComment(updated[0], user);
  }

  async deleteCommentAdmin(id: number): Promise<void> {
    const db = await this.getDb();
    await db.update(schema.comments).set({ isDeleted: true, content: "" }).where(eq(schema.comments.id, id));
  }

  async getAchievementRarities(): Promise<Record<string, number>> {
    const db = await this.getDb();
    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(schema.users);
    const totalUsers = Number(total);
    if (totalUsers === 0) return {};
    const rows = await db
      .select({ achievementId: schema.userAchievements.achievementId, count: sql<number>`COUNT(*)` })
      .from(schema.userAchievements)
      .groupBy(schema.userAchievements.achievementId);
    const result: Record<string, number> = {};
    for (const r of rows) {
      result[r.achievementId] = Math.round((Number(r.count) / totalUsers) * 100 * 10) / 10;
    }
    return result;
  }

  private generateShareCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  private mapQuizSession(row: any): QuizSession {
    return {
      id: row.id,
      creatorId: row.creatorId,
      gameSlug: row.gameSlug,
      title: row.title,
      description: row.description ?? null,
      shareCode: row.shareCode,
      params: typeof row.params === "string" ? JSON.parse(row.params) : (row.params ?? {}),
      closesAt: row.closesAt instanceof Date ? row.closesAt.toISOString() : (row.closesAt ?? null),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  async createQuizSession(session: InsertQuizSession): Promise<QuizSession> {
    const db = await this.getDb();
    let shareCode = session.shareCode || this.generateShareCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.select({ id: schema.quizSessions.id }).from(schema.quizSessions).where(eq(schema.quizSessions.shareCode, shareCode)).limit(1);
      if (existing.length === 0) break;
      shareCode = this.generateShareCode();
      attempts++;
    }
    const result = await db.insert(schema.quizSessions).values({
      creatorId: session.creatorId,
      gameSlug: session.gameSlug,
      title: session.title,
      description: session.description ?? null,
      shareCode,
      params: session.params ?? {},
      closesAt: session.closesAt ? new Date(session.closesAt) : null,
    });
    const rows = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.id, result[0].insertId)).limit(1);
    return this.mapQuizSession(rows[0]);
  }

  async getQuizSessionByCode(shareCode: string): Promise<QuizSession | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.shareCode, shareCode)).limit(1);
    if (!rows[0]) return undefined;
    return this.mapQuizSession(rows[0]);
  }

  async getQuizSessionsByCreator(creatorId: number): Promise<QuizSession[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.creatorId, creatorId)).orderBy(desc(schema.quizSessions.createdAt));
    return rows.map(r => this.mapQuizSession(r));
  }

  async addQuizSessionScore(sessionId: number, userId: number, score: number, guestName?: string | null): Promise<QuizSessionScore> {
    const db = await this.getDb();
    const existing = await db.select().from(schema.quizSessionScores).where(and(eq(schema.quizSessionScores.sessionId, sessionId), eq(schema.quizSessionScores.userId, userId))).limit(1);
    if (existing[0]) {
      return {
        id: existing[0].id,
        sessionId: existing[0].sessionId,
        userId: existing[0].userId,
        guestName: existing[0].guestName ?? null,
        score: existing[0].score,
        completedAt: existing[0].completedAt instanceof Date ? existing[0].completedAt.toISOString() : String(existing[0].completedAt),
      };
    }
    const result = await db.insert(schema.quizSessionScores).values({ sessionId, userId, guestName: guestName ?? null, score });
    const rows = await db.select().from(schema.quizSessionScores).where(eq(schema.quizSessionScores.id, result[0].insertId)).limit(1);
    const r = rows[0];
    return {
      id: r.id,
      sessionId: r.sessionId,
      userId: r.userId,
      guestName: r.guestName ?? null,
      score: r.score,
      completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : String(r.completedAt),
    };
  }

  async getQuizSessionScores(sessionId: number): Promise<QuizSessionScore[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.quizSessionScores).where(eq(schema.quizSessionScores.sessionId, sessionId)).orderBy(desc(schema.quizSessionScores.score));
    if (rows.length === 0) return [];
    const userIds = [...new Set(rows.map(r => r.userId))];
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
    const userMap = new Map(userRows.map(u => [u.id, u]));
    return rows.map(r => ({
      id: r.id,
      sessionId: r.sessionId,
      userId: r.userId,
      guestName: r.guestName ?? null,
      score: r.score,
      completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : String(r.completedAt),
      playerName: userMap.get(r.userId)?.name,
      playerAvatarUrl: userMap.get(r.userId)?.avatarUrl ?? null,
    }));
  }

  async getQuizSessionScore(sessionId: number, userId: number): Promise<QuizSessionScore | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.quizSessionScores).where(and(eq(schema.quizSessionScores.sessionId, sessionId), eq(schema.quizSessionScores.userId, userId))).limit(1);
    if (!rows[0]) return undefined;
    const r = rows[0];
    return {
      id: r.id,
      sessionId: r.sessionId,
      userId: r.userId,
      guestName: r.guestName ?? null,
      score: r.score,
      completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : String(r.completedAt),
    };
  }

  async deleteQuizSession(id: number): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.quizSessionScores).where(eq(schema.quizSessionScores.sessionId, id));
    await db.delete(schema.quizSessions).where(eq(schema.quizSessions.id, id));
  }

  private static tsToIso(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    return d instanceof Date ? d.toISOString() : String(d);
  }

  private mapDuelChallenge(row: typeof schema.duelChallenges.$inferSelect): DuelChallenge {
    return {
      id: row.id,
      challengerId: row.challengerId,
      challengeeId: row.challengeeId,
      gameSlug: row.gameSlug,
      message: row.message ?? null,
      status: row.status as DuelChallengeStatus,
      roomCode: row.roomCode ?? null,
      seed: row.seed ?? null,
      startWord: row.startWord ?? null,
      format: (row.format as "turn" | "race") ?? "turn",
      raceTarget: row.raceTarget ?? null,
      raceTimeLimit: row.raceTimeLimit ?? null,
      createdAt: MySQLStorage.tsToIso(row.createdAt)!,
      expiresAt: MySQLStorage.tsToIso(row.expiresAt),
    };
  }

  private mapDuelSession(row: typeof schema.duelSessions.$inferSelect): DuelSession {
    return {
      id: row.id,
      roomCode: row.roomCode,
      challengeId: row.challengeId ?? null,
      player1Id: row.player1Id,
      player2Id: row.player2Id,
      gameSlug: row.gameSlug,
      seed: row.seed,
      format: (row.format as "turn" | "race") ?? "turn",
      raceTarget: row.raceTarget ?? null,
      raceTimeLimit: row.raceTimeLimit ?? null,
      outcome: (row.outcome as DuelSession["outcome"]) ?? null,
      eloDeltaPlayer1: row.eloDeltaPlayer1 ?? null,
      eloDeltaPlayer2: row.eloDeltaPlayer2 ?? null,
      startedAt: MySQLStorage.tsToIso(row.startedAt)!,
      endedAt: MySQLStorage.tsToIso(row.endedAt),
    };
  }

  private mapDuelRating(row: typeof schema.duelRatings.$inferSelect): DuelRating {
    return {
      id: row.id,
      userId: row.userId,
      elo: row.elo,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      updatedAt: MySQLStorage.tsToIso(row.updatedAt)!,
    };
  }

  async createDuelChallenge(data: InsertDuelChallenge): Promise<DuelChallenge> {
    const db = await this.getDb();
    const result = await db.insert(schema.duelChallenges).values({
      challengerId: data.challengerId,
      challengeeId: data.challengeeId,
      gameSlug: data.gameSlug,
      message: data.message ?? null,
      status: data.status ?? "pending",
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      roomCode: data.roomCode ?? null,
      seed: data.seed ?? null,
      startWord: data.startWord ?? null,
      format: data.format ?? "turn",
      raceTarget: data.raceTarget ?? null,
      raceTimeLimit: data.raceTimeLimit ?? null,
    });
    const rows = await db.select().from(schema.duelChallenges).where(eq(schema.duelChallenges.id, result[0].insertId)).limit(1);
    return this.mapDuelChallenge(rows[0]);
  }

  async getDuelChallenge(id: number): Promise<DuelChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.duelChallenges).where(eq(schema.duelChallenges.id, id)).limit(1);
    return rows[0] ? this.mapDuelChallenge(rows[0]) : undefined;
  }

  async getDuelChallengeByRoom(roomCode: string): Promise<DuelChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.duelChallenges).where(eq(schema.duelChallenges.roomCode, roomCode)).limit(1);
    return rows[0] ? this.mapDuelChallenge(rows[0]) : undefined;
  }

  async updateDuelChallengeStatus(id: number, status: DuelChallengeStatus, roomCode?: string, seed?: number | null, startWord?: string | null): Promise<DuelChallenge | undefined> {
    const db = await this.getDb();
    const updates: { status: DuelChallengeStatus; roomCode?: string; seed?: number | null; startWord?: string | null } = { status };
    if (roomCode !== undefined) updates.roomCode = roomCode;
    if (seed !== undefined) updates.seed = seed;
    if (startWord !== undefined) updates.startWord = startWord;
    await db.update(schema.duelChallenges).set(updates).where(eq(schema.duelChallenges.id, id));
    return this.getDuelChallenge(id);
  }

  async getDuelChallengesForUser(userId: number): Promise<DuelChallenge[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.duelChallenges)
      .where(or(eq(schema.duelChallenges.challengerId, userId), eq(schema.duelChallenges.challengeeId, userId)))
      .orderBy(desc(schema.duelChallenges.createdAt));
    return rows.map((r: typeof schema.duelChallenges.$inferSelect) => this.mapDuelChallenge(r));
  }

  async updateDuelChallengeChallengee(id: number, challengeeId: number): Promise<DuelChallenge | undefined> {
    const db = await this.getDb();
    await db.update(schema.duelChallenges).set({ challengeeId }).where(eq(schema.duelChallenges.id, id));
    return this.getDuelChallenge(id);
  }

  async acceptOpenDuelChallenge(id: number, challengeeId: number): Promise<DuelChallenge | null> {
    const db = await this.getDb();
    // Single conditional UPDATE: only applies when challengeeId IS NULL and status = 'pending'
    const result = await db.update(schema.duelChallenges)
      .set({ challengeeId, status: "accepted" })
      .where(and(
        eq(schema.duelChallenges.id, id),
        isNull(schema.duelChallenges.challengeeId),
        eq(schema.duelChallenges.status, "pending"),
      ));
    // affectedRows = 0 means it was already taken
    if (result[0].affectedRows === 0) return null;
    return this.getDuelChallenge(id) as Promise<DuelChallenge>;
  }

  async getOpenDuelChallenges(excludeUserId: number, gameSlug?: string): Promise<DuelChallenge[]> {
    const db = await this.getDb();
    const conditions: any[] = [
      isNull(schema.duelChallenges.challengeeId),
      eq(schema.duelChallenges.status, "pending"),
      ne(schema.duelChallenges.challengerId, excludeUserId),
    ];
    if (gameSlug) conditions.push(eq(schema.duelChallenges.gameSlug, gameSlug));
    const rows = await db.select().from(schema.duelChallenges)
      .where(and(...conditions))
      .orderBy(desc(schema.duelChallenges.createdAt));
    return rows.map((r: typeof schema.duelChallenges.$inferSelect) => this.mapDuelChallenge(r));
  }

  async expireOpenChallenges(): Promise<number> {
    const db = await this.getDb();
    const result = await db.update(schema.duelChallenges)
      .set({ status: "expired" })
      .where(and(
        eq(schema.duelChallenges.status, "pending"),
        isNull(schema.duelChallenges.challengeeId),
        sql`(
          (${schema.duelChallenges.expiresAt} IS NOT NULL AND ${schema.duelChallenges.expiresAt} < NOW())
          OR
          (${schema.duelChallenges.expiresAt} IS NULL AND ${schema.duelChallenges.createdAt} < DATE_SUB(NOW(), INTERVAL 24 HOUR))
        )`,
      ));
    return result[0].affectedRows ?? 0;
  }

  async createDuelSession(data: InsertDuelSession): Promise<DuelSession> {
    const db = await this.getDb();
    const result = await db.insert(schema.duelSessions).values({
      roomCode: data.roomCode,
      challengeId: data.challengeId ?? null,
      player1Id: data.player1Id,
      player2Id: data.player2Id,
      gameSlug: data.gameSlug,
      seed: data.seed,
      format: data.format ?? "turn",
      raceTarget: data.raceTarget ?? null,
      raceTimeLimit: data.raceTimeLimit ?? null,
      outcome: data.outcome ?? null,
      eloDeltaPlayer1: data.eloDeltaPlayer1 ?? null,
      eloDeltaPlayer2: data.eloDeltaPlayer2 ?? null,
      startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
      endedAt: data.endedAt ? new Date(data.endedAt) : null,
    });
    const rows = await db.select().from(schema.duelSessions).where(eq(schema.duelSessions.id, result[0].insertId)).limit(1);
    return this.mapDuelSession(rows[0]);
  }

  async getDuelSession(id: number): Promise<DuelSession | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.duelSessions).where(eq(schema.duelSessions.id, id)).limit(1);
    return rows[0] ? this.mapDuelSession(rows[0]) : undefined;
  }

  async getDuelSessionByRoom(roomCode: string): Promise<DuelSession | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.duelSessions).where(eq(schema.duelSessions.roomCode, roomCode)).limit(1);
    return rows[0] ? this.mapDuelSession(rows[0]) : undefined;
  }

  async updateDuelSession(id: number, updates: Partial<Pick<DuelSession, "outcome" | "eloDeltaPlayer1" | "eloDeltaPlayer2" | "endedAt">>): Promise<DuelSession | undefined> {
    const db = await this.getDb();
    type SessionDbUpdate = {
      outcome?: string | null;
      eloDeltaPlayer1?: number | null;
      eloDeltaPlayer2?: number | null;
      endedAt?: Date | null;
    };
    const dbUpdates: SessionDbUpdate = {};
    if (updates.outcome !== undefined) dbUpdates.outcome = updates.outcome;
    if (updates.eloDeltaPlayer1 !== undefined) dbUpdates.eloDeltaPlayer1 = updates.eloDeltaPlayer1;
    if (updates.eloDeltaPlayer2 !== undefined) dbUpdates.eloDeltaPlayer2 = updates.eloDeltaPlayer2;
    if (updates.endedAt !== undefined) dbUpdates.endedAt = updates.endedAt ? new Date(updates.endedAt) : null;
    await db.update(schema.duelSessions).set(dbUpdates).where(eq(schema.duelSessions.id, id));
    return this.getDuelSession(id);
  }

  async getDuelSessionsForUser(userId: number): Promise<DuelSession[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.duelSessions)
      .where(or(eq(schema.duelSessions.player1Id, userId), eq(schema.duelSessions.player2Id, userId)))
      .orderBy(desc(schema.duelSessions.startedAt));
    return rows.map((r: typeof schema.duelSessions.$inferSelect) => this.mapDuelSession(r));
  }

  async getDuelRating(userId: number): Promise<DuelRating | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.duelRatings).where(eq(schema.duelRatings.userId, userId)).limit(1);
    return rows[0] ? this.mapDuelRating(rows[0]) : undefined;
  }

  async getDuelLeaderboard(limit = 100, format?: "turn" | "race"): Promise<Array<{ rank: number; userId: number; displayName: string; avatarUrl: string | null; elo: number; wins: number; losses: number; draws: number; winRate: number }>> {
    const db = await this.getDb();
    let query = db
      .select({
        userId: schema.duelRatings.userId,
        displayName: schema.users.name,
        avatarUrl: schema.users.avatarUrl,
        elo: schema.duelRatings.elo,
        wins: schema.duelRatings.wins,
        losses: schema.duelRatings.losses,
        draws: schema.duelRatings.draws,
      })
      .from(schema.duelRatings)
      .innerJoin(schema.users, eq(schema.duelRatings.userId, schema.users.id))
      .$dynamic();

    if (format) {
      const playedInFormat = db
        .selectDistinct({ userId: schema.duelSessions.player1Id })
        .from(schema.duelSessions)
        .where(eq(schema.duelSessions.format, format));
      const playedInFormat2 = db
        .selectDistinct({ userId: schema.duelSessions.player2Id })
        .from(schema.duelSessions)
        .where(eq(schema.duelSessions.format, format));
      query = query.where(
        or(
          inArray(schema.duelRatings.userId, playedInFormat),
          inArray(schema.duelRatings.userId, playedInFormat2),
        )
      );
    }

    const rows = await query.orderBy(desc(schema.duelRatings.elo)).limit(limit);
    return rows.map((r, i) => {
      const total = r.wins + r.losses + r.draws;
      return {
        rank: i + 1,
        userId: r.userId,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        elo: r.elo,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        winRate: total > 0 ? Math.round((r.wins / total) * 100) : 0,
      };
    });
  }

  async upsertDuelRating(userId: number, updates: Partial<Pick<DuelRating, "elo" | "wins" | "losses" | "draws">>): Promise<DuelRating> {
    const db = await this.getDb();
    const existing = await this.getDuelRating(userId);
    if (existing) {
      type RatingDbUpdate = { updatedAt: Date; elo?: number; wins?: number; losses?: number; draws?: number };
      const dbUpdates: RatingDbUpdate = { updatedAt: new Date() };
      if (updates.elo !== undefined) dbUpdates.elo = updates.elo;
      if (updates.wins !== undefined) dbUpdates.wins = updates.wins;
      if (updates.losses !== undefined) dbUpdates.losses = updates.losses;
      if (updates.draws !== undefined) dbUpdates.draws = updates.draws;
      await db.update(schema.duelRatings).set(dbUpdates).where(eq(schema.duelRatings.userId, userId));
      return this.getDuelRating(userId) as Promise<DuelRating>;
    }
    await db.insert(schema.duelRatings).values({
      userId,
      elo: updates.elo ?? 1200,
      wins: updates.wins ?? 0,
      losses: updates.losses ?? 0,
      draws: updates.draws ?? 0,
    });
    return this.getDuelRating(userId) as Promise<DuelRating>;
  }

  async getDuelRankContext(userId: number): Promise<{ rank: number; totalPlayers: number } | null> {
    const all = await this.getDuelLeaderboard(1_000_000);
    const entry = all.find(e => e.userId === userId);
    if (!entry) return null;
    return { rank: entry.rank, totalPlayers: all.length };
  }

  private mapHuddleChallenge(row: typeof schema.huddleChallenges.$inferSelect): HuddleChallenge {
    return {
      id: row.id,
      challengerGroupId: row.challengerGroupId,
      challengeeGroupId: row.challengeeGroupId,
      challengerAdminId: row.challengerAdminId,
      challengeeAdminId: row.challengeeAdminId ?? null,
      gameSlug: row.gameSlug,
      format: (row.format as "turn" | "race") ?? "turn",
      raceTarget: row.raceTarget ?? null,
      raceTimeLimit: row.raceTimeLimit ?? null,
      status: row.status as HuddleChallenge["status"],
      roomCode: row.roomCode ?? null,
      seed: row.seed ?? null,
      startWord: row.startWord ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : (row.expiresAt ? String(row.expiresAt) : null),
    };
  }

  async createHuddleChallenge(data: InsertHuddleChallenge): Promise<HuddleChallenge> {
    const db = await this.getDb();
    const result = await db.insert(schema.huddleChallenges).values({
      challengerGroupId: data.challengerGroupId,
      challengeeGroupId: data.challengeeGroupId,
      challengerAdminId: data.challengerAdminId,
      challengeeAdminId: data.challengeeAdminId ?? null,
      gameSlug: data.gameSlug,
      format: data.format ?? "turn",
      raceTarget: data.raceTarget ?? null,
      raceTimeLimit: data.raceTimeLimit ?? null,
      status: data.status ?? "pending",
      roomCode: data.roomCode ?? null,
      seed: data.seed ?? null,
      startWord: data.startWord ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });
    const rows = await db.select().from(schema.huddleChallenges).where(eq(schema.huddleChallenges.id, result[0].insertId)).limit(1);
    return this.mapHuddleChallenge(rows[0]);
  }

  async getHuddleChallenge(id: number): Promise<HuddleChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.huddleChallenges).where(eq(schema.huddleChallenges.id, id)).limit(1);
    return rows[0] ? this.mapHuddleChallenge(rows[0]) : undefined;
  }

  async getHuddleChallengesForGroup(groupId: number): Promise<HuddleChallenge[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.huddleChallenges)
      .where(or(eq(schema.huddleChallenges.challengerGroupId, groupId), eq(schema.huddleChallenges.challengeeGroupId, groupId)))
      .orderBy(desc(schema.huddleChallenges.createdAt));
    return rows.map((r: typeof schema.huddleChallenges.$inferSelect) => this.mapHuddleChallenge(r));
  }

  async updateHuddleChallenge(id: number, updates: Partial<Pick<HuddleChallenge, "status" | "challengeeAdminId" | "roomCode" | "seed" | "startWord">>): Promise<HuddleChallenge | undefined> {
    const db = await this.getDb();
    const dbUpdates: Record<string, any> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.challengeeAdminId !== undefined) dbUpdates.challengeeAdminId = updates.challengeeAdminId;
    if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
    if (updates.seed !== undefined) dbUpdates.seed = updates.seed;
    if (updates.startWord !== undefined) dbUpdates.startWord = updates.startWord;
    await db.update(schema.huddleChallenges).set(dbUpdates).where(eq(schema.huddleChallenges.id, id));
    return this.getHuddleChallenge(id);
  }

  async getHuddleChallengeByRoom(roomCode: string): Promise<HuddleChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.huddleChallenges).where(eq(schema.huddleChallenges.roomCode, roomCode)).limit(1);
    return rows[0] ? this.mapHuddleChallenge(rows[0]) : undefined;
  }

  private mapTeamRaceChallenge(row: typeof schema.teamRaceChallenges.$inferSelect): TeamRaceChallenge {
    return {
      id: row.id,
      challengerGroupId: row.challengerGroupId,
      challengeeGroupId: row.challengeeGroupId,
      challengerAdminId: row.challengerAdminId,
      challengeeAdminId: row.challengeeAdminId ?? null,
      gameSlug: row.gameSlug,
      raceTarget: row.raceTarget,
      raceTimeLimit: row.raceTimeLimit,
      status: row.status as TeamRaceChallenge["status"],
      roomCode: row.roomCode ?? null,
      seed: row.seed ?? null,
      startWord: row.startWord ?? null,
      winnerGroupId: row.winnerGroupId ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : (row.expiresAt ? String(row.expiresAt) : null),
    };
  }

  async createTeamRaceChallenge(data: InsertTeamRaceChallenge): Promise<TeamRaceChallenge> {
    const db = await this.getDb();
    const result = await db.insert(schema.teamRaceChallenges).values({
      challengerGroupId: data.challengerGroupId,
      challengeeGroupId: data.challengeeGroupId,
      challengerAdminId: data.challengerAdminId,
      challengeeAdminId: data.challengeeAdminId ?? null,
      gameSlug: data.gameSlug,
      raceTarget: data.raceTarget,
      raceTimeLimit: data.raceTimeLimit,
      status: data.status ?? "pending",
      roomCode: data.roomCode ?? null,
      seed: data.seed ?? null,
      startWord: data.startWord ?? null,
      winnerGroupId: data.winnerGroupId ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });
    const rows = await db.select().from(schema.teamRaceChallenges).where(eq(schema.teamRaceChallenges.id, result[0].insertId)).limit(1);
    return this.mapTeamRaceChallenge(rows[0]);
  }

  async getTeamRaceChallenge(id: number): Promise<TeamRaceChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.teamRaceChallenges).where(eq(schema.teamRaceChallenges.id, id)).limit(1);
    return rows[0] ? this.mapTeamRaceChallenge(rows[0]) : undefined;
  }

  async getTeamRaceChallengesForGroup(groupId: number): Promise<TeamRaceChallenge[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.teamRaceChallenges)
      .where(or(eq(schema.teamRaceChallenges.challengerGroupId, groupId), eq(schema.teamRaceChallenges.challengeeGroupId, groupId)))
      .orderBy(desc(schema.teamRaceChallenges.createdAt));
    return rows.map((r: typeof schema.teamRaceChallenges.$inferSelect) => this.mapTeamRaceChallenge(r));
  }

  async updateTeamRaceChallenge(id: number, updates: Partial<Pick<TeamRaceChallenge, "status" | "challengeeAdminId" | "roomCode" | "seed" | "startWord" | "winnerGroupId">>): Promise<TeamRaceChallenge | undefined> {
    const db = await this.getDb();
    const dbUpdates: Record<string, any> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.challengeeAdminId !== undefined) dbUpdates.challengeeAdminId = updates.challengeeAdminId;
    if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
    if (updates.seed !== undefined) dbUpdates.seed = updates.seed;
    if (updates.startWord !== undefined) dbUpdates.startWord = updates.startWord;
    if (updates.winnerGroupId !== undefined) dbUpdates.winnerGroupId = updates.winnerGroupId;
    await db.update(schema.teamRaceChallenges).set(dbUpdates).where(eq(schema.teamRaceChallenges.id, id));
    return this.getTeamRaceChallenge(id);
  }

  async getTeamRaceChallengeByRoom(roomCode: string): Promise<TeamRaceChallenge | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.teamRaceChallenges).where(eq(schema.teamRaceChallenges.roomCode, roomCode)).limit(1);
    return rows[0] ? this.mapTeamRaceChallenge(rows[0]) : undefined;
  }

  private mapNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      linkUrl: row.linkUrl ?? null,
      readAt: row.readAt instanceof Date ? row.readAt.toISOString() : (row.readAt ? String(row.readAt) : null),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const db = await this.getDb();
    const result = await db.insert(schema.notifications).values({
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      linkUrl: data.linkUrl ?? null,
    });
    const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.id, result[0].insertId)).limit(1);
    return this.mapNotification(rows[0]);
  }

  async getNotifications(userId: number, limit = 30): Promise<Notification[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit);
    return rows.map((r: any) => this.mapNotification(r));
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    const db = await this.getDb();
    const rows = await db.select({ count: sql<number>`COUNT(*)` })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
    return Number(rows[0]?.count ?? 0);
  }

  async markNotificationRead(id: number, userId: number): Promise<void> {
    const db = await this.getDb();
    await db.update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    const db = await this.getDb();
    await db.update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  }

  async pruneNotifications(): Promise<number> {
    const db = await this.getDb();
    const now = new Date();
    const readCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const unreadCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const result = await db.delete(schema.notifications).where(
      or(
        and(
          sql`${schema.notifications.readAt} IS NOT NULL`,
          sql`${schema.notifications.createdAt} < ${readCutoff}`,
        ),
        and(
          isNull(schema.notifications.readAt),
          sql`${schema.notifications.createdAt} < ${unreadCutoff}`,
        ),
      ),
    );
    return result[0].affectedRows ?? 0;
  }

  async getNotificationPreferences(userId: number): Promise<Record<NotificationType, boolean>> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, userId));
    const types = notificationTypeSchema.options as NotificationType[];
    const result = {} as Record<NotificationType, boolean>;
    const prefMap = new Map(rows.map((r) => [r.type, r.enabled === 1 || r.enabled === true]));
    for (const type of types) {
      result[type] = prefMap.has(type) ? prefMap.get(type)! : true;
    }
    return result;
  }

  async setNotificationPreference(userId: number, type: NotificationType, enabled: boolean): Promise<void> {
    const db = await this.getDb();
    await db.insert(schema.notificationPreferences).values({ userId, type, enabled })
      .onDuplicateKeyUpdate({ set: { enabled } });
  }

  async setAllNotificationPreferences(userId: number, enabled: boolean): Promise<void> {
    const db = await this.getDb();
    const types = notificationTypeSchema.options as NotificationType[];
    await Promise.all(
      types.map((type) =>
        db.insert(schema.notificationPreferences).values({ userId, type, enabled })
          .onDuplicateKeyUpdate({ set: { enabled } })
      )
    );
  }

  // ==================== WORD WARS ====================

  private toWordWarsTournament(row: any): WordWarsTournament {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      registrationDeadline: row.registrationDeadline instanceof Date ? row.registrationDeadline.toISOString() : String(row.registrationDeadline),
      roundDeadlineHours: row.roundDeadlineHours,
      minPlayers: row.minPlayers ?? 2,
      maxPlayers: row.maxPlayers ?? null,
      recurringCron: row.recurringCron ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  private toWordWarsRegistration(row: any): WordWarsRegistration {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      userId: row.userId,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  private toWordWarsMatch(row: any): WordWarsMatch {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      round: row.round,
      player1Id: row.player1Id ?? null,
      player2Id: row.player2Id ?? null,
      winnerId: row.winnerId ?? null,
      status: row.status,
      deadline: row.deadline ? (row.deadline instanceof Date ? row.deadline.toISOString() : String(row.deadline)) : null,
      game1Slug: row.game1Slug,
      game2Slug: row.game2Slug,
      game3Slug: row.game3Slug,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  private toWordWarsMatchGame(row: any): WordWarsMatchGame {
    return {
      id: row.id,
      matchId: row.matchId,
      gameNumber: row.gameNumber,
      gameSlug: row.gameSlug,
      roomCode: row.roomCode ?? null,
      winnerId: row.winnerId ?? null,
      status: row.status,
    };
  }

  async createWordWarsTournament(data: InsertWordWarsTournament): Promise<WordWarsTournament> {
    const db = await this.getDb();
    const result = await db.insert(schema.wordWarsTournaments).values({
      name: data.name,
      status: "registration",
      registrationDeadline: new Date(data.registrationDeadline),
      roundDeadlineHours: data.roundDeadlineHours,
      minPlayers: data.minPlayers ?? 2,
      maxPlayers: data.maxPlayers ?? null,
      recurringCron: data.recurringCron ?? null,
      createdBy: data.createdBy,
    });
    const created = await this.getWordWarsTournament(result[0].insertId);
    return created!;
  }

  async getWordWarsTournament(id: number): Promise<WordWarsTournament | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsTournaments).where(eq(schema.wordWarsTournaments.id, id)).limit(1);
    return rows[0] ? this.toWordWarsTournament(rows[0]) : undefined;
  }

  async listWordWarsTournaments(): Promise<WordWarsTournament[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsTournaments).orderBy(desc(schema.wordWarsTournaments.createdAt));
    return rows.map((r: any) => this.toWordWarsTournament(r));
  }

  async updateWordWarsTournament(id: number, updates: Partial<Pick<WordWarsTournament, "status" | "name" | "registrationDeadline" | "roundDeadlineHours" | "minPlayers" | "maxPlayers" | "recurringCron">>): Promise<WordWarsTournament | undefined> {
    const db = await this.getDb();
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.registrationDeadline !== undefined) dbUpdates.registrationDeadline = new Date(updates.registrationDeadline);
    if (updates.roundDeadlineHours !== undefined) dbUpdates.roundDeadlineHours = updates.roundDeadlineHours;
    if (updates.minPlayers !== undefined) dbUpdates.minPlayers = updates.minPlayers;
    if (updates.maxPlayers !== undefined) dbUpdates.maxPlayers = updates.maxPlayers;
    if (updates.recurringCron !== undefined) dbUpdates.recurringCron = updates.recurringCron;
    await db.update(schema.wordWarsTournaments).set(dbUpdates).where(eq(schema.wordWarsTournaments.id, id));
    return this.getWordWarsTournament(id);
  }

  async createWordWarsRegistration(tournamentId: number, userId: number): Promise<WordWarsRegistration> {
    const db = await this.getDb();
    const result = await db.insert(schema.wordWarsRegistrations).values({ tournamentId, userId });
    const rows = await db.select().from(schema.wordWarsRegistrations).where(eq(schema.wordWarsRegistrations.id, result[0].insertId)).limit(1);
    return this.toWordWarsRegistration(rows[0]);
  }

  async getWordWarsRegistration(tournamentId: number, userId: number): Promise<WordWarsRegistration | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsRegistrations)
      .where(and(eq(schema.wordWarsRegistrations.tournamentId, tournamentId), eq(schema.wordWarsRegistrations.userId, userId)))
      .limit(1);
    return rows[0] ? this.toWordWarsRegistration(rows[0]) : undefined;
  }

  async deleteWordWarsRegistration(tournamentId: number, userId: number): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.wordWarsRegistrations)
      .where(and(eq(schema.wordWarsRegistrations.tournamentId, tournamentId), eq(schema.wordWarsRegistrations.userId, userId)));
  }

  async getWordWarsRegistrationsForTournament(tournamentId: number): Promise<WordWarsRegistration[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsRegistrations)
      .where(eq(schema.wordWarsRegistrations.tournamentId, tournamentId))
      .orderBy(asc(schema.wordWarsRegistrations.createdAt));
    return rows.map((r: any) => this.toWordWarsRegistration(r));
  }

  async createWordWarsMatch(data: Omit<WordWarsMatch, "id" | "createdAt">): Promise<WordWarsMatch> {
    const db = await this.getDb();
    const result = await db.insert(schema.wordWarsMatches).values({
      tournamentId: data.tournamentId,
      round: data.round,
      player1Id: data.player1Id ?? null,
      player2Id: data.player2Id ?? null,
      winnerId: data.winnerId ?? null,
      status: data.status,
      deadline: data.deadline ? new Date(data.deadline) : null,
      game1Slug: data.game1Slug,
      game2Slug: data.game2Slug,
      game3Slug: data.game3Slug,
    });
    const created = await this.getWordWarsMatch(result[0].insertId);
    return created!;
  }

  async getWordWarsMatch(id: number): Promise<WordWarsMatch | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsMatches).where(eq(schema.wordWarsMatches.id, id)).limit(1);
    return rows[0] ? this.toWordWarsMatch(rows[0]) : undefined;
  }

  async listWordWarsMatchesForTournament(tournamentId: number): Promise<WordWarsMatch[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsMatches)
      .where(eq(schema.wordWarsMatches.tournamentId, tournamentId))
      .orderBy(asc(schema.wordWarsMatches.round), asc(schema.wordWarsMatches.id));
    return rows.map((r: any) => this.toWordWarsMatch(r));
  }

  async updateWordWarsMatch(id: number, updates: Partial<Pick<WordWarsMatch, "status" | "winnerId" | "deadline">>): Promise<WordWarsMatch | undefined> {
    const db = await this.getDb();
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.winnerId !== undefined) dbUpdates.winnerId = updates.winnerId;
    if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline ? new Date(updates.deadline) : null;
    await db.update(schema.wordWarsMatches).set(dbUpdates).where(eq(schema.wordWarsMatches.id, id));
    return this.getWordWarsMatch(id);
  }

  async createWordWarsMatchGame(data: Omit<WordWarsMatchGame, "id">): Promise<WordWarsMatchGame> {
    const db = await this.getDb();
    const result = await db.insert(schema.wordWarsMatchGames).values({
      matchId: data.matchId,
      gameNumber: data.gameNumber,
      gameSlug: data.gameSlug,
      roomCode: data.roomCode ?? null,
      winnerId: data.winnerId ?? null,
      status: data.status,
    });
    const rows = await db.select().from(schema.wordWarsMatchGames).where(eq(schema.wordWarsMatchGames.id, result[0].insertId)).limit(1);
    return this.toWordWarsMatchGame(rows[0]);
  }

  async getWordWarsMatchGame(matchId: number, gameNumber: number): Promise<WordWarsMatchGame | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsMatchGames)
      .where(and(eq(schema.wordWarsMatchGames.matchId, matchId), eq(schema.wordWarsMatchGames.gameNumber, gameNumber)))
      .limit(1);
    return rows[0] ? this.toWordWarsMatchGame(rows[0]) : undefined;
  }

  async getWordWarsMatchGames(matchId: number): Promise<WordWarsMatchGame[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsMatchGames)
      .where(eq(schema.wordWarsMatchGames.matchId, matchId))
      .orderBy(asc(schema.wordWarsMatchGames.gameNumber));
    return rows.map((r: any) => this.toWordWarsMatchGame(r));
  }

  async updateWordWarsMatchGame(id: number, updates: Partial<Pick<WordWarsMatchGame, "status" | "winnerId" | "roomCode">>): Promise<WordWarsMatchGame | undefined> {
    const db = await this.getDb();
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.winnerId !== undefined) dbUpdates.winnerId = updates.winnerId;
    if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
    await db.update(schema.wordWarsMatchGames).set(dbUpdates).where(eq(schema.wordWarsMatchGames.id, id));
    const rows = await db.select().from(schema.wordWarsMatchGames).where(eq(schema.wordWarsMatchGames.id, id)).limit(1);
    return rows[0] ? this.toWordWarsMatchGame(rows[0]) : undefined;
  }

  async getMatchGameByRoomCode(roomCode: string): Promise<WordWarsMatchGame | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsMatchGames)
      .where(eq(schema.wordWarsMatchGames.roomCode, roomCode))
      .limit(1);
    return rows[0] ? this.toWordWarsMatchGame(rows[0]) : undefined;
  }

  private toWordWarsChampion(row: any): WordWarsChampion {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      userId: row.userId,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  async createWordWarsChampion(tournamentId: number, userId: number): Promise<WordWarsChampion> {
    const db = await this.getDb();
    const result = await db.insert(schema.wordWarsChampions).values({ tournamentId, userId });
    const rows = await db.select().from(schema.wordWarsChampions).where(eq(schema.wordWarsChampions.id, result[0].insertId)).limit(1);
    return this.toWordWarsChampion(rows[0]);
  }

  async getChampionsForTournament(tournamentId: number): Promise<WordWarsChampion[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsChampions)
      .where(eq(schema.wordWarsChampions.tournamentId, tournamentId));
    return rows.map((r: any) => this.toWordWarsChampion(r));
  }

  async getChampionshipsForUser(userId: number): Promise<WordWarsChampion[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsChampions)
      .where(eq(schema.wordWarsChampions.userId, userId))
      .orderBy(desc(schema.wordWarsChampions.createdAt));
    return rows.map((r: any) => this.toWordWarsChampion(r));
  }

  async listAllWordWarsChampions(): Promise<WordWarsChampion[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.wordWarsChampions)
      .orderBy(desc(schema.wordWarsChampions.createdAt));
    return rows.map((r: any) => this.toWordWarsChampion(r));
  }

  async getWordWarsStatsForUser(userId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
    const db = await this.getDb();
    const regRows = await db.select().from(schema.wordWarsRegistrations)
      .where(eq(schema.wordWarsRegistrations.userId, userId));
    const tournamentsEntered = regRows.length;

    const matchRows = await db.select().from(schema.wordWarsMatches)
      .where(
        and(
          or(
            eq(schema.wordWarsMatches.player1Id, userId),
            eq(schema.wordWarsMatches.player2Id, userId)
          ),
          or(
            eq(schema.wordWarsMatches.status, "completed"),
            eq(schema.wordWarsMatches.status, "forfeited")
          )
        )
      );

    let matchWins = 0;
    let matchLosses = 0;
    for (const m of matchRows) {
      if (m.winnerId === userId) matchWins++;
      else if (m.winnerId !== null) matchLosses++;
    }
    return { tournamentsEntered, matchWins, matchLosses };
  }

  // ==================== GUILD WARS ====================

  private toGuildWarsTournament(row: any): GuildWarsTournament {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      registrationDeadline: row.registrationDeadline instanceof Date ? row.registrationDeadline.toISOString() : String(row.registrationDeadline),
      roundDeadlineHours: row.roundDeadlineHours,
      minGroups: row.minGroups ?? 2,
      maxGroups: row.maxGroups ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  private toGuildWarsRegistration(row: any): GuildWarsRegistration {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      groupId: row.groupId,
      registeredBy: row.registeredBy,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  private toGuildWarsMatch(row: any): GuildWarsMatch {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      round: row.round,
      group1Id: row.group1Id ?? null,
      group2Id: row.group2Id ?? null,
      winnerGroupId: row.winnerGroupId ?? null,
      status: row.status,
      deadline: row.deadline ? (row.deadline instanceof Date ? row.deadline.toISOString() : String(row.deadline)) : null,
      game1Slug: row.game1Slug,
      game2Slug: row.game2Slug,
      game3Slug: row.game3Slug,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  private toGuildWarsMatchGame(row: any): GuildWarsMatchGame {
    return {
      id: row.id,
      matchId: row.matchId,
      gameNumber: row.gameNumber,
      gameSlug: row.gameSlug,
      roomCode: row.roomCode ?? null,
      winnerGroupId: row.winnerGroupId ?? null,
      status: row.status,
    };
  }

  private toGuildWarsChampion(row: any): GuildWarsChampion {
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      groupId: row.groupId,
      tournamentName: row.tournamentName ?? "",
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  async createGuildWarsTournament(data: InsertGuildWarsTournament): Promise<GuildWarsTournament> {
    const db = await this.getDb();
    const result = await db.insert(schema.guildWarsTournaments).values({
      name: data.name,
      status: "registration",
      registrationDeadline: new Date(data.registrationDeadline),
      roundDeadlineHours: data.roundDeadlineHours,
      minGroups: data.minGroups ?? 2,
      maxGroups: data.maxGroups ?? null,
      createdBy: data.createdBy,
    });
    const created = await this.getGuildWarsTournament(result[0].insertId);
    return created!;
  }

  async getGuildWarsTournament(id: number): Promise<GuildWarsTournament | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsTournaments).where(eq(schema.guildWarsTournaments.id, id)).limit(1);
    return rows[0] ? this.toGuildWarsTournament(rows[0]) : undefined;
  }

  async listGuildWarsTournaments(): Promise<GuildWarsTournament[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsTournaments).orderBy(desc(schema.guildWarsTournaments.createdAt));
    return rows.map((r: any) => this.toGuildWarsTournament(r));
  }

  async updateGuildWarsTournament(id: number, updates: Partial<Pick<GuildWarsTournament, "status" | "name" | "registrationDeadline" | "roundDeadlineHours" | "minGroups" | "maxGroups">>): Promise<GuildWarsTournament | undefined> {
    const db = await this.getDb();
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.registrationDeadline !== undefined) dbUpdates.registrationDeadline = new Date(updates.registrationDeadline);
    if (updates.roundDeadlineHours !== undefined) dbUpdates.roundDeadlineHours = updates.roundDeadlineHours;
    if (updates.minGroups !== undefined) dbUpdates.minGroups = updates.minGroups;
    if (updates.maxGroups !== undefined) dbUpdates.maxGroups = updates.maxGroups;
    await db.update(schema.guildWarsTournaments).set(dbUpdates).where(eq(schema.guildWarsTournaments.id, id));
    return this.getGuildWarsTournament(id);
  }

  async createGuildWarsRegistration(tournamentId: number, groupId: number, registeredBy: number): Promise<GuildWarsRegistration> {
    const db = await this.getDb();
    const result = await db.insert(schema.guildWarsRegistrations).values({ tournamentId, groupId, registeredBy });
    const rows = await db.select().from(schema.guildWarsRegistrations).where(eq(schema.guildWarsRegistrations.id, result[0].insertId)).limit(1);
    return this.toGuildWarsRegistration(rows[0]);
  }

  async getGuildWarsRegistration(tournamentId: number, groupId: number): Promise<GuildWarsRegistration | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsRegistrations)
      .where(and(eq(schema.guildWarsRegistrations.tournamentId, tournamentId), eq(schema.guildWarsRegistrations.groupId, groupId)))
      .limit(1);
    return rows[0] ? this.toGuildWarsRegistration(rows[0]) : undefined;
  }

  async deleteGuildWarsRegistration(tournamentId: number, groupId: number): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.guildWarsRegistrations)
      .where(and(eq(schema.guildWarsRegistrations.tournamentId, tournamentId), eq(schema.guildWarsRegistrations.groupId, groupId)));
  }

  async getGuildWarsRegistrationsForTournament(tournamentId: number): Promise<GuildWarsRegistration[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsRegistrations)
      .where(eq(schema.guildWarsRegistrations.tournamentId, tournamentId))
      .orderBy(asc(schema.guildWarsRegistrations.createdAt));
    return rows.map((r: any) => this.toGuildWarsRegistration(r));
  }

  async getGuildWarsRegistrationsForGroup(groupId: number): Promise<GuildWarsRegistration[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsRegistrations)
      .where(eq(schema.guildWarsRegistrations.groupId, groupId))
      .orderBy(desc(schema.guildWarsRegistrations.createdAt));
    return rows.map((r: any) => this.toGuildWarsRegistration(r));
  }

  async createGuildWarsMatch(data: Omit<GuildWarsMatch, "id" | "createdAt">): Promise<GuildWarsMatch> {
    const db = await this.getDb();
    const result = await db.insert(schema.guildWarsMatches).values({
      tournamentId: data.tournamentId,
      round: data.round,
      group1Id: data.group1Id ?? null,
      group2Id: data.group2Id ?? null,
      winnerGroupId: data.winnerGroupId ?? null,
      status: data.status,
      deadline: data.deadline ? new Date(data.deadline) : null,
      game1Slug: data.game1Slug,
      game2Slug: data.game2Slug,
      game3Slug: data.game3Slug,
    });
    const created = await this.getGuildWarsMatch(result[0].insertId);
    return created!;
  }

  async getGuildWarsMatch(id: number): Promise<GuildWarsMatch | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsMatches).where(eq(schema.guildWarsMatches.id, id)).limit(1);
    return rows[0] ? this.toGuildWarsMatch(rows[0]) : undefined;
  }

  async listGuildWarsMatchesForTournament(tournamentId: number): Promise<GuildWarsMatch[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsMatches)
      .where(eq(schema.guildWarsMatches.tournamentId, tournamentId))
      .orderBy(asc(schema.guildWarsMatches.round), asc(schema.guildWarsMatches.id));
    return rows.map((r: any) => this.toGuildWarsMatch(r));
  }

  async updateGuildWarsMatch(id: number, updates: Partial<Pick<GuildWarsMatch, "status" | "winnerGroupId" | "deadline">>): Promise<GuildWarsMatch | undefined> {
    const db = await this.getDb();
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.winnerGroupId !== undefined) dbUpdates.winnerGroupId = updates.winnerGroupId;
    if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline ? new Date(updates.deadline) : null;
    await db.update(schema.guildWarsMatches).set(dbUpdates).where(eq(schema.guildWarsMatches.id, id));
    return this.getGuildWarsMatch(id);
  }

  async createGuildWarsMatchGame(data: Omit<GuildWarsMatchGame, "id">): Promise<GuildWarsMatchGame> {
    const db = await this.getDb();
    const result = await db.insert(schema.guildWarsMatchGames).values({
      matchId: data.matchId,
      gameNumber: data.gameNumber,
      gameSlug: data.gameSlug,
      roomCode: data.roomCode ?? null,
      winnerGroupId: data.winnerGroupId ?? null,
      status: data.status,
    });
    const rows = await db.select().from(schema.guildWarsMatchGames).where(eq(schema.guildWarsMatchGames.id, result[0].insertId)).limit(1);
    return this.toGuildWarsMatchGame(rows[0]);
  }

  async getGuildWarsMatchGame(matchId: number, gameNumber: number): Promise<GuildWarsMatchGame | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsMatchGames)
      .where(and(eq(schema.guildWarsMatchGames.matchId, matchId), eq(schema.guildWarsMatchGames.gameNumber, gameNumber)))
      .limit(1);
    return rows[0] ? this.toGuildWarsMatchGame(rows[0]) : undefined;
  }

  async getGuildWarsMatchGames(matchId: number): Promise<GuildWarsMatchGame[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsMatchGames)
      .where(eq(schema.guildWarsMatchGames.matchId, matchId))
      .orderBy(asc(schema.guildWarsMatchGames.gameNumber));
    return rows.map((r: any) => this.toGuildWarsMatchGame(r));
  }

  async updateGuildWarsMatchGame(id: number, updates: Partial<Pick<GuildWarsMatchGame, "status" | "winnerGroupId" | "roomCode">>): Promise<GuildWarsMatchGame | undefined> {
    const db = await this.getDb();
    const dbUpdates: any = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.winnerGroupId !== undefined) dbUpdates.winnerGroupId = updates.winnerGroupId;
    if (updates.roomCode !== undefined) dbUpdates.roomCode = updates.roomCode;
    await db.update(schema.guildWarsMatchGames).set(dbUpdates).where(eq(schema.guildWarsMatchGames.id, id));
    const rows = await db.select().from(schema.guildWarsMatchGames).where(eq(schema.guildWarsMatchGames.id, id)).limit(1);
    return rows[0] ? this.toGuildWarsMatchGame(rows[0]) : undefined;
  }

  async getGuildWarsMatchGameByRoomCode(roomCode: string): Promise<GuildWarsMatchGame | undefined> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsMatchGames)
      .where(eq(schema.guildWarsMatchGames.roomCode, roomCode))
      .limit(1);
    return rows[0] ? this.toGuildWarsMatchGame(rows[0]) : undefined;
  }

  async createGuildWarsChampion(tournamentId: number, groupId: number, tournamentName: string): Promise<GuildWarsChampion> {
    const db = await this.getDb();
    const result = await db.insert(schema.guildWarsChampions).values({ tournamentId, groupId, tournamentName });
    const rows = await db.select().from(schema.guildWarsChampions).where(eq(schema.guildWarsChampions.id, result[0].insertId)).limit(1);
    return this.toGuildWarsChampion(rows[0]);
  }

  async getWordWarsStatsForGroup(groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
    const db = await this.getDb();
    const members = await this.getGroupMembers(groupId);
    const memberIds = members.map(m => m.user.id);
    if (memberIds.length === 0) return { tournamentsEntered: 0, matchWins: 0, matchLosses: 0 };

    const regRows = await db.select().from(schema.wordWarsRegistrations)
      .where(inArray(schema.wordWarsRegistrations.userId, memberIds));
    const tournamentsEntered = new Set(regRows.map(r => r.tournamentId)).size;

    const matchRows = await db.select().from(schema.wordWarsMatches)
      .where(
        and(
          or(
            inArray(schema.wordWarsMatches.player1Id, memberIds),
            inArray(schema.wordWarsMatches.player2Id, memberIds)
          ),
          or(
            eq(schema.wordWarsMatches.status, "completed"),
            eq(schema.wordWarsMatches.status, "forfeited")
          )
        )
      );

    let matchWins = 0;
    let matchLosses = 0;
    for (const m of matchRows) {
      if (m.winnerId !== null && memberIds.includes(m.winnerId)) matchWins++;
      else if (m.winnerId !== null) matchLosses++;
    }
    return { tournamentsEntered, matchWins, matchLosses };
  }

  async getGuildWarsChampionsForTournament(tournamentId: number): Promise<GuildWarsChampion[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsChampions)
      .where(eq(schema.guildWarsChampions.tournamentId, tournamentId));
    return rows.map((r: any) => this.toGuildWarsChampion(r));
  }

  async getGuildWarsChampionshipsForGroup(groupId: number): Promise<GuildWarsChampion[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsChampions)
      .where(eq(schema.guildWarsChampions.groupId, groupId))
      .orderBy(desc(schema.guildWarsChampions.createdAt));
    return rows.map((r: any) => this.toGuildWarsChampion(r));
  }

  async listAllGuildWarsChampions(): Promise<GuildWarsChampion[]> {
    const db = await this.getDb();
    const rows = await db.select().from(schema.guildWarsChampions)
      .orderBy(desc(schema.guildWarsChampions.createdAt));
    return rows.map((r: any) => this.toGuildWarsChampion(r));
  }

  async getGuildWarsStatsForGroup(groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
    const db = await this.getDb();
    const regRows = await db.select().from(schema.guildWarsRegistrations)
      .where(eq(schema.guildWarsRegistrations.groupId, groupId));
    const tournamentsEntered = regRows.length;

    const matchRows = await db.select().from(schema.guildWarsMatches)
      .where(
        and(
          or(
            eq(schema.guildWarsMatches.group1Id, groupId),
            eq(schema.guildWarsMatches.group2Id, groupId)
          ),
          or(
            eq(schema.guildWarsMatches.status, "completed"),
            eq(schema.guildWarsMatches.status, "forfeited")
          )
        )
      );

    let matchWins = 0;
    let matchLosses = 0;
    for (const m of matchRows) {
      if (m.winnerGroupId === groupId) matchWins++;
      else if (m.winnerGroupId !== null) matchLosses++;
    }
    return { tournamentsEntered, matchWins, matchLosses };
  }

  async expireFriendChallenges(): Promise<number> {
    const db = await this.getDb();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await db.update(schema.friendChallenges)
      .set({ status: "cancelled" })
      .where(and(
        eq(schema.friendChallenges.status, "pending"),
        sql`${schema.friendChallenges.createdAt} < ${cutoff}`
      ));
    return (result as any)[0]?.affectedRows ?? 0;
  }

  async getRecentCommentCount(userId: number, since: Date): Promise<number> {
    const db = await this.getDb();
    const rows = await db.select({ cnt: sql<number>`COUNT(*)` })
      .from(schema.comments)
      .where(and(
        eq(schema.comments.userId, userId),
        eq(schema.comments.isDeleted, false),
        sql`${schema.comments.createdAt} >= ${since}`
      ));
    return Number(rows[0]?.cnt ?? 0);
  }

  async deleteUser(id: number): Promise<void> {
    const db = await this.getDb();
    await db.delete(schema.leaderboardEntries).where(eq(schema.leaderboardEntries.userId, id));
    await db.delete(schema.userAchievements).where(eq(schema.userAchievements.userId, id));
    await db.delete(schema.userStreaks).where(eq(schema.userStreaks.userId, id));
    await db.delete(schema.userGameStats).where(eq(schema.userGameStats.userId, id));
    await db.delete(schema.friendships).where(or(eq(schema.friendships.requesterId, id), eq(schema.friendships.addresseeId, id)));
    await db.delete(schema.friendChallenges).where(or(eq(schema.friendChallenges.senderId, id), eq(schema.friendChallenges.receiverId, id)));
    await db.delete(schema.notifications).where(eq(schema.notifications.userId, id));
    await db.delete(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, id));
    await db.delete(schema.emailVerificationTokens).where(eq(schema.emailVerificationTokens.userId, id));
    await db.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.userId, id));
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async getFriendsWhoPlayGame(gameSlug: string, userId: number): Promise<Array<{ id: number; name: string; avatarUrl: string | null; gamesPlayed: number }>> {
    const db = await this.getDb();
    const friendships = await db.select({
      requesterId: schema.friendships.requesterId,
      addresseeId: schema.friendships.addresseeId,
    }).from(schema.friendships)
      .where(and(
        eq(schema.friendships.status, "accepted"),
        or(eq(schema.friendships.requesterId, userId), eq(schema.friendships.addresseeId, userId))
      ));
    const friendIds = friendships.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
    if (friendIds.length === 0) return [];

    const statsRows = await db.select({
      userId: schema.userGameStats.userId,
      gamesPlayed: schema.userGameStats.gamesPlayed,
    }).from(schema.userGameStats)
      .where(and(
        inArray(schema.userGameStats.userId, friendIds),
        eq(schema.userGameStats.gameSlug, gameSlug),
        sql`${schema.userGameStats.gamesPlayed} > 0`
      ));
    if (statsRows.length === 0) return [];

    const playedIds = statsRows.map(s => s.userId);
    const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
      .from(schema.users).where(inArray(schema.users.id, playedIds));

    return userRows.map(u => ({
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl ?? null,
      gamesPlayed: statsRows.find(s => s.userId === u.id)?.gamesPlayed ?? 0,
    })).sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  }

  async getUsersWithStreakAtRisk(): Promise<Array<{ userId: number; currentStreak: number }>> {
    const db = await this.getDb();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const rows = await db.select({ userId: schema.userStreaks.userId, currentStreak: schema.userStreaks.currentStreak })
      .from(schema.userStreaks)
      .where(and(
        sql`${schema.userStreaks.currentStreak} > 0`,
        eq(schema.userStreaks.lastPlayedDate, yesterdayStr)
      ));
    return rows.map(r => ({ userId: r.userId, currentStreak: r.currentStreak }));
  }

  async getSiteSetting(key: string): Promise<string | null> {
    const db = await this.getDb();
    const rows = await db.select({ value: schema.siteSettings.value })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.key, key));
    return rows[0]?.value ?? null;
  }

  async setSiteSetting(key: string, value: string | null): Promise<void> {
    const db = await this.getDb();
    if (value === null) {
      await db.delete(schema.siteSettings).where(eq(schema.siteSettings.key, key));
    } else {
      await db.insert(schema.siteSettings)
        .values({ key, value })
        .onDuplicateKeyUpdate({ set: { value } });
    }
  }
}
