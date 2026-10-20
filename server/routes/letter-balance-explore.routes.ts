import type { Express, Response } from "express";
import { z } from "zod";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { LETTER_BALANCE_EXPLORE_CATEGORIES } from "../explore/letter-balance-types";
import type { LetterBalanceExploreFilters } from "../explore/letter-balance-types";
import { withLetterBalanceExploreSource } from "../explore/letter-balance-service";

const baseFiltersSchema = z.object({
  category: z.enum(LETTER_BALANCE_EXPLORE_CATEGORIES),
  count: z.coerce.number().int().min(0).max(100).optional(),
  length: z.coerce.number().int().min(1).max(100).optional(),
  consonantCount: z.coerce.number().int().min(0).max(100).optional(),
});

function validateFilters(filters: z.infer<typeof baseFiltersSchema>, context: z.RefinementCtx) {
  if (filters.category === "vowel_count" || filters.category === "consonant_count") {
    if (filters.count === undefined) {
      context.addIssue({ code: "custom", path: ["count"], message: "Choose an exact letter count" });
    }
    if (filters.consonantCount !== undefined) {
      context.addIssue({ code: "custom", path: ["consonantCount"], message: "Not used for this pattern" });
    }
    if (filters.length !== undefined && filters.count !== undefined && filters.count > filters.length) {
      context.addIssue({ code: "custom", path: ["count"], message: "Count cannot exceed word length" });
    }
    return;
  }

  if (filters.count !== undefined) {
    context.addIssue({ code: "custom", path: ["count"], message: "Not used for this pattern" });
  }

  if (filters.category === "locked_balance") {
    if (filters.length === undefined) {
      context.addIssue({ code: "custom", path: ["length"], message: "Choose a word length" });
    }
    if (filters.consonantCount === undefined) {
      context.addIssue({ code: "custom", path: ["consonantCount"], message: "Choose a consonant count" });
    } else if (filters.length !== undefined && filters.consonantCount > filters.length) {
      context.addIssue({ code: "custom", path: ["consonantCount"], message: "Count cannot exceed word length" });
    }
  } else if (filters.consonantCount !== undefined) {
    context.addIssue({ code: "custom", path: ["consonantCount"], message: "Not used for this pattern" });
  }
}

const searchSchema = baseFiltersSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
}).superRefine(validateFilters);

const checkSchema = baseFiltersSchema.extend({
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((word) => word.toUpperCase()),
}).superRefine(validateFilters);

function sendError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:LetterBalance] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

function toFilters(filters: z.infer<typeof baseFiltersSchema>): LetterBalanceExploreFilters {
  return {
    category: filters.category,
    count: filters.count,
    length: filters.length,
    consonantCount: filters.consonantCount,
  };
}

export function registerLetterBalanceExploreRoutes(app: Express): void {
  app.get("/api/explore/letter-balance/words", async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Choose a valid vowel/consonant pattern and its required counts",
        errors: parsed.error.flatten(),
      });
    }
    try {
      const { category, count, length, consonantCount, limit, cursor } = parsed.data;
      return res.json(await withLetterBalanceExploreSource((source) =>
        source.search(toFilters({ category, count, length, consonantCount }), limit, cursor),
      ));
    } catch (error) {
      return sendError(res, error, "search Vowel & Consonant words");
    }
  });

  app.post("/api/explore/letter-balance/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter a dictionary word and valid vowel/consonant rules",
        errors: parsed.error.flatten(),
      });
    }
    try {
      const { word, category, count, length, consonantCount } = parsed.data;
      return res.json(await withLetterBalanceExploreSource((source) =>
        source.check(word, toFilters({ category, count, length, consonantCount })),
      ));
    } catch (error) {
      return sendError(res, error, "check a Vowel & Consonant answer");
    }
  });
}
