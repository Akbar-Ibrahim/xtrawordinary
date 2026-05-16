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
import { SEEDED_GAME_SLUGS, QUIZ_MASTER_GAME_SLUGS, type DuelChallengeStatus, type NotificationType, notificationTypeSchema, type InsertNotification } from "@shared/schema";
import { executeGuildBracketDraw } from "./guild-wars-engine";
import { executeBracketDraw, checkAndForfeitExpiredMatches } from "./word-wars-engine";
import { registerSSEClient, unregisterSSEClient, ssePublishToUsers } from "./word-wars-sse";
import { seededShuffle } from "./seeded-rng";
// import axios from "axios";
// const REMOTE_BASE_URL = "https://your-remote-server.com";
// import { db } from "./db";
// import { words } from "./db-schema";
// import { eq } from "drizzle-orm";

const isLocalMode = process.env.DEV_MODE === "LOCAL";
const dataSource = isLocalMode ? storage : externalApi;

async function createNotificationIfEnabled(data: InsertNotification): Promise<void> {
  try {
    const prefs = await storage.getNotificationPreferences(data.userId);
    if (!prefs[data.type]) return;
    await storage.createNotification(data);
  } catch (err) {
    console.error("[notification]", err);
  }
}

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
      const { variation, level, seed } = req.body;
      const seedNum = (seed !== undefined && Number.isFinite(Number(seed))) ? Number(seed) : undefined;
      const word = await dataSource.getWordChainStartWord(variation || 1, level || 1, seedNum);
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
      const { friendId, gameSlug, score, message, seed, gameConfig } = req.body;
      if (!friendId || typeof friendId !== "number") return res.status(400).json({ error: "Valid friendId is required" });
      if (!gameSlug || typeof gameSlug !== "string") return res.status(400).json({ error: "Valid gameSlug is required" });
      if (!SEEDED_GAME_SLUGS.has(gameSlug)) return res.status(400).json({ error: "Game does not support challenges" });
      if (score === undefined || typeof score !== "number" || score < 0) return res.status(400).json({ error: "Valid non-negative score is required" });
      if (message && typeof message === "string" && message.length > 200) return res.status(400).json({ error: "Message too long (max 200 chars)" });
      if (seed !== undefined && (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 2147483647)) return res.status(400).json({ error: "Seed must be a non-negative integer" });
      const friendship = await storage.getFriendship(req.user!.id, friendId);
      if (!friendship || friendship.status !== "accepted") return res.status(400).json({ error: "You can only challenge friends" });
      const configJson = (gameSlug === "letter-balance" && gameConfig && typeof gameConfig === "object")
        ? JSON.stringify(gameConfig)
        : null;
      const challenge = await storage.createFriendChallenge({
        senderId: req.user!.id,
        receiverId: friendId,
        gameSlug,
        senderScore: score,
        receiverScore: null,
        status: "pending",
        message: message || null,
        seed: typeof seed === "number" ? seed : null,
        gameConfig: configJson,
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
      // Notify the challenge sender that results are ready
      if (challenge.senderId && challenge.senderId !== req.user!.id) {
        try {
          const receiverName = (req.user as any).name as string;
          const gameTitle = challenge.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          createNotificationIfEnabled({
            userId: challenge.senderId,
            type: "friend_challenge_result",
            title: "Challenge result ready",
            body: `${receiverName} completed your ${gameTitle} challenge`,
            linkUrl: "/friends?tab=challenges",
          });
        } catch {}
      }
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

  // GET /api/groups/my/admin — groups where the authenticated user is owner or admin
  app.get("/api/groups/my/admin", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const myGroups = await storage.getUserGroups(userId);
      const adminGroups: typeof myGroups = [];
      for (const g of myGroups) {
        const membership = await storage.getGroupMember(g.id, userId);
        if (membership && (membership.role === "owner" || membership.role === "admin")) {
          adminGroups.push(g);
        }
      }
      res.json(adminGroups);
    } catch (err) {
      console.error("[groups] admin-groups error", err);
      res.status(500).json({ error: "Failed to fetch admin groups" });
    }
  });

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
      // Notify all owners + admins (excluding the joiner) that someone joined
      try {
        const allMembers = await storage.getGroupMembers(group.id);
        const joinerName = (req.user as any).name as string;
        for (const m of allMembers) {
          if (m.userId !== userId && (m.role === "owner" || m.role === "admin")) {
            createNotificationIfEnabled({
              userId: m.userId,
              type: "group_join",
              title: "New member joined your group",
              body: `${joinerName} joined "${group.name}"`,
              linkUrl: `/groups/${group.id}`,
            });
          }
        }
      } catch {}
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
      // Notify all owners + admins (excluding the joiner) that someone joined
      try {
        const allMembers = await storage.getGroupMembers(groupId);
        const joinerName = (req.user as any).name as string;
        for (const m of allMembers) {
          if (m.userId !== userId && (m.role === "owner" || m.role === "admin")) {
            createNotificationIfEnabled({
              userId: m.userId,
              type: "group_join",
              title: "New member joined your group",
              body: `${joinerName} joined "${group.name}"`,
              linkUrl: `/groups/${groupId}`,
            });
          }
        }
      } catch {}
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
      const configJson = ((slug === "letter-frequency" || slug === "letter-balance") && gameConfig && typeof gameConfig === "object")
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
      // Notify all group members (except the creator) about the new round
      try {
        const group = await storage.getGroup(groupId);
        const members = await storage.getGroupMembers(groupId);
        const creatorName = (req.user as any).name as string;
        const gameTitle = slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        for (const m of members) {
          if (m.userId !== userId) {
            createNotificationIfEnabled({
              userId: m.userId,
              type: "group_round_start",
              title: "New group round started",
              body: `${creatorName} started a ${gameTitle} round in "${group?.name ?? "your group"}"`,
              linkUrl: `/groups/${groupId}`,
            });
          }
        }
      } catch {}
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

  // ==================== HUDDLE (GROUP vs GROUP) ====================

  app.post("/api/huddles", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { challengerGroupId, challengeeGroupId, gameSlug, format, raceTarget, raceTimeLimit } = req.body;
      if (!challengerGroupId || !challengeeGroupId || !gameSlug) {
        return res.status(400).json({ error: "challengerGroupId, challengeeGroupId, and gameSlug are required" });
      }
      if (challengerGroupId === challengeeGroupId) {
        return res.status(400).json({ error: "Cannot challenge your own group" });
      }
      const { DUEL_GAME_SLUGS, DUEL_TURN_SLUGS, DUEL_RACE_SLUGS } = await import("@shared/schema");
      if (!DUEL_GAME_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support duels" });
      }
      const duelFormat: "turn" | "race" = format === "race" ? "race" : "turn";
      if (duelFormat === "turn" && !DUEL_TURN_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support turn-based format" });
      }
      if (duelFormat === "race" && !DUEL_RACE_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support race format" });
      }
      const validRaceTargets = [5, 10, 15, 20, 25];
      const parsedRaceTarget = raceTarget != null ? Number(raceTarget) : 15;
      if (!validRaceTargets.includes(parsedRaceTarget)) {
        return res.status(400).json({ error: "raceTarget must be 5, 10, 15, 20, or 25" });
      }
      const validTimeLimits = [180, 300, 600];
      const parsedRaceTimeLimit = raceTimeLimit != null ? Number(raceTimeLimit) : 300;
      if (!validTimeLimits.includes(parsedRaceTimeLimit)) {
        return res.status(400).json({ error: "raceTimeLimit must be 180, 300, or 600 seconds" });
      }
      // Verify the user is an admin/owner of the challenger group
      const challengerMembership = await storage.getGroupMember(Number(challengerGroupId), userId);
      if (!challengerMembership || (challengerMembership.role !== "owner" && challengerMembership.role !== "admin")) {
        return res.status(403).json({ error: "Only group admins can send huddle challenges" });
      }
      // Verify challengee group exists
      const challengeeGroup = await storage.getGroup(Number(challengeeGroupId));
      if (!challengeeGroup) return res.status(404).json({ error: "Challengee group not found" });
      // Check there is not already a pending challenge between these two groups
      const existing = await storage.getHuddleChallengesForGroup(Number(challengerGroupId));
      const alreadyPending = existing.some(h =>
        h.status === "pending" &&
        ((h.challengerGroupId === Number(challengerGroupId) && h.challengeeGroupId === Number(challengeeGroupId)) ||
         (h.challengerGroupId === Number(challengeeGroupId) && h.challengeeGroupId === Number(challengerGroupId)))
      );
      if (alreadyPending) {
        return res.status(409).json({ error: "There is already a pending huddle challenge between these groups" });
      }
      // Create a duel room immediately
      const { duelRegistry } = await import("./duel-ws");
      const { roomCode, seed: roomSeed, startWord: roomStartWord } = duelRegistry.createRoom(
        gameSlug, userId, duelFormat, parsedRaceTarget, parsedRaceTimeLimit,
      );
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const huddle = await storage.createHuddleChallenge({
        challengerGroupId: Number(challengerGroupId),
        challengeeGroupId: Number(challengeeGroupId),
        challengerAdminId: userId,
        challengeeAdminId: null,
        gameSlug,
        format: duelFormat,
        raceTarget: parsedRaceTarget,
        raceTimeLimit: parsedRaceTimeLimit,
        status: "pending",
        roomCode,
        seed: roomSeed,
        startWord: roomStartWord,
        expiresAt,
      });
      // Notify all admins of the challengee group
      try {
        const challengeeMembers = await storage.getGroupMembers(Number(challengeeGroupId));
        const challengerGroup = await storage.getGroup(Number(challengerGroupId));
        const gameTitle = gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        for (const m of challengeeMembers) {
          if (m.role === "owner" || m.role === "admin") {
            createNotificationIfEnabled({
              userId: m.userId,
              type: "huddle_challenge_received",
              title: "Your group has been challenged!",
              body: `${challengerGroup?.name ?? "Another group"} challenged your group to a ${gameTitle} Huddle`,
              linkUrl: `/groups/${challengeeGroupId}`,
            });
          }
        }
      } catch {}
      res.status(201).json(huddle);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create huddle challenge" });
    }
  });

  app.get("/api/groups/:id/huddles", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const huddles = await storage.getHuddleChallengesForGroup(groupId);
      // Enrich with group names and admin names
      const enriched = await Promise.all(huddles.map(async (h) => {
        const [cGroup, eeGroup, cAdmin, eeAdmin] = await Promise.all([
          storage.getGroup(h.challengerGroupId),
          storage.getGroup(h.challengeeGroupId),
          storage.getUserById(h.challengerAdminId),
          h.challengeeAdminId ? storage.getUserById(h.challengeeAdminId) : Promise.resolve(undefined),
        ]);
        return {
          ...h,
          challengerGroupName: cGroup?.name ?? "Unknown",
          challengeeGroupName: eeGroup?.name ?? "Unknown",
          challengerAdminName: cAdmin?.name ?? "Unknown",
          challengeeAdminName: eeAdmin?.name ?? null,
        };
      }));
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch huddle challenges" });
    }
  });

  app.patch("/api/huddles/:id/accept", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const huddle = await storage.getHuddleChallenge(id);
      if (!huddle) return res.status(404).json({ error: "Huddle challenge not found" });
      if (huddle.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      if (huddle.expiresAt && new Date(huddle.expiresAt) < new Date()) {
        await storage.updateHuddleChallenge(id, { status: "cancelled" });
        return res.status(410).json({ error: "Challenge has expired" });
      }
      // Verify user is an admin/owner of the challengee group
      const membership = await storage.getGroupMember(huddle.challengeeGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenged group can accept" });
      }
      if (userId === huddle.challengerAdminId) {
        return res.status(400).json({ error: "Cannot accept your own group's challenge" });
      }
      const updated = await storage.updateHuddleChallenge(id, { status: "accepted", challengeeAdminId: userId });
      // Notify the challenger admin
      try {
        const challengerGroup = await storage.getGroup(huddle.challengerGroupId);
        const challengeeGroup = await storage.getGroup(huddle.challengeeGroupId);
        const gameTitle = huddle.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        createNotificationIfEnabled({
          userId: huddle.challengerAdminId,
          type: "huddle_accepted",
          title: "Huddle challenge accepted!",
          body: `${challengeeGroup?.name ?? "Another group"} accepted your ${gameTitle} Huddle challenge`,
          linkUrl: huddle.roomCode ? `/duel/${huddle.roomCode}` : `/groups/${huddle.challengerGroupId}`,
        });
        // Notify all members of both groups
        const [cMembers, eeMembers] = await Promise.all([
          storage.getGroupMembers(huddle.challengerGroupId),
          storage.getGroupMembers(huddle.challengeeGroupId),
        ]);
        const allMembers = [...cMembers, ...eeMembers];
        const gameWords = gameTitle;
        for (const m of allMembers) {
          if (m.userId === huddle.challengerAdminId || m.userId === userId) continue;
          createNotificationIfEnabled({
            userId: m.userId,
            type: "huddle_accepted",
            title: "Group Huddle is starting!",
            body: `${challengerGroup?.name ?? "Your group"} vs ${challengeeGroup?.name ?? "another group"} — ${gameWords} Huddle`,
            linkUrl: huddle.roomCode ? `/duel/${huddle.roomCode}` : null,
          });
        }
      } catch {}
      res.json({ ...updated, roomCode: huddle.roomCode });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to accept huddle challenge" });
    }
  });

  app.patch("/api/huddles/:id/decline", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const huddle = await storage.getHuddleChallenge(id);
      if (!huddle) return res.status(404).json({ error: "Huddle challenge not found" });
      if (huddle.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const membership = await storage.getGroupMember(huddle.challengeeGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenged group can decline" });
      }
      // Close the waiting room if it exists
      if (huddle.roomCode) {
        const { duelRegistry } = await import("./duel-ws");
        duelRegistry.notifyChallengeCancelled(huddle.roomCode, "declined");
      }
      const updated = await storage.updateHuddleChallenge(id, { status: "declined" });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to decline huddle challenge" });
    }
  });

  app.patch("/api/huddles/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const huddle = await storage.getHuddleChallenge(id);
      if (!huddle) return res.status(404).json({ error: "Huddle challenge not found" });
      if (huddle.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const membership = await storage.getGroupMember(huddle.challengerGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenger group can cancel" });
      }
      if (huddle.roomCode) {
        const { duelRegistry } = await import("./duel-ws");
        duelRegistry.notifyChallengeCancelled(huddle.roomCode, "cancelled");
      }
      const updated = await storage.updateHuddleChallenge(id, { status: "cancelled" });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to cancel huddle challenge" });
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
      // Notify the parent comment author about the reply
      if (resolvedParentId !== null) {
        try {
          const allComments = await storage.getComments(targetType, String(targetId));
          const flat = [...allComments, ...allComments.flatMap(c => c.replies ?? [])];
          const parent = flat.find(c => c.id === resolvedParentId);
          if (parent && parent.userId !== userId) {
            const commenterName = (req.user as any).name as string;
            let replyLinkUrl: string | null = null;
            if (targetType === "game") {
              replyLinkUrl = `/game/${targetId}`;
            } else if (targetType === "group_round") {
              const roundId = parseInt(String(targetId));
              const round = await storage.getGroupRound(roundId).catch(() => null);
              if (round) replyLinkUrl = `/groups/${round.groupId}`;
            }
            createNotificationIfEnabled({
              userId: parent.userId,
              type: "comment_reply",
              title: "Someone replied to your comment",
              body: `${commenterName}: "${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}"`,
              linkUrl: replyLinkUrl,
            });
          }
        } catch {}
      }
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

  // ==================== DUELS ====================

  function formatDuelVariationServer(gameSlug: string, startWord: string | null | undefined): string | null {
    if (!startWord) return null;
    switch (gameSlug) {
      case "letter-hunt":
      case "letter-frequency":
        if (/^[A-Z]$/i.test(startWord)) return `Letter ${startWord.toUpperCase()}`;
        return null;
      case "word-length":
        if (/^\d+$/.test(startWord)) return `${startWord}-letter words`;
        return null;
      case "letter-position": {
        const parts = startWord.split(":");
        if (parts.length === 2 && /^[A-Z]$/i.test(parts[0]) && /^\d+$/.test(parts[1]))
          return `Letter ${parts[0].toUpperCase()} at position ${parts[1]}`;
        return null;
      }
      case "letter-balance": {
        const m = startWord.match(/^(\d+)([VC])$/i);
        if (m) {
          const count = parseInt(m[1]);
          const type = m[2].toUpperCase() === "V" ? "vowel" : "consonant";
          return `${count} ${type}${count !== 1 ? "s" : ""}`;
        }
        return null;
      }
      case "definition-match": {
        const DUEL_DEF_CATS = ["ANIMALS", "COLORS", "FOODS", "SPORTS", "SCIENCE"] as const;
        if ((DUEL_DEF_CATS as readonly string[]).includes(startWord.toUpperCase()))
          return startWord.charAt(0).toUpperCase() + startWord.slice(1).toLowerCase();
        return null;
      }
      case "no-repeats":
        if (/^\d+$/.test(startWord)) return `${startWord}+ letter words`;
        return null;
      default:
        return null;
    }
  }

  app.post("/api/duels/challenges", requireAuth, async (req: any, res) => {
    try {
      const { challengeeId, gameSlug, message, format, raceTarget, raceTimeLimit, startWord: requestedStartWord } = req.body;
      if (!gameSlug) {
        return res.status(400).json({ error: "gameSlug is required" });
      }
      const {
        DUEL_GAME_SLUGS, DUEL_TURN_SLUGS, DUEL_RACE_SLUGS,
        DUEL_HUNT_LETTERS, DUEL_WORD_LENGTHS, DUEL_POSITIONS, DUEL_BALANCE_CONSTRAINTS, DUEL_NO_REPEATS_LENGTHS, DUEL_DEFINITION_CATEGORIES,
      } = await import("@shared/schema");
      if (!DUEL_GAME_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support duels" });
      }
      // Validate format-game compatibility
      const duelFormat: "turn" | "race" = format === "race" ? "race" : "turn";
      if (duelFormat === "turn" && !DUEL_TURN_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support the turn-based format" });
      }
      if (duelFormat === "race" && !DUEL_RACE_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support the race format" });
      }
      const validRaceTargets = [5, 10, 15, 20, 25];
      const parsedRaceTarget = raceTarget != null ? Number(raceTarget) : 15;
      if (!validRaceTargets.includes(parsedRaceTarget)) {
        return res.status(400).json({ error: "raceTarget must be 5, 10, 15, 20, or 25" });
      }
      const validTimeLimits = [180, 300, 600];
      const parsedRaceTimeLimit = raceTimeLimit != null ? Number(raceTimeLimit) : 300;
      if (!validTimeLimits.includes(parsedRaceTimeLimit)) {
        return res.status(400).json({ error: "raceTimeLimit must be 180, 300, or 600 seconds" });
      }
      // Validate optional startWord override
      let overrideStartWord: string | undefined;
      if (requestedStartWord != null) {
        const sw = String(requestedStartWord).toUpperCase().trim();
        let valid = false;
        switch (gameSlug) {
          case "letter-hunt":
          case "letter-frequency":
            valid = (DUEL_HUNT_LETTERS as readonly string[]).includes(sw);
            break;
          case "word-length":
            valid = (DUEL_WORD_LENGTHS as readonly string[]).includes(sw);
            break;
          case "letter-position": {
            const [letter, posStr] = sw.split(":");
            valid = (DUEL_HUNT_LETTERS as readonly string[]).includes(letter) &&
                    (DUEL_POSITIONS as readonly number[]).includes(Number(posStr));
            break;
          }
          case "letter-balance":
            valid = (DUEL_BALANCE_CONSTRAINTS as readonly string[]).includes(sw);
            break;
          case "no-repeats":
            valid = (DUEL_NO_REPEATS_LENGTHS as readonly string[]).includes(sw);
            break;
          case "definition-match":
            valid = (DUEL_DEFINITION_CATEGORIES as readonly string[]).includes(sw);
            break;
          default:
            valid = false;
        }
        if (!valid) {
          return res.status(400).json({ error: "Invalid startWord for this game" });
        }
        overrideStartWord = sw;
      }
      const challengerId = req.user.id;
      if (!req.user.isPremium) {
        return res.status(403).json({ error: "Duels require a Premium account." });
      }
      // challengeeId is optional — null means an open challenge anyone can accept
      const targetId: number | null = challengeeId != null ? Number(challengeeId) : null;
      if (targetId !== null) {
        if (!Number.isFinite(targetId) || targetId <= 0 || !Number.isInteger(targetId)) {
          return res.status(400).json({ error: "Invalid challengeeId" });
        }
        if (targetId === challengerId) {
          return res.status(400).json({ error: "Cannot challenge yourself" });
        }
        const targetUser = await storage.getUserById(targetId);
        if (!targetUser) {
          return res.status(404).json({ error: "Target player not found" });
        }
      }
      // Create the duel room immediately so the challenger can enter the waiting room right away.
      const { duelRegistry } = await import("./duel-ws");
      const { roomCode, seed: roomSeed, startWord: roomStartWord } = duelRegistry.createRoom(
        gameSlug, challengerId, duelFormat, parsedRaceTarget, parsedRaceTimeLimit, overrideStartWord,
      );

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const challenge = await storage.createDuelChallenge({
        challengerId,
        challengeeId: targetId,
        gameSlug,
        message: message ?? null,
        status: "pending",
        expiresAt,
        roomCode,
        seed: roomSeed,
        startWord: roomStartWord,
        format: duelFormat,
        raceTarget: parsedRaceTarget,
        raceTimeLimit: parsedRaceTimeLimit,
      });
      const [challenger, challengee] = await Promise.all([
        storage.getUserById(challengerId),
        targetId != null ? storage.getUserById(targetId) : Promise.resolve(undefined),
      ]);
      // Notify the specific challengee that they received a duel challenge
      if (targetId !== null && challengee) {
        const gameTitle = gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const variationLabel = formatDuelVariationServer(gameSlug, roomStartWord);
        createNotificationIfEnabled({
          userId: targetId,
          type: "duel_challenge_received",
          title: "You've been challenged to a duel!",
          body: `${challenger?.name ?? "Someone"} challenged you to a ${gameTitle}${variationLabel ? ` (${variationLabel})` : ""} duel`,
          linkUrl: "/friends?tab=duels",
        });
      }
      res.status(201).json({
        ...challenge,
        roomCode,
        challengerName: challenger?.name,
        challengeeName: challengee?.name ?? null,
        challengerAvatarUrl: challenger?.avatarUrl ?? null,
        challengeeAvatarUrl: challengee?.avatarUrl ?? null,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create duel challenge" });
    }
  });

  app.get("/api/duels/challenges", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const type = req.query.type as string | undefined;
      let challenges = await storage.getDuelChallengesForUser(userId);
      if (type === "incoming") {
        challenges = challenges.filter((c) => c.challengeeId === userId);
      } else if (type === "outgoing") {
        challenges = challenges.filter((c) => c.challengerId === userId);
      }
      const enriched = await Promise.all(
        challenges.map(async (c) => {
          const [challenger, challengee] = await Promise.all([
            storage.getUserById(c.challengerId),
            c.challengeeId != null ? storage.getUserById(c.challengeeId) : Promise.resolve(undefined),
          ]);
          return {
            ...c,
            challengerName: challenger?.name ?? null,
            challengeeName: challengee?.name ?? null,
            challengerAvatarUrl: challenger?.avatarUrl ?? null,
            challengeeAvatarUrl: challengee?.avatarUrl ?? null,
          };
        }),
      );
      res.json(enriched);
    } catch (err) {
      console.error("Failed to fetch duel challenges:", err);
      res.status(500).json({ error: "Failed to fetch duel challenges" });
    }
  });

  app.get("/api/duels/open/count", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const challenges = await storage.getOpenDuelChallenges(userId);
      res.json({ count: challenges.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to count open duel challenges" });
    }
  });

  app.get("/api/duels/open", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rawSlug = req.query.gameSlug as string | undefined;
      const { DUEL_GAME_SLUGS } = await import("@shared/schema");
      if (rawSlug && !DUEL_GAME_SLUGS.has(rawSlug)) {
        return res.status(400).json({ error: "Invalid gameSlug filter" });
      }
      const gameSlug = rawSlug;
      const challenges = await storage.getOpenDuelChallenges(userId, gameSlug);
      const enriched = await Promise.all(
        challenges.map(async (c) => {
          const challenger = await storage.getUserById(c.challengerId);
          return {
            ...c,
            challengerName: challenger?.name ?? null,
            challengerAvatarUrl: challenger?.avatarUrl ?? null,
          };
        }),
      );
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch open duel challenges" });
    }
  });

  app.patch("/api/duels/challenges/:id/accept", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const challenge = await storage.getDuelChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      // Open challenge: anyone except the challenger can accept; set them as challengee
      const isOpen = challenge.challengeeId === null;
      if (!isOpen && challenge.challengeeId !== userId) return res.status(403).json({ error: "Not your challenge" });
      if (isOpen && challenge.challengerId === userId) return res.status(400).json({ error: "Cannot accept your own open challenge" });
      if (challenge.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      if (challenge.expiresAt && new Date(challenge.expiresAt) < new Date()) {
        await storage.updateDuelChallengeStatus(id, "expired");
        // Notify any challenger in the waiting room, then close the room
        if (challenge.roomCode) {
          const { duelRegistry } = await import("./duel-ws");
          duelRegistry.notifyChallengeCancelled(challenge.roomCode, "expired");
        }
        return res.status(410).json({ error: "Challenge has expired" });
      }
      // Room should have been pre-created at challenge send time.
      // If missing (legacy challenge), create it now and persist metadata.
      let roomCode = challenge.roomCode;
      if (!roomCode) {
        const { duelRegistry } = await import("./duel-ws");
        const created = duelRegistry.createRoom(
          challenge.gameSlug,
          challenge.challengerId,
          (challenge.format ?? "turn") as "turn" | "race",
          challenge.raceTarget ?? 15,
          challenge.raceTimeLimit ?? 300,
          challenge.startWord ?? undefined,
        );
        roomCode = created.roomCode;
        await storage.updateDuelChallengeStatus(id, challenge.status as DuelChallengeStatus, created.roomCode, created.seed, created.startWord);
      }
      let updated: DuelChallenge | undefined | null;
      if (isOpen) {
        // Atomic accept: sets challengeeId + status in one operation to prevent race conditions
        updated = await storage.acceptOpenDuelChallenge(id, userId);
        if (!updated) {
          return res.status(409).json({ error: "This open challenge was already taken by another player" });
        }
      } else {
        updated = await storage.updateDuelChallengeStatus(id, "accepted", roomCode ?? undefined);
      }
      // Notify the challenger that their challenge was accepted
      try {
        const accepterName = (req.user as any).name as string;
        const gameTitle = challenge.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const variationLabel = formatDuelVariationServer(challenge.gameSlug, challenge.startWord);
        createNotificationIfEnabled({
          userId: challenge.challengerId,
          type: "duel_accepted",
          title: "Duel challenge accepted!",
          body: `${accepterName} accepted your ${gameTitle}${variationLabel ? ` (${variationLabel})` : ""} duel`,
          linkUrl: roomCode ? `/duel/${roomCode}` : "/duels",
        });
      } catch {}
      res.json({ ...updated, roomCode });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to accept challenge" });
    }
  });

  app.patch("/api/duels/challenges/:id/decline", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const challenge = await storage.getDuelChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.challengeeId !== userId) return res.status(403).json({ error: "Not your challenge" });
      if (challenge.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const updated = await storage.updateDuelChallengeStatus(id, "declined");
      // Notify any challenger already in the waiting room, then close the room
      if (challenge.roomCode) {
        const { duelRegistry } = await import("./duel-ws");
        duelRegistry.notifyChallengeCancelled(challenge.roomCode, "declined");
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to decline challenge" });
    }
  });

  app.patch("/api/duels/challenges/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const challenge = await storage.getDuelChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.challengerId !== userId) return res.status(403).json({ error: "Only the challenger can cancel" });
      if (challenge.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const updated = await storage.updateDuelChallengeStatus(id, "cancelled");
      // Notify any challenger already in the waiting room, then close the room
      if (challenge.roomCode) {
        const { duelRegistry } = await import("./duel-ws");
        duelRegistry.notifyChallengeCancelled(challenge.roomCode, "cancelled");
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to cancel challenge" });
    }
  });

  app.get("/api/duels/live", requireAuth, async (_req, res) => {
    try {
      const { duelRegistry } = await import("./duel-ws");
      res.json(duelRegistry.getActiveLiveRooms());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch live rooms" });
    }
  });

  app.get("/api/duels/rooms/:roomCode", requireAuth, async (req: any, res) => {
    try {
      const roomCode = req.params.roomCode.toUpperCase();
      const userId = req.user.id;
      const challenge = await storage.getDuelChallengeByRoom(roomCode);
      if (!challenge) return res.status(404).json({ error: "Room not found" });

      const isParticipant = challenge.challengerId === userId || challenge.challengeeId === userId;
      const isOpenChallenge = challenge.challengeeId === null;

      if (!isParticipant && !isOpenChallenge) {
        // Allow spectators if the room is actively playing
        const { duelRegistry: reg } = await import("./duel-ws");
        const liveRoom = reg.getRoom(roomCode);
        if (!liveRoom || liveRoom.status !== "playing") {
          return res.status(403).json({ error: "Not a participant" });
        }
      }

      // Reject complete/terminal statuses (for participants)
      if (
        isParticipant &&
        (challenge.status === "declined" ||
          challenge.status === "cancelled" ||
          challenge.status === "expired" ||
          challenge.status === "completed")
      ) {
        return res.status(410).json({ error: `This challenge has been ${challenge.status}` });
      }
      const { duelRegistry } = await import("./duel-ws");
      // Room may be missing after a process restart — restore it lazily from
      // persisted challenge metadata so accepted/pending challenges remain reachable.
      const room =
        duelRegistry.getRoom(roomCode) ??
        duelRegistry.restoreRoom(
          roomCode,
          challenge.gameSlug,
          challenge.challengerId,
          challenge.seed,
          challenge.startWord,
          (challenge.format as "turn" | "race") ?? "turn",
          challenge.raceTarget ?? 15,
          challenge.raceTimeLimit ?? 300,
        );
      res.json({
        gameSlug: room.gameSlug,
        seed: room.seed,
        startWord: room.startWord,
        challengerId: challenge.challengerId,
        challengeeId: challenge.challengeeId,
        format: room.format,
        raceTarget: room.raceTarget,
        raceTimeLimitMs: room.raceTimeLimitMs,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch room info" });
    }
  });

  app.get("/api/duels/leaderboard", async (req, res) => {
    try {
      const rawFormat = req.query.format;
      const format = rawFormat === "turn" || rawFormat === "race" ? rawFormat : undefined;
      const entries = await storage.getDuelLeaderboard(100, format);
      res.json(entries);
    } catch {
      res.status(500).json({ error: "Failed to fetch duel leaderboard" });
    }
  });

  app.get("/api/duels/ratings/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
      const rating = await storage.getDuelRating(userId);
      if (!rating) {
        return res.json({ userId, elo: 1200, wins: 0, losses: 0, draws: 0, rank: null, totalPlayers: 0 });
      }
      const rankContext = await storage.getDuelRankContext(userId);
      res.json({ ...rating, rank: rankContext?.rank ?? null, totalPlayers: rankContext?.totalPlayers ?? 0 });
    } catch {
      res.status(500).json({ error: "Failed to fetch duel rating" });
    }
  });

  app.get("/api/duels/sessions/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
      const sessions = await storage.getDuelSessionsForUser(userId);
      const opponentIds = [...new Set(sessions.map(s => s.player1Id === userId ? s.player2Id : s.player1Id))];
      const opponentUsers = await Promise.all(opponentIds.map(id => storage.getUserById(id)));
      const opponentMap = new Map<number, { name: string; avatarUrl: string | null }>();
      opponentUsers.forEach(user => { if (user) opponentMap.set(user.id, { name: user.name, avatarUrl: user.avatarUrl }); });
      const result = sessions.map(s => {
        const isPlayer1 = s.player1Id === userId;
        const opponentId = isPlayer1 ? s.player2Id : s.player1Id;
        const eloDelta = isPlayer1 ? s.eloDeltaPlayer1 : s.eloDeltaPlayer2;
        const isForfeit = s.outcome === "forfeit_player1" || s.outcome === "forfeit_player2";
        let outcome: "win" | "loss" | "draw" | null = null;
        if (s.outcome) {
          if (s.outcome === "draw") {
            outcome = "draw";
          } else if (
            (isPlayer1 && (s.outcome === "player1_wins" || s.outcome === "forfeit_player2")) ||
            (!isPlayer1 && (s.outcome === "player2_wins" || s.outcome === "forfeit_player1"))
          ) {
            outcome = "win";
          } else {
            outcome = "loss";
          }
        }
        const opponent = opponentMap.get(opponentId);
        return {
          id: s.id,
          roomCode: s.roomCode,
          opponentId,
          opponentName: opponent?.name ?? "Unknown",
          opponentAvatarUrl: opponent?.avatarUrl ?? null,
          gameSlug: s.gameSlug,
          outcome,
          isForfeit,
          eloDelta,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
        };
      });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch duel sessions" });
    }
  });

  // ==================== NOTIFICATION PREFERENCES ====================

  app.get("/api/notification-preferences", requireAuth, async (req, res) => {
    try {
      const prefs = await storage.getNotificationPreferences(req.user!.id);
      res.json(prefs);
    } catch {
      res.status(500).json({ error: "Failed to fetch notification preferences" });
    }
  });

  app.patch("/api/notification-preferences/:type", requireAuth, async (req, res) => {
    try {
      const type = req.params.type;
      const parsed = notificationTypeSchema.safeParse(type);
      if (!parsed.success) return res.status(400).json({ error: "Invalid notification type" });
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });
      await storage.setNotificationPreference(req.user!.id, parsed.data, enabled);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to update notification preference" });
    }
  });

  app.patch("/api/notification-preferences", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });
      await storage.setAllNotificationPreferences(req.user!.id, enabled);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  // ==================== NOTIFICATIONS ====================

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getNotifications(req.user!.id, 30);
      res.json(notifications);
    } catch {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user!.id);
      res.json({ count });
    } catch {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      await storage.markNotificationRead(id, req.user!.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.user!.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to mark all notifications read" });
    }
  });

  // ==================== WORD WARS ====================

  app.post("/api/word-wars", requireAuth, async (req, res) => {
    try {
      if (!req.user!.isAdmin) return res.status(403).json({ error: "Admin only" });
      const { name, registrationDeadline, roundDeadlineHours, minPlayers, maxPlayers, recurringCron } = req.body;
      if (!name || !registrationDeadline) return res.status(400).json({ error: "name and registrationDeadline required" });
      const parsedMin = minPlayers ? Number(minPlayers) : 2;
      if (!Number.isInteger(parsedMin) || parsedMin < 2) return res.status(400).json({ error: "minPlayers must be an integer >= 2" });
      const parsedMax = maxPlayers ? Number(maxPlayers) : null;
      if (parsedMax !== null && parsedMax < parsedMin) return res.status(400).json({ error: "maxPlayers must be >= minPlayers" });
      const tournament = await storage.createWordWarsTournament({
        name: String(name),
        registrationDeadline: new Date(registrationDeadline).toISOString(),
        roundDeadlineHours: Number(roundDeadlineHours) || 24,
        minPlayers: parsedMin,
        maxPlayers: parsedMax,
        recurringCron: recurringCron ? String(recurringCron) : null,
        createdBy: req.user!.id,
      });
      res.status(201).json(tournament);
    } catch (err) {
      console.error("[word-wars] create tournament error", err);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  app.get("/api/word-wars", async (_req, res) => {
    try {
      const tournaments = await storage.listWordWarsTournaments();
      const withCounts = await Promise.all(
        tournaments.map(async (t) => {
          const regs = await storage.getWordWarsRegistrationsForTournament(t.id);
          return { ...t, registrationCount: regs.length };
        })
      );
      res.json(withCounts);
    } catch {
      res.status(500).json({ error: "Failed to list tournaments" });
    }
  });

  // Global Hall of Fame — all champions across all tournaments, most recent first.
  // Must be defined BEFORE /api/word-wars/:id to avoid "champions" matching :id.
  app.get("/api/word-wars/champions", async (_req, res) => {
    try {
      const champions = await storage.listAllWordWarsChampions();
      if (champions.length === 0) return res.json([]);
      const [users, tournaments] = await Promise.all([
        Promise.all(champions.map(c => storage.getUserById(c.userId))),
        Promise.all(champions.map(c => storage.getWordWarsTournament(c.tournamentId))),
      ]);
      res.json(champions.map((c, i) => ({
        ...c,
        user: users[i] ? { id: users[i]!.id, name: users[i]!.name, avatarUrl: users[i]!.avatarUrl } : null,
        tournament: tournaments[i] ? { id: tournaments[i]!.id, name: tournaments[i]!.name } : null,
      })));
    } catch {
      res.status(500).json({ error: "Failed to get champions" });
    }
  });

  // Match detail — must be defined BEFORE /api/word-wars/:id to avoid "matches" matching :id.
  app.get("/api/word-wars/matches/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) return res.status(400).json({ error: "Invalid match ID" });
      const match = await storage.getWordWarsMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const games = await storage.getWordWarsMatchGames(matchId);
      res.json({ match, games });
    } catch {
      res.status(500).json({ error: "Failed to get match" });
    }
  });

  app.get("/api/word-wars/:id/sse", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).end(); return; }
    const userId = req.user!.id;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    registerSSEClient(id, userId, res);
    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
    }, 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unregisterSSEClient(id, userId);
    });
  });

  app.get("/api/word-wars/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const tournament = await storage.getWordWarsTournament(id);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      // Auto-forfeit any matches whose round deadline has expired before returning data
      await checkAndForfeitExpiredMatches(id);
      const [registrations, matches] = await Promise.all([
        storage.getWordWarsRegistrationsForTournament(id),
        storage.listWordWarsMatchesForTournament(id),
      ]);
      const matchesWithGames = await Promise.all(
        matches.map(async (m) => ({ ...m, games: await storage.getWordWarsMatchGames(m.id) }))
      );
      // Embed user info for all players so the bracket can show names/avatars
      const playerIds = new Set<number>();
      matchesWithGames.forEach(m => {
        if (m.player1Id) playerIds.add(m.player1Id);
        if (m.player2Id) playerIds.add(m.player2Id);
      });
      const playerUsers = await Promise.all([...playerIds].map(uid => storage.getUserById(uid)));
      const players: Record<number, { id: number; name: string; avatarUrl: string | null }> = {};
      playerUsers.forEach(u => {
        if (u) players[u.id] = { id: u.id, name: u.name, avatarUrl: u.avatarUrl };
      });
      res.json({ tournament, registrations, matches: matchesWithGames, players });
    } catch {
      res.status(500).json({ error: "Failed to get tournament" });
    }
  });

  app.post("/api/word-wars/:id/register", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const tournament = await storage.getWordWarsTournament(id);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Registration is closed" });
      if (new Date(tournament.registrationDeadline) <= new Date()) {
        return res.status(400).json({ error: "Registration deadline has passed" });
      }
      const userId = req.user!.id;
      const existing = await storage.getWordWarsRegistration(id, userId);
      if (existing) {
        await storage.deleteWordWarsRegistration(id, userId);
        return res.json({ registered: false });
      }
      const registrations = await storage.getWordWarsRegistrationsForTournament(id);
      if (tournament.maxPlayers && registrations.length >= tournament.maxPlayers) {
        return res.status(400).json({ error: "Tournament is full" });
      }
      await storage.createWordWarsRegistration(id, userId);
      res.json({ registered: true });
    } catch (err) {
      console.error("[word-wars] register error", err);
      res.status(500).json({ error: "Failed to register" });
    }
  });

  app.patch("/api/word-wars/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user!.isAdmin) return res.status(403).json({ error: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const tournament = await storage.getWordWarsTournament(id);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Only registration-status tournaments can be edited" });
      const { name, registrationDeadline, roundDeadlineHours, minPlayers, maxPlayers } = req.body;
      const updates: Parameters<typeof storage.updateWordWarsTournament>[1] = {};

      if (name !== undefined) {
        const trimmed = String(name).trim();
        if (!trimmed) return res.status(400).json({ error: "Name cannot be empty" });
        updates.name = trimmed;
      }
      if (registrationDeadline !== undefined) {
        const d = new Date(registrationDeadline);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid registrationDeadline" });
        updates.registrationDeadline = d.toISOString();
      }
      if (roundDeadlineHours !== undefined) {
        const rh = parseInt(roundDeadlineHours);
        if (isNaN(rh) || rh < 1) return res.status(400).json({ error: "roundDeadlineHours must be a positive integer" });
        updates.roundDeadlineHours = rh;
      }
      if (minPlayers !== undefined) {
        const mp = parseInt(minPlayers);
        if (isNaN(mp) || mp < 2) return res.status(400).json({ error: "minPlayers must be at least 2" });
        updates.minPlayers = mp;
      }
      if (maxPlayers !== undefined) {
        if (maxPlayers === null || maxPlayers === "" || maxPlayers === 0) {
          updates.maxPlayers = null;
        } else {
          const mx = parseInt(maxPlayers);
          if (isNaN(mx) || mx < 2) return res.status(400).json({ error: "maxPlayers must be at least 2" });
          const effectiveMin = updates.minPlayers ?? tournament.minPlayers;
          if (mx < effectiveMin) return res.status(400).json({ error: "maxPlayers must be >= minPlayers" });
          updates.maxPlayers = mx;
        }
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });

      const updated = await storage.updateWordWarsTournament(id, updates);
      res.json(updated);
    } catch (err) {
      console.error("[word-wars] update tournament error", err);
      res.status(500).json({ error: "Failed to update tournament" });
    }
  });

  app.post("/api/word-wars/:id/cancel", requireAuth, async (req, res) => {
    try {
      if (!req.user!.isAdmin) return res.status(403).json({ error: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const tournament = await storage.getWordWarsTournament(id);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Only registration-status tournaments can be cancelled" });
      const updated = await storage.updateWordWarsTournament(id, { status: "cancelled" });
      const registrations = await storage.getWordWarsRegistrationsForTournament(id);
      await Promise.all(registrations.map((r) =>
        createNotificationIfEnabled({
          userId: r.userId,
          type: "word_war_cancelled",
          title: "Tournament Cancelled",
          body: `"${tournament.name}" has been cancelled by an admin.`,
          linkUrl: "/word-wars",
        })
      ));
      res.json(updated);
    } catch (err) {
      console.error("[word-wars] cancel tournament error", err);
      res.status(500).json({ error: "Failed to cancel tournament" });
    }
  });

  app.post("/api/word-wars/:id/draw", requireAuth, async (req, res) => {
    try {
      if (!req.user!.isAdmin) return res.status(403).json({ error: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const result = await executeBracketDraw(id);
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ matches: result.matches });
    } catch (err) {
      console.error("[word-wars] draw error", err);
      res.status(500).json({ error: "Failed to draw bracket" });
    }
  });

  app.get("/api/word-wars/:id/champions", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const champions = await storage.getChampionsForTournament(id);
      if (champions.length === 0) return res.json([]);
      const users = await Promise.all(champions.map(c => storage.getUserById(c.userId)));
      res.json(champions.map((c, i) => ({ ...c, user: users[i] ? { id: users[i]!.id, name: users[i]!.name, avatarUrl: users[i]!.avatarUrl } : null })));
    } catch {
      res.status(500).json({ error: "Failed to get champions" });
    }
  });

  app.get("/api/users/:id/championships", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const championships = await storage.getChampionshipsForUser(id);
      if (championships.length === 0) return res.json([]);
      const tournaments = await Promise.all(championships.map(c => storage.getWordWarsTournament(c.tournamentId)));
      res.json(championships.map((c, i) => ({
        ...c,
        tournamentName: tournaments[i]?.name ?? `Tournament #${c.tournamentId}`,
      })));
    } catch {
      res.status(500).json({ error: "Failed to get championships" });
    }
  });

  app.get("/api/users/:id/word-wars-stats", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const stats = await storage.getWordWarsStatsForUser(id);
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Failed to get Word Wars stats" });
    }
  });

  // GET /api/users/:id/guild-wars-championships — groups this user belongs to that have won Guild Wars
  app.get("/api/users/:id/guild-wars-championships", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const groups = await storage.getUserGroups(id);
      const allChampionships = await Promise.all(groups.map(async (g) => {
        const champs = await storage.getGuildWarsChampionshipsForGroup(g.id);
        return champs.map((c) => ({ ...c, groupName: g.name }));
      }));
      const flat = allChampionships.flat();
      flat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(flat);
    } catch {
      res.status(500).json({ error: "Failed to get Guild Wars championships" });
    }
  });

  app.post("/api/word-wars/matches/:matchId/games/:gameNumber/start", requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const gameNumber = parseInt(req.params.gameNumber);
      if (isNaN(matchId) || isNaN(gameNumber) || gameNumber < 1 || gameNumber > 3) {
        return res.status(400).json({ error: "Invalid match or game number" });
      }
      const match = await storage.getWordWarsMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const userId = req.user!.id;
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ error: "You are not a participant in this match" });
      }
      if (match.status !== "pending" && match.status !== "active") {
        return res.status(400).json({ error: "Match is not active" });
      }
      const matchGame = await storage.getWordWarsMatchGame(matchId, gameNumber);
      if (!matchGame) return res.status(404).json({ error: "Game not found" });
      if (matchGame.roomCode) return res.json({ roomCode: matchGame.roomCode });
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let roomCode = "";
      for (let i = 0; i < 8; i++) roomCode += chars[Math.floor(Math.random() * chars.length)];
      const seed = Math.floor(Math.random() * 1000000);
      await storage.createDuelChallenge({
        challengerId: match.player1Id!,
        challengeeId: match.player2Id!,
        gameSlug: matchGame.gameSlug,
        message: `Word Wars Match — Game ${gameNumber}`,
        status: "accepted",
        roomCode,
        seed,
        startWord: null,
        format: "race",
        raceTarget: 10,
        raceTimeLimit: 180,
        expiresAt: null,
      });
      await storage.updateWordWarsMatchGame(matchGame.id, { roomCode, status: "active" });
      if (match.status === "pending") {
        await storage.updateWordWarsMatch(matchId, { status: "active" });
      }

      // Push real-time SSE event to the two match participants only (no sensitive data in payload)
      const participantIds = [match.player1Id, match.player2Id].filter((id): id is number => id != null);
      ssePublishToUsers(match.tournamentId, participantIds, { type: "game_started", matchId, gameNumber });

      // Notify the opponent that a game room is ready
      const opponentId = userId === match.player1Id ? match.player2Id : match.player1Id;
      if (opponentId) {
        try {
          const [starter, prefs] = await Promise.all([
            storage.getUserById(userId),
            storage.getNotificationPreferences(opponentId),
          ]);
          if (prefs["word_war_matched"]) {
            const notifLink = roomCode
              ? `/duel/${roomCode}`
              : `/word-wars/${match.tournamentId}/match/${matchId}`;
            await storage.createNotification({
              userId: opponentId,
              type: "word_war_matched",
              title: "Your opponent is ready",
              body: `${starter?.name ?? "Your opponent"} has started Game ${gameNumber} of Round ${match.round}. Jump straight into the room!`,
              linkUrl: notifLink,
            });
          }
        } catch (notifErr) {
          console.error("[word-wars] start-game notification error", notifErr);
        }
      }

      // Send a "room is live" notification to both players so each has a direct link
      if (roomCode) {
        const bothPlayerIds = [userId, opponentId].filter((id): id is number => id != null);
        try {
          const prefsResults = await Promise.all(
            bothPlayerIds.map((pid) => storage.getNotificationPreferences(pid)),
          );
          await Promise.all(
            bothPlayerIds.map(async (pid, i) => {
              if (prefsResults[i]["word_war_round_start"]) {
                await storage.createNotification({
                  userId: pid,
                  type: "word_war_round_start",
                  title: "Room is live — join now!",
                  body: `Game ${gameNumber} of Round ${match.round} (Word Wars) is ready. Click to enter the duel room.`,
                  linkUrl: `/duel/${roomCode}`,
                });
              }
            }),
          );
        } catch (notifErr) {
          console.error("[word-wars] room-ready notification error", notifErr);
        }
      }

      res.json({ roomCode });
    } catch (err) {
      console.error("[word-wars] start game error", err);
      res.status(500).json({ error: "Failed to start game" });
    }
  });

  // ==================== GUILD WARS ====================

  // POST /api/guild-wars — admin creates a tournament
  app.post("/api/guild-wars", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, registrationDeadline, roundDeadlineHours, minGroups, maxGroups } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name is required" });
      }
      if (!registrationDeadline) {
        return res.status(400).json({ error: "registrationDeadline is required" });
      }
      const deadline = new Date(registrationDeadline);
      if (isNaN(deadline.getTime())) {
        return res.status(400).json({ error: "registrationDeadline must be a valid date" });
      }
      if (deadline <= new Date()) {
        return res.status(400).json({ error: "registrationDeadline must be in the future" });
      }
      const parsedRoundHours = Number(roundDeadlineHours ?? 24);
      if (isNaN(parsedRoundHours) || parsedRoundHours < 1 || parsedRoundHours > 168) {
        return res.status(400).json({ error: "roundDeadlineHours must be between 1 and 168" });
      }
      const parsedMin = Number(minGroups ?? 2);
      if (isNaN(parsedMin) || parsedMin < 2 || parsedMin > 64) {
        return res.status(400).json({ error: "minGroups must be between 2 and 64" });
      }
      const parsedMax = maxGroups != null ? Number(maxGroups) : null;
      if (parsedMax !== null && (isNaN(parsedMax) || parsedMax < parsedMin || parsedMax > 64)) {
        return res.status(400).json({ error: "maxGroups must be between minGroups and 64" });
      }
      const tournament = await storage.createGuildWarsTournament({
        name: name.trim(),
        registrationDeadline: deadline.toISOString(),
        roundDeadlineHours: parsedRoundHours,
        minGroups: parsedMin,
        maxGroups: parsedMax,
        createdBy: req.user!.id,
      });
      res.status(201).json(tournament);
    } catch (err) {
      console.error("[guild-wars] create tournament error", err);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  // GET /api/guild-wars — list tournaments; optionally filter by ?status=registration|active|completed|cancelled
  app.get("/api/guild-wars", async (req, res) => {
    try {
      const all = await storage.listGuildWarsTournaments();
      const { status } = req.query;
      const filtered = status ? all.filter((t) => t.status === status) : all;
      // Enrich with registration count
      const enriched = await Promise.all(filtered.map(async (t) => {
        const regs = await storage.getGuildWarsRegistrationsForTournament(t.id);
        return { ...t, registrationCount: regs.length };
      }));
      res.json(enriched);
    } catch (err) {
      console.error("[guild-wars] list tournaments error", err);
      res.status(500).json({ error: "Failed to list tournaments" });
    }
  });

  // GET /api/guild-wars/champions — Hall of Fame (enriched with group name)
  app.get("/api/guild-wars/champions", async (req, res) => {
    try {
      const champions = await storage.listAllGuildWarsChampions();
      const enriched = await Promise.all(champions.map(async (c) => {
        const group = await storage.getGroup(c.groupId);
        return { ...c, groupName: group?.name ?? null };
      }));
      res.json(enriched);
    } catch (err) {
      console.error("[guild-wars] champions error", err);
      res.status(500).json({ error: "Failed to fetch champions" });
    }
  });

  // GET /api/guild-wars/:id — tournament detail with registrations + matches + groups map
  app.get("/api/guild-wars/:id", async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      if (isNaN(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });

      const [tournament, registrations, matches] = await Promise.all([
        storage.getGuildWarsTournament(tournamentId),
        storage.getGuildWarsRegistrationsForTournament(tournamentId),
        storage.listGuildWarsMatchesForTournament(tournamentId),
      ]);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });

      const matchesWithGames = await Promise.all(
        matches.map(async (m) => ({
          ...m,
          games: await storage.getGuildWarsMatchGames(m.id),
        })),
      );

      // Enrich registrations with group names
      const enriched = await Promise.all(
        registrations.map(async (r) => {
          const group = await storage.getGroup(r.groupId);
          return { ...r, groupName: group?.name ?? null };
        }),
      );

      // Build a groups map for the bracket (groupId → { id, name })
      const groupIds = new Set<number>();
      enriched.forEach((r) => groupIds.add(r.groupId));
      matchesWithGames.forEach((m) => {
        if (m.group1Id) groupIds.add(m.group1Id);
        if (m.group2Id) groupIds.add(m.group2Id);
        if (m.winnerGroupId) groupIds.add(m.winnerGroupId);
      });
      const groupsMap: Record<number, { id: number; name: string }> = {};
      await Promise.all(Array.from(groupIds).map(async (gid) => {
        const g = await storage.getGroup(gid);
        if (g) groupsMap[gid] = { id: g.id, name: g.name };
      }));

      res.json({ ...tournament, registrations: enriched, matches: matchesWithGames, groups: groupsMap });
    } catch (err) {
      console.error("[guild-wars] get tournament error", err);
      res.status(500).json({ error: "Failed to fetch tournament" });
    }
  });

  // GET /api/groups/:id/guild-wars — tournaments a group is registered in
  app.get("/api/groups/:id/guild-wars", requireAuth, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const regs = await storage.getGuildWarsRegistrationsForGroup(groupId);
      const entries = await Promise.all(regs.map(async (r) => {
        const t = await storage.getGuildWarsTournament(r.tournamentId);
        return t ? { registration: r, tournament: t } : null;
      }));
      res.json(entries.filter(Boolean));
    } catch (err) {
      console.error("[guild-wars] group guild wars error", err);
      res.status(500).json({ error: "Failed to fetch group tournaments" });
    }
  });

  // POST /api/guild-wars/:id/register — group admin registers their group
  app.post("/api/guild-wars/:id/register", requireAuth, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      if (isNaN(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });

      const userId = req.user!.id;
      const { groupId } = req.body;
      if (!groupId) return res.status(400).json({ error: "groupId is required" });

      const tournament = await storage.getGuildWarsTournament(tournamentId);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Registration is closed" });
      if (new Date(tournament.registrationDeadline) <= new Date()) {
        return res.status(400).json({ error: "Registration deadline has passed" });
      }

      // Verify the user is an owner or admin of the group
      const membership = await storage.getGroupMember(Number(groupId), userId);
      if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
        return res.status(403).json({ error: "Only group owners or admins can register a group" });
      }

      const existing = await storage.getGuildWarsRegistration(tournamentId, Number(groupId));
      if (existing) return res.status(409).json({ error: "Group is already registered" });

      if (tournament.maxGroups) {
        const regs = await storage.getGuildWarsRegistrationsForTournament(tournamentId);
        if (regs.length >= tournament.maxGroups) {
          return res.status(400).json({ error: "Tournament is full" });
        }
      }

      const reg = await storage.createGuildWarsRegistration(tournamentId, Number(groupId), userId);
      res.status(201).json(reg);
    } catch (err) {
      console.error("[guild-wars] register error", err);
      res.status(500).json({ error: "Failed to register group" });
    }
  });

  // DELETE /api/guild-wars/:id/register — group admin withdraws their group
  app.delete("/api/guild-wars/:id/register", requireAuth, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      if (isNaN(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });

      const userId = req.user!.id;
      const { groupId } = req.body;
      if (!groupId) return res.status(400).json({ error: "groupId is required" });

      const tournament = await storage.getGuildWarsTournament(tournamentId);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Cannot withdraw after registration closes" });

      const membership = await storage.getGroupMember(Number(groupId), userId);
      if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
        return res.status(403).json({ error: "Only group owners or admins can withdraw a group" });
      }

      const existing = await storage.getGuildWarsRegistration(tournamentId, Number(groupId));
      if (!existing) return res.status(404).json({ error: "Group is not registered" });

      await storage.deleteGuildWarsRegistration(tournamentId, Number(groupId));
      res.json({ success: true });
    } catch (err) {
      console.error("[guild-wars] unregister error", err);
      res.status(500).json({ error: "Failed to withdraw group" });
    }
  });

  // POST /api/guild-wars/:id/draw — admin manually draws the bracket
  app.post("/api/guild-wars/:id/draw", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      if (isNaN(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });

      const result = await executeGuildBracketDraw(tournamentId);
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true, matchCount: result.matches.length });
    } catch (err) {
      console.error("[guild-wars] draw error", err);
      res.status(500).json({ error: "Failed to draw bracket" });
    }
  });

  // GET /api/guild-wars/matches/:matchId — match detail with games
  app.get("/api/guild-wars/matches/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) return res.status(400).json({ error: "Invalid match ID" });

      const match = await storage.getGuildWarsMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });

      const games = await storage.getGuildWarsMatchGames(matchId);
      res.json({ ...match, games });
    } catch (err) {
      console.error("[guild-wars] match detail error", err);
      res.status(500).json({ error: "Failed to fetch match" });
    }
  });

  // POST /api/guild-wars/matches/:matchId/games/:gameNumber/start — group admin starts a match game (creates duel room)
  app.post("/api/guild-wars/matches/:matchId/games/:gameNumber/start", requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const gameNumber = parseInt(req.params.gameNumber);
      if (isNaN(matchId) || isNaN(gameNumber) || gameNumber < 1 || gameNumber > 3) {
        return res.status(400).json({ error: "Invalid match or game number" });
      }

      const match = await storage.getGuildWarsMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      if (!match.group1Id || !match.group2Id) return res.status(400).json({ error: "Match has a bye" });
      if (match.status === "completed" || match.status === "bye" || match.status === "forfeited") {
        return res.status(400).json({ error: "Match is already resolved" });
      }

      const userId = req.user!.id;

      // Any admin of either competing group may start a game
      const [mem1, mem2] = await Promise.all([
        storage.getGroupMember(match.group1Id, userId),
        storage.getGroupMember(match.group2Id, userId),
      ]);
      const isGroupAdmin =
        (mem1 && (mem1.role === "admin" || mem1.role === "owner")) ||
        (mem2 && (mem2.role === "admin" || mem2.role === "owner"));
      if (!isGroupAdmin) {
        return res.status(403).json({ error: "Only a group owner or admin of one of the competing groups can start games" });
      }

      // Fetch registrations to get the designated typists (players)
      const [reg1, reg2] = await Promise.all([
        storage.getGuildWarsRegistration(match.tournamentId, match.group1Id),
        storage.getGuildWarsRegistration(match.tournamentId, match.group2Id),
      ]);
      if (!reg1 || !reg2) {
        return res.status(400).json({ error: "Missing group registrations — cannot create game room" });
      }

      const matchGame = await storage.getGuildWarsMatchGame(matchId, gameNumber);
      if (!matchGame) return res.status(404).json({ error: "Match game not found" });

      // Idempotent — return existing room code if already started
      if (matchGame.roomCode) {
        return res.json({ roomCode: matchGame.roomCode, gameSlug: matchGame.gameSlug });
      }
      if (matchGame.status !== "pending") {
        return res.status(400).json({ error: "Game is already completed" });
      }

      // Game N requires game N-1 to be completed first; also skip if series is decided
      if (gameNumber > 1) {
        const prevGame = await storage.getGuildWarsMatchGame(matchId, gameNumber - 1);
        if (prevGame?.status !== "completed") {
          return res.status(400).json({ error: `Game ${gameNumber - 1} must be completed first` });
        }
        const allGames = await storage.getGuildWarsMatchGames(matchId);
        const completedBefore = allGames.filter(g => g.status === "completed" && g.gameNumber < gameNumber);
        let g1Wins = 0;
        let g2Wins = 0;
        for (const g of completedBefore) {
          if (g.winnerGroupId === match.group1Id) g1Wins++;
          else if (g.winnerGroupId === match.group2Id) g2Wins++;
        }
        if (g1Wins >= 2 || g2Wins >= 2) {
          return res.status(400).json({ error: "Series is already decided" });
        }
      }

      // Create duel room eagerly via registry (mirrors Huddle flow)
      const { duelRegistry } = await import("./duel-ws");
      const { roomCode, seed: roomSeed, startWord: roomStartWord } = duelRegistry.createRoom(
        matchGame.gameSlug, reg1.registeredBy, "race", 10, 180,
      );

      const gameExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      // Persist a HuddleChallenge record so the group-vs-group battle is formally tracked
      await storage.createHuddleChallenge({
        challengerGroupId: match.group1Id,
        challengeeGroupId: match.group2Id,
        challengerAdminId: reg1.registeredBy,
        challengeeAdminId: reg2.registeredBy,
        gameSlug: matchGame.gameSlug,
        format: "race",
        raceTarget: 10,
        raceTimeLimit: 180,
        status: "accepted",
        roomCode,
        seed: roomSeed,
        startWord: roomStartWord ?? null,
        expiresAt: gameExpiresAt,
      });

      // Also persist an accepted DuelChallenge so the WS can fall back after a process restart
      await storage.createDuelChallenge({
        challengerId: reg1.registeredBy,
        challengeeId: reg2.registeredBy,
        gameSlug: matchGame.gameSlug,
        message: `Guild Wars Match ${matchId} — Game ${gameNumber}`,
        status: "accepted",
        roomCode,
        seed: roomSeed,
        startWord: roomStartWord ?? null,
        format: "race",
        raceTarget: 10,
        raceTimeLimit: 180,
        expiresAt: null,
      });

      await storage.updateGuildWarsMatchGame(matchGame.id, { roomCode, status: "active" });

      if (match.status === "pending") {
        await storage.updateGuildWarsMatch(matchId, { status: "active" });
      }

      // Notify all admins of both competing groups
      try {
        const [group1Members, group2Members] = await Promise.all([
          storage.getGroupMembers(match.group1Id),
          storage.getGroupMembers(match.group2Id),
        ]);
        const adminIds = new Set<number>();
        for (const m of [...group1Members, ...group2Members]) {
          if (m.role === "admin" || m.role === "owner") adminIds.add(m.userId);
        }
        await Promise.all(
          Array.from(adminIds).map(async (pid) => {
            const prefs = await storage.getNotificationPreferences(pid);
            if (prefs["guild_war_round_start"]) {
              await storage.createNotification({
                userId: pid,
                type: "guild_war_round_start",
                title: "Room is live — join now!",
                body: `Guild Wars Game ${gameNumber} (${matchGame.gameSlug}) is ready. Click to enter the duel room.`,
                linkUrl: `/duel/${roomCode}`,
              });
            }
          }),
        );
      } catch (notifErr) {
        console.error("[guild-wars] start-game notification error", notifErr);
      }

      res.json({ roomCode, gameSlug: matchGame.gameSlug });
    } catch (err) {
      console.error("[guild-wars] start game error", err);
      res.status(500).json({ error: "Failed to start game" });
    }
  });

  return httpServer;
}

