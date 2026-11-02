import type { Express } from "express";
import { userReportInputSchema } from "@shared/schema";
import { requireAdmin, requireAuth } from "../auth";
import { userReportLimiter } from "../middleware/security";
import { storage } from "../storage";

function parseUserId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function registerUserSafetyRoutes(app: Express): void {
  app.get("/api/users/me/blocked", requireAuth, async (req, res) => {
    try {
      res.json(await storage.getBlockedUsers(req.user!.id));
    } catch (error) {
      console.error("[User Safety] Failed to load blocked users", error);
      res.status(500).json({ error: "Could not load blocked users" });
    }
  });

  app.post("/api/users/:id/block", requireAuth, async (req, res) => {
    const blockedUserId = parseUserId(req.params.id);
    if (!blockedUserId) return res.status(400).json({ error: "Invalid user ID" });
    if (blockedUserId === req.user!.id) return res.status(400).json({ error: "You cannot block yourself" });

    try {
      if (!await storage.getUserById(blockedUserId)) return res.status(404).json({ error: "User not found" });
      await storage.blockUser(req.user!.id, blockedUserId);
      res.json({ ok: true });
    } catch (error) {
      console.error("[User Safety] Failed to block user", error);
      res.status(500).json({ error: "Could not block this user" });
    }
  });

  app.delete("/api/users/:id/block", requireAuth, async (req, res) => {
    const blockedUserId = parseUserId(req.params.id);
    if (!blockedUserId) return res.status(400).json({ error: "Invalid user ID" });
    try {
      await storage.unblockUser(req.user!.id, blockedUserId);
      res.json({ ok: true });
    } catch (error) {
      console.error("[User Safety] Failed to unblock user", error);
      res.status(500).json({ error: "Could not unblock this user" });
    }
  });

  app.post("/api/users/:id/report", requireAuth, userReportLimiter, async (req, res) => {
    const reportedUserId = parseUserId(req.params.id);
    if (!reportedUserId) return res.status(400).json({ error: "Invalid user ID" });
    if (reportedUserId === req.user!.id) return res.status(400).json({ error: "You cannot report yourself" });
    const parsed = userReportInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid report" });
    }

    try {
      if (!await storage.getUserById(reportedUserId)) return res.status(404).json({ error: "User not found" });
      await storage.createUserReport(req.user!.id, reportedUserId, parsed.data);
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error("[User Safety] Failed to submit user report", error);
      res.status(500).json({ error: "Could not submit this report" });
    }
  });

  app.get("/api/admin/user-reports", requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getUserReports());
    } catch (error) {
      console.error("[User Safety] Failed to load user reports", error);
      res.status(500).json({ error: "Could not load user reports" });
    }
  });

  app.patch("/api/admin/user-reports/:id/read", requireAdmin, async (req, res) => {
    const id = parseUserId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid report ID" });
    try {
      if (!await storage.markUserReportRead(id)) return res.status(404).json({ error: "Report not found" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[User Safety] Failed to mark report read", error);
      res.status(500).json({ error: "Could not mark report as read" });
    }
  });
}
