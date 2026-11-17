import type { Express, Response } from "express";
import { z } from "zod";
import {
  WORD_FUSION_EXPLORE_MAX_COMPONENTS,
  WORD_FUSION_EXPLORE_MAX_COMPONENT_LENGTH,
  WORD_FUSION_EXPLORE_MIN_COMPONENTS,
  WORD_FUSION_EXPLORE_MIN_WORD_LENGTH,
} from "@shared/word-fusion-explore";
import { InvalidExploreCursorError } from "../explore/shared-types";
import {
  WordFusionComponentsNotFoundError,
  WordFusionLetterDataMissingError,
} from "../explore/word-fusion-types";
import { withWordFusionExploreSource } from "../explore/word-fusion-service";

const searchSchema = z.object({
  component: z.array(
    z.string().trim().min(WORD_FUSION_EXPLORE_MIN_WORD_LENGTH)
      .max(WORD_FUSION_EXPLORE_MAX_COMPONENT_LENGTH)
      .regex(/^[A-Za-z]+$/)
      .transform((value) => value.toUpperCase()),
  ).min(WORD_FUSION_EXPLORE_MIN_COMPONENTS).max(WORD_FUSION_EXPLORE_MAX_COMPONENTS),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(512).optional(),
});

function sendExploreError(res: Response, error: unknown) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  if (error instanceof WordFusionComponentsNotFoundError) {
    return res.status(404).json({
      message: `These component words were not found in the dictionary: ${error.components.join(", ")}.`,
      missingComponents: error.components,
    });
  }
  if (error instanceof WordFusionLetterDataMissingError) {
    return res.status(503).json({
      message: `Letter-count data is unavailable for ${error.word}. Please check the letter_frequency data.`,
    });
  }
  console.error("[Explore:WordFusion] Failed to find matching words", error);
  return res.status(500).json({ message: "Could not find words for these components." });
}

export function registerWordFusionExploreRoutes(app: Express): void {
  app.get("/api/explore/word-fusion/matches", async (req, res) => {
    const rawComponents = req.query.component;
    const parsed = searchSchema.safeParse({
      ...req.query,
      component: Array.isArray(rawComponents) ? rawComponents : [],
    });
    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter 2–8 component words, each at least two letters long.",
        errors: parsed.error.flatten(),
      });
    }

    try {
      const result = await withWordFusionExploreSource((source) =>
        source.search(parsed.data.component, parsed.data.limit, parsed.data.cursor),
      );
      return res.json(result);
    } catch (error) {
      return sendExploreError(res, error);
    }
  });
}
