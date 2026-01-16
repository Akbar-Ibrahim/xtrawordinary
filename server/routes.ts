import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/games", async (_req, res) => {
    try {
      const games = await storage.getGames();
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  // Game-specific word data endpoints (must be before :slug route)
  app.get("/api/games/word-guessing/words", async (_req, res) => {
    try {
      const words = await storage.getWordGuessingWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch words" });
    }
  });

  app.get("/api/games/anagram-solver/words", async (_req, res) => {
    try {
      const wordSets = await storage.getAnagramWordSets();
      res.json(wordSets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word sets" });
    }
  });

  app.get("/api/games/word-scramble/words", async (_req, res) => {
    try {
      const words = await storage.getScrambleWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch words" });
    }
  });

  app.get("/api/games/definition-match/words", async (_req, res) => {
    try {
      const words = await storage.getDefinitionWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch definition words" });
    }
  });

  app.get("/api/games/word-builder/words", async (_req, res) => {
    try {
      const words = await storage.getBuilderWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch builder words" });
    }
  });

  app.get("/api/games/word-maker/words", async (_req, res) => {
    try {
      const words = await storage.getMakerWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch maker words" });
    }
  });

  // Word dictionary and validation endpoints for new games
  app.get("/api/games/word-dictionary", async (_req, res) => {
    try {
      const dictionary = await storage.getWordDictionary();
      res.json(dictionary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word dictionary" });
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

  // Word Length game config
  app.get("/api/games/word-length/config", async (_req, res) => {
    try {
      const config = await storage.getWordLengthConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word length config" });
    }
  });

  // Letter Position game config
  app.get("/api/games/letter-position/config", async (_req, res) => {
    try {
      const config = await storage.getLetterPositionConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch letter position config" });
    }
  });

  // Contains game config
  app.get("/api/games/contains-letters/config", async (_req, res) => {
    try {
      const config = await storage.getContainsConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contains config" });
    }
  });

  app.get("/api/games/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const game = await storage.getGameBySlug(slug);
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
