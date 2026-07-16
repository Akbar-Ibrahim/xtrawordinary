import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordRootsPuzzle, WordLengthConfig, LetterPositionConfig, LetterHuntConfig, WordChainConfig, VowelConsonantConfig, WordStackPuzzle, WordSplitPuzzle, ProgressiveRevealWord, WordSweepGrid, WordUnpackPuzzle, WordLadderPuzzle, LadderRushPuzzle, User, InsertUser, EmailVerificationToken, PasswordResetToken, UserGameStats, InsertUserGameStats, LeaderboardEntry, InsertLeaderboardEntry, UserStreak, UserAchievement, Friendship, InsertFriendship, FriendChallenge, InsertFriendChallenge, Group, InsertGroup, GroupMember, GroupRound, InsertGroupRound, GroupRoundScore, GroupScoreReaction, GroupActivityEntry, GroupRoundAttempt, DailyChallengeAttempt, Comment, InsertComment, CommentReport, CommentTargetType, LikeTargetType, QuizSession, InsertQuizSession, QuizSessionScore, DuelChallenge, InsertDuelChallenge, DuelChallengeStatus, DuelSession, InsertDuelSession, DuelRating, HuddleChallenge, InsertHuddleChallenge, TeamRaceChallenge, InsertTeamRaceChallenge, Notification, InsertNotification, NotificationType, WordWarsTournament, InsertWordWarsTournament, WordWarsRegistration, WordWarsMatch, WordWarsMatchGame, WordWarsChampion, GuildWarsTournament, InsertGuildWarsTournament, GuildWarsRegistration, GuildWarsMatch, GuildWarsMatchGame, GuildWarsChampion, GroupSeason, InsertGroupSeason } from "@shared/schema";
import { notificationTypeSchema } from "@shared/schema";
import type { IStorage, LengthConstraint, PositionConstraint, ContainsConstraint } from "./storage";
import { mulberry32 } from "./seeded-rng";
import { gamesData, wordLadderPuzzlesData, ladderRushStartWords, anagramWordSets, scrambleWords, definitionWords, letterPoolBaseWords, generateLetterPool, makerWords, wordDictionary, wordLengthConfig, letterPositionConfig, letterHuntConfig, wordChainConfig, vowelConsonantConfig, wordStackPuzzles, wordSplitPuzzles, progressiveRevealWords, shellWordSet, shellWordPuzzles, crackPuzzles, deepShellWordSet, deepShellWordPuzzles, deepCrackPuzzles, wordStretchPuzzles, wordBloomPuzzles, wordDictSet } from "./game-data";

function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export class MemStorage implements IStorage {
  private games: Game[];
  private quizSessions: QuizSession[] = [];
  private quizSessionScores: QuizSessionScore[] = [];
  private quizIdCounter = 1;
  private quizScoreIdCounter = 1;

  private duelChallenges: DuelChallenge[] = [];
  private duelChallengeIdCounter = 1;
  private duelSessions: DuelSession[] = [];
  private duelSessionIdCounter = 1;
  private duelRatings: DuelRating[] = [];
  private duelRatingIdCounter = 1;

  private huddleChallenges: HuddleChallenge[] = [];
  private huddleChallengeIdCounter = 1;

  private teamRaceChallenges: TeamRaceChallenge[] = [];
  private teamRaceChallengeIdCounter = 1;

  private wordWarsTournaments: WordWarsTournament[] = [];
  private wordWarsTournamentIdCounter = 1;
  private wordWarsRegistrations: WordWarsRegistration[] = [];
  private wordWarsRegistrationIdCounter = 1;
  private wordWarsMatches: WordWarsMatch[] = [];
  private wordWarsMatchIdCounter = 1;
  private wordWarsMatchGames: WordWarsMatchGame[] = [];
  private wordWarsMatchGameIdCounter = 1;
  private wordWarsChampions: WordWarsChampion[] = [];
  private wordWarsChampionIdCounter = 1;

  private guildWarsTournaments: GuildWarsTournament[] = [];
  private guildWarsTournamentIdCounter = 1;
  private guildWarsRegistrations: GuildWarsRegistration[] = [];
  private guildWarsRegistrationIdCounter = 1;
  private guildWarsMatches: GuildWarsMatch[] = [];
  private guildWarsMatchIdCounter = 1;
  private guildWarsMatchGames: GuildWarsMatchGame[] = [];
  private guildWarsMatchGameIdCounter = 1;
  private guildWarsChampions: GuildWarsChampion[] = [];
  private guildWarsChampionIdCounter = 1;

  private notifications: Notification[] = [];
  private notificationIdCounter = 1;
  private notificationPrefsMap: Map<string, boolean> = new Map();
  private siteSettingsMap: Map<string, string> = new Map();

  constructor() {
    this.games = gamesData;
  }

  async getGames(): Promise<Game[]> {
    return this.games;
  }

  async getAllGames(): Promise<Game[]> {
    return this.games;
  }

  async setGameActive(_slug: string, _isActive: boolean): Promise<void> {
    // no-op for in-memory storage
  }

  async getGameBySlug(slug: string): Promise<Game | undefined> {
    return this.games.find((game) => game.slug === slug);
  }

  async getWordLadderPuzzles(): Promise<WordLadderPuzzle[]> {
    return wordLadderPuzzlesData;
  }

  async getLadderRushPuzzles(wordLength: number): Promise<LadderRushPuzzle[]> {
    const starts = ladderRushStartWords[wordLength] ?? [];
    return starts.map(start => ({ start, wordLength }));
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

  async getWordRootsPuzzles(): Promise<WordRootsPuzzle[]> {
    return makerWords.map(w => ({ canonicalWord: w.baseWord, derivatives: w.derivatives }));
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

  async countLetterPositionWords(letter: string, position: number): Promise<number> {
    const upper = letter.toUpperCase();
    const idx = position - 1;
    return wordDictionary.filter(w => w.length > idx && w[idx] === upper).length;
  }

  async getWordExamples(game: "letter-hunt" | "letter-dodge", letters: string[], limit: number): Promise<{ words: string[]; total: number }> {
    if (letters.length === 0) return { words: [], total: 0 };
    const upper = letters.map(l => l.toUpperCase());
    const matches = wordDictionary.filter(w =>
      game === "letter-hunt"
        ? upper.every(l => w.includes(l))
        : upper.every(l => !w.includes(l))
    );
    const total = matches.length;
    const shuffled = [...matches].sort(() => Math.random() - 0.5).slice(0, limit);
    return { words: shuffled, total };
  }

  async countWordLengthWords(length: number, startsWith?: string, endsWith?: string, contains?: string): Promise<number> {
    return wordDictionary.filter(w => {
      if (w.length !== length) return false;
      if (startsWith && !w.startsWith(startsWith.toUpperCase())) return false;
      if (endsWith && !w.endsWith(endsWith.toUpperCase())) return false;
      if (contains && !w.includes(contains.toUpperCase())) return false;
      return true;
    }).length;
  }

  async getWordLengthConfig(): Promise<WordLengthConfig> {
    return wordLengthConfig;
  }

  async getLetterPositionConfig(): Promise<LetterPositionConfig> {
    return letterPositionConfig;
  }

  async getLetterHuntConfig(): Promise<LetterHuntConfig> {
    return letterHuntConfig;
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
    const EXCLUDED_LETTERS = new Set(["Z", "X", "Q", "J", "V"]);
    const letterCounts: Record<string, number> = {};
    
    for (const word of wordDictionary) {
      const letters = Array.from(new Set(word.split("")));
      for (const letter of letters) {
        letterCounts[letter] = (letterCounts[letter] || 0) + 1;
      }
    }
    
    const sortedLetters = Object.entries(letterCounts)
      .filter(([letter, count]) => count >= minWords && !EXCLUDED_LETTERS.has(letter))
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

  async getWordChainStartWord(_variation: number, _level: number, seed?: number): Promise<string | null> {
    if (wordDictionary.length === 0) return null;
    if (seed !== undefined) {
      return wordDictionary[seed % wordDictionary.length];
    }
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
      candidates = candidates.filter(w => w.length >= 3 && w.length <= 8);
    }
    
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  async getProgressiveRevealWords(): Promise<ProgressiveRevealWord[]> {
    return progressiveRevealWords;
  }

  async generateWordUnpackPuzzle(seed?: number): Promise<WordUnpackPuzzle> {
    const TARGET = 36;
    const SIZE = 6;
    const MIN_WORDS = 5;
    const MAX_WORDS = 9;
    const rng = seed !== undefined ? mulberry32(seed) : Math.random;

    function shuffle<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    const candidates = wordDictionary.filter(w => w.length >= 3 && w.length <= 8);

    // Try up to 50 shuffles to find a set of 5–9 words summing to exactly 36
    let chosenWords: string[] = [];
    for (let attempt = 0; attempt < 50; attempt++) {
      const shuffled = shuffle(candidates);
      const words: string[] = [];
      let remaining = TARGET;

      for (const word of shuffled) {
        if (remaining === 0) break;
        if (words.length >= MAX_WORDS) break;
        if (word.length > remaining) continue;

        const afterThis = remaining - word.length;

        if (afterThis === 0) {
          // Perfect fill — only accept if we'll have enough words
          if (words.length + 1 >= MIN_WORDS) {
            words.push(word);
            remaining = 0;
          }
          // Too few words — skip this exact match and keep looking
          continue;
        }

        // afterThis > 0: ensure the gap can still be filled within the remaining word budget
        if (afterThis < 3) continue; // Gap too small for any word
        const wordsLeft = MAX_WORDS - (words.length + 1);
        if (wordsLeft === 0) continue; // Already at max words but didn't land on 0
        if (afterThis > wordsLeft * 8) continue; // Gap too large to fill with remaining budget

        words.push(word);
        remaining -= word.length;
      }

      if (remaining === 0 && words.length >= MIN_WORDS && words.length <= MAX_WORDS) {
        chosenWords = words;
        break;
      }
    }

    // Guaranteed fallback: 6 six-letter words = exactly 36 letters, always valid
    if (chosenWords.length === 0) {
      const sixLetters = shuffle(candidates.filter(w => w.length === 6));
      chosenWords = sixLetters.slice(0, 6);
    }

    // Combine all letters, shuffle, build grid
    const allLetters = chosenWords.flatMap(w => w.split(""));
    const shuffledLetters = shuffle(allLetters);

    const grid: string[][] = [];
    for (let row = 0; row < SIZE; row++) {
      grid.push(shuffledLetters.slice(row * SIZE, (row + 1) * SIZE));
    }

    return { grid, size: SIZE, words: chosenWords };
  }

  async validateShellWord(word: string): Promise<{ valid: boolean; innerWord: string | null }> {
    const upper = word.toUpperCase().trim();
    if (upper.length < 4) return { valid: false, innerWord: null };
    const inner = upper.slice(1, -1);
    if (shellWordSet.has(upper)) {
      return { valid: true, innerWord: inner };
    }
    return { valid: false, innerWord: null };
  }

  async getShellWordPuzzle(seed: number): Promise<{ middle: string; count: number } | null> {
    if (shellWordPuzzles.length === 0) return null;
    const idx = ((seed % shellWordPuzzles.length) + shellWordPuzzles.length) % shellWordPuzzles.length;
    const puzzle = shellWordPuzzles[idx];
    return { middle: puzzle.middle, count: puzzle.wrappers.length };
  }

  async getCrackPuzzle(seed: number): Promise<{ first: string; last: string } | null> {
    if (crackPuzzles.length === 0) return null;
    const idx = ((seed % crackPuzzles.length) + crackPuzzles.length) % crackPuzzles.length;
    return crackPuzzles[idx];
  }

  async validateDeepShellWord(word: string): Promise<{ valid: boolean; innerWord: string | null }> {
    const upper = word.toUpperCase().trim();
    if (upper.length < 7) return { valid: false, innerWord: null };
    const inner = upper.slice(2, -2);
    if (deepShellWordSet.has(upper)) {
      return { valid: true, innerWord: inner };
    }
    return { valid: false, innerWord: null };
  }

  async getDeepShellWordPuzzle(seed: number): Promise<{ middle: string; count: number } | null> {
    if (deepShellWordPuzzles.length === 0) return null;
    const idx = ((seed % deepShellWordPuzzles.length) + deepShellWordPuzzles.length) % deepShellWordPuzzles.length;
    const puzzle = deepShellWordPuzzles[idx];
    return { middle: puzzle.middle, count: puzzle.wrappers.length };
  }

  async getDeepCrackPuzzle(seed: number): Promise<{ first: string; last: string } | null> {
    if (deepCrackPuzzles.length === 0) return null;
    const idx = ((seed % deepCrackPuzzles.length) + deepCrackPuzzles.length) % deepCrackPuzzles.length;
    return deepCrackPuzzles[idx];
  }

  async getDeepCrackAnswer(seed: number): Promise<string | null> {
    const pair = await this.getDeepCrackPuzzle(seed);
    if (!pair) return null;
    for (const word of deepShellWordSet) {
      if (word.slice(0, 2) === pair.first && word.slice(-2) === pair.last) {
        return word.slice(2, -2);
      }
    }
    return null;
  }

  async getWordStretchPuzzle(seed: number): Promise<{ word: string; totalSolutions: number }> {
    if (wordStretchPuzzles.length === 0) throw new Error("No word stretch puzzles");
    const idx = ((seed % wordStretchPuzzles.length) + wordStretchPuzzles.length) % wordStretchPuzzles.length;
    const puzzle = wordStretchPuzzles[idx];
    return { word: puzzle.word, totalSolutions: puzzle.solutions.length };
  }

  async getWordStretchSolutions(seed: number): Promise<string[]> {
    if (wordStretchPuzzles.length === 0) return [];
    const idx = ((seed % wordStretchPuzzles.length) + wordStretchPuzzles.length) % wordStretchPuzzles.length;
    return [...wordStretchPuzzles[idx].solutions];
  }

  async validateWordStretch(stretched: string, seedWord: string): Promise<{ valid: boolean; isMiddle: boolean }> {
    const upper = stretched.toUpperCase().trim();
    const upperSeed = seedWord.toUpperCase().trim();
    if (upper.length !== upperSeed.length + 1) return { valid: false, isMiddle: false };
    if (!wordDictSet.has(upper)) return { valid: false, isMiddle: false };
    for (let i = 0; i < upper.length; i++) {
      if (upper.slice(0, i) + upper.slice(i + 1) === upperSeed) {
        const isMiddle = i > 0 && i < upper.length - 1;
        return { valid: true, isMiddle };
      }
    }
    return { valid: false, isMiddle: false };
  }

  async getWordBloomPuzzle(seed: number): Promise<{ seed: string; maxDepth: number }> {
    if (wordBloomPuzzles.length === 0) throw new Error("No word bloom puzzles");
    const idx = ((seed % wordBloomPuzzles.length) + wordBloomPuzzles.length) % wordBloomPuzzles.length;
    return wordBloomPuzzles[idx];
  }

  async validateWordBloom(currentWord: string, nextWord: string): Promise<{ valid: boolean; isMiddle: boolean }> {
    const upperNext = nextWord.toUpperCase().trim();
    const upperCurrent = currentWord.toUpperCase().trim();
    if (upperNext.length !== upperCurrent.length + 1) return { valid: false, isMiddle: false };
    if (!wordDictSet.has(upperNext)) return { valid: false, isMiddle: false };
    for (let i = 0; i < upperNext.length; i++) {
      if (upperNext.slice(0, i) + upperNext.slice(i + 1) === upperCurrent) {
        const isMiddle = i > 0 && i < upperNext.length - 1;
        return { valid: true, isMiddle };
      }
    }
    return { valid: false, isMiddle: false };
  }

  async generateWordSweepGrid(seed?: number): Promise<WordSweepGrid> {
    const size = 6;
    const totalCells = size * size;

    const vowels = "AEIOU";
    const uncommonLetters = "JKVXZ";

    const rng = seed !== undefined ? mulberry32(seed) : Math.random;

    const archetypes = [
      { name: "normal", vowelRatio: 0.39, uncommonMin: 2, uncommonMax: 3 },
      { name: "uncommon", vowelRatio: 0.39, uncommonMin: 4, uncommonMax: 6 },
      { name: "vowel-rich", vowelRatio: 0.47, uncommonMin: 1, uncommonMax: 2 },
    ];
    const archetype = archetypes[Math.floor(rng() * archetypes.length)];

    const vowelWeights: Record<string, number> = { A: 8, E: 12, I: 7, O: 8, U: 3 };
    const consonantWeightsNormal: Record<string, number> = {
      B: 2, C: 3, D: 4, F: 2, G: 2, H: 6, J: 1, K: 1, L: 4, M: 3,
      N: 7, P: 2, R: 6, S: 6, T: 9, V: 1, W: 2, X: 1, Y: 2, Z: 1,
    };

    function buildPool(weights: Record<string, number>): string[] {
      const pool: string[] = [];
      for (const [letter, weight] of Object.entries(weights)) {
        for (let i = 0; i < weight; i++) pool.push(letter);
      }
      return pool;
    }

    function pickFrom<T>(arr: T[]): T {
      return arr[Math.floor(rng() * arr.length)];
    }

    function shuffle<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    const seedWords = wordDictionary.filter(w => w.length >= 3 && w.length <= 5);
    const seedCount = 2 + Math.floor(rng() * 2);
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
    const targetUncommon = archetype.uncommonMin + Math.floor(rng() * (archetype.uncommonMax - archetype.uncommonMin + 1));

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
      if (placedUncommon < targetUncommon && rng() < uncommonNeeded / Math.max(1, remainingSlots)) {
        cells[idx] = pickFrom(uncommonPool);
        placedUncommon++;
        uncommonNeeded--;
        if (vowels.includes(cells[idx])) {
          placedVowels++;
          vowelsNeeded = Math.max(0, vowelsNeeded - 1);
        }
      } else if (placedVowels < targetVowels && rng() < vowelsNeeded / Math.max(1, remainingSlots)) {
        cells[idx] = pickFrom(vowelPool);
        placedVowels++;
        vowelsNeeded--;
      } else {
        cells[idx] = pickFrom(consonantPool);
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
  private gamePlayCountsMap: Map<string, number> = new Map();
  private lbIdCounter = 1;
  private userStreaks: Map<number, UserStreak> = new Map();
  private usIdCounter = 1;
  private userAchievements: UserAchievement[] = [];
  private uaIdCounter = 1;
  private friendshipsStore: Friendship[] = [];
  private frIdCounter = 1;
  private friendChallengesStore: FriendChallenge[] = [];
  private fcIdCounter = 1;
  private groupsStore: Group[] = [];
  private grpIdCounter = 1;
  private groupMembersStore: GroupMember[] = [];
  private gmIdCounter = 1;
  private groupRoundsStore: GroupRound[] = [];
  private grIdCounter = 1;
  private groupRoundScoresStore: GroupRoundScore[] = [];
  private grsIdCounter = 1;
  private groupReactionsStore: GroupScoreReaction[] = [];
  private gsrIdCounter = 1;
  private groupActivityStore: GroupActivityEntry[] = [];
  private gaIdCounter = 1;
  private groupSeasonsStore: GroupSeason[] = [];
  private groupSeasonIdCounter = 1;

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
    const existing = this.leaderboardEntries.find(
      e => e.userId === entry.userId && e.gameSlug === entry.gameSlug
    );
    if (existing) {
      if (entry.score > existing.score) {
        existing.score = entry.score;
        existing.playerName = entry.playerName;
        existing.playedAt = entry.playedAt;
      }
      return { ...existing };
    }
    const newEntry: LeaderboardEntry = { ...entry, id: this.lbIdCounter++ };
    this.leaderboardEntries.push(newEntry);
    return newEntry;
  }

  private _timeFilterCutoff(timeFilter?: string): string | null {
    if (timeFilter === "today") {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (timeFilter === "week") {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 7);
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    }
    return null;
  }

  async getLeaderboard(gameSlug: string, limit = 50, timeFilter?: string): Promise<LeaderboardEntry[]> {
    const cutoff = this._timeFilterCutoff(timeFilter);
    const seen = new Set<number>();
    return this.leaderboardEntries
      .filter(e => e.gameSlug === gameSlug && (!cutoff || e.playedAt >= cutoff))
      .sort((a, b) => b.score - a.score)
      .filter(e => {
        if (seen.has(e.userId)) return false;
        seen.add(e.userId);
        return true;
      })
      .slice(0, limit)
      .map(e => {
        const user = this.users.get(e.userId);
        const stats = Array.from(this.userGameStatsMap.values()).find(
          s => s.userId === e.userId && s.gameSlug === gameSlug
        );
        return {
          ...e,
          playerName: user?.name ?? e.playerName,
          playerAvatarUrl: user?.avatarUrl ?? null,
          gamesPlayed: stats?.gamesPlayed ?? undefined,
        };
      });
  }

  async getOverallLeaderboard(limit = 50, timeFilter?: string): Promise<LeaderboardEntry[]> {
    const cutoff = this._timeFilterCutoff(timeFilter);
    const playerTotals = new Map<number, { userId: number; playerName: string; score: number; playedAt: string; gamesPlayed: number }>();
    for (const entry of this.leaderboardEntries) {
      if (cutoff && entry.playedAt < cutoff) continue;
      const existing = playerTotals.get(entry.userId);
      if (existing) {
        existing.score += entry.score;
        if (entry.playedAt > existing.playedAt) existing.playedAt = entry.playedAt;
      } else {
        playerTotals.set(entry.userId, { userId: entry.userId, playerName: entry.playerName, score: entry.score, playedAt: entry.playedAt, gamesPlayed: 0 });
      }
    }
    for (const stats of this.userGameStatsMap.values()) {
      const player = playerTotals.get(stats.userId);
      if (player) player.gamesPlayed += stats.gamesPlayed;
    }
    return Array.from(playerTotals.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((p, i) => {
        const user = this.users.get(p.userId);
        return { id: i + 1, ...p, gameSlug: "overall", playerName: user?.name ?? p.playerName, playerAvatarUrl: user?.avatarUrl ?? null };
      });
  }

  async getPlayerRank(gameSlug: string, userId: number, timeFilter?: string): Promise<{ rank: number; score: number; totalPlayers: number } | null> {
    const cutoff = this._timeFilterCutoff(timeFilter);
    if (gameSlug === "overall") {
      const allEntries = this.leaderboardEntries.filter(e => !cutoff || e.playedAt >= cutoff);
      const playerTotals = new Map<number, number>();
      for (const e of allEntries) {
        playerTotals.set(e.userId, (playerTotals.get(e.userId) ?? 0) + e.score);
      }
      const userScore = playerTotals.get(userId);
      if (userScore == null) return null;
      const allScores = Array.from(playerTotals.values());
      const rank = allScores.filter(s => s > userScore).length + 1;
      return { rank, score: userScore, totalPlayers: allScores.length };
    }
    const seen = new Map<number, number>();
    for (const e of this.leaderboardEntries) {
      if (e.gameSlug !== gameSlug) continue;
      if (cutoff && e.playedAt < cutoff) continue;
      const cur = seen.get(e.userId);
      if (cur == null || e.score > cur) seen.set(e.userId, e.score);
    }
    const userScore = seen.get(userId);
    if (userScore == null) return null;
    const allScores = Array.from(seen.values());
    const rank = allScores.filter(s => s > userScore).length + 1;
    return { rank, score: userScore, totalPlayers: allScores.length };
  }

  async getFriendsLeaderboard(gameSlug: string, userId: number): Promise<LeaderboardEntry[]> {
    const friendIds = this.friendshipsStore
      .filter(f => f.status === "accepted" && (f.requesterId === userId || f.addresseeId === userId))
      .map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
    const allowedIds = new Set([userId, ...friendIds]);

    if (gameSlug === "overall") {
      const playerTotals = new Map<number, { score: number; playedAt: string }>();
      for (const e of this.leaderboardEntries) {
        if (!allowedIds.has(e.userId)) continue;
        const cur = playerTotals.get(e.userId);
        if (cur) { cur.score += e.score; if (e.playedAt > cur.playedAt) cur.playedAt = e.playedAt; }
        else playerTotals.set(e.userId, { score: e.score, playedAt: e.playedAt });
      }
      return Array.from(playerTotals.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .map(([uid, data], i) => {
          const user = this.users.get(uid);
          return { id: i + 1, userId: uid, gameSlug: "overall", score: data.score, playedAt: data.playedAt, playerName: user?.name ?? "Unknown", playerAvatarUrl: user?.avatarUrl ?? null };
        });
    }

    const seen = new Map<number, LeaderboardEntry>();
    for (const e of this.leaderboardEntries) {
      if (e.gameSlug !== gameSlug || !allowedIds.has(e.userId)) continue;
      const cur = seen.get(e.userId);
      if (!cur || e.score > cur.score) seen.set(e.userId, e);
    }
    return Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .map(e => {
        const user = this.users.get(e.userId);
        const stats = Array.from(this.userGameStatsMap.values()).find(s => s.userId === e.userId && s.gameSlug === gameSlug);
        return { ...e, playerName: user?.name ?? e.playerName, playerAvatarUrl: user?.avatarUrl ?? null, gamesPlayed: stats?.gamesPlayed ?? undefined };
      });
  }

  async incrementGamePlayCount(gameSlug: string): Promise<void> {
    this.gamePlayCountsMap.set(gameSlug, (this.gamePlayCountsMap.get(gameSlug) ?? 0) + 1);
  }

  async getGamePlayCount(gameSlug: string): Promise<number> {
    return this.gamePlayCountsMap.get(gameSlug) ?? 0;
  }

  async getAllGamePlayCounts(): Promise<Record<string, number>> {
    return Object.fromEntries(this.gamePlayCountsMap.entries());
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
    const streak: UserStreak = { id: this.usIdCounter++, userId, currentStreak, longestStreak, lastPlayedDate, dailyChallengeStreak: 0, longestDailyChallengeStreak: 0, lastDailyChallengeDate: null };
    this.userStreaks.set(userId, streak);
    return streak;
  }

  async updateDailyChallengeStreak(userId: number, date: string): Promise<{ streak: number; longest: number; alreadyDone: boolean }> {
    let existing = this.userStreaks.get(userId);
    if (!existing) {
      existing = { id: this.usIdCounter++, userId, currentStreak: 0, longestStreak: 0, lastPlayedDate: date, dailyChallengeStreak: 0, longestDailyChallengeStreak: 0, lastDailyChallengeDate: null };
      this.userStreaks.set(userId, existing);
    }
    if (existing.lastDailyChallengeDate === date) {
      return { streak: existing.dailyChallengeStreak, longest: existing.longestDailyChallengeStreak, alreadyDone: true };
    }
    let newStreak = 1;
    if (existing.lastDailyChallengeDate) {
      const prev = new Date(existing.lastDailyChallengeDate + "T00:00:00");
      const cur = new Date(date + "T00:00:00");
      const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) newStreak = (existing.dailyChallengeStreak ?? 0) + 1;
    }
    const newLongest = Math.max(existing.longestDailyChallengeStreak ?? 0, newStreak);
    existing.dailyChallengeStreak = newStreak;
    existing.longestDailyChallengeStreak = newLongest;
    existing.lastDailyChallengeDate = date;
    return { streak: newStreak, longest: newLongest, alreadyDone: false };
  }

  async getTopStreaks(limit: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; currentStreak: number; longestStreak: number }>> {
    const results: Array<{ userId: number; name: string; avatarUrl: string | null; currentStreak: number; longestStreak: number }> = [];
    for (const [uid, streak] of this.userStreaks.entries()) {
      if (streak.currentStreak > 0) {
        const u = this.users.get(uid);
        if (u) results.push({ userId: uid, name: u.name, avatarUrl: u.avatarUrl ?? null, currentStreak: streak.currentStreak, longestStreak: streak.longestStreak });
      }
    }
    return results.sort((a, b) => b.currentStreak - a.currentStreak).slice(0, limit);
  }

  async getStreakBatch(userIds: number[]): Promise<Record<number, number>> {
    const result: Record<number, number> = {};
    for (const id of userIds) {
      const streak = this.userStreaks.get(id);
      result[id] = streak?.currentStreak ?? 0;
    }
    return result;
  }

  async getLeaderboardPercentile(gameSlug: string, score: number): Promise<{ percentile: number; totalPlayers: number }> {
    const seen = new Map<number, number>();
    for (const e of this.leaderboardEntries) {
      if (e.gameSlug !== gameSlug) continue;
      const cur = seen.get(e.userId);
      if (cur === undefined || e.score > cur) seen.set(e.userId, e.score);
    }
    const scores = Array.from(seen.values());
    const total = scores.length;
    if (total === 0) return { percentile: 100, totalPlayers: 0 };
    const below = scores.filter(s => s < score).length;
    return { percentile: Math.round((below / total) * 100), totalPlayers: total };
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

  async searchUsers(query: string): Promise<Array<{ id: number; name: string; avatarUrl: string | null }>> {
    const q = query.toLowerCase();
    return Array.from(this.users.values())
      .filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 20)
      .map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }));
  }

  async getPublicProfile(userId: number): Promise<{ user: { id: number; name: string; avatarUrl: string | null; createdAt: string; isPremium: boolean; bio: string | null }; stats: UserGameStats[]; achievements: UserAchievement[]; leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }> } | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const stats = Array.from(this.userGameStatsMap.values()).filter(s => s.userId === userId);
    const achievements = this.userAchievements.filter(a => a.userId === userId);
    const slugScores = new Map<string, number>();
    for (const e of this.leaderboardEntries) {
      if (e.userId === userId) {
        const existing = slugScores.get(e.gameSlug);
        if (!existing || e.score > existing) slugScores.set(e.gameSlug, e.score);
      }
    }
    const leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }> = [];
    for (const [slug, score] of slugScores) {
      const allScores = this.leaderboardEntries
        .filter(e => e.gameSlug === slug)
        .reduce((acc, e) => { const ex = acc.get(e.userId); if (!ex || e.score > ex) acc.set(e.userId, e.score); return acc; }, new Map<number, number>());
      const sorted = Array.from(allScores.entries()).sort((a, b) => b[1] - a[1]);
      const rank = sorted.findIndex(([uid]) => uid === userId) + 1;
      leaderboardRankings.push({ gameSlug: slug, rank, score });
    }
    return { user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt, isPremium: user.isPremium ?? false, bio: user.bio || null }, stats, achievements, leaderboardRankings };
  }

  async getFriendshipById(id: number): Promise<Friendship | undefined> {
    return this.friendshipsStore.find(f => f.id === id);
  }

  async sendFriendRequest(requesterId: number, addresseeId: number): Promise<Friendship> {
    const f: Friendship = { id: this.frIdCounter++, requesterId, addresseeId, status: "pending", createdAt: new Date().toISOString() };
    this.friendshipsStore.push(f);
    return f;
  }

  async acceptFriendRequest(id: number): Promise<Friendship | undefined> {
    const f = this.friendshipsStore.find(fr => fr.id === id);
    if (f) f.status = "accepted";
    return f;
  }

  async declineFriendRequest(id: number): Promise<Friendship | undefined> {
    const f = this.friendshipsStore.find(fr => fr.id === id);
    if (f) f.status = "declined";
    return f;
  }

  async removeFriend(id: number): Promise<void> {
    this.friendshipsStore = this.friendshipsStore.filter(f => f.id !== id);
  }

  async getFriends(userId: number): Promise<Array<Friendship & { friendUser: { id: number; name: string; avatarUrl: string | null } }>> {
    return this.friendshipsStore
      .filter(f => f.status === "accepted" && (f.requesterId === userId || f.addresseeId === userId))
      .map(f => {
        const friendId = f.requesterId === userId ? f.addresseeId : f.requesterId;
        const friendUser = this.users.get(friendId);
        return { ...f, friendUser: { id: friendId, name: friendUser?.name || "Unknown", avatarUrl: friendUser?.avatarUrl || null } };
      });
  }

  async getPendingFriendRequests(userId: number): Promise<Array<Friendship & { requesterUser: { id: number; name: string; avatarUrl: string | null } }>> {
    return this.friendshipsStore
      .filter(f => f.status === "pending" && f.addresseeId === userId)
      .map(f => {
        const requester = this.users.get(f.requesterId);
        return { ...f, requesterUser: { id: f.requesterId, name: requester?.name || "Unknown", avatarUrl: requester?.avatarUrl || null } };
      });
  }

  async getFriendship(userId1: number, userId2: number): Promise<Friendship | undefined> {
    return this.friendshipsStore.find(f =>
      (f.requesterId === userId1 && f.addresseeId === userId2) ||
      (f.requesterId === userId2 && f.addresseeId === userId1)
    );
  }

  async createFriendChallenge(challenge: InsertFriendChallenge): Promise<FriendChallenge> {
    const fc: FriendChallenge = { ...challenge, seed: challenge.seed ?? null, gameConfig: challenge.gameConfig ?? null, senderViewed: challenge.senderViewed ?? false, receiverViewed: false, id: this.fcIdCounter++, createdAt: new Date().toISOString() };
    this.friendChallengesStore.push(fc);
    return fc;
  }

  async getFriendChallenges(userId: number): Promise<FriendChallenge[]> {
    const challenges = this.friendChallengesStore
      .filter(c => c.senderId === userId || c.receiverId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return challenges.map(c => {
      const sender = this.users.get(c.senderId);
      const receiver = this.users.get(c.receiverId);
      return {
        ...c,
        senderName: sender?.name,
        receiverName: receiver?.name,
        senderAvatarUrl: sender?.avatarUrl ?? null,
        receiverAvatarUrl: receiver?.avatarUrl ?? null,
      };
    });
  }

  async getFriendChallenge(id: number): Promise<FriendChallenge | undefined> {
    return this.friendChallengesStore.find(c => c.id === id);
  }

  async getPendingFriendChallenge(senderId: number, receiverId: number, gameSlug: string): Promise<FriendChallenge | undefined> {
    return this.friendChallengesStore.find(
      c => c.senderId === senderId && c.receiverId === receiverId && c.gameSlug === gameSlug && c.status === "pending"
    );
  }

  async completeFriendChallenge(id: number, score: number): Promise<FriendChallenge | undefined> {
    const c = this.friendChallengesStore.find(ch => ch.id === id);
    if (c) { c.receiverScore = score; c.status = "completed"; c.senderViewed = false; }
    return c;
  }

  async cancelFriendChallenge(id: number): Promise<FriendChallenge | undefined> {
    const c = this.friendChallengesStore.find(ch => ch.id === id);
    if (c) { c.status = "cancelled"; }
    return c;
  }

  async declineFriendChallenge(id: number): Promise<FriendChallenge | undefined> {
    const c = this.friendChallengesStore.find(ch => ch.id === id);
    if (c) { c.status = "declined"; }
    return c;
  }

  async markChallengeViewed(id: number): Promise<void> {
    const c = this.friendChallengesStore.find(ch => ch.id === id);
    if (c) { c.senderViewed = true; }
  }

  async markChallengeReceiverViewed(id: number): Promise<void> {
    const c = this.friendChallengesStore.find(ch => ch.id === id);
    if (c) { c.receiverViewed = true; }
  }

  async createGroup(group: InsertGroup): Promise<Group> {
    const g: Group = {
      ...group,
      id: this.grpIdCounter++,
      isFeatured: group.isFeatured ?? false,
      tags: group.tags ?? null,
      pinnedAnnouncement: group.pinnedAnnouncement ?? null,
      createdAt: new Date().toISOString(),
    };
    this.groupsStore.push(g);
    return g;
  }

  async getGroup(id: number): Promise<Group | undefined> {
    return this.groupsStore.find(g => g.id === id);
  }

  async getGroupByInviteCode(code: string): Promise<Group | undefined> {
    return this.groupsStore.find(g => g.inviteCode === code);
  }

  async updateGroup(id: number, updates: Partial<Pick<Group, "name" | "description" | "isPublic" | "tags" | "pinnedAnnouncement" | "isFeatured">>): Promise<Group | undefined> {
    const g = this.groupsStore.find(gr => gr.id === id);
    if (!g) return undefined;
    Object.assign(g, updates);
    return g;
  }

  async deleteGroup(id: number): Promise<void> {
    this.groupsStore = this.groupsStore.filter(g => g.id !== id);
    this.groupMembersStore = this.groupMembersStore.filter(m => m.groupId !== id);
    const roundIds = this.groupRoundsStore.filter(r => r.groupId === id).map(r => r.id);
    this.groupRoundsStore = this.groupRoundsStore.filter(r => r.groupId !== id);
    this.groupRoundScoresStore = this.groupRoundScoresStore.filter(s => !roundIds.includes(s.roundId));
  }

  async getUserGroups(userId: number): Promise<Group[]> {
    const memberGroupIds = this.groupMembersStore.filter(m => m.userId === userId).map(m => m.groupId);
    return this.groupsStore
      .filter(g => memberGroupIds.includes(g.id))
      .map(g => ({ ...g, memberCount: this.groupMembersStore.filter(m => m.groupId === g.id).length }));
  }

  async getPublicGroups(): Promise<Group[]> {
    return this.groupsStore
      .filter(g => g.isPublic)
      .map(g => ({ ...g, memberCount: this.groupMembersStore.filter(m => m.groupId === g.id).length }));
  }

  async getAllGroups(): Promise<Group[]> {
    return this.groupsStore
      .map(g => ({ ...g, memberCount: this.groupMembersStore.filter(m => m.groupId === g.id).length }));
  }

  async addGroupMember(groupId: number, userId: number, role: string): Promise<GroupMember> {
    const m: GroupMember = { id: this.gmIdCounter++, groupId, userId, role, joinedAt: new Date().toISOString() };
    this.groupMembersStore.push(m);
    return m;
  }

  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    this.groupMembersStore = this.groupMembersStore.filter(m => !(m.groupId === groupId && m.userId === userId));
  }

  async getGroupMembers(groupId: number): Promise<Array<GroupMember & { user: { id: number; name: string; avatarUrl: string | null } }>> {
    const members = this.groupMembersStore.filter(m => m.groupId === groupId);
    return members.map(m => {
      const u = this.users.get(m.userId);
      return { ...m, user: { id: m.userId, name: u?.name || "Unknown", avatarUrl: u?.avatarUrl || null } };
    });
  }

  async getGroupMember(groupId: number, userId: number): Promise<GroupMember | undefined> {
    return this.groupMembersStore.find(m => m.groupId === groupId && m.userId === userId);
  }

  async updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<GroupMember | undefined> {
    const m = this.groupMembersStore.find(mb => mb.groupId === groupId && mb.userId === userId);
    if (m) m.role = role;
    return m;
  }

  async createGroupRound(round: InsertGroupRound): Promise<GroupRound> {
    const r: GroupRound = { ...round, id: this.grIdCounter++, createdAt: new Date().toISOString() };
    this.groupRoundsStore.push(r);
    return r;
  }

  async getGroupRound(id: number): Promise<GroupRound | undefined> {
    return this.groupRoundsStore.find(r => r.id === id);
  }

  async getGroupRounds(groupId: number): Promise<GroupRound[]> {
    return this.groupRoundsStore.filter(r => r.groupId === groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async closeGroupRound(id: number): Promise<GroupRound | undefined> {
    const r = this.groupRoundsStore.find(rd => rd.id === id);
    if (r) r.status = "closed";
    return r;
  }

  async deleteGroupRound(id: number): Promise<void> {
    this.groupRoundsStore = this.groupRoundsStore.filter(r => r.id !== id);
    this.groupRoundScoresStore = this.groupRoundScoresStore.filter(s => s.roundId !== id);
  }

  async submitGroupRoundScore(roundId: number, userId: number, score: number, durationMs?: number): Promise<GroupRoundScore> {
    const existing = this.groupRoundScoresStore.find(s => s.roundId === roundId && s.userId === userId);
    if (existing) return existing;
    const s: GroupRoundScore = { id: this.grsIdCounter++, roundId, userId, score, durationMs: durationMs ?? null, completedAt: new Date().toISOString() };
    this.groupRoundScoresStore.push(s);
    return s;
  }

  async getGroupRoundScores(roundId: number): Promise<Array<GroupRoundScore & { user: { id: number; name: string; avatarUrl: string | null } }>> {
    const scores = this.groupRoundScoresStore.filter(s => s.roundId === roundId);
    return scores
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aDur = a.durationMs ?? Number.MAX_SAFE_INTEGER;
        const bDur = b.durationMs ?? Number.MAX_SAFE_INTEGER;
        return aDur - bDur;
      })
      .map(s => {
        const u = this.users.get(s.userId);
        return { ...s, user: { id: s.userId, name: u?.name || "Unknown", avatarUrl: u?.avatarUrl || null } };
      });
  }

  async getUserGroupRoundScore(roundId: number, userId: number): Promise<GroupRoundScore | undefined> {
    return this.groupRoundScoresStore.find(s => s.roundId === roundId && s.userId === userId);
  }

  async getGroupLeaderboard(groupId: number): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; totalScore: number; roundsPlayed: number }>> {
    const roundIds = this.groupRoundsStore.filter(r => r.groupId === groupId).map(r => r.id);
    const relevantScores = this.groupRoundScoresStore.filter(s => roundIds.includes(s.roundId));
    const tally = new Map<number, { totalScore: number; roundsPlayed: number }>();
    for (const s of relevantScores) {
      const existing = tally.get(s.userId);
      if (existing) {
        existing.totalScore += s.score;
        existing.roundsPlayed++;
      } else {
        tally.set(s.userId, { totalScore: s.score, roundsPlayed: 1 });
      }
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .map(([userId, data]) => {
        const u = this.users.get(userId);
        return { userId, name: u?.name || "Unknown", avatarUrl: u?.avatarUrl || null, ...data };
      });
  }

  async setGroupFeatured(groupId: number, isFeatured: boolean): Promise<Group | undefined> {
    const g = this.groupsStore.find(gr => gr.id === groupId);
    if (g) g.isFeatured = isFeatured;
    return g;
  }

  async addGroupReaction(roundId: number, scoreId: number, userId: number, emoji: string): Promise<GroupScoreReaction> {
    // Enforce single emoji per user per score — remove any prior reaction first
    this.groupReactionsStore = this.groupReactionsStore.filter(r => !(r.scoreId === scoreId && r.userId === userId));
    const reaction: GroupScoreReaction = { id: this.gsrIdCounter++, roundId, scoreId, userId, emoji, createdAt: new Date().toISOString() };
    this.groupReactionsStore.push(reaction);
    return reaction;
  }

  async removeGroupReaction(roundId: number, scoreId: number, userId: number, emoji: string): Promise<void> {
    this.groupReactionsStore = this.groupReactionsStore.filter(r => !(r.scoreId === scoreId && r.userId === userId && r.emoji === emoji));
  }

  async getGroupRoundReactions(roundId: number): Promise<GroupScoreReaction[]> {
    return this.groupReactionsStore.filter(r => r.roundId === roundId);
  }

  async logGroupActivity(groupId: number, userId: number | null, type: string, metadata: Record<string, any> = {}): Promise<void> {
    const u = userId ? this.users.get(userId) : null;
    const entry: GroupActivityEntry = {
      id: this.gaIdCounter++,
      groupId,
      userId,
      type,
      metadata,
      createdAt: new Date().toISOString(),
      user: u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null } : null,
    };
    this.groupActivityStore.push(entry);
  }

  async getGroupActivity(groupId: number, limit = 30): Promise<GroupActivityEntry[]> {
    return this.groupActivityStore
      .filter(a => a.groupId === groupId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(a => {
        const u = a.userId ? this.users.get(a.userId) : null;
        return { ...a, user: u ? { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null } : null };
      });
  }

  private groupRoundAttemptsStore: GroupRoundAttempt[] = [];
  private graIdCounter = 1;
  private dailyChallengeAttemptsStore: DailyChallengeAttempt[] = [];
  private dcaIdCounter = 1;

  async createGroupRoundAttempt(roundId: number, userId: number): Promise<GroupRoundAttempt> {
    const existing = await this.getGroupRoundAttempt(roundId, userId);
    if (existing) return existing;
    const attempt: GroupRoundAttempt = { id: this.graIdCounter++, roundId, userId, startedAt: new Date().toISOString() };
    this.groupRoundAttemptsStore.push(attempt);
    return attempt;
  }

  async getGroupRoundAttempt(roundId: number, userId: number): Promise<GroupRoundAttempt | undefined> {
    return this.groupRoundAttemptsStore.find(a => a.roundId === roundId && a.userId === userId);
  }

  async createDailyChallengeAttempt(userId: number, challengeDate: string): Promise<DailyChallengeAttempt> {
    const existing = await this.getDailyChallengeAttempt(userId, challengeDate);
    if (existing) return existing;
    const attempt: DailyChallengeAttempt = { id: this.dcaIdCounter++, userId, challengeDate, startedAt: new Date().toISOString() };
    this.dailyChallengeAttemptsStore.push(attempt);
    return attempt;
  }

  async getDailyChallengeAttempt(userId: number, challengeDate: string): Promise<DailyChallengeAttempt | undefined> {
    return this.dailyChallengeAttemptsStore.find(a => a.userId === userId && a.challengeDate === challengeDate);
  }

  private dailyChallengeScoresStore: Array<{ id: number; userId: number; challengeDate: string; gameSlug: string; score: number; submittedAt: string }> = [];
  private dcsIdCounter = 1;

  async saveDailyChallengeScore(userId: number, challengeDate: string, gameSlug: string, score: number): Promise<void> {
    const existing = this.dailyChallengeScoresStore.find(s => s.userId === userId && s.challengeDate === challengeDate);
    if (existing) {
      if (score > existing.score) existing.score = score;
    } else {
      this.dailyChallengeScoresStore.push({ id: this.dcsIdCounter++, userId, challengeDate, gameSlug, score, submittedAt: new Date().toISOString() });
    }
  }

  async getDailyLeaderboard(challengeDate: string, gameSlug: string, requestingUserId?: number): Promise<{ entries: import("@shared/schema").DailyLeaderboardEntry[]; myRank?: number; myScore?: number }> {
    const dayScores = this.dailyChallengeScoresStore
      .filter(s => s.challengeDate === challengeDate && s.gameSlug === gameSlug)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    const entries = dayScores.map((s, i) => {
      const user = this.users.get(s.userId);
      return { rank: i + 1, userId: s.userId, playerName: user?.name ?? "Unknown", avatarUrl: user?.avatarUrl ?? null, score: s.score };
    });
    let myRank: number | undefined;
    let myScore: number | undefined;
    if (requestingUserId) {
      const myEntry = entries.find(e => e.userId === requestingUserId);
      if (myEntry) {
        myRank = myEntry.rank;
        myScore = myEntry.score;
      } else {
        const myRecord = this.dailyChallengeScoresStore.find(s => s.userId === requestingUserId && s.challengeDate === challengeDate && s.gameSlug === gameSlug);
        if (myRecord) {
          myScore = myRecord.score;
          myRank = this.dailyChallengeScoresStore.filter(s => s.challengeDate === challengeDate && s.gameSlug === gameSlug && s.score > myRecord.score).length + 1;
        }
      }
    }
    return { entries, myRank, myScore };
  }

  private commentsStore: Comment[] = [];
  private commentReportsStore: CommentReport[] = [];
  private cmtIdCounter = 1;
  private crIdCounter = 1;

  private likesStore: Array<{ id: number; userId: number; targetType: string; targetId: string }> = [];
  private likeIdCounter = 1;

  private commentToPublic(c: Comment): Comment {
    const user = this.users.get(c.userId);
    return {
      ...c,
      user: user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl || null } : undefined,
    };
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const c: Comment = {
      id: this.cmtIdCounter++,
      ...comment,
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };
    this.commentsStore.push(c);
    return this.commentToPublic(c);
  }

  async getComments(targetType: CommentTargetType, targetId: string, userId?: number): Promise<Comment[]> {
    const all = this.commentsStore
      .filter(c => c.targetType === targetType && c.targetId === targetId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const allIds = all.map(c => String(c.id));
    const countMap = await this.getLikeCounts("comment", allIds);
    const likedSet = userId ? await this.getUserLikes(userId, "comment", allIds) : new Set<string>();
    const roots = all.filter(c => c.parentId === null).map(c => ({
      ...this.commentToPublic(c),
      likeCount: countMap[String(c.id)] ?? 0,
      likedByMe: likedSet.has(String(c.id)),
    }));
    const replies = all.filter(c => c.parentId !== null).map(c => ({
      ...this.commentToPublic(c),
      likeCount: countMap[String(c.id)] ?? 0,
      likedByMe: likedSet.has(String(c.id)),
    }));
    return roots.map(root => ({
      ...root,
      replies: replies.filter(r => r.parentId === root.id),
    }));
  }

  async toggleLike(userId: number, targetType: LikeTargetType, targetId: string): Promise<{ liked: boolean; count: number }> {
    const idx = this.likesStore.findIndex(l => l.userId === userId && l.targetType === targetType && l.targetId === targetId);
    if (idx >= 0) {
      this.likesStore.splice(idx, 1);
    } else {
      this.likesStore.push({ id: this.likeIdCounter++, userId, targetType, targetId });
    }
    const count = this.likesStore.filter(l => l.targetType === targetType && l.targetId === targetId).length;
    return { liked: idx < 0, count };
  }

  async getLikeCounts(targetType: LikeTargetType, targetIds: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const id of targetIds) {
      result[id] = this.likesStore.filter(l => l.targetType === targetType && l.targetId === id).length;
    }
    return result;
  }

  async getUserLikes(userId: number, targetType: LikeTargetType, targetIds: string[]): Promise<Set<string>> {
    const liked = this.likesStore
      .filter(l => l.userId === userId && l.targetType === targetType && targetIds.includes(l.targetId))
      .map(l => l.targetId);
    return new Set(liked);
  }

  async getCommentById(id: number): Promise<Comment | null> {
    const c = this.commentsStore.find(c => c.id === id);
    return c ? this.commentToPublic(c) : null;
  }

  async updateComment(id: number, userId: number, content: string): Promise<Comment | null> {
    const c = this.commentsStore.find(c => c.id === id);
    if (!c || c.isDeleted || c.userId !== userId) return null;
    c.content = content;
    c.updatedAt = new Date().toISOString();
    return this.commentToPublic(c);
  }

  async deleteComment(id: number, userId: number, isAdmin = false): Promise<boolean> {
    const c = this.commentsStore.find(c => c.id === id);
    if (!c) return false;
    if (!isAdmin && c.userId !== userId) return false;
    c.isDeleted = true;
    c.content = "";
    return true;
  }

  async getAchievementRarities(): Promise<Record<string, number>> {
    const totalUsers = this.users.size;
    if (totalUsers === 0) return {};
    const counts: Record<string, number> = {};
    for (const a of this.userAchievements) {
      counts[a.achievementId] = (counts[a.achievementId] ?? 0) + 1;
    }
    const result: Record<string, number> = {};
    for (const [id, count] of Object.entries(counts)) {
      result[id] = Math.round((count / totalUsers) * 100 * 10) / 10;
    }
    return result;
  }

  async reportComment(commentId: number, reportingUserId: number, reason: string): Promise<CommentReport> {
    const report: CommentReport = {
      id: this.crIdCounter++,
      commentId,
      reportingUserId,
      reason,
      createdAt: new Date().toISOString(),
    };
    this.commentReportsStore.push(report);
    return report;
  }

  async getCommentReports(): Promise<CommentReport[]> {
    return this.commentReportsStore
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => {
        const comment = this.commentsStore.find(c => c.id === r.commentId);
        const user = this.users.get(r.reportingUserId);
        const commentUser = comment ? this.users.get(comment.userId) : undefined;
        return {
          ...r,
          reporter: user ? { id: user.id, name: user.name } : undefined,
          comment: comment ? this.commentToPublic(comment) : undefined,
        };
      });
  }

  async deleteCommentAdmin(id: number): Promise<void> {
    const c = this.commentsStore.find(c => c.id === id);
    if (c) {
      c.isDeleted = true;
      c.content = "";
    }
  }

  async createQuizSession(session: InsertQuizSession): Promise<QuizSession> {
    let shareCode = session.shareCode;
    while (this.quizSessions.find(s => s.shareCode === shareCode)) {
      shareCode = generateShareCode();
    }
    const newSession: QuizSession = {
      ...session,
      id: this.quizIdCounter++,
      shareCode,
      createdAt: new Date().toISOString(),
    };
    this.quizSessions.push(newSession);
    return newSession;
  }

  async getQuizSessionByCode(shareCode: string): Promise<QuizSession | undefined> {
    return this.quizSessions.find(s => s.shareCode === shareCode);
  }

  async getQuizSessionsByCreator(creatorId: number): Promise<QuizSession[]> {
    return this.quizSessions.filter(s => s.creatorId === creatorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addQuizSessionScore(sessionId: number, userId: number, score: number, guestName?: string | null): Promise<QuizSessionScore> {
    const existing = this.quizSessionScores.find(s => s.sessionId === sessionId && s.userId === userId);
    if (existing) return existing;
    const entry: QuizSessionScore = {
      id: this.quizScoreIdCounter++,
      sessionId,
      userId,
      guestName: guestName ?? null,
      score,
      completedAt: new Date().toISOString(),
    };
    this.quizSessionScores.push(entry);
    return entry;
  }

  async getQuizSessionScores(sessionId: number): Promise<QuizSessionScore[]> {
    return this.quizSessionScores
      .filter(s => s.sessionId === sessionId)
      .sort((a, b) => b.score - a.score)
      .map(s => {
        const user = this.users.get(s.userId);
        return {
          ...s,
          playerName: user?.name ?? s.guestName ?? undefined,
          playerAvatarUrl: user?.avatarUrl ?? null,
        };
      });
  }

  async getQuizSessionScore(sessionId: number, userId: number): Promise<QuizSessionScore | undefined> {
    return this.quizSessionScores.find(s => s.sessionId === sessionId && s.userId === userId);
  }

  async deleteQuizSession(id: number): Promise<void> {
    this.quizSessionScores = this.quizSessionScores.filter(s => s.sessionId !== id);
    this.quizSessions = this.quizSessions.filter(s => s.id !== id);
  }

  async createDuelChallenge(data: InsertDuelChallenge): Promise<DuelChallenge> {
    const challenge: DuelChallenge = {
      ...data,
      id: this.duelChallengeIdCounter++,
      roomCode: data.roomCode ?? null,
      createdAt: new Date().toISOString(),
    };
    this.duelChallenges.push(challenge);
    return challenge;
  }

  async getDuelChallenge(id: number): Promise<DuelChallenge | undefined> {
    return this.duelChallenges.find(c => c.id === id);
  }

  async getDuelChallengeByRoom(roomCode: string): Promise<DuelChallenge | undefined> {
    return this.duelChallenges.find(c => c.roomCode === roomCode);
  }

  async updateDuelChallengeStatus(id: number, status: DuelChallengeStatus, roomCode?: string, seed?: number | null, startWord?: string | null): Promise<DuelChallenge | undefined> {
    const challenge = this.duelChallenges.find(c => c.id === id);
    if (!challenge) return undefined;
    challenge.status = status;
    if (roomCode !== undefined) challenge.roomCode = roomCode;
    if (seed !== undefined) challenge.seed = seed;
    if (startWord !== undefined) challenge.startWord = startWord;
    return challenge;
  }

  async getDuelChallengesForUser(userId: number): Promise<DuelChallenge[]> {
    return this.duelChallenges
      .filter(c => c.challengerId === userId || c.challengeeId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateDuelChallengeChallengee(id: number, challengeeId: number): Promise<DuelChallenge | undefined> {
    const challenge = this.duelChallenges.find(c => c.id === id);
    if (!challenge) return undefined;
    challenge.challengeeId = challengeeId;
    return challenge;
  }

  async acceptOpenDuelChallenge(id: number, challengeeId: number): Promise<DuelChallenge | null> {
    const challenge = this.duelChallenges.find(c => c.id === id);
    if (!challenge) return null;
    // Atomic guard: only claim if still open+pending
    if (challenge.challengeeId !== null || challenge.status !== "pending") return null;
    challenge.challengeeId = challengeeId;
    challenge.status = "accepted";
    return challenge;
  }

  async getOpenDuelChallenges(excludeUserId: number, gameSlug?: string): Promise<DuelChallenge[]> {
    return this.duelChallenges
      .filter(c =>
        c.challengeeId === null &&
        c.status === "pending" &&
        c.challengerId !== excludeUserId &&
        (!gameSlug || c.gameSlug === gameSlug),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async expireOpenChallenges(): Promise<number> {
    const now = new Date();
    const fallbackMs = 24 * 60 * 60 * 1000;
    let count = 0;
    for (const c of this.duelChallenges) {
      if (c.status !== "pending" || c.challengeeId !== null) continue;
      const deadline = c.expiresAt
        ? new Date(c.expiresAt)
        : new Date(new Date(c.createdAt).getTime() + fallbackMs);
      if (deadline < now) {
        c.status = "expired";
        count++;
      }
    }
    return count;
  }

  async createDuelSession(data: InsertDuelSession): Promise<DuelSession> {
    const session: DuelSession = {
      ...data,
      id: this.duelSessionIdCounter++,
    };
    this.duelSessions.push(session);
    return session;
  }

  async getDuelSession(id: number): Promise<DuelSession | undefined> {
    return this.duelSessions.find(s => s.id === id);
  }

  async getDuelSessionByRoom(roomCode: string): Promise<DuelSession | undefined> {
    return this.duelSessions.find(s => s.roomCode === roomCode);
  }

  async updateDuelSession(id: number, updates: Partial<Pick<DuelSession, "outcome" | "eloDeltaPlayer1" | "eloDeltaPlayer2" | "endedAt">>): Promise<DuelSession | undefined> {
    const session = this.duelSessions.find(s => s.id === id);
    if (!session) return undefined;
    Object.assign(session, updates);
    return session;
  }

  async getDuelRating(userId: number): Promise<DuelRating | undefined> {
    return this.duelRatings.find(r => r.userId === userId);
  }

  async getDuelSessionsForUser(userId: number): Promise<DuelSession[]> {
    return this.duelSessions
      .filter(s => s.player1Id === userId || s.player2Id === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getDuelLeaderboard(limit = 100, format?: "turn" | "race"): Promise<Array<{ rank: number; userId: number; displayName: string; avatarUrl: string | null; elo: number; wins: number; losses: number; draws: number; winRate: number }>> {
    let ratings = [...this.duelRatings];
    if (format) {
      const userIdsInFormat = new Set(
        this.duelSessions
          .filter(s => s.format === format)
          .flatMap(s => [s.player1Id, s.player2Id])
      );
      ratings = ratings.filter(r => userIdsInFormat.has(r.userId));
    }
    const sorted = ratings.sort((a, b) => b.elo - a.elo).slice(0, limit);
    return sorted.map((r, i) => {
      const user = Array.from(this.users.values()).find(u => u.id === r.userId);
      const total = r.wins + r.losses + r.draws;
      return {
        rank: i + 1,
        userId: r.userId,
        displayName: user?.name ?? `User #${r.userId}`,
        avatarUrl: user?.avatarUrl ?? null,
        elo: r.elo,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        winRate: total > 0 ? Math.round((r.wins / total) * 100) : 0,
      };
    });
  }

  async upsertDuelRating(userId: number, updates: Partial<Pick<DuelRating, "elo" | "wins" | "losses" | "draws">>): Promise<DuelRating> {
    let rating = this.duelRatings.find(r => r.userId === userId);
    if (rating) {
      if (updates.elo !== undefined) rating.elo = updates.elo;
      if (updates.wins !== undefined) rating.wins = updates.wins;
      if (updates.losses !== undefined) rating.losses = updates.losses;
      if (updates.draws !== undefined) rating.draws = updates.draws;
      rating.updatedAt = new Date().toISOString();
      return rating;
    }
    rating = {
      id: this.duelRatingIdCounter++,
      userId,
      elo: updates.elo ?? 1200,
      wins: updates.wins ?? 0,
      losses: updates.losses ?? 0,
      draws: updates.draws ?? 0,
      updatedAt: new Date().toISOString(),
    };
    this.duelRatings.push(rating);
    return rating;
  }

  async getDuelRankContext(userId: number): Promise<{ rank: number; totalPlayers: number } | null> {
    const all = await this.getDuelLeaderboard(Number.MAX_SAFE_INTEGER);
    const entry = all.find(e => e.userId === userId);
    if (!entry) return null;
    return { rank: entry.rank, totalPlayers: all.length };
  }

  async createHuddleChallenge(data: InsertHuddleChallenge): Promise<HuddleChallenge> {
    const h: HuddleChallenge = { ...data, id: this.huddleChallengeIdCounter++, createdAt: new Date().toISOString() };
    this.huddleChallenges.push(h);
    return h;
  }

  async getHuddleChallenge(id: number): Promise<HuddleChallenge | undefined> {
    return this.huddleChallenges.find(h => h.id === id);
  }

  async getHuddleChallengesForGroup(groupId: number): Promise<HuddleChallenge[]> {
    return this.huddleChallenges
      .filter(h => h.challengerGroupId === groupId || h.challengeeGroupId === groupId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateHuddleChallenge(id: number, updates: Partial<Pick<HuddleChallenge, "status" | "challengeeAdminId" | "roomCode" | "seed" | "startWord">>): Promise<HuddleChallenge | undefined> {
    const h = this.huddleChallenges.find(h => h.id === id);
    if (!h) return undefined;
    Object.assign(h, updates);
    return h;
  }

  async getHuddleChallengeByRoom(roomCode: string): Promise<HuddleChallenge | undefined> {
    return this.huddleChallenges.find(h => h.roomCode === roomCode);
  }

  async createTeamRaceChallenge(data: InsertTeamRaceChallenge): Promise<TeamRaceChallenge> {
    const tr: TeamRaceChallenge = { ...data, id: this.teamRaceChallengeIdCounter++, createdAt: new Date().toISOString() };
    this.teamRaceChallenges.push(tr);
    return tr;
  }

  async getTeamRaceChallenge(id: number): Promise<TeamRaceChallenge | undefined> {
    return this.teamRaceChallenges.find(tr => tr.id === id);
  }

  async getTeamRaceChallengesForGroup(groupId: number): Promise<TeamRaceChallenge[]> {
    return this.teamRaceChallenges
      .filter(tr => tr.challengerGroupId === groupId || tr.challengeeGroupId === groupId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateTeamRaceChallenge(id: number, updates: Partial<Pick<TeamRaceChallenge, "status" | "challengeeAdminId" | "roomCode" | "seed" | "startWord" | "winnerGroupId">>): Promise<TeamRaceChallenge | undefined> {
    const tr = this.teamRaceChallenges.find(tr => tr.id === id);
    if (!tr) return undefined;
    Object.assign(tr, updates);
    return tr;
  }

  async getTeamRaceChallengeByRoom(roomCode: string): Promise<TeamRaceChallenge | undefined> {
    return this.teamRaceChallenges.find(tr => tr.roomCode === roomCode);
  }

  async createOvertakenNotificationIfAllowed(data: InsertNotification, gameSlug: string, windowMs: number): Promise<boolean> {
    // Node.js is single-threaded: no true concurrent DB race exists in MemStorage.
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    const alreadySent = this.notifications.some(
      (n) =>
        n.userId === data.userId &&
        n.type === "leaderboard_overtaken" &&
        n.linkUrl === `/leaderboard?game=${gameSlug}` &&
        n.createdAt >= cutoff,
    );
    if (alreadySent) return false;
    await this.createNotification(data);
    return true;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const notif: Notification = {
      ...data,
      id: this.notificationIdCounter++,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(notif);
    return notif;
  }

  async getNotifications(userId: number, limit = 30): Promise<Notification[]> {
    return this.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    return this.notifications.filter(n => n.userId === userId && n.readAt === null).length;
  }

  async markNotificationRead(id: number, userId: number): Promise<void> {
    const notif = this.notifications.find(n => n.id === id && n.userId === userId);
    if (notif && notif.readAt === null) {
      notif.readAt = new Date().toISOString();
    }
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    const now = new Date().toISOString();
    for (const n of this.notifications) {
      if (n.userId === userId && n.readAt === null) {
        n.readAt = now;
      }
    }
  }

  async pruneNotifications(): Promise<number> {
    const now = Date.now();
    const readCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const unreadCutoff = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    const before = this.notifications.length;
    this.notifications = this.notifications.filter(n => {
      if (n.readAt !== null) {
        return n.createdAt >= readCutoff;
      }
      return n.createdAt >= unreadCutoff;
    });
    return before - this.notifications.length;
  }

  async getNotificationPreferences(userId: number): Promise<Record<NotificationType, boolean>> {
    const types = notificationTypeSchema.options as NotificationType[];
    const result = {} as Record<NotificationType, boolean>;
    for (const type of types) {
      const key = `${userId}:${type}`;
      result[type] = this.notificationPrefsMap.has(key) ? this.notificationPrefsMap.get(key)! : true;
    }
    return result;
  }

  async setNotificationPreference(userId: number, type: NotificationType, enabled: boolean): Promise<void> {
    this.notificationPrefsMap.set(`${userId}:${type}`, enabled);
  }

  async setAllNotificationPreferences(userId: number, enabled: boolean): Promise<void> {
    const types = notificationTypeSchema.options as NotificationType[];
    for (const type of types) {
      this.notificationPrefsMap.set(`${userId}:${type}`, enabled);
    }
  }

  // ==================== WORD WARS ====================

  async createWordWarsTournament(data: InsertWordWarsTournament): Promise<WordWarsTournament> {
    const t: WordWarsTournament = {
      ...data,
      id: this.wordWarsTournamentIdCounter++,
      status: "registration",
      createdAt: new Date().toISOString(),
    };
    this.wordWarsTournaments.push(t);
    return t;
  }

  async getWordWarsTournament(id: number): Promise<WordWarsTournament | undefined> {
    return this.wordWarsTournaments.find(t => t.id === id);
  }

  async listWordWarsTournaments(): Promise<WordWarsTournament[]> {
    return [...this.wordWarsTournaments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateWordWarsTournament(id: number, updates: Partial<Pick<WordWarsTournament, "status" | "name" | "registrationDeadline" | "roundDeadlineHours" | "minPlayers" | "maxPlayers" | "recurringCron">>): Promise<WordWarsTournament | undefined> {
    const t = this.wordWarsTournaments.find(t => t.id === id);
    if (!t) return undefined;
    Object.assign(t, updates);
    return t;
  }

  async createWordWarsRegistration(tournamentId: number, userId: number): Promise<WordWarsRegistration> {
    const r: WordWarsRegistration = {
      id: this.wordWarsRegistrationIdCounter++,
      tournamentId,
      userId,
      createdAt: new Date().toISOString(),
    };
    this.wordWarsRegistrations.push(r);
    return r;
  }

  async getWordWarsRegistration(tournamentId: number, userId: number): Promise<WordWarsRegistration | undefined> {
    return this.wordWarsRegistrations.find(r => r.tournamentId === tournamentId && r.userId === userId);
  }

  async deleteWordWarsRegistration(tournamentId: number, userId: number): Promise<void> {
    this.wordWarsRegistrations = this.wordWarsRegistrations.filter(
      r => !(r.tournamentId === tournamentId && r.userId === userId)
    );
  }

  async getWordWarsRegistrationsForTournament(tournamentId: number): Promise<WordWarsRegistration[]> {
    return this.wordWarsRegistrations.filter(r => r.tournamentId === tournamentId);
  }

  async createWordWarsMatch(data: Omit<WordWarsMatch, "id" | "createdAt">): Promise<WordWarsMatch> {
    const m: WordWarsMatch = {
      ...data,
      id: this.wordWarsMatchIdCounter++,
      createdAt: new Date().toISOString(),
    };
    this.wordWarsMatches.push(m);
    return m;
  }

  async getWordWarsMatch(id: number): Promise<WordWarsMatch | undefined> {
    return this.wordWarsMatches.find(m => m.id === id);
  }

  async listWordWarsMatchesForTournament(tournamentId: number): Promise<WordWarsMatch[]> {
    return this.wordWarsMatches
      .filter(m => m.tournamentId === tournamentId)
      .sort((a, b) => a.round - b.round);
  }

  async updateWordWarsMatch(id: number, updates: Partial<Pick<WordWarsMatch, "status" | "winnerId" | "deadline">>): Promise<WordWarsMatch | undefined> {
    const m = this.wordWarsMatches.find(m => m.id === id);
    if (!m) return undefined;
    Object.assign(m, updates);
    return m;
  }

  async createWordWarsMatchGame(data: Omit<WordWarsMatchGame, "id">): Promise<WordWarsMatchGame> {
    const g: WordWarsMatchGame = { ...data, id: this.wordWarsMatchGameIdCounter++ };
    this.wordWarsMatchGames.push(g);
    return g;
  }

  async getWordWarsMatchGame(matchId: number, gameNumber: number): Promise<WordWarsMatchGame | undefined> {
    return this.wordWarsMatchGames.find(g => g.matchId === matchId && g.gameNumber === gameNumber);
  }

  async getWordWarsMatchGames(matchId: number): Promise<WordWarsMatchGame[]> {
    return this.wordWarsMatchGames
      .filter(g => g.matchId === matchId)
      .sort((a, b) => a.gameNumber - b.gameNumber);
  }

  async updateWordWarsMatchGame(id: number, updates: Partial<Pick<WordWarsMatchGame, "status" | "winnerId" | "roomCode">>): Promise<WordWarsMatchGame | undefined> {
    const g = this.wordWarsMatchGames.find(g => g.id === id);
    if (!g) return undefined;
    Object.assign(g, updates);
    return g;
  }

  async getMatchGameByRoomCode(roomCode: string): Promise<WordWarsMatchGame | undefined> {
    return this.wordWarsMatchGames.find(g => g.roomCode === roomCode);
  }

  async createWordWarsChampion(tournamentId: number, userId: number): Promise<WordWarsChampion> {
    const c: WordWarsChampion = {
      id: this.wordWarsChampionIdCounter++,
      tournamentId,
      userId,
      createdAt: new Date().toISOString(),
    };
    this.wordWarsChampions.push(c);
    return c;
  }

  async getChampionsForTournament(tournamentId: number): Promise<WordWarsChampion[]> {
    return this.wordWarsChampions.filter(c => c.tournamentId === tournamentId);
  }

  async getChampionshipsForUser(userId: number): Promise<WordWarsChampion[]> {
    return this.wordWarsChampions.filter(c => c.userId === userId);
  }

  async listAllWordWarsChampions(): Promise<WordWarsChampion[]> {
    return [...this.wordWarsChampions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getWordWarsStatsForGroup(groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
    const members = await this.getGroupMembers(groupId);
    const memberIds = new Set(members.map(m => m.user.id));
    const tournamentsEntered = new Set(
      this.wordWarsRegistrations.filter(r => memberIds.has(r.userId)).map(r => r.tournamentId)
    ).size;
    const memberMatches = this.wordWarsMatches.filter(
      m => ((m.player1Id !== null && memberIds.has(m.player1Id)) || (m.player2Id !== null && memberIds.has(m.player2Id))) &&
        (m.status === "completed" || m.status === "forfeited")
    );
    let matchWins = 0;
    let matchLosses = 0;
    for (const m of memberMatches) {
      if (m.winnerId !== null && memberIds.has(m.winnerId)) matchWins++;
      else if (m.winnerId !== null) matchLosses++;
    }
    return { tournamentsEntered, matchWins, matchLosses };
  }

  async getWordWarsStatsForUser(userId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
    const tournamentsEntered = this.wordWarsRegistrations.filter(r => r.userId === userId).length;
    const userMatches = this.wordWarsMatches.filter(
      m => (m.player1Id === userId || m.player2Id === userId) &&
        (m.status === "completed" || m.status === "forfeited")
    );
    const matchWins = userMatches.filter(m => m.winnerId === userId).length;
    const matchLosses = userMatches.filter(m => m.winnerId !== null && m.winnerId !== userId).length;
    return { tournamentsEntered, matchWins, matchLosses };
  }

  // ==================== GUILD WARS ====================

  async createGuildWarsTournament(data: InsertGuildWarsTournament): Promise<GuildWarsTournament> {
    const t: GuildWarsTournament = {
      ...data,
      id: this.guildWarsTournamentIdCounter++,
      status: "registration",
      createdAt: new Date().toISOString(),
    };
    this.guildWarsTournaments.push(t);
    return t;
  }

  async getGuildWarsTournament(id: number): Promise<GuildWarsTournament | undefined> {
    return this.guildWarsTournaments.find(t => t.id === id);
  }

  async listGuildWarsTournaments(): Promise<GuildWarsTournament[]> {
    return [...this.guildWarsTournaments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateGuildWarsTournament(id: number, updates: Partial<Pick<GuildWarsTournament, "status" | "name" | "registrationDeadline" | "roundDeadlineHours" | "minGroups" | "maxGroups">>): Promise<GuildWarsTournament | undefined> {
    const t = this.guildWarsTournaments.find(t => t.id === id);
    if (!t) return undefined;
    Object.assign(t, updates);
    return t;
  }

  async createGuildWarsRegistration(tournamentId: number, groupId: number, registeredBy: number): Promise<GuildWarsRegistration> {
    const r: GuildWarsRegistration = {
      id: this.guildWarsRegistrationIdCounter++,
      tournamentId,
      groupId,
      registeredBy,
      createdAt: new Date().toISOString(),
    };
    this.guildWarsRegistrations.push(r);
    return r;
  }

  async getGuildWarsRegistration(tournamentId: number, groupId: number): Promise<GuildWarsRegistration | undefined> {
    return this.guildWarsRegistrations.find(r => r.tournamentId === tournamentId && r.groupId === groupId);
  }

  async deleteGuildWarsRegistration(tournamentId: number, groupId: number): Promise<void> {
    this.guildWarsRegistrations = this.guildWarsRegistrations.filter(
      r => !(r.tournamentId === tournamentId && r.groupId === groupId)
    );
  }

  async getGuildWarsRegistrationsForTournament(tournamentId: number): Promise<GuildWarsRegistration[]> {
    return this.guildWarsRegistrations.filter(r => r.tournamentId === tournamentId);
  }

  async getGuildWarsRegistrationsForGroup(groupId: number): Promise<GuildWarsRegistration[]> {
    return this.guildWarsRegistrations.filter(r => r.groupId === groupId);
  }

  async createGuildWarsMatch(data: Omit<GuildWarsMatch, "id" | "createdAt">): Promise<GuildWarsMatch> {
    const m: GuildWarsMatch = {
      ...data,
      id: this.guildWarsMatchIdCounter++,
      createdAt: new Date().toISOString(),
    };
    this.guildWarsMatches.push(m);
    return m;
  }

  async getGuildWarsMatch(id: number): Promise<GuildWarsMatch | undefined> {
    return this.guildWarsMatches.find(m => m.id === id);
  }

  async listGuildWarsMatchesForTournament(tournamentId: number): Promise<GuildWarsMatch[]> {
    return this.guildWarsMatches
      .filter(m => m.tournamentId === tournamentId)
      .sort((a, b) => a.round - b.round);
  }

  async updateGuildWarsMatch(id: number, updates: Partial<Pick<GuildWarsMatch, "status" | "winnerGroupId" | "deadline">>): Promise<GuildWarsMatch | undefined> {
    const m = this.guildWarsMatches.find(m => m.id === id);
    if (!m) return undefined;
    Object.assign(m, updates);
    return m;
  }

  async createGuildWarsMatchGame(data: Omit<GuildWarsMatchGame, "id">): Promise<GuildWarsMatchGame> {
    const g: GuildWarsMatchGame = { ...data, id: this.guildWarsMatchGameIdCounter++ };
    this.guildWarsMatchGames.push(g);
    return g;
  }

  async getGuildWarsMatchGame(matchId: number, gameNumber: number): Promise<GuildWarsMatchGame | undefined> {
    return this.guildWarsMatchGames.find(g => g.matchId === matchId && g.gameNumber === gameNumber);
  }

  async getGuildWarsMatchGames(matchId: number): Promise<GuildWarsMatchGame[]> {
    return this.guildWarsMatchGames
      .filter(g => g.matchId === matchId)
      .sort((a, b) => a.gameNumber - b.gameNumber);
  }

  async updateGuildWarsMatchGame(id: number, updates: Partial<Pick<GuildWarsMatchGame, "status" | "winnerGroupId" | "roomCode">>): Promise<GuildWarsMatchGame | undefined> {
    const g = this.guildWarsMatchGames.find(g => g.id === id);
    if (!g) return undefined;
    Object.assign(g, updates);
    return g;
  }

  async getGuildWarsMatchGameByRoomCode(roomCode: string): Promise<GuildWarsMatchGame | undefined> {
    return this.guildWarsMatchGames.find(g => g.roomCode === roomCode);
  }

  async createGuildWarsChampion(tournamentId: number, groupId: number, tournamentName: string): Promise<GuildWarsChampion> {
    const c: GuildWarsChampion = {
      id: this.guildWarsChampionIdCounter++,
      tournamentId,
      groupId,
      tournamentName,
      createdAt: new Date().toISOString(),
    };
    this.guildWarsChampions.push(c);
    return c;
  }

  async getGuildWarsChampionsForTournament(tournamentId: number): Promise<GuildWarsChampion[]> {
    return this.guildWarsChampions.filter(c => c.tournamentId === tournamentId);
  }

  async getGuildWarsChampionshipsForGroup(groupId: number): Promise<GuildWarsChampion[]> {
    return this.guildWarsChampions.filter(c => c.groupId === groupId);
  }

  async listAllGuildWarsChampions(): Promise<GuildWarsChampion[]> {
    return [...this.guildWarsChampions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getRecentMatchesForGroup(groupId: number): Promise<{ matchId: number; tournamentId: number; tournamentName: string; round: number; outcome: "win" | "loss"; opponentGroupId: number | null; opponentGroupName: string | null }[]> {
    const matches = this.guildWarsMatches
      .filter(m => (m.group1Id === groupId || m.group2Id === groupId) && m.status === "completed")
      .slice(-3)
      .reverse();
    return matches.map(m => {
      const opponentGroupId = m.group1Id === groupId ? m.group2Id : m.group1Id;
      return {
        matchId: m.id,
        tournamentId: m.tournamentId,
        tournamentName: "Tournament",
        round: m.round,
        outcome: m.winnerGroupId === groupId ? "win" : "loss",
        opponentGroupId: opponentGroupId ?? null,
        opponentGroupName: null,
      };
    });
  }

  async getGuildWarsStatsForGroup(groupId: number): Promise<{ tournamentsEntered: number; matchWins: number; matchLosses: number }> {
    const tournamentsEntered = this.guildWarsRegistrations.filter(r => r.groupId === groupId).length;
    const groupMatches = this.guildWarsMatches.filter(
      m => (m.group1Id === groupId || m.group2Id === groupId) &&
        (m.status === "completed" || m.status === "forfeited")
    );
    const matchWins = groupMatches.filter(m => m.winnerGroupId === groupId).length;
    const matchLosses = groupMatches.filter(m => m.winnerGroupId !== null && m.winnerGroupId !== groupId).length;
    return { tournamentsEntered, matchWins, matchLosses };
  }

  async createGroupSeason(data: InsertGroupSeason): Promise<GroupSeason> {
    const eligibleMemberIds = this.groupMembersStore.filter(m => m.groupId === data.groupId).map(m => m.userId);
    const s: GroupSeason = { ...data, id: this.groupSeasonIdCounter++, winnerId: null, winnerName: null, eligibleMemberIds, createdAt: new Date().toISOString() };
    this.groupSeasonsStore.push(s);
    return s;
  }

  async getGroupSeasons(groupId: number): Promise<GroupSeason[]> {
    return this.groupSeasonsStore.filter(s => s.groupId === groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getGroupSeason(id: number): Promise<GroupSeason | undefined> {
    return this.groupSeasonsStore.find(s => s.id === id);
  }

  async endGroupSeason(id: number, winnerId: number | null, winnerName: string | null): Promise<GroupSeason | undefined> {
    const s = this.groupSeasonsStore.find(s => s.id === id);
    if (!s) return undefined;
    s.status = "ended";
    s.winnerId = winnerId;
    s.winnerName = winnerName;
    return s;
  }

  async getGroupSeasonLeaderboard(season: GroupSeason): Promise<Array<{ userId: number; name: string; avatarUrl: string | null; totalScore: number; roundsPlayed: number }>> {
    const roundIds = this.groupRoundsStore.filter(r => r.seasonId === season.id).map(r => r.id);
    const eligible = new Set(season.eligibleMemberIds);
    const scores = this.groupRoundScoresStore.filter(s => roundIds.includes(s.roundId) && eligible.has(s.userId));
    const tally = new Map<number, { totalScore: number; roundsPlayed: number }>();
    for (const s of scores) {
      const e = tally.get(s.userId);
      if (e) { e.totalScore += s.score; e.roundsPlayed++; }
      else tally.set(s.userId, { totalScore: s.score, roundsPlayed: 1 });
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .map(([userId, data]) => {
        const u = this.users.get(userId);
        return { userId, name: u?.name || "Unknown", avatarUrl: u?.avatarUrl || null, ...data };
      });
  }

  async expireFriendChallenges(): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let count = 0;
    for (const c of this.friendChallengesStore) {
      if (c.status === "pending" && c.createdAt < cutoff) {
        c.status = "cancelled";
        count++;
      }
    }
    return count;
  }

  async getRecentCommentCount(userId: number, since: Date): Promise<number> {
    const sinceStr = since.toISOString();
    return this.commentsStore.filter(
      c => c.userId === userId && !c.isDeleted && (c.createdAt ?? "") >= sinceStr
    ).length;
  }

  async deleteUser(id: number): Promise<void> {
    this.users.delete(id);
    this.leaderboardEntries = this.leaderboardEntries.filter(e => e.userId !== id);
    this.userAchievements = this.userAchievements.filter(a => a.userId !== id);
    this.userStreaks.delete(id);
    for (const key of Array.from(this.userGameStatsMap.keys())) {
      if (key.startsWith(`${id}-`)) this.userGameStatsMap.delete(key);
    }
    this.friendshipsStore = this.friendshipsStore.filter(f => f.requesterId !== id && f.addresseeId !== id);
    this.friendChallengesStore = this.friendChallengesStore.filter(c => c.senderId !== id && c.receiverId !== id);
    this.notifications = this.notifications.filter(n => n.userId !== id);
    this.commentsStore = this.commentsStore.filter(c => c.userId !== id);
    this.likesStore = this.likesStore.filter(l => l.userId !== id);
    for (const key of Array.from(this.notificationPrefsMap.keys())) {
      if (key.startsWith(`${id}-`)) this.notificationPrefsMap.delete(key);
    }
  }

  async getFriendsWhoPlayGame(gameSlug: string, userId: number): Promise<Array<{ id: number; name: string; avatarUrl: string | null; gamesPlayed: number }>> {
    const friendIds = this.friendshipsStore
      .filter(f => f.status === "accepted" && (f.requesterId === userId || f.addresseeId === userId))
      .map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
    const result: Array<{ id: number; name: string; avatarUrl: string | null; gamesPlayed: number }> = [];
    for (const fid of friendIds) {
      const stats = this.userGameStatsMap.get(`${fid}-${gameSlug}`);
      if (stats && stats.gamesPlayed > 0) {
        const u = this.users.get(fid);
        if (u) result.push({ id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null, gamesPlayed: stats.gamesPlayed });
      }
    }
    return result.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  }

  async getUsersWithStreakAtRisk(): Promise<Array<{ userId: number; currentStreak: number }>> {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const result: Array<{ userId: number; currentStreak: number }> = [];
    for (const streak of this.userStreaks.values()) {
      if (streak.currentStreak > 0 && streak.lastPlayedDate === yesterdayStr) {
        result.push({ userId: streak.userId, currentStreak: streak.currentStreak });
      }
    }
    return result;
  }

  async getSiteSetting(key: string): Promise<string | null> {
    return this.siteSettingsMap.get(key) ?? null;
  }

  async setSiteSetting(key: string, value: string | null): Promise<void> {
    if (value === null) {
      this.siteSettingsMap.delete(key);
    } else {
      this.siteSettingsMap.set(key, value);
    }
  }
}
