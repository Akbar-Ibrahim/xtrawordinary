import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordLengthConfig, LetterPositionConfig, ContainsConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid, WordLadderPuzzle, User, InsertUser, EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement } from "@shared/schema";
import type { IStorage, LengthConstraint, PositionConstraint, ContainsConstraint } from "./storage";
import { gamesData, wordLadderPuzzlesData, anagramWordSets, scrambleWords, definitionWords, letterPoolBaseWords, generateLetterPool, makerWords, wordDictionary, wordLengthConfig, letterPositionConfig, containsConfig, wordChainConfig, vowelConsonantConfig, wordStackPuzzles, wordSplitPuzzles, progressiveRevealWords } from "./game-data";

export class MemStorage implements IStorage {
  private games: Game[];

  constructor() {
    this.games = gamesData;
  }

  async getGames(): Promise<Game[]> {
    return this.games;
  }

  async getGameBySlug(slug: string): Promise<Game | undefined> {
    return this.games.find((game) => game.slug === slug);
  }

  async getWordLadderPuzzles(): Promise<WordLadderPuzzle[]> {
    return wordLadderPuzzlesData;
  }

  async getAnagramWordSets(): Promise<AnagramWordSet[]> {
    return anagramWordSets;
  }

  async getScrambleWords(): Promise<ScrambleWord[]> {
    return scrambleWords;
  }

  async getDefinitionWords(): Promise<DefinitionWord[]> {
    return definitionWords;
  }

  async getLetterPoolWords(): Promise<LetterPoolWord[]> {
    return letterPoolBaseWords.map(w => ({
      ...w,
      letterPool: generateLetterPool(w.word),
    }));
  }

  async getMakerWords(): Promise<MakerWord[]> {
    return makerWords;
  }

  async getWordStackPuzzles(): Promise<WordStackPuzzle[]> {
    return wordStackPuzzles;
  }

  async getWordSplitPuzzles(): Promise<WordSplitPuzzle[]> {
    return wordSplitPuzzles;
  }

  async getWordDictionary(): Promise<string[]> {
    return wordDictionary;
  }

  async validateWord(word: string): Promise<boolean> {
    return wordDictionary.includes(word.toUpperCase());
  }

  async getWordLengthConfig(): Promise<WordLengthConfig> {
    return wordLengthConfig;
  }

  async getLetterPositionConfig(): Promise<LetterPositionConfig> {
    return letterPositionConfig;
  }

  async getContainsConfig(): Promise<ContainsConfig> {
    return containsConfig;
  }

  async getWordChainConfig(): Promise<WordChainConfig> {
    return wordChainConfig;
  }

  async getVowelConsonantConfig(): Promise<VowelConsonantConfig> {
    return vowelConsonantConfig;
  }

  async generateLengthConstraint(level: number): Promise<LengthConstraint> {
    const lengths = [5, 6, 7, 8];
    const minWords = 10;
    
    for (const length of lengths) {
      const wordsOfLength = wordDictionary.filter(w => w.length === length);
      if (wordsOfLength.length < minWords) continue;
      
      switch (level) {
        case 1:
          if (wordsOfLength.length >= minWords) {
            return { length };
          }
          break;
        case 2: {
          const startLetters = Array.from(new Set(wordsOfLength.map(w => w[0])));
          for (const letter of startLetters.sort(() => Math.random() - 0.5)) {
            if (wordsOfLength.filter(w => w.startsWith(letter)).length >= minWords) {
              return { length, startsWith: letter };
            }
          }
          break;
        }
        case 3: {
          const endLetters = Array.from(new Set(wordsOfLength.map(w => w[w.length - 1])));
          for (const letter of endLetters.sort(() => Math.random() - 0.5)) {
            if (wordsOfLength.filter(w => w.endsWith(letter)).length >= minWords) {
              return { length, endsWith: letter };
            }
          }
          break;
        }
        case 4: {
          const startLetters = Array.from(new Set(wordsOfLength.map(w => w[0])));
          for (const startLetter of startLetters.sort(() => Math.random() - 0.5)) {
            const matching = wordsOfLength.filter(w => w.startsWith(startLetter));
            if (matching.length >= minWords) {
              const containsLetters = Array.from(new Set(matching.flatMap(w => w.slice(1).split(""))));
              for (const containsLetter of containsLetters.sort(() => Math.random() - 0.5)) {
                if (matching.filter(w => w.slice(1).includes(containsLetter)).length >= minWords) {
                  return { length, startsWith: startLetter, contains: containsLetter };
                }
              }
              return { length, startsWith: startLetter };
            }
          }
          break;
        }
        case 5: {
          const endLetters = Array.from(new Set(wordsOfLength.map(w => w[w.length - 1])));
          for (const endLetter of endLetters.sort(() => Math.random() - 0.5)) {
            const matching = wordsOfLength.filter(w => w.endsWith(endLetter));
            if (matching.length >= minWords) {
              const containsLetters = Array.from(new Set(matching.flatMap(w => w.slice(0, -1).split(""))));
              for (const containsLetter of containsLetters.sort(() => Math.random() - 0.5)) {
                if (matching.filter(w => w.slice(0, -1).includes(containsLetter)).length >= minWords) {
                  return { length, endsWith: endLetter, contains: containsLetter };
                }
              }
              return { length, endsWith: endLetter };
            }
          }
          break;
        }
      }
    }
    return { length: 5 };
  }

  async generatePositionConstraint(): Promise<PositionConstraint> {
    const positions = [2, 3, 4, 5];
    const minWords = 10;
    
    for (const position of positions.sort(() => Math.random() - 0.5)) {
      const validWords = wordDictionary.filter(w => w.length >= position);
      if (validWords.length < minWords) continue;
      
      const letters = Array.from(new Set(validWords.map(w => w[position - 1])));
      for (const letter of letters.sort(() => Math.random() - 0.5)) {
        const matching = validWords.filter(w => w[position - 1] === letter);
        if (matching.length >= minWords) {
          return { position, letter };
        }
      }
    }
    return { position: 2, letter: "A" };
  }

  async generateContainsConstraint(): Promise<ContainsConstraint> {
    const minWords = 10;
    const letterCounts: Record<string, number> = {};
    
    for (const word of wordDictionary) {
      const letters = Array.from(new Set(word.split("")));
      for (const letter of letters) {
        letterCounts[letter] = (letterCounts[letter] || 0) + 1;
      }
    }
    
    const sortedLetters = Object.entries(letterCounts)
      .filter(([_, count]) => count >= minWords)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(([letter]) => letter);
    
    if (sortedLetters.length < 3) {
      return { letters: ["E", "A", "T"] };
    }
    
    const matchingWords = wordDictionary.filter(w => 
      sortedLetters.every(letter => w.includes(letter))
    );
    
    if (matchingWords.length < minWords) {
      const commonLetters = Object.entries(letterCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([letter]) => letter);
      
      for (let i = 0; i < commonLetters.length - 2; i++) {
        for (let j = i + 1; j < commonLetters.length - 1; j++) {
          for (let k = j + 1; k < commonLetters.length; k++) {
            const combo = [commonLetters[i], commonLetters[j], commonLetters[k]];
            const matches = wordDictionary.filter(w => combo.every(l => w.includes(l)));
            if (matches.length >= minWords) {
              return { letters: combo };
            }
          }
        }
      }
      return { letters: [commonLetters[0], commonLetters[1]] };
    }
    
    return { letters: sortedLetters };
  }

  async getWordChainStartWord(_variation: number, _level: number): Promise<string | null> {
    if (wordDictionary.length === 0) return null;
    return wordDictionary[Math.floor(Math.random() * wordDictionary.length)];
  }

  async getWordChainComputerWord(playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null> {
    const usedSet = new Set(usedWords.map(w => w.toUpperCase()));
    const upperPlayerWord = playerWord.toUpperCase();
    
    const startsWith = variation === 1 ? upperPlayerWord[upperPlayerWord.length - 1] : upperPlayerWord.slice(-2);
    
    let candidates = wordDictionary.filter(w => 
      !usedSet.has(w) && 
      w.startsWith(startsWith)
    );
    
    if (level === 2) {
      candidates = candidates.filter(w => w.length === upperPlayerWord.length);
    }
    
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]> {
    return progressiveRevealWords;
  }

  async generateWordSweepGrid(): Promise<WordSweepGrid> {
    const size = 6;
    const totalCells = size * size;

    const vowels = "AEIOU";
    const uncommonLetters = "JKQVXZ";

    const archetypes = [
      { name: "normal", vowelRatio: 0.39, uncommonMin: 2, uncommonMax: 3 },
      { name: "uncommon", vowelRatio: 0.39, uncommonMin: 4, uncommonMax: 6 },
      { name: "vowel-rich", vowelRatio: 0.47, uncommonMin: 1, uncommonMax: 2 },
    ];
    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    const vowelWeights: Record<string, number> = { A: 8, E: 12, I: 7, O: 8, U: 3 };
    const consonantWeightsNormal: Record<string, number> = {
      B: 2, C: 3, D: 4, F: 2, G: 2, H: 6, J: 1, K: 1, L: 4, M: 3,
      N: 7, P: 2, Q: 1, R: 6, S: 6, T: 9, V: 1, W: 2, X: 1, Y: 2, Z: 1,
    };

    function buildPool(weights: Record<string, number>): string[] {
      const pool: string[] = [];
      for (const [letter, weight] of Object.entries(weights)) {
        for (let i = 0; i < weight; i++) pool.push(letter);
      }
      return pool;
    }

    function pickRandom<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function shuffle<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    const seedWords = wordDictionary.filter(w => w.length >= 3 && w.length <= 5);
    const seedCount = 2 + Math.floor(Math.random() * 2);
    const chosenSeeds: string[] = [];
    const usedLetterBudget: string[] = [];
    const shuffledSeeds = shuffle(seedWords);
    for (const word of shuffledSeeds) {
      if (chosenSeeds.length >= seedCount) break;
      if (usedLetterBudget.length + word.length > Math.floor(totalCells * 0.5)) break;
      chosenSeeds.push(word);
      usedLetterBudget.push(...word.split(""));
    }

    const cells: string[] = new Array(totalCells).fill("");
    const positions = shuffle(Array.from({ length: totalCells }, (_, i) => i));
    let posIdx = 0;

    for (const letter of usedLetterBudget) {
      cells[positions[posIdx++]] = letter;
    }

    const currentVowelCount = usedLetterBudget.filter(l => vowels.includes(l)).length;
    const currentUncommonCount = usedLetterBudget.filter(l => uncommonLetters.includes(l)).length;

    const targetVowels = Math.round(totalCells * archetype.vowelRatio);
    const targetUncommon = archetype.uncommonMin + Math.floor(Math.random() * (archetype.uncommonMax - archetype.uncommonMin + 1));

    let vowelsNeeded = Math.max(0, targetVowels - currentVowelCount);
    let uncommonNeeded = Math.max(0, targetUncommon - currentUncommonCount);
    let remainingSlots = totalCells - posIdx;

    const vowelPool = buildPool(vowelWeights);
    const consonantPool = buildPool(consonantWeightsNormal);
    const uncommonPool = uncommonLetters.split("");

    let placedVowels = currentVowelCount;
    let placedUncommon = currentUncommonCount;

    for (let i = posIdx; i < totalCells; i++) {
      const idx = positions[i];
      if (placedUncommon < targetUncommon && Math.random() < uncommonNeeded / Math.max(1, remainingSlots)) {
        cells[idx] = pickRandom(uncommonPool);
        placedUncommon++;
        uncommonNeeded--;
        if (vowels.includes(cells[idx])) {
          placedVowels++;
          vowelsNeeded = Math.max(0, vowelsNeeded - 1);
        }
      } else if (placedVowels < targetVowels && Math.random() < vowelsNeeded / Math.max(1, remainingSlots)) {
        cells[idx] = pickRandom(vowelPool);
        placedVowels++;
        vowelsNeeded--;
      } else {
        cells[idx] = pickRandom(consonantPool);
      }
      remainingSlots--;
    }

    const grid: string[][] = [];
    for (let row = 0; row < size; row++) {
      grid.push(cells.slice(row * size, (row + 1) * size));
    }

    return { grid, size };
  }

  private users: Map<number, User> = new Map();
  private userIdCounter = 1;
  private emailVerificationTokens: Map<string, EmailVerificationToken> = new Map();
  private evtIdCounter = 1;
  private passwordResetTokens: Map<string, PasswordResetToken> = new Map();
  private prtIdCounter = 1;
  private userGameStatsMap: Map<string, UserGameStats> = new Map();
  private ugsIdCounter = 1;
  private leaderboardEntries: LeaderboardEntry[] = [];
  private lbIdCounter = 1;
  private userStreaks: Map<number, UserStreak> = new Map();
  private usIdCounter = 1;
  private userAchievements: UserAchievement[] = [];
  private uaIdCounter = 1;

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      ...user,
      id: this.userIdCounter++,
      createdAt: new Date().toISOString(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.googleId === googleId);
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async createEmailVerificationToken(userId: number, token: string, expiresAt: string): Promise<EmailVerificationToken> {
    const evt: EmailVerificationToken = { id: this.evtIdCounter++, userId, token, expiresAt };
    this.emailVerificationTokens.set(token, evt);
    return evt;
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    return this.emailVerificationTokens.get(token);
  }

  async deleteEmailVerificationToken(token: string): Promise<void> {
    this.emailVerificationTokens.delete(token);
  }

  async createPasswordResetToken(userId: number, token: string, expiresAt: string): Promise<PasswordResetToken> {
    const prt: PasswordResetToken = { id: this.prtIdCounter++, userId, token, expiresAt };
    this.passwordResetTokens.set(token, prt);
    return prt;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return this.passwordResetTokens.get(token);
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    this.passwordResetTokens.delete(token);
  }

  async saveUserGameStats(stats: InsertUserGameStats): Promise<UserGameStats> {
    const key = `${stats.userId}-${stats.gameSlug}`;
    const existing = this.userGameStatsMap.get(key);
    if (existing) {
      const updated: UserGameStats = { ...existing, ...stats };
      this.userGameStatsMap.set(key, updated);
      return updated;
    }
    const newStats: UserGameStats = { ...stats, id: this.ugsIdCounter++ };
    this.userGameStatsMap.set(key, newStats);
    return newStats;
  }

  async getUserGameStats(userId: number, gameSlug: string): Promise<UserGameStats | undefined> {
    return this.userGameStatsMap.get(`${userId}-${gameSlug}`);
  }

  async getAllUserGameStats(userId: number): Promise<UserGameStats[]> {
    return Array.from(this.userGameStatsMap.values()).filter(s => s.userId === userId);
  }

  async saveLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
    const newEntry: LeaderboardEntry = { ...entry, id: this.lbIdCounter++ };
    this.leaderboardEntries.push(newEntry);
    return newEntry;
  }

  async getLeaderboard(gameSlug: string, limit = 50): Promise<LeaderboardEntry[]> {
    return this.leaderboardEntries
      .filter(e => e.gameSlug === gameSlug)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getOverallLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const playerTotals = new Map<number, { userId: number; playerName: string; score: number; playedAt: string }>();
    for (const entry of this.leaderboardEntries) {
      const existing = playerTotals.get(entry.userId);
      if (existing) {
        existing.score += entry.score;
        if (entry.playedAt > existing.playedAt) existing.playedAt = entry.playedAt;
      } else {
        playerTotals.set(entry.userId, { userId: entry.userId, playerName: entry.playerName, score: entry.score, playedAt: entry.playedAt });
      }
    }
    return Array.from(playerTotals.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((p, i) => ({ id: i + 1, ...p, gameSlug: "overall" }));
  }

  async getUserStreak(userId: number): Promise<UserStreak | undefined> {
    return this.userStreaks.get(userId);
  }

  async saveUserStreak(userId: number, currentStreak: number, longestStreak: number, lastPlayedDate: string): Promise<UserStreak> {
    const existing = this.userStreaks.get(userId);
    if (existing) {
      existing.currentStreak = currentStreak;
      existing.longestStreak = longestStreak;
      existing.lastPlayedDate = lastPlayedDate;
      return existing;
    }
    const streak: UserStreak = { id: this.usIdCounter++, userId, currentStreak, longestStreak, lastPlayedDate };
    this.userStreaks.set(userId, streak);
    return streak;
  }

  async getUserAchievements(userId: number): Promise<UserAchievement[]> {
    return this.userAchievements.filter(a => a.userId === userId);
  }

  async saveUserAchievement(userId: number, achievementId: string, unlockedAt: string): Promise<UserAchievement> {
    const existing = this.userAchievements.find(a => a.userId === userId && a.achievementId === achievementId);
    if (existing) return existing;
    const achievement: UserAchievement = { id: this.uaIdCounter++, userId, achievementId, unlockedAt };
    this.userAchievements.push(achievement);
    return achievement;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteLeaderboardEntry(id: number): Promise<void> {
    this.leaderboardEntries = this.leaderboardEntries.filter(e => e.id !== id);
  }

  async getAdminStats(): Promise<{ totalUsers: number; totalGamesPlayed: number; gamesPerSlug: Record<string, number> }> {
    const totalUsers = this.users.size;
    let totalGamesPlayed = 0;
    const gamesPerSlug: Record<string, number> = {};
    for (const stats of this.userGameStatsMap.values()) {
      totalGamesPlayed += stats.gamesPlayed;
      gamesPerSlug[stats.gameSlug] = (gamesPerSlug[stats.gameSlug] || 0) + stats.gamesPlayed;
    }
    return { totalUsers, totalGamesPlayed, gamesPerSlug };
  }

  async getAllLeaderboardEntries(): Promise<LeaderboardEntry[]> {
    return [...this.leaderboardEntries].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }
}
