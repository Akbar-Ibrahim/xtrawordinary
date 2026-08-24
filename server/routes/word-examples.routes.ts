import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isMySQLStorageEnabled } from "../storage-config";
import type { DatabaseWordExamplesRequest } from "../mysql/word-examples";

const querySchema = z.object({
  game: z.enum(["letter-hunt", "letter-dodge"]),
  letters: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

const databaseQuerySchema = z.object({
  game: z.enum(["word-length", "letter-frequency", "letter-balance"]),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  length: z.coerce.number().int().min(3).max(12).optional(),
  variation: z.coerce.number().int().min(1).max(5).optional(),
  startsWith: z.string().regex(/^[A-Za-z]$/).optional(),
  endsWith: z.string().regex(/^[A-Za-z]$/).optional(),
  contains: z.string().regex(/^[A-Za-z]$/).optional(),
  mode: z.enum(["exact", "minimum"]).optional(),
  constraints: z.string().optional(),
  category: z.enum([
    "consonant_count",
    "vowel_count",
    "start_end_vowel",
    "start_end_consonant",
    "start_vowel_end_consonant",
    "start_consonant_end_vowel",
    "locked_balance",
    "custom",
  ]).optional(),
  vowelCount: z.coerce.number().int().min(0).max(12).optional(),
  consonantCount: z.coerce.number().int().min(0).max(12).optional(),
});

function normalizeLetter(value: string | undefined): string | undefined {
  return value?.toUpperCase();
}

export function parseDatabaseWordExampleRequest(input: z.infer<typeof databaseQuerySchema>): DatabaseWordExamplesRequest | null {
  if (input.game === "word-length") {
    if (input.length === undefined || input.variation === undefined) return null;
    return {
      game: "word-length",
      length: input.length,
      variation: input.variation,
      startsWith: normalizeLetter(input.startsWith),
      endsWith: normalizeLetter(input.endsWith),
      contains: normalizeLetter(input.contains),
    };
  }

  if (input.game === "letter-frequency") {
    if (!input.constraints || !input.mode) return null;
    const constraints = input.constraints.split(",").map(item => {
      const match = /^([A-Za-z]):([1-6])$/.exec(item.trim());
      return match ? { letter: match[1].toUpperCase(), count: Number(match[2]) } : null;
    });
    if (constraints.length === 0 || constraints.length > 3 || constraints.some(item => item === null)) return null;
    const resolved = constraints as Array<{ letter: string; count: number }>;
    if (new Set(resolved.map(item => item.letter)).size !== resolved.length) return null;
    return { game: "letter-frequency", mode: input.mode, constraints: resolved };
  }

  if (!input.category) return null;
  const request = {
    game: "letter-balance" as const,
    category: input.category,
    length: input.length,
    vowelCount: input.vowelCount,
    consonantCount: input.consonantCount,
  };
  const needsLength = input.category.includes("start_") || input.category === "locked_balance";
  if (needsLength && input.length === undefined) return null;
  if (input.category === "vowel_count" && input.vowelCount === undefined) return null;
  if (input.category === "consonant_count" && input.consonantCount === undefined) return null;
  if (input.category === "locked_balance" && input.consonantCount === undefined) return null;
  if (input.category === "custom" && input.length === undefined && input.vowelCount === undefined && input.consonantCount === undefined) return null;
  return request;
}

export function registerWordExamplesRoutes(app: Express): void {
  app.get("/api/games/database-word-examples/availability", (_req, res) => {
    res.json({ available: isMySQLStorageEnabled() });
  });

  app.get("/api/games/database-word-examples", async (req, res) => {
    if (!isMySQLStorageEnabled()) {
      return res.status(404).json({ message: "Database word examples are unavailable in memory mode" });
    }

    const parsed = databaseQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid parameters", errors: parsed.error.flatten() });
    }
    const request = parseDatabaseWordExampleRequest(parsed.data);
    if (!request) {
      return res.status(400).json({ message: "Invalid word-example constraints" });
    }

    try {
      const [{ db }, wordExamples] = await Promise.all([
        import("../db"),
        import("../mysql/word-examples"),
      ]);
      const result = await wordExamples.getDatabaseWordExamples(db, request, parsed.data.limit);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch database word examples" });
    }
  });

  app.get("/api/games/word-examples", async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid parameters", errors: parsed.error.flatten() });
    }

    const { game, letters: lettersStr, limit } = parsed.data;
    const letters = lettersStr
      .split(",")
      .map(l => l.trim().toUpperCase())
      .filter(l => l.length === 1 && /[A-Z]/.test(l));

    if (letters.length === 0) {
      return res.json({ words: [], total: 0 });
    }

    try {
      const result = await storage.getWordExamples(game, letters, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch word examples" });
    }
  });
}
