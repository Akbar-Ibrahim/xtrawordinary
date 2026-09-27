import type { Express } from "express";
import { gameReportInputSchema, type AdminGameReport } from "@shared/schema";
import { requireAdmin } from "../auth";
import { gameReportLimiter } from "../middleware/security";
import { storage } from "../storage";

export function registerGameReportRoutes(app: Express): void {
  app.post("/api/game-reports", gameReportLimiter, async (req, res) => {
    if (typeof req.body?.website === "string" && req.body.website.trim()) {
      return res.status(201).json({ ok: true });
    }
    const parsed = gameReportInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid report" });
    }

    try {
      const game = await storage.getGameBySlug(parsed.data.gameSlug);
      if (!game) return res.status(404).json({ error: "Game not found" });
      const report = await storage.createGameReport({
        gameSlug: game.slug,
        message: parsed.data.message,
      });
      res.status(201).json({ ok: true, id: report.id });
    } catch (error) {
      console.error("[Game Reports] Failed to save report", error);
      res.status(500).json({ error: "Could not send your report. Please try again." });
    }
  });

  app.get("/api/admin/game-reports", requireAdmin, async (_req, res) => {
    try {
      const [reports, games] = await Promise.all([storage.getGameReports(), storage.getAllGames()]);
      const names = new Map(games.map((game) => [game.slug, game.name]));
      const result: AdminGameReport[] = reports.map((report) => ({
        ...report,
        gameName: names.get(report.gameSlug) ?? report.gameSlug,
      }));
      res.json(result);
    } catch (error) {
      console.error("[Game Reports] Failed to load reports", error);
      res.status(500).json({ error: "Could not load game reports" });
    }
  });

  app.patch("/api/admin/game-reports/:id/read", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid report ID" });
    }
    try {
      if (!await storage.markGameReportRead(id)) return res.status(404).json({ error: "Report not found" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[Game Reports] Failed to mark report read", error);
      res.status(500).json({ error: "Could not mark report as read" });
    }
  });
}