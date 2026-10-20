import type { Express, Response } from "express";
import { z } from "zod";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { normalizeRequiredLetters } from "../explore/no-repeats-utils";
import { withNoRepeatsExploreSource } from "../explore/no-repeats-service";

const requiredLettersSchema = z.preprocess(
  (value) => value === undefined ? "" : value,
  z.string().max(26).regex(/^[A-Za-z]*$/)
    .transform((letters) => normalizeRequiredLetters(letters))
    .refine((letters) => new Set(letters).size === letters.length, "Required letters must be unique"),
);

const lengthSchema = z.preprocess(
  (value) => value === undefined || value === "" ? undefined : value,
  z.coerce.number().int().min(1).max(26).optional(),
);

const filtersSchema = z.object({
  length: lengthSchema,
  requiredLetters: requiredLettersSchema,
});

const searchSchema = filtersSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
});

const checkSchema = filtersSchema.extend({
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((word) => word.toUpperCase()),
});

function sendError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:NoRepeats] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerNoRepeatsExploreRoutes(app: Express): void {
  app.get("/api/explore/no-repeats/words", async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Choose a length from 1 to 26 and unique required letters",
        errors: parsed.error.flatten(),
      });
    }
    try {
      const { length, requiredLetters, limit, cursor } = parsed.data;
      return res.json(await withNoRepeatsExploreSource((source) =>
        source.search({ length, requiredLetters }, limit, cursor),
      ));
    } catch (error) {
      return sendError(res, error, "search No Repeats words");
    }
  });

  app.post("/api/explore/no-repeats/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter an alphabetic word, an optional length, and unique required letters",
        errors: parsed.error.flatten(),
      });
    }
    try {
      const { word, length, requiredLetters } = parsed.data;
      return res.json(await withNoRepeatsExploreSource((source) =>
        source.check(word, { length, requiredLetters }),
      ));
    } catch (error) {
      return sendError(res, error, "check a No Repeats answer");
    }
  });
}
