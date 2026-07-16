import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";

const querySchema = z.object({
  game: z.enum(["letter-hunt", "letter-dodge"]),
  letters: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export function registerWordExamplesRoutes(app: Express): void {
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
