import type { Express } from "express";
import { z } from "zod";
import { withAnagramExploreSource } from "../explore/anagram-service";
import { AnagramBaseWordNotFoundError } from "../explore/anagram-types";
import { InvalidExploreCursorError } from "../explore/shared-types";

const baseWordSchema = z.object({
  q: z.string().trim().max(100).regex(/^[A-Za-z]*$/).default(""),
  limit: z.coerce.number().int().min(1).max(20).default(20),
  cursor: z.string().max(512).optional(),
});

const wordsSchema = z.object({
  baseWord: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
});

const checkSchema = z.object({
  baseWord: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/),
  answer: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/),
});

function sendAnagramExploreError(res: import("express").Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) return res.status(400).json({ message: error.message });
  if (error instanceof AnagramBaseWordNotFoundError) {
    return res.status(404).json({ message: "No anagram matches are available for that base word" });
  }
  console.error(`[Explore:Anagrams] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerAnagramExploreRoutes(app: Express): void {
  app.get("/api/explore/anagrams/base-words", async (req, res) => {
    const parsed = baseWordSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid anagram base-word search", errors: parsed.error.flatten() });
    }
    try {
      return res.json(await withAnagramExploreSource((source) =>
        source.searchBaseWords(parsed.data.q, parsed.data.limit, parsed.data.cursor),
      ));
    } catch (error) {
      return sendAnagramExploreError(res, error, "search anagram base words");
    }
  });

  app.get("/api/explore/anagrams/base-words/random", async (_req, res) => {
    try {
      return res.json(await withAnagramExploreSource((source) => source.randomBaseWord()));
    } catch (error) {
      return sendAnagramExploreError(res, error, "choose a random anagram base word");
    }
  });

  app.get("/api/explore/anagrams/words", async (req, res) => {
    const parsed = wordsSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid anagram Explore query", errors: parsed.error.flatten() });
    }
    try {
      return res.json(await withAnagramExploreSource((source) =>
        source.getWords(parsed.data.baseWord, parsed.data.limit, parsed.data.cursor),
      ));
    } catch (error) {
      return sendAnagramExploreError(res, error, "load anagram Explore results");
    }
  });

  app.post("/api/explore/anagrams/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid anagram answer check", errors: parsed.error.flatten() });
    }
    try {
      return res.json(await withAnagramExploreSource((source) =>
        source.checkAnswer(parsed.data.baseWord, parsed.data.answer),
      ));
    } catch (error) {
      return sendAnagramExploreError(res, error, "check an anagram suggestion");
    }
  });
}
