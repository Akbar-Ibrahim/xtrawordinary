import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { externalApi } from "./externalApi";
// import axios from "axios";
// const REMOTE_BASE_URL = "https://your-remote-server.com";

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

  app.get("/api/games/word-ladder/puzzles", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/word-ladder/puzzles`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch word ladder puzzles";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const puzzles = await dataSource.getWordLadderPuzzles();
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word ladder puzzles" });
    }
  });

  app.get("/api/games/anagram-solver/words", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/anagram-solver/words`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch word sets";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const wordSets = await dataSource.getAnagramWordSets();
      res.json(wordSets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word sets" });
    }
  });

  app.get("/api/games/word-scramble/words", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/word-scramble/words`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch words";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const words = await dataSource.getScrambleWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch words" });
    }
  });

  app.get("/api/games/definition-match/words", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/definition-match/words`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch definition words";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const words = await dataSource.getDefinitionWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch definition words" });
    }
  });

  app.get("/api/games/letter-pool/words", async (_req, res) => {
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
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch letter pool words" });
    }
  });

  app.get("/api/games/word-maker/words", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/word-maker/words`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to fetch maker words";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const words = await dataSource.getMakerWords();
      res.json(words);
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

  app.get("/api/games/word-sweep/grid", async (_req, res) => {
    // --- REMOTE SERVER BLOCK (uncomment to use remote API) ---
    // try {
    //   const response = await axios.get(`${REMOTE_BASE_URL}/api/games/word-sweep/grid`);
    //   res.json(response.data);
    // } catch (error: any) {
    //   const status = error.response?.status || 500;
    //   const message = error.response?.data?.message || "Failed to generate grid";
    //   res.status(status).json({ message });
    // }
    // --- END REMOTE SERVER BLOCK ---
    try {
      const grid = await dataSource.generateWordSweepGrid();
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
        "contains-letters",
        "letter-balance",
        "letter-frequency",
        "no-repeats",
        "word-sweep",
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

  return httpServer;
}
