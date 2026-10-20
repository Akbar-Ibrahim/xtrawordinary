import type { Express, Response } from "express";
import { z } from "zod";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { withLetterHuntExploreSource } from "../explore/letter-hunt-service";

const lettersSchema = z.string().trim().min(1).max(12).regex(/^[A-Za-z]+$/)
  .transform((letters) => letters.toUpperCase());
const orderedQuerySchema = z.enum(["true", "false"]).default("false")
  .transform((value) => value === "true");

const searchSchema = z.object({
  letters: lettersSchema,
  ordered: orderedQuerySchema,
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
});

const checkSchema = z.object({
  letters: lettersSchema,
  ordered: z.boolean().default(false),
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((word) => word.toUpperCase()),
});

function sendError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:LetterHunt] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerLetterHuntExploreRoutes(app: Express): void {
  app.get("/api/explore/letter-hunt/words", async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Enter 1–12 required letters (A–Z)", errors: parsed.error.flatten() });
    }
    try {
      const { letters, ordered, limit, cursor } = parsed.data;
      return res.json(await withLetterHuntExploreSource((source) =>
        source.search(letters, ordered, limit, cursor),
      ));
    } catch (error) {
      return sendError(res, error, "search Letter Hunt words");
    }
  });

  app.post("/api/explore/letter-hunt/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Enter a dictionary word and 1–12 required letters (A–Z)", errors: parsed.error.flatten() });
    }
    try {
      const { word, letters, ordered } = parsed.data;
      return res.json(await withLetterHuntExploreSource((source) =>
        source.check(word, letters, ordered),
      ));
    } catch (error) {
      return sendError(res, error, "check a Letter Hunt answer");
    }
  });
}
