import type { Express, Response } from "express";
import { z } from "zod";
import { withUnscrambleSource } from "../explore/unscramble-service";
import { InvalidExploreCursorError } from "../explore/shared-types";

const examplesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(8).default(6),
});

const solveSchema = z.object({
  letters: z.string().trim().min(1).max(100).regex(/^[A-Za-z]+$/),
  cursor: z.string().max(512).optional(),
});

function sendUnscrambleError(res: Response, error: unknown, action: string) {
  if (error instanceof InvalidExploreCursorError) return res.status(400).json({ message: error.message });
  console.error(`[Explore:Unscramble] Failed to ${action}`, error);
  return res.status(500).json({ message: `Failed to ${action}` });
}

export function registerUnscrambleExploreRoutes(app: Express): void {
  app.get("/api/explore/unscramble/examples", async (req, res) => {
    const parsed = examplesSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid unscramble example request", errors: parsed.error.flatten() });
    }
    try {
      return res.json(await withUnscrambleSource((source) => source.getExamples(parsed.data.limit)));
    } catch (error) {
      return sendUnscrambleError(res, error, "load scrambled examples");
    }
  });

  app.post("/api/explore/unscramble/solve", async (req, res) => {
    const parsed = solveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Enter letters A–Z to unscramble", errors: parsed.error.flatten() });
    }
    try {
      return res.json(await withUnscrambleSource((source) =>
        source.solve(parsed.data.letters, 100, parsed.data.cursor),
      ));
    } catch (error) {
      return sendUnscrambleError(res, error, "find words for scrambled letters");
    }
  });
}
