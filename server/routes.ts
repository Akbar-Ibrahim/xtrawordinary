import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { externalApi } from "./externalApi";

const isLocalMode = process.env.DEV_MODE === "LOCAL";
const dataSource = isLocalMode ? storage : externalApi;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/games", async (_req, res) => {
    try {
      const games = await dataSource.getGames();
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  app.get("/api/games/word-guessing/words", async (_req, res) => {
    try {
      const words = await dataSource.getWordGuessingWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch words" });
    }
  });

  app.get("/api/games/anagram-solver/words", async (_req, res) => {
    try {
      const wordSets = await dataSource.getAnagramWordSets();
      res.json(wordSets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word sets" });
    }
  });

  app.get("/api/games/word-scramble/words", async (_req, res) => {
    try {
      const words = await dataSource.getScrambleWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch words" });
    }
  });

  app.get("/api/games/definition-match/words", async (_req, res) => {
    try {
      const words = await dataSource.getDefinitionWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch definition words" });
    }
  });

  app.get("/api/games/word-builder/words", async (_req, res) => {
    try {
      const words = await dataSource.getBuilderWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch builder words" });
    }
  });

  app.get("/api/games/word-maker/words", async (_req, res) => {
    try {
      const words = await dataSource.getMakerWords();
      res.json(words);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch maker words" });
    }
  });

  // Dictionary endpoint removed for security - words validated only via /api/games/validate-word

  app.post("/api/games/validate-word", async (req, res) => {
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
    try {
      const config = await dataSource.getVowelConsonantConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch letter balance config" });
    }
  });

  // Word Chain endpoints - need dictionary access for computer responses
  app.post("/api/games/word-chain/start", async (req, res) => {
    try {
      const { variation, level } = req.body;
      const word = await dataSource.getWordChainStartWord(variation || 1, level || 1);
      res.json({ word });
    } catch (error) {
      res.status(500).json({ message: "Failed to get start word" });
    }
  });

  app.post("/api/games/word-chain/computer-word", async (req, res) => {
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

  app.get("/api/games/:slug", async (req, res) => {
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
