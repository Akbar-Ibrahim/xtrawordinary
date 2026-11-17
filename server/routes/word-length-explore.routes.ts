import type { Express, Response } from "express";
import { z } from "zod";
import { WORD_LENGTH_EXPLORE_MAX_LENGTH, type WordLengthExplorePattern } from "@shared/word-length-explore";
import type { WordLengthVariation } from "@shared/word-length";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { withWordLengthExploreSource } from "../explore/word-length-service";

const letterSchema = z.string().trim().length(1).regex(/^[A-Za-z]$/)
  .transform((letter) => letter.toUpperCase());

const patternFields = {
  variation: z.coerce.number().int().min(1).max(5),
  length: z.coerce.number().int().min(1).max(WORD_LENGTH_EXPLORE_MAX_LENGTH),
  startsWith: letterSchema.optional(),
  endsWith: letterSchema.optional(),
  contains: letterSchema.optional(),
};

const querySchema = z.object({
  ...patternFields,
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
});

const checkSchema = z.object({
  ...patternFields,
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((word) => word.toUpperCase()),
});

type PatternInput = {
  variation: number;
  length: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

function toPattern(input: PatternInput): WordLengthExplorePattern | null {
  const variation = input.variation as WordLengthVariation;
  if ((variation === 2 || variation === 4) && !input.startsWith) return null;
  if ((variation === 3 || variation === 5) && !input.endsWith) return null;
  if ((variation === 4 || variation === 5) && !input.contains) return null;

  return {
    variation,
    length: input.length,
    ...(input.startsWith ? { startsWith: input.startsWith } : {}),
    ...(input.endsWith ? { endsWith: input.endsWith } : {}),
    ...(input.contains ? { contains: input.contains } : {}),
  };
}

function sendError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:LengthChallenge] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerWordLengthExploreRoutes(app: Express): void {
  app.get("/api/explore/word-length/words", async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Choose a valid pattern and word length", errors: parsed.error.flatten() });
    }

    const pattern = toPattern(parsed.data);
    if (!pattern) {
      return res.status(400).json({ message: "Provide the letters required by the selected pattern" });
    }

    try {
      return res.json(await withWordLengthExploreSource((source) =>
        source.search(pattern, parsed.data.limit, parsed.data.cursor),
      ));
    } catch (error) {
      return sendError(res, error, "search Length Challenge words");
    }
  });

  app.post("/api/explore/word-length/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Enter an alphabetic word and valid pattern settings", errors: parsed.error.flatten() });
    }

    const pattern = toPattern(parsed.data);
    if (!pattern) {
      return res.status(400).json({ message: "Provide the letters required by the selected pattern" });
    }

    try {
      return res.json(await withWordLengthExploreSource((source) =>
        source.check(parsed.data.word, pattern),
      ));
    } catch (error) {
      return sendError(res, error, "check a Length Challenge word");
    }
  });
}
