import type { Express, Response } from "express";
import { z } from "zod";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { withLetterDodgeExploreSource } from "../explore/letter-dodge-service";

const forbiddenLettersSchema = z.string().trim().min(1).max(26).regex(/^[A-Za-z]+$/)
  .transform((letters) => [...new Set(letters.toUpperCase())].sort().join(""));

const searchSchema = z.object({
  forbidden: forbiddenLettersSchema,
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
});

const checkSchema = z.object({
  forbidden: forbiddenLettersSchema,
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((word) => word.toUpperCase()),
});

function sendError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:LetterDodge] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerLetterDodgeExploreRoutes(app: Express): void {
  app.get("/api/explore/letter-dodge/words", async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Select 1–26 forbidden letters (A–Z)", errors: parsed.error.flatten() });
    }
    try {
      const { forbidden, limit, cursor } = parsed.data;
      return res.json(await withLetterDodgeExploreSource((source) =>
        source.search(forbidden, limit, cursor),
      ));
    } catch (error) {
      return sendError(res, error, "search Letter Dodge words");
    }
  });

  app.post("/api/explore/letter-dodge/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Enter a dictionary word and select 1–26 forbidden letters (A–Z)", errors: parsed.error.flatten() });
    }
    try {
      const { word, forbidden } = parsed.data;
      return res.json(await withLetterDodgeExploreSource((source) =>
        source.check(word, forbidden),
      ));
    } catch (error) {
      return sendError(res, error, "check a Letter Dodge answer");
    }
  });
}
