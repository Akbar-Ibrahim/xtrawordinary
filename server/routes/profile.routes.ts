import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../auth";

export function registerProfileRoutes(app: Express): void {
  app.get("/api/users/search", requireAuth, async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      if (q.length < 2) return res.json([]);
      const results = await storage.searchUsers(q);
      const filtered = results.filter(u => u.id !== req.user!.id);
      res.json(filtered);
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(50).optional(),
        avatarUrl: z.union([z.string().url(), z.null()]).optional(),
        bio: z.union([z.string().max(200), z.null()]).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const { name, avatarUrl, bio } = parsed.data;
      const updates: { name?: string; avatarUrl?: string | null; bio?: string | null } = {};
      if (name !== undefined) updates.name = name;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      if (bio !== undefined) updates.bio = bio;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
      const updated = await storage.updateUser(req.user!.id, updates);
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ id: updated.id, name: updated.name, avatarUrl: updated.avatarUrl ?? null, bio: updated.bio ?? null });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.delete("/api/users/me", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((err) => err ? reject(err) : resolve());
      });
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      const profile = await storage.getPublicProfile(id);
      if (!profile) return res.status(404).json({ error: "User not found" });
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
}
