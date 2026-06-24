import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { leaderboardInputSchema } from "../validators";

const VALID_TIME_FILTERS = new Set(["today", "week", "all"]);
function parseTimeFilter(raw: unknown): string | undefined {
  if (typeof raw === "string" && VALID_TIME_FILTERS.has(raw) && raw !== "all") return raw;
  return undefined;
}

export function registerLeaderboardRoutes(app: Express): void {
  app.get("/api/leaderboard/streaks", async (req, res) => {
    try {
      const streaks = await storage.getTopStreaks(50);
      res.json(streaks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch streak leaderboard" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const timeFilter = parseTimeFilter(req.query.timeFilter);
      const entries = await storage.getOverallLeaderboard(50, timeFilter);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/leaderboard/:gameSlug/percentile", async (req, res) => {
    try {
      const score = parseInt(req.query.score as string);
      if (isNaN(score)) return res.status(400).json({ error: "Invalid score" });
      const result = await storage.getLeaderboardPercentile(req.params.gameSlug, score);
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to fetch percentile" });
    }
  });

  app.get("/api/leaderboard/:gameSlug/my-rank", requireAuth, async (req, res) => {
    try {
      const { gameSlug } = req.params;
      const timeFilter = parseTimeFilter(req.query.timeFilter);
      const result = await storage.getPlayerRank(gameSlug, req.user!.id, timeFilter);
      if (!result) return res.json(null);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch player rank" });
    }
  });

  app.get("/api/leaderboard/:gameSlug/friends", requireAuth, async (req, res) => {
    try {
      const { gameSlug } = req.params;
      const entries = await storage.getFriendsLeaderboard(gameSlug, req.user!.id);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch friends leaderboard" });
    }
  });

  app.get("/api/leaderboard/:gameSlug", async (req, res) => {
    try {
      const timeFilter = parseTimeFilter(req.query.timeFilter);
      const entries = await storage.getLeaderboard(req.params.gameSlug, 50, timeFilter);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/leaderboard", requireAuth, async (req, res) => {
    try {
      const parsed = leaderboardInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { gameSlug, score } = parsed.data;
      const entry = await storage.saveLeaderboardEntry({
        userId: req.user!.id,
        gameSlug,
        score,
        playerName: req.user!.name,
        playedAt: new Date().toISOString(),
      });
      await storage.incrementGamePlayCount(gameSlug);
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit score" });
    }
  });
}
