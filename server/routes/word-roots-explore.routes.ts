import type { Express, Response } from "express";
import { z } from "zod";
import {
  WORD_ROOTS_EXPLORE_DEFAULT_PAGE_SIZE,
  WORD_ROOTS_EXPLORE_MAX_INPUTS,
  WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH,
  WORD_ROOTS_EXPLORE_MAX_PAGE_SIZE,
  WORD_ROOTS_EXPLORE_MAX_WORD_LENGTH,
  WORD_ROOTS_EXPLORE_MIN_INPUTS,
} from "@shared/word-roots-explore";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { WordRootsExploreWordsNotFoundError } from "../explore/word-roots-types";
import { withWordRootsExploreSource } from "../explore/word-roots-service";

const searchSchema = z.object({
  word: z.array(
    z.string().trim().min(1).max(WORD_ROOTS_EXPLORE_MAX_WORD_LENGTH)
      .regex(/^[A-Za-z]+$/)
      .transform((value) => value.toUpperCase()),
  ).min(WORD_ROOTS_EXPLORE_MIN_INPUTS).max(WORD_ROOTS_EXPLORE_MAX_INPUTS),
  length: z.coerce.number().int().min(1).max(WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(WORD_ROOTS_EXPLORE_MAX_PAGE_SIZE)
    .default(WORD_ROOTS_EXPLORE_DEFAULT_PAGE_SIZE),
  cursor: z.string().max(512).optional(),
});

function sendExploreError(res: Response, error: unknown) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  if (error instanceof WordRootsExploreWordsNotFoundError) {
    return res.status(404).json({
      message: `These words were not found in the dictionary: ${error.words.join(", ")}.`,
      missingWords: error.words,
    });
  }
  if (error instanceof RangeError) {
    return res.status(400).json({ message: error.message });
  }
  console.error("[Explore:WordRoots] Failed to find base words", error);
  return res.status(500).json({ message: "Could not find base words for these entries." });
}

export function registerWordRootsExploreRoutes(app: Express): void {
  app.get("/api/explore/word-roots/base-words", async (req, res) => {
    const rawWords = req.query.word;
    const parsed = searchSchema.safeParse({
      ...req.query,
      word: Array.isArray(rawWords) ? rawWords : [],
    });
    if (!parsed.success) {
      return res.status(400).json({
        message: `Enter ${WORD_ROOTS_EXPLORE_MIN_INPUTS}–${WORD_ROOTS_EXPLORE_MAX_INPUTS} words using letters A–Z.`,
        errors: parsed.error.flatten(),
      });
    }

    if (new Set(parsed.data.word).size !== parsed.data.word.length) {
      return res.status(400).json({ message: "Enter each word only once." });
    }

    try {
      const result = await withWordRootsExploreSource((source) =>
        source.findBaseWords(parsed.data.word, {
          limit: parsed.data.limit,
          cursor: parsed.data.cursor,
          length: parsed.data.length ?? null,
        }),
      );
      return res.json(result);
    } catch (error) {
      return sendExploreError(res, error);
    }
  });
}
