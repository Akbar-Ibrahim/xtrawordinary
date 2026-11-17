import type { Express, Response } from "express";
import { z } from "zod";
import type {
  ShellWordExploreBrowseInput,
  ShellWordExploreDepth,
  ShellWordExploreDirection,
} from "@shared/shell-word-explore";
import { InvalidExploreCursorError } from "../explore/shared-types";
import { withShellWordExploreSource } from "../explore/shell-word-explore-service";

const directionSchema = z.enum(["shell", "inner"]);

function letterBoundarySchema(depth: ShellWordExploreDepth) {
  return z.string().trim().length(depth).regex(new RegExp(`^[A-Za-z]{${depth}}$`))
    .transform((value) => value.toUpperCase());
}

function createBrowseSchema(depth: ShellWordExploreDepth) {
  return z.object({
    direction: directionSchema,
    word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
      .transform((value) => value.toUpperCase()).optional(),
    first: letterBoundarySchema(depth).optional(),
    last: letterBoundarySchema(depth).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(512).optional(),
  });
}

const checkSchema = z.object({
  direction: directionSchema,
  word: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/)
    .transform((value) => value.toUpperCase()),
});

function sendError(res: Response, error: unknown, gameLabel: string, action: string) {
  if (error instanceof InvalidExploreCursorError) {
    return res.status(400).json({ message: error.message });
  }
  console.error(`[Explore:${gameLabel}] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

function registerRoutesForDepth(
  app: Express,
  gameSlug: string,
  gameLabel: string,
  depth: ShellWordExploreDepth,
): void {
  const browseSchema = createBrowseSchema(depth);
  const basePath = `/api/explore/${gameSlug}`;

  app.get(`${basePath}/words`, async (req, res) => {
    const parsed = browseSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        message: `Choose a valid ${depth === 1 ? "one-letter" : "two-letter"} boundary and search direction`,
        errors: parsed.error.flatten(),
      });
    }

    const input: ShellWordExploreBrowseInput = {
      direction: parsed.data.direction as ShellWordExploreDirection,
      ...(parsed.data.word ? { word: parsed.data.word } : {}),
      ...(parsed.data.first ? { first: parsed.data.first } : {}),
      ...(parsed.data.last ? { last: parsed.data.last } : {}),
    };

    try {
      return res.json(await withShellWordExploreSource(depth, (source) =>
        source.search(input, parsed.data.limit, parsed.data.cursor),
      ));
    } catch (error) {
      return sendError(res, error, gameLabel, "browse word relationships");
    }
  });

  app.post(`${basePath}/check`, async (req, res) => {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter a dictionary word and choose a search direction",
        errors: parsed.error.flatten(),
      });
    }

    try {
      return res.json(await withShellWordExploreSource(depth, (source) =>
        source.check({
          direction: parsed.data.direction as ShellWordExploreDirection,
          word: parsed.data.word,
        }),
      ));
    } catch (error) {
      return sendError(res, error, gameLabel, "check a word");
    }
  });
}

export function registerShellWordExploreRoutes(app: Express): void {
  registerRoutesForDepth(app, "shell-words", "ShellWords", 1);
  registerRoutesForDepth(app, "deep-shell-words", "DeepShellWords", 2);
}
