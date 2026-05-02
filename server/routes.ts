import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { externalApi } from "./externalApi";
import passport from "passport";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireAuth, requireAdmin } from "./auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import { registerSchema, loginSchema, statsInputSchema, leaderboardInputSchema } from "./validators";
import { SEEDED_GAME_SLUGS, QUIZ_MASTER_GAME_SLUGS } from "@shared/schema";
import { seededShuffle } from "./seeded-rng";
// import axios from "axios";
// const REMOTE_BASE_URL = "https://your-remote-server.com";
// import { db } from "./db";
// import { words } from "./db-schema";
// import { eq } from "drizzle-orm";

const isLocalMode = process.env.DEV_MODE === "LOCAL";
const dataSource = isLocalMode ? storage : externalApi;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/games", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch games";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const games = await dataSource.getGames();
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  app.get("/api/games/word-ladder/puzzles", async (req, res) => {
    try {
      const puzzles = await dataSource.getWordLadderPuzzles();
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
      const puzzles = await dataSource.getLadderRushPuzzles(wordLength);
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ladder rush puzzles" });
    }
  });

  app.get("/api/games/anagram-solver/words", async (req, res) => {
    try {
      const wordSets = await dataSource.getAnagramWordSets();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? wordSets : seededShuffle(wordSets, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word sets" });
    }
  });

  app.get("/api/games/word-scramble/words", async (req, res) => {
    try {
      const words = await dataSource.getScrambleWords();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? words : seededShuffle(words, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch words" });
    }
  });

  app.get("/api/games/definition-match/words", async (req, res) => {
    // --- MYSQL QUERY (uncomment when word_categories table is populated) ---
    // try {
    //   const db = await import("./db").then(m => m.db);
    //   const { wordCategories } = await import("./db-schema");
    //   const { sql } = await import("drizzle-orm");
    //
    //   // Fetch a random selection of rows from word_categories
    //   const rows = await db
    //     .select()
    //     .from(wordCategories)
    //     .orderBy(sql`RAND()`)
    //     .limit(20);
    //
    //   // Helper: safely parse the definitions JSON column.
    //   // MySQL drivers may return JSON columns as raw strings — always parse defensively.
    //   function parseDefinitions(raw: unknown): string[] {
    //     if (Array.isArray(raw)) return raw.map(String);
    //     if (typeof raw === "string") {
    //       try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(String) : []; }
    //       catch { return []; }
    //     }
    //     return [];
    //   }
    //
    //   // Helper: pick N random items from an array (Fisher-Yates slice).
    //   function pickRandom<T>(arr: T[], n: number): T[] {
    //     const copy = [...arr];
    //     for (let i = copy.length - 1; i > 0; i--) {
    //       const j = Math.floor(Math.random() * (i + 1));
    //       [copy[i], copy[j]] = [copy[j], copy[i]];
    //     }
    //     return copy.slice(0, n);
    //   }
    //
    //   const words = rows
    //     .map(row => {
    //       const allDefs = parseDefinitions(row.definitions);
    //       if (allDefs.length < 1) return null; // skip rows with no definitions
    //       // If the row has more than 3 definitions, randomly pick 3.
    //       const chosen = allDefs.length > 3 ? pickRandom(allDefs, 3) : allDefs;
    //       // Pad to exactly 3 if fewer than 3 exist (reuses last definition as fallback).
    //       while (chosen.length < 3) chosen.push(chosen[chosen.length - 1]);
    //       return {
    //         word: row.word.toUpperCase(),
    //         partOfSpeech: "word", // extend db-schema with a partOfSpeech column when available
    //         definitions: chosen as [string, string, string],
    //       };
    //     })
    //     .filter(Boolean);
    //
    //   const seed = parseInt(req.query.seed as string);
    //   return res.json(isNaN(seed) ? words : seededShuffle(words as any[], seed));
    // } catch (error) {
    //   console.error("definition-match MySQL fetch error:", error);
    //   return res.status(500).json({ message: "Failed to fetch definition words" });
    // }
    // --- END MYSQL QUERY ---
    try {
      const words = await dataSource.getDefinitionWords();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? words : seededShuffle(words, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch definition words" });
    }
  });

  app.get("/api/games/letter-pool/words", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/letter-pool/words`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch letter pool words";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const words = await dataSource.getLetterPoolWords();
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
      const result = await dataSource.validateShellWord(word);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate word" });
    }
  });

  app.get("/api/games/shell-words/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await dataSource.getShellWordPuzzle(seed);
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
      const puzzle = await dataSource.getCrackPuzzle(seed);
      if (!puzzle) return res.status(404).json({ message: "No crack puzzle found" });
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crack puzzle" });
    }
  });

  app.get("/api/games/deep-shell-words/validate", async (req, res) => {
    try {
      const word = (req.query.word as string) || "";
      const result = await dataSource.validateDeepShellWord(word);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate word" });
    }
  });

  app.get("/api/games/deep-shell-words/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await dataSource.getDeepShellWordPuzzle(seed);
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
      const puzzle = await dataSource.getDeepCrackPuzzle(seed);
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
      const puzzle = await dataSource.getWordStretchPuzzle(seed);
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word stretch puzzle" });
    }
  });

  app.get("/api/games/validate-word", async (req, res) => {
    try {
      const word = ((req.query.word as string) || "").trim().toUpperCase();
      if (!word || word.length < 2) return res.status(400).json({ message: "word must be at least 2 characters" });
      const exists = await dataSource.validateWord(word);
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
      const result = await dataSource.validateWordStretch(stretched, seedWord);
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
      const count = await dataSource.countLetterPositionWords(letter, position);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to count matching words" });
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
      const count = await dataSource.countWordLengthWords(length, startsWith, endsWith, contains);
      res.json({ count, ok: count >= 10 });
    } catch (error) {
      res.status(500).json({ message: "Failed to count matching words" });
    }
  });

  app.get("/api/games/word-stretch/solutions", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const solutions = await dataSource.getWordStretchSolutions(seed);
      res.json({ solutions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch solutions" });
    }
  });

  app.get("/api/games/word-bloom/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const puzzle = await dataSource.getWordBloomPuzzle(seed);
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
      const result = await dataSource.validateWordBloom(currentWord, nextWord);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate word bloom step" });
    }
  });

  app.get("/api/games/deep-shell-words/crack-answer", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      if (isNaN(seed)) return res.status(400).json({ message: "seed is required" });
      const answer = await dataSource.getDeepCrackAnswer(seed);
      if (!answer) return res.status(404).json({ message: "No answer found" });
      res.json({ example: answer });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crack answer" });
    }
  });

  app.get("/api/games/word-roots/puzzles", async (req, res) => {
    try {
      const allPuzzles = await dataSource.getWordRootsPuzzles();
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
      const words = await dataSource.getMakerWords();
      const seed = parseInt(req.query.seed as string);
      res.json(isNaN(seed) ? words : seededShuffle(words, seed));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch maker words" });
    }
  });

  app.get("/api/games/word-stack/puzzles", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/word-stack/puzzles`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch word stack puzzles";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const puzzles = await dataSource.getWordStackPuzzles();
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word stack puzzles" });
    }
  });

  app.get("/api/games/word-split/puzzles", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/word-split/puzzles`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch word split puzzles";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const puzzles = await dataSource.getWordSplitPuzzles();
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word split puzzles" });
    }
  });

  app.get("/api/games/progressive-reveal/words", async (req, res) => {
    try {
      const words = await dataSource.getProgressiveRevealWords();
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

  // Dictionary endpoint removed for security - words validated only via /api/games/validate-word

  app.post("/api/games/validate-word", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const { word } = req.body;
    //   if (!word || typeof word !== "string") {
    //     return res.status(400).json({ valid: false, message: "Word is required" });
    //   }
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/games/validate-word`, { word });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const data = error.response?.data || { valid: false, message: "Validation failed" };
    //   res.status(status).json(data);
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { word } = req.body;
      if (!word || typeof word !== "string") {
        return res.status(400).json({ valid: false, message: "Word is required" });
      }
      const valid = await dataSource.validateWord(word);
      // --- DB VALIDATION (uncomment to validate against words table instead) ---
      // const rows = await db.select({ id: words.id }).from(words).where(eq(words.word, word.toUpperCase())).limit(1);
      // const valid = rows.length > 0;
      // --- END DB VALIDATION ---
      res.json({ valid, message: valid ? "Valid word!" : "Not in dictionary" });
    } catch (error) {
      res.status(500).json({ valid: false, message: "Validation failed" });
    }
  });

  // Letter Balance config - still needed for that game
  app.get("/api/games/letter-balance/config", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/letter-balance/config`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch letter balance config";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const config = await dataSource.getVowelConsonantConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch letter balance config" });
    }
  });

  // Word Chain endpoints - need dictionary access for computer responses
  app.post("/api/games/word-chain/start", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const { variation, level } = req.body;
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/games/word-chain/start`, {
    //     variation: variation || 1,
    //     level: level || 1,
    //   });
    //   const { word } = response.data;
    //   res.json({ word });
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to get start word";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { variation, level } = req.body;
      const word = await dataSource.getWordChainStartWord(variation || 1, level || 1);
      res.json({ word });
    } catch (error) {
      res.status(500).json({ message: "Failed to get start word" });
    }
  });

  app.post("/api/games/word-chain/computer-word", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const { playerWord, variation, level, usedWords } = req.body;
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/games/word-chain/computer-word`, {
    //     playerWord,
    //     variation: variation || 1,
    //     level: level || 1,
    //     usedWords: usedWords || [],
    //   });
    //   const { word } = response.data;
    //   res.json({ word });
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to get computer word";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { playerWord, variation, level, usedWords } = req.body;
      const word = await dataSource.getWordChainComputerWord(
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
      const grid = await dataSource.generateWordSweepGrid(isNaN(seed) ? undefined : seed);
      res.json(grid);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate grid" });
    }
  });

  app.get("/api/games/word-unpack/puzzle", async (req, res) => {
    try {
      const seed = parseInt(req.query.seed as string);
      const puzzle = await dataSource.generateWordUnpackPuzzle(isNaN(seed) ? undefined : seed);
      res.json(puzzle);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate puzzle" });
    }
  });

  app.get("/api/daily-challenge", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/daily-challenge`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch daily challenge";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const challengeGameSlugs = [
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
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      let hash = 0;
      for (let i = 0; i < dateStr.length; i++) {
        hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
      }
      hash = Math.abs(hash);
      const index = hash % challengeGameSlugs.length;
      const slug = challengeGameSlugs[index];
      const game = await dataSource.getGameBySlug(slug);
      res.json({ date: dateStr, slug, game, seed: hash });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch daily challenge" });
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
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const { slug } = req.params;
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/${slug}`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   if (status === 404) {
    //     return res.status(404).json({ message: "Game not found" });
    //   }
    //   const message = error.response?.data?.message || "Failed to fetch game";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { slug } = req.params;
      const game = await dataSource.getGameBySlug(slug);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  // ==================== AUTH ROUTES ====================

  function sanitizeUser(user: any) {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }

  app.post("/api/auth/register", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/auth/register`, req.body);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Registration failed";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { email, name, password } = parsed.data;
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        name,
        passwordHash,
        googleId: null,
        emailVerified: false,
        avatarUrl: null,
        isAdmin: false,
        isBanned: false,
        isPremium: false,
      });
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await storage.createEmailVerificationToken(user.id, token, expiresAt);
      await sendVerificationEmail(email, token);
      res.status(201).json({ user: sanitizeUser(user), message: "Registration successful. Please verify your email." });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/auth/login`, req.body);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Login failed";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Login failed" });
      }
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.json({ user: sanitizeUser(user) });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      res.json({ user: sanitizeUser(req.user) });
    } else {
      res.json({ user: null });
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

    app.get("/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/?auth=error" }),
      (_req, res) => {
        res.redirect("/?auth=success");
      }
    );
  }

  app.post("/api/auth/verify-email", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/auth/verify-email`, req.body);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Verification failed";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Token is required" });
      const record = await storage.getEmailVerificationToken(token);
      if (!record) return res.status(400).json({ error: "Invalid or expired token" });
      if (new Date(record.expiresAt) < new Date()) {
        await storage.deleteEmailVerificationToken(token);
        return res.status(400).json({ error: "Token has expired" });
      }
      await storage.updateUser(record.userId, { emailVerified: true });
      await storage.deleteEmailVerificationToken(token);
      res.json({ message: "Email verified successfully" });
    } catch (error) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/auth/forgot-password`, req.body);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Request failed";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ message: "If that email is registered, a reset link has been sent." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      await sendPasswordResetEmail(email, token);
      res.json({ message: "If that email is registered, a reset link has been sent." });
    } catch (error) {
      res.status(500).json({ error: "Request failed" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/auth/reset-password`, req.body);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Reset failed";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { token, password } = req.body;
      if (!token || !password) return res.status(400).json({ error: "Token and password are required" });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      const record = await storage.getPasswordResetToken(token);
      if (!record) return res.status(400).json({ error: "Invalid or expired token" });
      if (new Date(record.expiresAt) < new Date()) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ error: "Token has expired" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await storage.updateUser(record.userId, { passwordHash });
      await storage.deletePasswordResetToken(token);
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ error: "Reset failed" });
    }
  });

  // ==================== USER STATS ROUTES ====================

  app.get("/api/user/stats", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/user/stats`, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch stats";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const stats = await storage.getAllUserGameStats(req.user!.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/user/stats", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/user/stats`, req.body, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to save stats";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const parsed = statsInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { gameSlug, bestScore, gamesPlayed, gamesWon, wordsFound } = parsed.data;
      const stats = await storage.saveUserGameStats({
        userId: req.user!.id,
        gameSlug,
        bestScore,
        gamesPlayed,
        gamesWon,
        wordsFound,
        lastPlayedAt: new Date().toISOString(),
      });
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to save stats" });
    }
  });

  app.get("/api/user/streak", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/user/streak`, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch streak";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const streak = await storage.getUserStreak(req.user!.id);
      res.json(streak || { currentStreak: 0, longestStreak: 0, lastPlayedDate: null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch streak" });
    }
  });

  app.post("/api/user/streak", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/user/streak`, req.body, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to save streak";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { currentStreak, longestStreak, lastPlayedDate } = req.body;
      const streak = await storage.saveUserStreak(req.user!.id, currentStreak || 0, longestStreak || 0, lastPlayedDate || new Date().toISOString().split("T")[0]);
      res.json(streak);
    } catch (error) {
      res.status(500).json({ error: "Failed to save streak" });
    }
  });

  app.get("/api/user/achievements", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/user/achievements`, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch achievements";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const achievements = await storage.getUserAchievements(req.user!.id);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  });

  app.post("/api/user/achievements", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/user/achievements`, req.body, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to save achievement";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { achievementId, unlockedAt } = req.body;
      if (!achievementId) return res.status(400).json({ error: "achievementId is required" });
      const achievement = await storage.saveUserAchievement(req.user!.id, achievementId, unlockedAt || new Date().toISOString());
      res.json(achievement);
    } catch (error) {
      res.status(500).json({ error: "Failed to save achievement" });
    }
  });

  // ==================== LEADERBOARD ROUTES ====================

  app.get("/api/leaderboard", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/leaderboard`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch leaderboard";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const entries = await storage.getOverallLeaderboard(50);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/:gameSlug", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/leaderboard/${req.params.gameSlug}`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch leaderboard";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const entries = await storage.getLeaderboard(req.params.gameSlug, 50);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/leaderboard", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/leaderboard`, req.body, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to submit score";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const parsed = leaderboardInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { gameSlug, score } = parsed.data;
      const entry = await storage.saveLeaderboardEntry({
        userId: req.user!.id,
        gameSlug,
        score,
        playerName: req.user!.name,
        playedAt: new Date().toISOString(),
      });
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit score" });
    }
  });

  // ==================== PROFILE ROUTES ====================

  app.get("/api/users/search", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/users/search`, { params: { q: req.query.q }, headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to search users";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const q = (req.query.q as string) || "";
      if (q.length < 2) return res.json([]);
      const results = await storage.searchUsers(q);
      const filtered = results.filter(u => u.id !== req.user!.id);
      res.json(filtered);
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(50).optional(),
        avatarUrl: z.union([z.string().url(), z.null()]).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const { name, avatarUrl } = parsed.data;
      const updates: { name?: string; avatarUrl?: string | null } = {};
      if (name !== undefined) updates.name = name;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
      const updated = await storage.updateUser(req.user!.id, updates);
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ id: updated.id, name: updated.name, avatarUrl: updated.avatarUrl ?? null });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.get("/api/users/:id/profile", async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/users/${req.params.id}/profile`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch profile";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      const profile = await storage.getPublicProfile(id);
      if (!profile) return res.status(404).json({ error: "User not found" });
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // ==================== FRIEND ROUTES ====================

  app.get("/api/friends", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/friends`, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch friends";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const friends = await storage.getFriends(req.user!.id);
      res.json(friends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  });

  app.get("/api/friends/requests", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/friends/requests`, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch friend requests";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const requests = await storage.getPendingFriendRequests(req.user!.id);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch friend requests" });
    }
  });

  app.post("/api/friends/request", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/friends/request`, req.body, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to send friend request";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId is required" });
      if (userId === req.user!.id) return res.status(400).json({ error: "Cannot friend yourself" });
      const existing = await storage.getFriendship(req.user!.id, userId);
      if (existing) return res.status(400).json({ error: "Friend request already exists" });
      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      const friendship = await storage.sendFriendRequest(req.user!.id, userId);
      res.json(friendship);
    } catch (error) {
      res.status(500).json({ error: "Failed to send friend request" });
    }
  });

  app.post("/api/friends/:id/accept", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/friends/${req.params.id}/accept`, {}, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to accept friend request";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const existing = await storage.getFriendshipById(id);
      if (!existing) return res.status(404).json({ error: "Request not found" });
      if (existing.addresseeId !== req.user!.id) return res.status(403).json({ error: "Not your request" });
      const updated = await storage.acceptFriendRequest(id);
      if (!updated) return res.status(404).json({ error: "Request not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept friend request" });
    }
  });

  app.post("/api/friends/:id/decline", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/friends/${req.params.id}/decline`, {}, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to decline friend request";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const existing = await storage.getFriendshipById(id);
      if (!existing) return res.status(404).json({ error: "Request not found" });
      if (existing.addresseeId !== req.user!.id) return res.status(403).json({ error: "Not your request" });
      const updated = await storage.declineFriendRequest(id);
      if (!updated) return res.status(404).json({ error: "Request not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to decline friend request" });
    }
  });

  app.delete("/api/friends/:id", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.delete(`${REMOTE_BASE_URL}/api/friends/${req.params.id}`, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to remove friend";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const existing = await storage.getFriendshipById(id);
      if (!existing) return res.status(404).json({ error: "Friendship not found" });
      if (existing.requesterId !== req.user!.id && existing.addresseeId !== req.user!.id) return res.status(403).json({ error: "Not your friendship" });
      await storage.removeFriend(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove friend" });
    }
  });

  // ==================== CHALLENGE ROUTES ====================

  app.post("/api/challenges", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/challenges`, req.body, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to create challenge";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const { friendId, gameSlug, score, message, seed } = req.body;
      if (!friendId || typeof friendId !== "number") return res.status(400).json({ error: "Valid friendId is required" });
      if (!gameSlug || typeof gameSlug !== "string") return res.status(400).json({ error: "Valid gameSlug is required" });
      if (!SEEDED_GAME_SLUGS.has(gameSlug)) return res.status(400).json({ error: "Game does not support challenges" });
      if (score === undefined || typeof score !== "number" || score < 0) return res.status(400).json({ error: "Valid non-negative score is required" });
      if (message && typeof message === "string" && message.length > 200) return res.status(400).json({ error: "Message too long (max 200 chars)" });
      if (seed !== undefined && (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 2147483647)) return res.status(400).json({ error: "Seed must be a non-negative integer" });
      const friendship = await storage.getFriendship(req.user!.id, friendId);
      if (!friendship || friendship.status !== "accepted") return res.status(400).json({ error: "You can only challenge friends" });
      const challenge = await storage.createFriendChallenge({
        senderId: req.user!.id,
        receiverId: friendId,
        gameSlug,
        senderScore: score,
        receiverScore: null,
        status: "pending",
        message: message || null,
        seed: typeof seed === "number" ? seed : null,
        senderViewed: false,
      });
      res.json(challenge);
    } catch (error) {
      res.status(500).json({ error: "Failed to create challenge" });
    }
  });

  app.get("/api/challenges", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/challenges`, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch challenges";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const challenges = await storage.getFriendChallenges(req.user!.id);
      res.json(challenges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  app.get("/api/challenges/unread-count", requireAuth, async (req, res) => {
    try {
      const challenges = await storage.getFriendChallenges(req.user!.id);
      const resultCount = challenges.filter(
        (c) => c.status === "completed" && c.senderId === req.user!.id && !c.senderViewed
      ).length;
      const pendingCount = challenges.filter(
        (c) => c.status === "pending" && c.receiverId === req.user!.id
      ).length;
      res.json({ count: resultCount + pendingCount, resultCount, pendingCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.get("/api/challenges/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const challenge = await storage.getFriendChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.senderId !== req.user!.id && challenge.receiverId !== req.user!.id) {
        return res.status(403).json({ error: "Not your challenge" });
      }
      res.json(challenge);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  });

  app.post("/api/challenges/:id/complete", requireAuth, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.post(`${REMOTE_BASE_URL}/api/challenges/${req.params.id}/complete`, req.body, { headers: { cookie: req.headers.cookie } });
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to complete challenge";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const { score } = req.body;
      if (score === undefined || typeof score !== "number" || score < 0) return res.status(400).json({ error: "Valid non-negative score is required" });
      const challenge = await storage.getFriendChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.receiverId !== req.user!.id) return res.status(403).json({ error: "Not your challenge" });
      if (challenge.status === "completed") return res.status(400).json({ error: "Challenge already completed" });
      const updated = await storage.completeFriendChallenge(id, score);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete challenge" });
    }
  });

  app.post("/api/challenges/:id/viewed", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const challenge = await storage.getFriendChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.senderId !== req.user!.id) return res.status(403).json({ error: "Only the sender can mark as viewed" });
      if (challenge.status !== "completed") return res.status(400).json({ error: "Only completed challenges can be marked as viewed" });
      await storage.markChallengeViewed(id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark challenge as viewed" });
    }
  });

  // ==================== ADMIN ROUTES ====================

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/admin/stats`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch admin stats";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/admin/users`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch users";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const users = await storage.getAllUsers();
      const sanitized = users.map(u => {
        const { passwordHash, ...rest } = u;
        return rest;
      });
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.patch(`${REMOTE_BASE_URL}/api/admin/users/${req.params.id}/ban`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to toggle ban";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      if (id === req.user!.id) return res.status(400).json({ error: "Cannot ban yourself" });
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, { isBanned: !user.isBanned });
      if (!updated) return res.status(500).json({ error: "Failed to update user" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle ban" });
    }
  });

  app.patch("/api/admin/users/:id/admin", requireAdmin, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.patch(`${REMOTE_BASE_URL}/api/admin/users/${req.params.id}/admin`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to toggle admin";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      if (id === req.user!.id) return res.status(400).json({ error: "Cannot change your own admin status" });
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, { isAdmin: !user.isAdmin });
      if (!updated) return res.status(500).json({ error: "Failed to update user" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle admin" });
    }
  });

  app.post("/api/users/me/upgrade-premium", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateUser(req.user!.id, { isPremium: true });
      if (!updated) return res.status(500).json({ error: "Failed to upgrade" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch {
      res.status(500).json({ error: "Failed to upgrade" });
    }
  });

  app.post("/api/users/me/downgrade-premium", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateUser(req.user!.id, { isPremium: false });
      if (!updated) return res.status(500).json({ error: "Failed to downgrade" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch {
      res.status(500).json({ error: "Failed to downgrade" });
    }
  });

  app.patch("/api/admin/users/:id/premium", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, { isPremium: !user.isPremium });
      if (!updated) return res.status(500).json({ error: "Failed to update user" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle premium" });
    }
  });

  app.get("/api/admin/leaderboard", requireAdmin, async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/admin/leaderboard`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to fetch leaderboard";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const entries = await storage.getAllLeaderboardEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard entries" });
    }
  });

  app.get("/api/admin/groups", requireAdmin, async (_req, res) => {
    try {
      const groups = await storage.getAllGroups();
      res.json(groups);
    } catch {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.get("/api/admin/games", requireAdmin, async (_req, res) => {
    try {
      const games = await storage.getAllGames();
      res.json(games);
    } catch {
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.patch("/api/admin/games/:slug/active", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive must be a boolean" });
      const game = await storage.getGameBySlug(slug);
      if (!game) return res.status(404).json({ error: "Game not found" });
      await storage.setGameActive(slug, isActive);
      res.json({ success: true, slug, isActive });
    } catch {
      res.status(500).json({ error: "Failed to update game" });
    }
  });

  app.delete("/api/admin/leaderboard/:id", requireAdmin, async (req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.delete(`${REMOTE_BASE_URL}/api/admin/leaderboard/${req.params.id}`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.error || "Failed to delete entry";
    //   res.status(status).json({ error: message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid entry ID" });
      await storage.deleteLeaderboardEntry(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  // ==================== GROUPS ROUTES ====================

  function generateInviteCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += "-";
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  const CHALLENGE_GAME_SLUGS = [
    "word-ladder", "anagram-solver", "word-scramble", "definition-match",
    "letter-pool", "word-maker", "word-length", "letter-position",
    "letter-hunt", "letter-balance", "letter-frequency", "no-repeats",
    "word-sweep", "word-roots", "shell-words", "deep-shell-words",
  ];

  app.get("/api/groups", async (req, res) => {
    try {
      let publicGroups = await storage.getPublicGroups();
      const tagFilter = req.query.tag as string | undefined;
      if (tagFilter) {
        publicGroups = publicGroups.filter(g => Array.isArray(g.tags) && g.tags.includes(tagFilter));
      }
      if (!req.isAuthenticated()) {
        return res.json({ myGroups: [], discover: publicGroups, featured: publicGroups.filter(g => g.isFeatured) });
      }
      const userId = (req.user as any).id;
      const myGroups = await storage.getUserGroups(userId);
      const myGroupIds = new Set(myGroups.map((g: any) => g.id));
      const discover = publicGroups.filter((g: any) => !myGroupIds.has(g.id));
      const featured = publicGroups.filter(g => g.isFeatured && !myGroupIds.has(g.id));
      res.json({ myGroups, discover, featured });
    } catch {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.post("/api/groups", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name, description, isPublic, tags, pinnedAnnouncement } = req.body;
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Group name must be at least 2 characters" });
      }
      const ALLOWED_TAGS = ["School", "Office", "Family", "Friends", "Gaming", "Book Club", "Other"];
      const sanitizedTags: string[] = Array.isArray(tags)
        ? tags.filter((t: any) => ALLOWED_TAGS.includes(t)).slice(0, 3)
        : [];
      let inviteCode = generateInviteCode();
      let attempts = 0;
      while (await storage.getGroupByInviteCode(inviteCode) && attempts < 10) {
        inviteCode = generateInviteCode();
        attempts++;
      }
      const group = await storage.createGroup({
        name: name.trim(),
        description: description?.trim() || null,
        creatorId: userId,
        inviteCode,
        isPublic: Boolean(isPublic),
        tags: sanitizedTags,
        pinnedAnnouncement: typeof pinnedAnnouncement === "string" && pinnedAnnouncement.trim() ? pinnedAnnouncement.trim() : null,
        isFeatured: false,
      });
      await storage.addGroupMember(group.id, userId, "owner");
      res.status(201).json(group);
    } catch {
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.post("/api/groups/join", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { inviteCode } = req.body;
      if (!inviteCode) return res.status(400).json({ error: "Invite code required" });
      const group = await storage.getGroupByInviteCode(inviteCode.trim().toUpperCase());
      if (!group) return res.status(404).json({ error: "Invalid invite code" });
      const existing = await storage.getGroupMember(group.id, userId);
      if (existing) return res.status(409).json({ error: "Already a member" });
      await storage.addGroupMember(group.id, userId, "member");
      await storage.logGroupActivity(group.id, userId, "joined", { name: (req.user as any).name });
      res.json(group);
    } catch {
      res.status(500).json({ error: "Failed to join group" });
    }
  });

  // Direct join for public groups by ID (no invite code required)
  app.post("/api/groups/join-public/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ error: "Group not found" });
      if (!group.isPublic) return res.status(403).json({ error: "Group is not public" });
      const existing = await storage.getGroupMember(groupId, userId);
      if (existing) return res.status(409).json({ error: "Already a member" });
      await storage.addGroupMember(groupId, userId, "member");
      await storage.logGroupActivity(groupId, userId, "joined", { name: (req.user as any).name });
      res.json(group);
    } catch {
      res.status(500).json({ error: "Failed to join group" });
    }
  });

  // Must be registered BEFORE /api/groups/:id to avoid "browse" being treated as an ID
  app.get("/api/groups/browse", async (req, res) => {
    try {
      let allPublic = await storage.getPublicGroups();
      const tagFilter = req.query.tag as string | undefined;
      if (tagFilter) {
        allPublic = allPublic.filter(g => Array.isArray(g.tags) && g.tags.includes(tagFilter));
      }
      res.json(allPublic);
    } catch {
      res.status(500).json({ error: "Failed to browse groups" });
    }
  });

  app.get("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ error: "Group not found" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership && !group.isPublic) return res.status(403).json({ error: "Not a member" });
      res.json({ group, membership: membership || null });
    } catch {
      res.status(500).json({ error: "Failed to fetch group" });
    }
  });

  app.patch("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { name, description, isPublic, tags, pinnedAnnouncement } = req.body;
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (isPublic !== undefined) updates.isPublic = Boolean(isPublic);
      const ALLOWED_TAGS = ["School", "Office", "Family", "Friends", "Gaming", "Book Club", "Other"];
      if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags.filter((t: any) => ALLOWED_TAGS.includes(t)).slice(0, 3) : [];
      if (pinnedAnnouncement !== undefined) updates.pinnedAnnouncement = pinnedAnnouncement?.trim() || null;
      const updated = await storage.updateGroup(groupId, updates);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update group" });
    }
  });

  app.patch("/api/groups/:id/feature", requireAuth, async (req, res) => {
    try {
      if (!(req.user as any).isAdmin) return res.status(403).json({ error: "Site admin only" });
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const { isFeatured } = req.body;
      const updated = await storage.setGroupFeatured(groupId, Boolean(isFeatured));
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update featured status" });
    }
  });

  app.delete("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || membership.role !== "owner") {
        return res.status(403).json({ error: "Only the owner can delete the group" });
      }
      await storage.deleteGroup(groupId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  app.post("/api/groups/:id/leave", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(400).json({ error: "Not a member" });
      if (membership.role === "owner") return res.status(400).json({ error: "Owner cannot leave. Delete the group instead." });
      await storage.removeGroupMember(groupId, userId);
      await storage.logGroupActivity(groupId, userId, "left", { name: (req.user as any).name });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to leave group" });
    }
  });

  app.get("/api/groups/:id/members", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const members = await storage.getGroupMembers(groupId);
      res.json(members);
    } catch {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.patch("/api/groups/:id/members/:userId/role", requireAuth, async (req, res) => {
    try {
      const requestingUserId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      if (isNaN(groupId) || isNaN(targetUserId)) return res.status(400).json({ error: "Invalid ID" });
      const requesterMembership = await storage.getGroupMember(groupId, requestingUserId);
      if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
        return res.status(403).json({ error: "Only owners and admins can change roles" });
      }
      const { role } = req.body;
      if (!["admin", "member"].includes(role)) return res.status(400).json({ error: "Invalid role" });
      const targetMembership = await storage.getGroupMember(groupId, targetUserId);
      if (!targetMembership) return res.status(404).json({ error: "Member not found" });
      if (targetMembership.role === "owner") return res.status(403).json({ error: "Cannot change the owner's role" });
      if (requesterMembership.role === "admin" && targetMembership.role === "admin" && role === "member") {
        return res.status(403).json({ error: "Admins cannot demote other admins; only the owner can" });
      }
      const updated = await storage.updateGroupMemberRole(groupId, targetUserId, role);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/groups/:id/members/:userId", requireAuth, async (req, res) => {
    try {
      const requestingUserId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      if (isNaN(groupId) || isNaN(targetUserId)) return res.status(400).json({ error: "Invalid ID" });
      const requesterMembership = await storage.getGroupMember(groupId, requestingUserId);
      if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const targetMembershipForDelete = await storage.getGroupMember(groupId, targetUserId);
      if (targetMembershipForDelete?.role === "owner") {
        return res.status(403).json({ error: "Cannot remove the group owner" });
      }
      if (requesterMembership.role === "admin" && targetMembershipForDelete?.role === "admin") {
        return res.status(403).json({ error: "Admins cannot remove other admins; only the owner can" });
      }
      await storage.removeGroupMember(groupId, targetUserId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.get("/api/groups/:id/rounds", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const rounds = await storage.getGroupRounds(groupId);
      res.json(rounds);
    } catch {
      res.status(500).json({ error: "Failed to fetch rounds" });
    }
  });

  app.post("/api/groups/:id/rounds", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return res.status(403).json({ error: "Only admins can create rounds" });
      }
      const { gameSlug, closesAt, gameConfig } = req.body;
      const slug = gameSlug && CHALLENGE_GAME_SLUGS.includes(gameSlug) ? gameSlug : CHALLENGE_GAME_SLUGS[Math.floor(Math.random() * CHALLENGE_GAME_SLUGS.length)];
      const seed = Math.floor(Math.random() * 2147483647);
      const configJson = (slug === "letter-frequency" && gameConfig && typeof gameConfig === "object")
        ? JSON.stringify(gameConfig)
        : null;
      const round = await storage.createGroupRound({
        groupId,
        gameSlug: slug,
        seed,
        status: "active",
        createdById: userId,
        closesAt: closesAt || null,
        gameConfig: configJson,
      });
      await storage.logGroupActivity(groupId, userId, "round_started", { gameSlug: slug, roundId: round.id, name: (req.user as any).name });
      res.status(201).json(round);
    } catch {
      res.status(500).json({ error: "Failed to create round" });
    }
  });

  app.get("/api/groups/:id/rounds/:roundId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      const myScore = await storage.getUserGroupRoundScore(roundId, userId);
      res.json({ round, myScore: myScore || null });
    } catch {
      res.status(500).json({ error: "Failed to fetch round" });
    }
  });

  app.post("/api/groups/:id/rounds/:roundId/attempt", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      if (round.status !== "active") return res.status(400).json({ error: "Round is not active" });
      const attempt = await storage.createGroupRoundAttempt(roundId, userId);
      res.json(attempt);
    } catch {
      res.status(500).json({ error: "Failed to record attempt" });
    }
  });

  app.get("/api/groups/:id/rounds/:roundId/attempt", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      const attempt = await storage.getGroupRoundAttempt(roundId, userId);
      res.json({ attempt: attempt || null });
    } catch {
      res.status(500).json({ error: "Failed to fetch attempt" });
    }
  });

  app.post("/api/groups/:id/rounds/:roundId/score", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      if (round.status !== "active") return res.status(400).json({ error: "Round is not active" });
      const { score, durationMs } = req.body;
      if (typeof score !== "number") return res.status(400).json({ error: "Score required" });
      const existing = await storage.getUserGroupRoundScore(roundId, userId);
      if (existing) return res.status(409).json({ error: "Score already submitted" });
      const result = await storage.submitGroupRoundScore(roundId, userId, score, typeof durationMs === "number" ? durationMs : undefined);
      await storage.logGroupActivity(groupId, userId, "score_submitted", { score, gameSlug: round.gameSlug, roundId, name: (req.user as any).name });
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to submit score" });
    }
  });

  app.get("/api/groups/:id/rounds/:roundId/scores", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      const scores = await storage.getGroupRoundScores(roundId);
      res.json(scores);
    } catch {
      res.status(500).json({ error: "Failed to fetch scores" });
    }
  });

  app.patch("/api/groups/:id/rounds/:roundId/close", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      const closed = await storage.closeGroupRound(roundId);
      await storage.logGroupActivity(groupId, userId, "round_closed", { gameSlug: round.gameSlug, roundId, name: (req.user as any).name });
      res.json(closed);
    } catch {
      res.status(500).json({ error: "Failed to close round" });
    }
  });

  app.get("/api/groups/:id/leaderboard", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const leaderboard = await storage.getGroupLeaderboard(groupId);
      res.json(leaderboard);
    } catch {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/groups/:id/rounds/:roundId/reactions", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      // Verify round belongs to this group
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found in this group" });
      const reactions = await storage.getGroupRoundReactions(roundId);
      res.json(reactions);
    } catch {
      res.status(500).json({ error: "Failed to fetch reactions" });
    }
  });

  app.post("/api/groups/:id/rounds/:roundId/scores/:scoreId/reactions", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      const scoreId = parseInt(req.params.scoreId);
      if (isNaN(groupId) || isNaN(roundId) || isNaN(scoreId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      // Verify round belongs to this group
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found in this group" });
      // Verify score belongs to this round
      const scores = await storage.getGroupRoundScores(roundId);
      const score = scores.find(s => s.id === scoreId);
      if (!score) return res.status(404).json({ error: "Score not found in this round" });
      const { emoji } = req.body;
      const ALLOWED_EMOJIS = ["🔥", "❤️", "😂", "👏"];
      if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ error: "Invalid emoji" });
      const reaction = await storage.addGroupReaction(roundId, scoreId, userId, emoji);
      await storage.logGroupActivity(groupId, userId, "reaction", { emoji, scoreId, name: (req.user as any).name });
      res.json(reaction);
    } catch {
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });

  app.delete("/api/groups/:id/rounds/:roundId/scores/:scoreId/reactions/:emoji", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      const scoreId = parseInt(req.params.scoreId);
      if (isNaN(groupId) || isNaN(roundId) || isNaN(scoreId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      // Verify round belongs to this group
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found in this group" });
      // Verify score belongs to this round
      const scores = await storage.getGroupRoundScores(roundId);
      const score = scores.find(s => s.id === scoreId);
      if (!score) return res.status(404).json({ error: "Score not found in this round" });
      const emoji = decodeURIComponent(req.params.emoji);
      await storage.removeGroupReaction(roundId, scoreId, userId, emoji);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to remove reaction" });
    }
  });

  app.get("/api/groups/:id/activity", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const activity = await storage.getGroupActivity(groupId, 30);
      res.json(activity);
    } catch {
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // ==================== COMMENT ROUTES ====================

  const checkGroupRoundAccess = async (roundId: number, userId: number | null): Promise<boolean> => {
    const round = await storage.getGroupRound(roundId);
    if (!round) return false;
    const group = await storage.getGroup(round.groupId);
    if (!group) return false;
    if (group.isPublic) return true;
    if (!userId) return false;
    const membership = await storage.getGroupMember(round.groupId, userId);
    return !!membership;
  };

  const fetchComments = async (req: any, res: any) => {
    try {
      const targetType = req.params.targetType ?? req.query.targetType;
      const targetId = req.params.targetId ?? req.query.targetId;
      if (!targetType || !targetId || typeof targetType !== "string" || typeof targetId !== "string") {
        return res.status(400).json({ error: "targetType and targetId are required" });
      }
      if (targetType !== "game" && targetType !== "group_round") {
        return res.status(400).json({ error: "Invalid targetType" });
      }
      if (targetType === "group_round") {
        const roundId = parseInt(targetId);
        if (isNaN(roundId)) return res.status(400).json({ error: "Invalid round ID" });
        const userId = req.user?.id ?? null;
        const hasAccess = await checkGroupRoundAccess(roundId, userId);
        if (!hasAccess) return res.status(403).json({ error: "Access denied" });
      }
      const comments = await storage.getComments(targetType, targetId, req.user?.id);
      res.json(comments);
    } catch {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  };

  app.get("/api/comments", fetchComments);
  app.get("/api/comments/:targetType/:targetId", fetchComments);

  app.post("/api/comments", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { targetType, targetId, content, parentId } = req.body;
      if (!targetType || !targetId || !content || typeof content !== "string") {
        return res.status(400).json({ error: "targetType, targetId, and content are required" });
      }
      if (targetType !== "game" && targetType !== "group_round") {
        return res.status(400).json({ error: "Invalid targetType" });
      }
      if (targetType === "group_round") {
        const roundId = parseInt(String(targetId));
        if (isNaN(roundId)) return res.status(400).json({ error: "Invalid round ID" });
        const hasAccess = await checkGroupRoundAccess(roundId, userId);
        if (!hasAccess) return res.status(403).json({ error: "Access denied — must be a group member" });
      }
      const trimmed = content.trim();
      if (!trimmed) return res.status(400).json({ error: "Content cannot be empty" });
      if (trimmed.length > 500) return res.status(400).json({ error: "Comment cannot exceed 500 characters" });

      let resolvedParentId: number | null = null;
      if (parentId) {
        const pid = parseInt(parentId);
        if (isNaN(pid)) return res.status(400).json({ error: "Invalid parentId" });
        const existingComments = await storage.getComments(targetType, String(targetId));
        const allComments = [...existingComments, ...existingComments.flatMap(c => c.replies ?? [])];
        const parent = allComments.find(c => c.id === pid);
        if (!parent) return res.status(400).json({ error: "Parent comment not found" });
        if (parent.targetType !== targetType || parent.targetId !== String(targetId)) {
          return res.status(400).json({ error: "Parent comment belongs to a different target" });
        }
        if (parent.parentId !== null) {
          return res.status(400).json({ error: "Replies can only be one level deep" });
        }
        resolvedParentId = pid;
      }

      const comment = await storage.createComment({
        targetType,
        targetId: String(targetId),
        userId,
        parentId: resolvedParentId,
        content: trimmed,
      });
      res.status(201).json(comment);
    } catch {
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/comments/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid comment ID" });
      const isAdmin = req.user!.isAdmin;
      const deleted = await storage.deleteComment(id, userId, isAdmin);
      if (!deleted) return res.status(403).json({ error: "Cannot delete this comment" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  app.post("/api/comments/:id/report", requireAuth, async (req, res) => {
    try {
      const reportingUserId = req.user!.id;
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });
      const { reason } = req.body;
      if (!reason || typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ error: "Reason is required" });
      }
      if (reason.length > 500) return res.status(400).json({ error: "Reason cannot exceed 500 characters" });
      const comment = await storage.getCommentById(commentId);
      if (!comment) return res.status(404).json({ error: "Comment not found" });
      if (comment.targetType === "group_round") {
        const roundId = parseInt(comment.targetId);
        const hasAccess = !isNaN(roundId) && await checkGroupRoundAccess(roundId, reportingUserId);
        if (!hasAccess) return res.status(403).json({ error: "Access denied" });
      }
      const report = await storage.reportComment(commentId, reportingUserId, reason.trim());
      res.status(201).json(report);
    } catch {
      res.status(500).json({ error: "Failed to report comment" });
    }
  });

  // Like routes
  app.post("/api/likes", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { targetType, targetId } = req.body;
      if (!targetType || !targetId) {
        return res.status(400).json({ error: "targetType and targetId are required" });
      }
      if (targetType !== "game" && targetType !== "comment") {
        return res.status(400).json({ error: "Invalid targetType" });
      }
      if (targetType === "comment") {
        const commentId = parseInt(String(targetId));
        if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });
        const comment = await storage.getCommentById(commentId);
        if (!comment) return res.status(404).json({ error: "Comment not found" });
        if (comment.targetType === "group_round") {
          const roundId = parseInt(comment.targetId);
          const hasAccess = !isNaN(roundId) && await checkGroupRoundAccess(roundId, userId);
          if (!hasAccess) return res.status(403).json({ error: "Access denied" });
        }
      }
      const result = await storage.toggleLike(userId, targetType, String(targetId));
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  app.get("/api/likes", async (req, res) => {
    try {
      const { targetType, targetIds } = req.query;
      if (!targetType || !targetIds) {
        return res.status(400).json({ error: "targetType and targetIds are required" });
      }
      if (targetType !== "game") {
        return res.status(400).json({ error: "Only targetType=game is supported on this endpoint; comment likes are returned via /api/comments" });
      }
      const ids = Array.isArray(targetIds) ? targetIds.map(String) : String(targetIds).split(",");
      const counts = await storage.getLikeCounts("game", ids);
      const userId = req.user?.id;
      const likedByMe: Record<string, boolean> = {};
      if (userId) {
        const likedSet = await storage.getUserLikes(userId, "game", ids);
        for (const id of ids) likedByMe[id] = likedSet.has(id);
      } else {
        for (const id of ids) likedByMe[id] = false;
      }
      res.json({ counts, likedByMe });
    } catch {
      res.status(500).json({ error: "Failed to fetch likes" });
    }
  });

  // Admin comment routes
  const fetchCommentReports = async (_req: any, res: any) => {
    try {
      const reports = await storage.getCommentReports();
      res.json(reports);
    } catch {
      res.status(500).json({ error: "Failed to fetch comment reports" });
    }
  };

  app.get("/api/admin/comment-reports", requireAuth, requireAdmin, fetchCommentReports);
  app.get("/api/admin/comments/reported", requireAuth, requireAdmin, fetchCommentReports);

  app.delete("/api/admin/comments/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid comment ID" });
      await storage.deleteCommentAdmin(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // ==================== QUIZ MASTER ====================

  function generateShareCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  app.post("/api/quiz-sessions", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.isPremium) return res.status(403).json({ error: "Quiz Master requires a Premium account." });
      const { gameSlug, title, description, params, closesAt } = req.body;
      if (!gameSlug || !title) return res.status(400).json({ error: "gameSlug and title are required" });
      if (!QUIZ_MASTER_GAME_SLUGS.has(gameSlug)) return res.status(400).json({ error: "Game does not support Quiz Master" });

      let finalParams = params ?? {};
      if (gameSlug === "letter-position") {
        const letter = (typeof finalParams.letter === "string" ? finalParams.letter : "").toUpperCase().trim();
        const position = Number(finalParams.position);
        if (!letter || !/^[A-Z]$/.test(letter)) return res.status(400).json({ error: "letter must be a single A-Z character" });
        if (!position || position < 1 || position > 8) return res.status(400).json({ error: "position must be between 1 and 8" });
        const count = await dataSource.countLetterPositionWords(letter, position);
        if (count < 10) return res.status(400).json({ error: `Only ${count} words match — need at least 10. Choose a different letter or position.` });
        finalParams = { ...finalParams, letter, position, mode: 1 };
      }

      const shareCode = generateShareCode();
      const session = await storage.createQuizSession({
        creatorId: req.user.id,
        gameSlug,
        title: title.trim().slice(0, 200),
        description: typeof description === "string" && description.trim() ? description.trim().slice(0, 500) : null,
        shareCode,
        params: finalParams,
        closesAt: closesAt ?? null,
      });
      res.json(session);
    } catch {
      res.status(500).json({ error: "Failed to create quiz session" });
    }
  });

  app.get("/api/quiz-sessions/my", requireAuth, async (req: any, res) => {
    try {
      const sessions = await storage.getQuizSessionsByCreator(req.user.id);
      const enriched = await Promise.all(
        sessions.map(async (s) => {
          const scores = await storage.getQuizSessionScores(s.id);
          return { ...s, playerCount: scores.length };
        })
      );
      res.json(enriched);
    } catch {
      res.status(500).json({ error: "Failed to fetch quiz sessions" });
    }
  });

  app.get("/api/users/:userId/quiz-sessions", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });
      const sessions = await storage.getQuizSessionsByCreator(userId);
      const enriched = await Promise.all(
        sessions.map(async (s) => {
          const scores = await storage.getQuizSessionScores(s.id);
          return { ...s, playerCount: scores.length };
        })
      );
      res.json(enriched);
    } catch {
      res.status(500).json({ error: "Failed to fetch quiz sessions" });
    }
  });

  app.delete("/api/quiz-sessions/:code", requireAuth, async (req: any, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      if (session.creatorId !== req.user.id) return res.status(403).json({ error: "Only the creator can delete this session" });
      await storage.deleteQuizSession(session.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete quiz session" });
    }
  });

  app.get("/api/quiz-sessions/:code", async (req, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      const creator = session.creatorId ? await storage.getUserById(session.creatorId) : undefined;
      const enriched = {
        ...session,
        creatorName: creator?.name ?? session.creatorName,
        creatorAvatarUrl: creator?.avatarUrl ?? null,
        isClosed: !!(session.closesAt && new Date(session.closesAt) < new Date()),
      };
      res.json(enriched);
    } catch {
      res.status(500).json({ error: "Failed to fetch quiz session" });
    }
  });

  app.post("/api/quiz-sessions/:code/scores", requireAuth, async (req: any, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      if (session.closesAt && new Date(session.closesAt) < new Date()) {
        return res.status(403).json({ error: "Quiz session is closed" });
      }
      const userId = req.user.id;
      const existing = await storage.getQuizSessionScore(session.id, userId);
      if (existing) return res.status(409).json({ error: "Already submitted", score: existing });
      const { score } = req.body;
      if (typeof score !== "number") return res.status(400).json({ error: "score is required" });
      const entry = await storage.addQuizSessionScore(session.id, userId, score);
      res.json(entry);
    } catch {
      res.status(500).json({ error: "Failed to submit score" });
    }
  });

  app.get("/api/quiz-sessions/:code/scores", async (req: any, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      const scores = await storage.getQuizSessionScores(session.id);
      const myScore = req.user ? scores.find((s: any) => s.userId === req.user.id) : undefined;
      res.json({ scores, myScore: myScore ?? null });
    } catch {
      res.status(500).json({ error: "Failed to fetch scores" });
    }
  });

  app.get("/api/quiz-sessions/:code/results", requireAuth, async (req: any, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      if (session.creatorId !== req.user.id) return res.status(403).json({ error: "Only the quiz creator can view results" });
      const [scores, creator] = await Promise.all([
        storage.getQuizSessionScores(session.id),
        session.creatorId ? storage.getUserById(session.creatorId) : Promise.resolve(undefined),
      ]);
      res.json({
        session: {
          ...session,
          creatorName: creator?.name ?? session.creatorName,
          creatorAvatarUrl: creator?.avatarUrl ?? null,
          isClosed: !!(session.closesAt && new Date(session.closesAt) < new Date()),
        },
        scores,
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  return httpServer;
}
