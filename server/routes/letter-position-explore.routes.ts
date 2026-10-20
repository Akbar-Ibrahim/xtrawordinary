import type { Express, Response } from "express";
import { z } from "zod";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { withLetterPositionExploreSource } from "../explore/letter-position-service";

const letterSchema = z.string().trim().length(1).regex(/^[A-Za-z]$/)
  .transform((letter) => letter.toUpperCase());
const positionSchema = z.coerce.number().int().min(1).max(8);

const searchSchema = z.object({
  letter: letterSchema,
  position: positionSchema,
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
});

const checkSchema = z.object({
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((word) => word.toUpperCase()),
  letter: letterSchema,
  position: positionSchema,
});

function sendError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:LetterPosition] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerLetterPositionExploreRoutes(app: Express): void {
  app.get("/api/explore/letter-position/words", async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Choose one letter and a position from 1 to 8", errors: parsed.error.flatten() });
    }
    try {
      const { letter, position, limit, cursor } = parsed.data;
      return res.json(await withLetterPositionExploreSource((source) =>
        source.search(letter, position, limit, cursor),
      ));
    } catch (error) {
      return sendError(res, error, "search Letter Position words");
    }
  });

  app.post("/api/explore/letter-position/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Enter an alphabetic word, one letter, and a position from 1 to 8", errors: parsed.error.flatten() });
    }
    try {
      const { word, letter, position } = parsed.data;
      return res.json(await withLetterPositionExploreSource((source) =>
        source.check(word, letter, position),
      ));
    } catch (error) {
      return sendError(res, error, "check a Letter Position answer");
    }
  });
}
