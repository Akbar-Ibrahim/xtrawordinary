import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../auth";
import { notificationTypeSchema } from "@shared/schema";
import { registerNotifSSE, unregisterNotifSSE } from "../notification-sse";

export function registerAdminRoutes(app: Express): void {
  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitized = users.map(u => {
        const { passwordHash, ...rest } = u;
        return rest;
      });
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      if (id === req.user!.id) return res.status(400).json({ error: "Cannot ban yourself" });
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, { isBanned: !user.isBanned });
      if (!updated) return res.status(500).json({ error: "Failed to update user" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle ban" });
    }
  });

  app.patch("/api/admin/users/:id/admin", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      if (id === req.user!.id) return res.status(400).json({ error: "Cannot change your own admin status" });
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, { isAdmin: !user.isAdmin });
      if (!updated) return res.status(500).json({ error: "Failed to update user" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle admin" });
    }
  });

  app.post("/api/users/me/upgrade-premium", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateUser(req.user!.id, { isPremium: true });
      if (!updated) return res.status(500).json({ error: "Failed to upgrade" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch {
      res.status(500).json({ error: "Failed to upgrade" });
    }
  });

  app.post("/api/users/me/downgrade-premium", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateUser(req.user!.id, { isPremium: false });
      if (!updated) return res.status(500).json({ error: "Failed to downgrade" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch {
      res.status(500).json({ error: "Failed to downgrade" });
    }
  });

  app.patch("/api/admin/users/:id/premium", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUser(id, { isPremium: !user.isPremium });
      if (!updated) return res.status(500).json({ error: "Failed to update user" });
      const { passwordHash, ...rest } = updated;
      res.json(rest);
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle premium" });
    }
  });

  app.get("/api/admin/leaderboard", requireAdmin, async (_req, res) => {
    try {
      const entries = await storage.getAllLeaderboardEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaderboard entries" });
    }
  });

  app.get("/api/admin/groups", requireAdmin, async (_req, res) => {
    try {
      const groups = await storage.getAllGroups();
      res.json(groups);
    } catch {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.get("/api/admin/games", requireAdmin, async (_req, res) => {
    try {
      const games = await storage.getAllGames();
      res.json(games);
    } catch {
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.patch("/api/admin/games/:slug/active", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive must be a boolean" });
      const game = await storage.getGameBySlug(slug);
      if (!game) return res.status(404).json({ error: "Game not found" });
      await storage.setGameActive(slug, isActive);
      res.json({ success: true, slug, isActive });
    } catch {
      res.status(500).json({ error: "Failed to update game" });
    }
  });

  app.delete("/api/admin/leaderboard/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid entry ID" });
      await storage.deleteLeaderboardEntry(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  // Site announcements
  app.get("/api/site/announcement", async (_req, res) => {
    try {
      const text = await storage.getSiteSetting("announcement");
      res.json({ text: text ?? null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch announcement" });
    }
  });

  app.post("/api/site/announcement", requireAdmin, async (req, res) => {
    try {
      const { text } = req.body;
      if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "text is required" });
      }
      if (text.trim().length > 300) {
        return res.status(400).json({ error: "Announcement cannot exceed 300 characters" });
      }
      await storage.setSiteSetting("announcement", text.trim());
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save announcement" });
    }
  });

  app.delete("/api/site/announcement", requireAdmin, async (_req, res) => {
    try {
      await storage.setSiteSetting("announcement", null);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove announcement" });
    }
  });

  // Notification preferences
  app.get("/api/notification-preferences", requireAuth, async (req, res) => {
    try {
      const prefs = await storage.getNotificationPreferences(req.user!.id);
      res.json(prefs);
    } catch {
      res.status(500).json({ error: "Failed to fetch notification preferences" });
    }
  });

  app.patch("/api/notification-preferences/:type", requireAuth, async (req, res) => {
    try {
      const type = req.params.type;
      const parsed = notificationTypeSchema.safeParse(type);
      if (!parsed.success) return res.status(400).json({ error: "Invalid notification type" });
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });
      await storage.setNotificationPreference(req.user!.id, parsed.data, enabled);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to update notification preference" });
    }
  });

  app.patch("/api/notification-preferences", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });
      await storage.setAllNotificationPreferences(req.user!.id, enabled);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to update notification preferences" });
    }
  });

  // Notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getNotifications(req.user!.id, 30);
      res.json(notifications);
    } catch {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user!.id);
      res.json({ count });
    } catch {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      await storage.markNotificationRead(id, req.user!.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.user!.id);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to mark all notifications read" });
    }
  });

  // Notification SSE stream
  app.get("/api/notifications/stream", requireAuth, (req: any, res) => {
    const userId = req.user.id as number;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    registerNotifSSE(userId, res);

    const pingInterval = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(pingInterval);
      }
    }, 25000);

    res.on("close", () => {
      clearInterval(pingInterval);
      unregisterNotifSSE(userId, res);
    });
  });
}
