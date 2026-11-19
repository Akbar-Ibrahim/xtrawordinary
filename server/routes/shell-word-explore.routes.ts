import type { Express, Response } from "express";
import { z } from "zod";
import {
  SHELL_WORD_EXPLORE_DEPTHS,
  SHELL_WORD_EXPLORE_DEFAULT_PAGE_SIZE,
  SHELL_WORD_EXPLORE_MAX_PAGE_SIZE,
  type ShellWordExploreBrowseInput,
  type ShellWordExploreDepth,
  type ShellWordExploreDirection,
} from "@shared/shell-word-explore";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { withShellWordExploreSource } from "../explore/shell-word-explore-service";

const directionSchema = z.enum(["shell", "inner"]);
const depthSchema = z.coerce.number().int().transform((value) => value as ShellWordExploreDepth)
  .refine((value) => SHELL_WORD_EXPLORE_DEPTHS.includes(value), "Choose a depth from 1 to 4");
const boundarySchema = z.string().trim().min(1).max(4).regex(/^[A-Za-z]+$/)
  .transform((value) => value.toUpperCase());

const browseSchema = z.object({
  depth: depthSchema.default(1),
  direction: directionSchema,
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((value) => value.toUpperCase()).optional(),
  first: boundarySchema.optional(),
  last: boundarySchema.optional(),
  limit: z.coerce.number().int().min(1).max(SHELL_WORD_EXPLORE_MAX_PAGE_SIZE)
    .default(SHELL_WORD_EXPLORE_DEFAULT_PAGE_SIZE),
  cursor: z.string().max(512).optional(),
}).superRefine((input, context) => {
  for (const [key, value] of [["first", input.first], ["last", input.last]] as const) {
    if (value && value.length !== input.depth) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `Enter exactly ${input.depth} letter${input.depth === 1 ? "" : "s"} for this depth`,
      });
    }
  }
});

const checkSchema = z.object({
  depth: depthSchema,
  direction: directionSchema,
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((value) => value.toUpperCase()),
});

function sendError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:ShellWords] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerShellWordExploreRoutes(app: Express): void {
  app.get("/api/explore/shell-words/words", async (req, res) => {
    const parsed = browseSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Choose a valid depth, boundary, and search direction",
        errors: parsed.error.flatten(),
      });
    }

    const input: ShellWordExploreBrowseInput = {
      depth: parsed.data.depth,
      direction: parsed.data.direction as ShellWordExploreDirection,
      ...(parsed.data.word ? { word: parsed.data.word } : {}),
      ...(parsed.data.first ? { first: parsed.data.first } : {}),
      ...(parsed.data.last ? { last: parsed.data.last } : {}),
    };

    try {
      return res.json(await withShellWordExploreSource((source) =>
        source.search(input, parsed.data.limit, parsed.data.cursor),
      ));
    } catch (error) {
      return sendError(res, error, "browse word relationships");
    }
  });

  app.post("/api/explore/shell-words/check", async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter a dictionary word, choose a depth, and select a search direction",
        errors: parsed.error.flatten(),
      });
    }

    try {
      return res.json(await withShellWordExploreSource((source) =>
        source.check({
          depth: parsed.data.depth,
          direction: parsed.data.direction as ShellWordExploreDirection,
          word: parsed.data.word,
        }),
      ));
    } catch (error) {
      return sendError(res, error, "check a word");
    }
  });
}
