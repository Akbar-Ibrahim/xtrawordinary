import type { Express, Response } from "express";
import { z } from "zod";
import { EXPLORE_MAX_WORD_LENGTH_FILTER } from "@shared/explore-limits";
import { InvalidExploreCursorError } from "../explore/shared-types";
import {
  WordSplitSearchTooComplexError,
  WordSplitTargetNotFoundError,
} from "../explore/word-split-types";
import { withWordSplitExploreSource } from "../explore/word-split-service";

const searchSchema = z.object({
  targetWord: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((value) => value.toUpperCase()),
  wordCount: z.coerce.number().int().min(2).max(100).optional(),
  minWordLength: z.coerce.number().int().min(1).max(EXPLORE_MAX_WORD_LENGTH_FILTER).default(2),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(2048).optional(),
});

function sendExploreError(res: Response, error: unknown) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  if (error instanceof WordSplitTargetNotFoundError) {
    return res.status(404).json({ message: "That word was not found in the dictionary." });
  }
  if (error instanceof WordSplitSearchTooComplexError) {
    return res.status(422).json({ message: error.message });
  }
  console.error("[Explore:WordSplit] Failed to find word splits", error);
  return res.status(500).json({ message: "Could not load splits for this word." });
}

export function registerWordSplitExploreRoutes(app: Express): void {
  app.get("/api/explore/word-split/splits", async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter a dictionary word and choose valid split filters.",
        errors: parsed.error.flatten(),
      });
    }

    const { targetWord, wordCount, minWordLength, limit, cursor } = parsed.data;
    try {
      const result = await withWordSplitExploreSource((source) =>
        source.getSplits(
          { targetWord, wordCount: wordCount ?? null, minWordLength },
          limit,
          cursor,
        ),
      );
      return res.json(result);
    } catch (error) {
      return sendExploreError(res, error);
    }
  });
}
