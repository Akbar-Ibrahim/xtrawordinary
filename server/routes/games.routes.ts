import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { seededShuffle } from "../seeded-rng";
import { wordDictionary, wordDictSet } from "../game-data";

// ── Ladder Rush hint helpers ──────────────────────────────────────────────────

function _lrIsNLetterDiff(a: string, b: string, n: number): boolean {
  if (a.length !== b.length) return false;
  const freqA: Record<string, number> = {};
  const freqB: Record<string, number> = {};
  for (const c of a) freqA[c] = (freqA[c] || 0) + 1;
  for (const c of b) freqB[c] = (freqB[c] || 0) + 1;
  let added = 0, removed = 0;
  const allLetters = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  for (const c of allLetters) {
    const diff = (freqB[c] || 0) - (freqA[c] || 0);
    if (diff > 0) added += diff;
    else removed -= diff;
  }
  return added === n && removed === n;
}

function _lrFindNeighbors(word: string, swapCount: number, used: Set<string>): string[] {
  const results: string[] = [];
  if (swapCount === 1) {
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < word.length; i++) {
      for (const ch of LETTERS) {
        if (ch === word[i]) continue;
        const candidate = word.slice(0, i) + ch + word.slice(i + 1);
        if (wordDictSet.has(candidate) && !used.has(candidate)) results.push(candidate);
      }
    }
  } else {
    for (const candidate of wordDictionary) {
      if (candidate.length !== word.length) continue;
      if (used.has(candidate)) continue;
      if (_lrIsNLetterDiff(word, candidate, swapCount)) results.push(candidate);
    }
  }
  return results;
}

const DAILY_CHALLENGE_SLUGS = [
  "word-ladder",
  "anagram-solver",
  "word-scramble",
  "definition-match",
  "letter-pool",
  "word-maker",
  "word-length",
  "letter-position",
  "letter-hunt",
  "letter-balance",
  "letter-frequency",
  "no-repeats",
  "word-sweep",
  "word-roots",
  "ladder-rush",
  "shell-words",
  "deep-shell-words",
  "letter-dodge",
];

function getDailySlugForDate(dateStr: string): string {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);
  return DAILY_CHALLENGE_SLUGS[hash % DAILY_CHALLENGE_SLUGS.length];
}

export function registerGamesRoutes(app: Express): void {
  app.get("/api/games", async (_req, res) => {
    try {
      const [games, liveCounts] = await Promise.all([
        storage.getGames(),
        storage.getAllGamePlayCounts(),
      ]);
      const merged = games.map(g => ({
        ...g,
        playCount: g.playCount + (liveCounts[g.slug] ?? 0),
      }));
      res.json(merged);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  app.get("/api/games/word-ladder/puzzles", async (req, res) => {
    try {
      const puzzles = await storage.getWordLadderPuzzles();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? puzzles : seededShuffle(puzzles, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word ladder puzzles" });
    }
  });

  app.get("/api/games/ladder-rush/puzzles", async (req, res) => {
    try {
      const wordLength = parseInt(req.query.wordLength as string);
      if (![4, 5, 6].includes(wordLength)) {
        return res.status(400).json({ message: "wordLength must be 4, 5, or 6" });
      }
      const puzzles = await storage.getLadderRushPuzzles(wordLength);
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ladder rush puzzles" });
    }
  });

  app.post("/api/games/ladder-rush/hint", (req, res) => {
    try {
      const { currentWord, usedWords = [], doubleSwap = false } = req.body;
      if (!currentWord || typeof currentWord !== "string") {
        return res.status(400).json({ message: "currentWord is required" });
      }
      const word = currentWord.toUpperCase();
      const swapCount = doubleSwap ? 2 : 1;
      const used = new Set((usedWords as string[]).map((w: string) => w.toUpperCase()));
      used.add(word);

      const neighbors = _lrFindNeighbors(word, swapCount, used);
      if (neighbors.length === 0) {
        return res.status(404).json({ message: "No hint available" });
      }

      // Only return a neighbor that itself has at least one onward move (no dead ends)
      const goodNeighbors = neighbors.filter(n => {
        const nextUsed = new Set([...used, n]);
        return _lrFindNeighbors(n, swapCount, nextUsed).length > 0;
      });

      if (goodNeighbors.length === 0) {
        return res.status(404).json({ message: "No hint available" });
      }

      const hint = goodNeighbors[Math.floor(Math.random() * goodNeighbors.length)];
      return res.json({ word: hint });
    } catch {
      return res.status(500).json({ message: "Hint generation failed" });
    }
  });

  app.get("/api/games/anagram-solver/words", async (req, res) => {
    try {
      const wordSets = await storage.getAnagramWordSets();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? wordSets : seededShuffle(wordSets, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word sets" });
    }
  });

  app.get("/api/games/word-scramble/words", async (req, res) => {
    try {
      const words = await storage.getScrambleWords();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? words : seededShuffle(words, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch words" });
    }
  });

  app.get("/api/games/definition-match/words", async (req, res) => {
    try {
      const words = await storage.getDefinitionWords();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? words : seededShuffle(words, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch definition words" });
    }
  });

  app.get("/api/games/letter-pool/words", async (req, res) => {
    try {
      const words = await storage.getLetterPoolWords();
      const seed = parseInt(req.query.seed as string);
      const result = isNaN(seed) ? [...words].sort(() => Math.random() - 0.5) : seededShuffle(words, seed);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch letter pool words" });
    }
  });

  app.get("/api/games/shell-words/validate", async (req, res) => {
    try {
      const word = (req.query.word as string) || "";
      const result = await storage.validateShellWord(word);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate word" });
    }
  });

  app.get("/api/games/shell-words/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await storage.getShellWordPuzzle(seed);
      if (!puzzle) return res.status(404).json({ message: "No puzzle found" });
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch puzzle" });
    }
  });

  app.get("/api/games/shell-words/crack", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await storage.getCrackPuzzle(seed);
      if (!puzzle) return res.status(404).json({ message: "No crack puzzle found" });
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crack puzzle" });
    }
  });

  app.get("/api/games/deep-shell-words/validate", async (req, res) => {
    try {
      const word = (req.query.word as string) || "";
      const result = await storage.validateDeepShellWord(word);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate word" });
    }
  });

  app.get("/api/games/deep-shell-words/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await storage.getDeepShellWordPuzzle(seed);
      if (!puzzle) return res.status(404).json({ message: "No puzzle found" });
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch puzzle" });
    }
  });

  app.get("/api/games/deep-shell-words/crack", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await storage.getDeepCrackPuzzle(seed);
      if (!puzzle) return res.status(404).json({ message: "No crack puzzle found" });
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crack puzzle" });
    }
  });

  app.get("/api/games/word-stretch/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await storage.getWordStretchPuzzle(seed);
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word stretch puzzle" });
    }
  });

  app.get("/api/games/validate-word", async (req, res) => {
    try {
      const word = ((req.query.word as string) || "").trim().toUpperCase();
      if (!word || word.length < 2) return res.status(400).json({ message: "word must be at least 2 characters" });
      const exists = await storage.validateWord(word);
      res.json({ exists });
    } catch (error) {
      res.status(500).json({ message: "Failed to validate word" });
    }
  });

  app.get("/api/games/word-stretch/validate", async (req, res) => {
    try {
      const stretched = (req.query.stretched as string) || "";
      const seedWord = (req.query.seedWord as string) || "";
      if (!stretched || !seedWord) return res.status(400).json({ message: "stretched and seedWord are required" });
      const result = await storage.validateWordStretch(stretched, seedWord);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate word stretch" });
    }
  });

  app.get("/api/games/letter-position/validate", async (req, res) => {
    try {
      const letter = (req.query.letter as string || "").toUpperCase().trim();
      const position = parseInt(req.query.position as string);
      if (!letter || letter.length !== 1 || !/^[A-Z]$/.test(letter)) {
        return res.status(400).json({ message: "letter must be a single A-Z character" });
      }
      if (isNaN(position) || position < 1 || position > 8) {
        return res.status(400).json({ message: "position must be between 1 and 8" });
      }
      const count = await storage.countLetterPositionWords(letter, position);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to count matching words" });
    }
  });

  app.get("/api/games/letter-position/examples", async (req, res) => {
    try {
      const letter = (req.query.letter as string || "").toUpperCase().trim();
      const position = parseInt(req.query.position as string);
      const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));
      if (!letter || letter.length !== 1 || !/^[A-Z]$/.test(letter)) {
        return res.status(400).json({ message: "letter must be a single A-Z character" });
      }
      if (isNaN(position) || position < 1 || position > 8) {
        return res.status(400).json({ message: "position must be between 1 and 8" });
      }
      const result = await storage.getLetterPositionExamples(letter, position, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch letter position examples" });
    }
  });

  app.get("/api/games/no-repeats/examples", async (req, res) => {
    try {
      const challenge = parseInt(req.query.challenge as string);
      const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 10));
      const requiredLetters = ((req.query.requiredLetters as string) || "")
        .split(",")
        .map(l => l.trim().toUpperCase())
        .filter(l => /^[A-Z]$/.test(l));
      if (isNaN(challenge) || challenge < 3 || challenge > 9) {
        return res.status(400).json({ message: "challenge must be between 3 and 9" });
      }
      const result = await storage.getNoRepeatsExamples(challenge, requiredLetters, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch no-repeats examples" });
    }
  });

  app.get("/api/games/word-length/validate", async (req, res) => {
    try {
      const length = parseInt(req.query.length as string);
      const startsWith = (req.query.startsWith as string || "").toUpperCase().trim() || undefined;
      const endsWith = (req.query.endsWith as string || "").toUpperCase().trim() || undefined;
      const contains = (req.query.contains as string || "").toUpperCase().trim() || undefined;
      if (isNaN(length) || length < 3 || length > 12) {
        return res.status(400).json({ message: "length must be between 3 and 12" });
      }
      const singleLetter = /^[A-Z]$/;
      if (startsWith && !singleLetter.test(startsWith)) return res.status(400).json({ message: "startsWith must be a single A-Z letter" });
      if (endsWith && !singleLetter.test(endsWith)) return res.status(400).json({ message: "endsWith must be a single A-Z letter" });
      if (contains && !singleLetter.test(contains)) return res.status(400).json({ message: "contains must be a single A-Z letter" });
      const count = await storage.countWordLengthWords(length, startsWith, endsWith, contains);
      res.json({ count, ok: count >= 10 });
    } catch (error) {
      res.status(500).json({ message: "Failed to count matching words" });
    }
  });

  app.get("/api/games/word-stretch/solutions", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const solutions = await storage.getWordStretchSolutions(seed);
      res.json({ solutions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch solutions" });
    }
  });

  app.get("/api/games/word-bloom/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await storage.getWordBloomPuzzle(seed);
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word bloom puzzle" });
    }
  });

  app.get("/api/games/word-bloom/validate", async (req, res) => {
    try {
      const currentWord = (req.query.current as string) || "";
      const nextWord = (req.query.next as string) || "";
      if (!currentWord || !nextWord) return res.status(400).json({ message: "current and next are required" });
      const result = await storage.validateWordBloom(currentWord, nextWord);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate word bloom step" });
    }
  });

  app.get("/api/games/deep-shell-words/crack-answer", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const answer = await storage.getDeepCrackAnswer(seed);
      if (!answer) return res.status(404).json({ message: "No answer found" });
      res.json({ example: answer });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crack answer" });
    }
  });

  app.get("/api/games/word-roots/puzzles", async (req, res) => {
    try {
      const allPuzzles = await storage.getWordRootsPuzzles();
      const seed = parseInt(req.query.seed as string);
      const shuffled = isNaN(seed)
        ? [...allPuzzles].sort(() => Math.random() - 0.5)
        : seededShuffle(allPuzzles, seed);
      const selected = shuffled.slice(0, 5).map((p, idx) => {
        const shuffledDerivatives = isNaN(seed)
          ? [...p.derivatives].sort(() => Math.random() - 0.5)
          : seededShuffle(p.derivatives, seed + idx + 1);
        return {
          canonicalWord: p.canonicalWord,
          derivatives: shuffledDerivatives.slice(0, 5),
        };
      });
      res.json(selected);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word roots puzzles" });
    }
  });

  app.get("/api/games/word-maker/words", async (req, res) => {
    try {
      const words = await storage.getMakerWords();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? words : seededShuffle(words, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch maker words" });
    }
  });

  app.get("/api/games/word-stack/puzzles", async (_req, res) => {
    try {
      const puzzles = await storage.getWordStackPuzzles();
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word stack puzzles" });
    }
  });

  app.get("/api/games/word-split/puzzles", async (_req, res) => {
    try {
      const puzzles = await storage.getWordSplitPuzzles();
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word split puzzles" });
    }
  });

  app.get("/api/games/progressive-reveal/words", async (req, res) => {
    try {
      const words = await storage.getProgressiveRevealWords();
      const rawSeed = req.query.seed;
      if (rawSeed !== undefined) {
        const seed = parseInt(rawSeed as string, 10);
        if (!isNaN(seed)) {
          return res.json(seededShuffle(words, seed));
        }
      }
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch progressive reveal words" });
    }
  });

  app.get("/api/games/word-extension/puzzles", async (req, res) => {
    try {
      const lettersToAdd = parseInt(req.query.lettersToAdd as string);
      if (isNaN(lettersToAdd) || lettersToAdd < 1 || lettersToAdd > 4) {
        return res.status(400).json({ message: "lettersToAdd must be 1–4" });
      }
      const puzzles = await storage.getWordExtensionPuzzles(lettersToAdd);
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word extension puzzles" });
    }
  });

  app.post("/api/games/word-extension/validate", async (req, res) => {
    try {
      const { shownWord, submittedWord, lettersToAdd } = req.body;
      if (!shownWord || typeof shownWord !== "string" || !submittedWord || typeof submittedWord !== "string") {
        return res.status(400).json({ message: "shownWord and submittedWord are required" });
      }
      const n = parseInt(lettersToAdd);
      if (isNaN(n) || n < 1 || n > 4) {
        return res.status(400).json({ message: "lettersToAdd must be 1–4" });
      }
      const shown = shownWord.trim().toUpperCase();
      const submitted = submittedWord.trim().toUpperCase();
      // Enforce exact length server-side — prevents cross-difficulty abuse.
      if (submitted.length !== shown.length + n) {
        return res.json({ valid: false });
      }
      const result = await storage.validateWordExtension(shown, submitted, n);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Validation failed" });
    }
  });

  app.post("/api/games/validate-word", async (req, res) => {
    try {
      const { word } = req.body;
      if (!word || typeof word !== "string") {
        return res.status(400).json({ valid: false, message: "Word is required" });
      }
      const valid = await storage.validateWord(word);
      res.json({ valid, message: valid ? "Valid word!" : "Not in dictionary" });
    } catch (error) {
      res.status(500).json({ valid: false, message: "Validation failed" });
    }
  });

  app.get("/api/games/letter-balance/config", async (_req, res) => {
    try {
      const config = await storage.getVowelConsonantConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch letter balance config" });
    }
  });

  app.post("/api/games/word-chain/start", async (req, res) => {
    try {
      const { variation, level, seed } = req.body;
      const seedNum = (seed !== undefined && Number.isFinite(Number(seed))) ? Number(seed) : undefined;
      const word = await storage.getWordChainStartWord(variation || 1, level || 1, seedNum);
      res.json({ word });
    } catch (error) {
      res.status(500).json({ message: "Failed to get start word" });
    }
  });

  app.post("/api/games/word-chain/computer-word", async (req, res) => {
    try {
      const { playerWord, variation, level, usedWords } = req.body;
      const word = await storage.getWordChainComputerWord(
        playerWord,
        variation || 1,
        level || 1,
        usedWords || []
      );
      res.json({ word });
    } catch (error) {
      res.status(500).json({ message: "Failed to get computer word" });
    }
  });

  app.get("/api/games/word-sweep/grid", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      const grid = await storage.generateWordSweepGrid(isNaN(seed) ? undefined : seed);
      res.json(grid);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate grid" });
    }
  });

  app.get("/api/games/word-unpack/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      const puzzle = await storage.generateWordUnpackPuzzle(isNaN(seed) ? undefined : seed);
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate puzzle" });
    }
  });

  app.get("/api/daily-challenge", async (_req, res) => {
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      let hash = 0;
      for (let i = 0; i < dateStr.length; i++) {
        hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
      }
      hash = Math.abs(hash);
      const slug = DAILY_CHALLENGE_SLUGS[hash % DAILY_CHALLENGE_SLUGS.length];
      const game = await storage.getGameBySlug(slug);
      res.json({ date: dateStr, slug, game, seed: hash });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch daily challenge" });
    }
  });

  app.post("/api/daily-challenge/score", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const bodySchema = z.object({ date: z.string(), score: z.number().int().min(0) });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
      const gameSlug = getDailySlugForDate(parsed.data.date);
      await storage.saveDailyChallengeScore(userId, parsed.data.date, gameSlug, parsed.data.score);
      const streakResult = await storage.updateDailyChallengeStreak(userId, parsed.data.date);
      res.json({ ok: true, streak: streakResult.streak, longest: streakResult.longest, alreadyDone: streakResult.alreadyDone });
    } catch {
      res.status(500).json({ error: "Failed to save score" });
    }
  });

  app.get("/api/user/daily-streak", requireAuth, async (req, res) => {
    try {
      const streak = await storage.getUserStreak(req.user!.id);
      res.json({ streak: streak?.dailyChallengeStreak ?? 0, longest: streak?.longestDailyChallengeStreak ?? 0 });
    } catch {
      res.status(500).json({ error: "Failed to fetch daily streak" });
    }
  });

  app.get("/api/daily-challenge/leaderboard", async (req, res) => {
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const date = (req.query.date as string) || todayStr;
      const gameSlug = getDailySlugForDate(date);
      const requestingUserId = req.isAuthenticated() ? req.user!.id : undefined;
      const result = await storage.getDailyLeaderboard(date, gameSlug, requestingUserId);
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/daily-challenge/attempt", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { date } = req.body;
      if (!date || typeof date !== "string") return res.status(400).json({ error: "date is required" });
      const attempt = await storage.createDailyChallengeAttempt(userId, date);
      res.json(attempt);
    } catch {
      res.status(500).json({ error: "Failed to record attempt" });
    }
  });

  app.get("/api/daily-challenge/attempt", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ error: "date is required" });
      const attempt = await storage.getDailyChallengeAttempt(userId, date);
      res.json({ attempt: attempt || null });
    } catch {
      res.status(500).json({ error: "Failed to fetch attempt" });
    }
  });

  app.get("/api/games/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const [game, liveCount] = await Promise.all([
        storage.getGameBySlug(slug),
        storage.getGamePlayCount(slug),
      ]);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json({ ...game, playCount: game.playCount + liveCount });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  app.get("/api/games/:slug/friends-who-play", requireAuth, async (req, res) => {
    try {
      const friends = await storage.getFriendsWhoPlayGame(req.params.slug, req.user!.id);
      res.json(friends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  });
}
