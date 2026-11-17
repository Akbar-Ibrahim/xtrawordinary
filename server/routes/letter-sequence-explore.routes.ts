import type { Express, Response } from "express";
import { z } from "zod";
import {
  LETTER_SEQUENCE_MAX_LENGTH,
  LETTER_SEQUENCE_EXPLORE_MAX_WORD_LENGTH,
  LETTER_SEQUENCE_TYPES,
} from "@shared/letter-sequence-explore";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { withLetterSequenceExploreSource } from "../explore/letter-sequence-service";

const typeSchema = z.enum(LETTER_SEQUENCE_TYPES);
const sequenceSchema = z.string().trim().min(1).max(LETTER_SEQUENCE_MAX_LENGTH)
  .regex(/^[A-Za-z]+$/)
  .transform((sequence) => sequence.toUpperCase());
const searchSchema = z.object({
  sequence: sequenceSchema,
  length: z.coerce.number().int().min(1).max(LETTER_SEQUENCE_EXPLORE_MAX_WORD_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(512).optional(),
});

function sendExploreError(res: Response, error: unknown, type: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:LetterSequence] Failed to search ${type} matches`, error);
  return res.status(500).json({ message: `Could not search ${type} matches.` });
}

export function registerLetterSequenceExploreRoutes(app: Express): void {
  app.get("/api/explore/letter-sequences/:type", async (req, res) => {
    const type = typeSchema.safeParse(req.params.type);
    const query = searchSchema.safeParse(req.query);
    if (!type.success || !query.success) {
      return res.status(400).json({
        message: `Enter a 1–${LETTER_SEQUENCE_MAX_LENGTH}-letter alphabetic sequence.`,
        errors: {
          type: type.success ? undefined : type.error.flatten(),
          query: query.success ? undefined : query.error.flatten(),
        },
      });
    }

    try {
      const { sequence, limit, cursor, length } = query.data;
      return res.json(await withLetterSequenceExploreSource((source) =>
        source.search(type.data, sequence, limit, cursor, length ?? null),
      ));
    } catch (error) {
      return sendExploreError(res, error, type.data);
    }
  });
}
