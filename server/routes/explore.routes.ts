import type { Express } from "express";
import { z } from "zod";
import { withWordMakerExploreSource } from "../explore/word-maker-service";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { WordMakerBaseWordNotFoundError } from "../explore/word-maker-types";

const baseWordSearchSchema = z.object({
  q: z.string().trim().max(100).regex(/^[A-Za-z]*$/).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(20),
  cursor: z.string().max(512).optional(),
});

const wordResultsSchema = z.object({
  baseWord: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
});

const checkAnswerSchema = z.object({
  baseWord: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/),
  answer: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/),
});

function sendExploreError(res: import("express").Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  if (error instanceof WordMakerBaseWordNotFoundError) {
    return res.status(404).json({ message: "Word Maker base word not found" });
  }
  console.error(`[Explore] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerExploreRoutes(app: Express): void {
  app.get("/api/explore/word-maker/base-words", async (req, res) => {
    const parsed = baseWordSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid base-word search", errors: parsed.error.flatten() });
    }
    try {
      const result = await withWordMakerExploreSource((source) =>
        source.searchBaseWords(parsed.data.q, parsed.data.limit, parsed.data.cursor),
      );
      return res.json(result);
    } catch (error) {
      return sendExploreError(res, error, "search Word Maker base words");
    }
  });

  app.get("/api/explore/word-maker/base-words/random", async (_req, res) => {
    try {
      const result = await withWordMakerExploreSource((source) => source.randomBaseWord());
      return res.json(result);
    } catch (error) {
      return sendExploreError(res, error, "choose a random Word Maker base word");
    }
  });

  app.get("/api/explore/word-maker/words", async (req, res) => {
    const parsed = wordResultsSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid Word Maker Explore query", errors: parsed.error.flatten() });
    }
    try {
      const result = await withWordMakerExploreSource((source) =>
        source.getWords(parsed.data.baseWord, parsed.data.limit, parsed.data.cursor),
      );
      return res.json(result);
    } catch (error) {
      return sendExploreError(res, error, "load Word Maker Explore results");
    }
  });

  app.post("/api/explore/word-maker/check", async (req, res) => {
    const parsed = checkAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid Word Maker answer check", errors: parsed.error.flatten() });
    }
    try {
      const result = await withWordMakerExploreSource((source) =>
        source.checkAnswer(parsed.data.baseWord, parsed.data.answer),
      );
      return res.json(result);
    } catch (error) {
      return sendExploreError(res, error, "check a Word Maker suggestion");
    }
  });
}
