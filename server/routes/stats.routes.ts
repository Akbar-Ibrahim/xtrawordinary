import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { statsInputSchema } from "../validators";
import { createNotificationIfEnabled } from "./helpers";

export function registerStatsRoutes(app: Express): void {
  app.get("/api/user/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getAllUserGameStats(req.user!.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.post("/api/user/stats", requireAuth, async (req, res) => {
    try {
      const parsed = statsInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { gameSlug, bestScore, gamesPlayed, gamesWon, wordsFound, lastScore } = parsed.data;
      const stats = await storage.saveUserGameStats({
        userId: req.user!.id,
        gameSlug,
        bestScore,
        gamesPlayed,
        gamesWon,
        wordsFound,
        lastScore: lastScore ?? null,
        lastPlayedAt: new Date().toISOString(),
      });
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to save stats" });
    }
  });

  app.get("/api/user/streak", requireAuth, async (req, res) => {
    try {
      const streak = await storage.getUserStreak(req.user!.id);
      res.json(streak || { currentStreak: 0, longestStreak: 0, lastPlayedDate: null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch streak" });
    }
  });

  app.post("/api/user/streak", requireAuth, async (req, res) => {
    try {
      const { currentStreak, longestStreak, lastPlayedDate } = req.body;
      const streak = await storage.saveUserStreak(req.user!.id, currentStreak || 0, longestStreak || 0, lastPlayedDate || new Date().toISOString().split("T")[0]);
      res.json(streak);
    } catch (error) {
      res.status(500).json({ error: "Failed to save streak" });
    }
  });

  app.get("/api/users/:id/streak", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });
      const streak = await storage.getUserStreak(userId);
      res.json(streak || { currentStreak: 0, longestStreak: 0, lastPlayedDate: null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch streak" });
    }
  });

  app.get("/api/streaks/batch", async (req, res) => {
    try {
      const raw = req.query.userIds as string;
      if (!raw) return res.json({});
      const userIds = raw.split(",").map(Number).filter(n => !isNaN(n) && n > 0);
      if (userIds.length === 0) return res.json({});
      const batch = await storage.getStreakBatch(userIds);
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch streaks" });
    }
  });

  app.get("/api/user/achievements", requireAuth, async (req, res) => {
    try {
      const achievements = await storage.getUserAchievements(req.user!.id);
      res.json(achievements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  });

  app.post("/api/user/achievements", requireAuth, async (req, res) => {
    try {
      const { achievementId, unlockedAt } = req.body;
      if (!achievementId) return res.status(400).json({ error: "achievementId is required" });
      const achievement = await storage.saveUserAchievement(req.user!.id, achievementId, unlockedAt || new Date().toISOString());
      createNotificationIfEnabled({
        userId: req.user!.id,
        type: "achievement_unlocked",
        title: "Achievement unlocked!",
        body: `You earned the "${achievementId.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}" achievement`,
        linkUrl: "/badges",
      });
      res.json(achievement);
    } catch (error) {
      res.status(500).json({ error: "Failed to save achievement" });
    }
  });
}
