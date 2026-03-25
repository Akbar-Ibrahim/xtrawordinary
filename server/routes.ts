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

  app.get("/api/games/progressive-reveal/words", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/progressive-reveal/words`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch progressive reveal words";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const words = await dataSource.getProgressiveRevealWords();
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
      const { friendId, gameSlug, score, message } = req.body;
      if (!friendId || typeof friendId !== "number") return res.status(400).json({ error: "Valid friendId is required" });
      if (!gameSlug || typeof gameSlug !== "string") return res.status(400).json({ error: "Valid gameSlug is required" });
      if (score === undefined || typeof score !== "number" || score < 0) return res.status(400).json({ error: "Valid non-negative score is required" });
      if (message && typeof message === "string" && message.length > 200) return res.status(400).json({ error: "Message too long (max 200 chars)" });
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
    "word-sweep", "word-roots",
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
      const { gameSlug, closesAt } = req.body;
      const slug = gameSlug && CHALLENGE_GAME_SLUGS.includes(gameSlug) ? gameSlug : CHALLENGE_GAME_SLUGS[Math.floor(Math.random() * CHALLENGE_GAME_SLUGS.length)];
      const seed = Math.floor(Math.random() * 2147483647);
      const round = await storage.createGroupRound({
        groupId,
        gameSlug: slug,
        seed,
        status: "active",
        createdById: userId,
        closesAt: closesAt || null,
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

  return httpServer;
}
