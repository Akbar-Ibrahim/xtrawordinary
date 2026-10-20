import type { Express, Response } from "express";
import { z } from "zod";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { withLetterFrequencyExploreSource } from "../explore/letter-frequency-service";

const constraintSchema = z.object({
  letter: z.string().trim().length(1).regex(/^[A-Za-z]$/)
    .transform((letter) => letter.toUpperCase()),
  count: z.coerce.number().int().min(1).max(6),
});

const constraintsSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.array(constraintSchema).min(1).max(3).superRefine((constraints, context) => {
  const letters = constraints.map(({ letter }) => letter);
  if (new Set(letters).size !== letters.length) {
    context.addIssue({ code: "custom", message: "Choose a different letter for each requirement" });
  }
}));

const matchSchema = z.enum(["exact", "minimum"]).default("exact");

const ruleFieldsSchema = z.object({
  constraints: constraintsSchema,
  match: matchSchema,
});

function validateRules(
  { constraints, match }: { constraints: { letter: string; count: number }[]; match: "exact" | "minimum" },
  context: z.RefinementCtx,
) {
  if (constraints.length > 1 && match !== "exact") {
    context.addIssue({ code: "custom", message: "Multi-Letter requirements use exact counts" });
  }
  if (constraints.length > 1 && constraints.some(({ count }) => count > 3)) {
    context.addIssue({ code: "custom", message: "Multi-Letter counts must be from 1 to 3" });
  }
}

const searchSchema = ruleFieldsSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  cursor: z.string().max(512).optional(),
}).superRefine(validateRules);

const checkSchema = ruleFieldsSchema.extend({
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((word) => word.toUpperCase()),
}).superRefine(validateRules);

function sendError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:LetterFrequency] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerLetterFrequencyExploreRoutes(app: Express): void {
  app.get("/api/explore/letter-frequency/words", async (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Choose one letter rule or 2–3 exact Multi-Letter rules",
        errors: parsed.error.flatten(),
      });
    }
    try {
      const { constraints, match, limit, cursor } = parsed.data;
      return res.json(await withLetterFrequencyExploreSource((source) =>
        source.search(constraints, match, limit, cursor),
      ));
    } catch (error) {
      return sendError(res, error, "search Letter Frequency words");
    }
  });

  app.post("/api/explore/letter-frequency/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter an alphabetic word and valid letter-frequency rules",
        errors: parsed.error.flatten(),
      });
    }
    try {
      const { word, constraints, match } = parsed.data;
      return res.json(await withLetterFrequencyExploreSource((source) =>
        source.check(word, constraints, match),
      ));
    } catch (error) {
      return sendError(res, error, "check a Letter Frequency answer");
    }
  });
}
