import express, { type Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import type { IStorage } from "../storage";
import { requireAuth } from "../auth";
import { normalizeUsername, validateUsername } from "@shared/usernames";
import {
  AVATAR_UPLOAD_MIME_TYPES,
  MAX_AVATAR_UPLOAD_BYTES,
} from "@shared/avatar";
import {
  getAvatarStorageDirectory,
  InvalidAvatarImageError,
  removeStoredAvatar,
  storeAvatarImage,
} from "../profile/avatar-storage";

async function cleanStoredAvatar(avatarUrl: string | null | undefined): Promise<void> {
  try {
    await removeStoredAvatar(avatarUrl);
  } catch (error) {
    console.error("[Profile] Failed to remove previous avatar file", error);
  }
}

export function registerProfileRoutes(
  app: Express,
  activityStorage: Pick<IStorage, "getFriendActivity"> = storage,
): void {
  app.use(
    "/uploads/avatars",
    express.static(getAvatarStorageDirectory(), {
      dotfiles: "deny",
      immutable: true,
      index: false,
      maxAge: "1y",
    }),
  );

  app.get("/api/users/search", requireAuth, async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      if (q.length < 2) return res.json([]);
      const results = await storage.searchUsers(q);
      const blockedIds = new Set(await storage.getBlockedUserIds(req.user!.id, results.map((user) => user.id)));
      const filtered = results.filter((user) => user.id !== req.user!.id && !blockedIds.has(user.id));
      const activity = await activityStorage.getFriendActivity(req.user!.id, filtered.map((user) => user.id));
      res.json(filtered.map((user) => ({ ...user, lastActiveAt: activity[user.id] ?? null })));
    } catch (error) {
      console.error("Search users error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.get("/api/users/username-available", async (req, res) => {
    const username = String(req.query.username || "");
    const validationError = validateUsername(username);
    if (validationError) return res.json({ available: false, error: validationError });

    const existing = await storage.getUserByUsername(normalizeUsername(username));
    res.json({ available: !existing || existing.id === req.user?.id });
  });

  app.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(50).optional(),
        username: z.string().optional(),
        avatarUrl: z.union([z.string().url(), z.null()]).optional(),
        bio: z.union([z.string().max(200), z.null()]).optional(),
        hideActivity: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const { name, username, avatarUrl, bio, hideActivity } = parsed.data;
      const updates: { name?: string; username?: string; usernameNormalized?: string; avatarUrl?: string | null; bio?: string | null; hideActivity?: boolean } = {};
      const currentUser = avatarUrl !== undefined
        ? await storage.getUserById(req.user!.id)
        : undefined;
      if (name !== undefined) updates.name = name;
      if (username !== undefined) {
        const validationError = validateUsername(username);
        if (validationError) return res.status(400).json({ error: validationError });
        const normalized = normalizeUsername(username);
        const existing = await storage.getUserByUsername(normalized);
        if (existing && existing.id !== req.user!.id) {
          return res.status(409).json({ error: "That username is already taken" });
        }
        updates.username = normalized;
        updates.usernameNormalized = normalized;
      }
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      if (bio !== undefined) updates.bio = bio;
      if (hideActivity !== undefined) updates.hideActivity = hideActivity;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
      const updated = await storage.updateUser(req.user!.id, updates);
      if (!updated) return res.status(404).json({ error: "User not found" });
      if (avatarUrl !== undefined && avatarUrl !== currentUser?.avatarUrl) {
        await cleanStoredAvatar(currentUser?.avatarUrl);
      }
      res.json({ id: updated.id, username: updated.username, name: updated.name, avatarUrl: updated.avatarUrl ?? null, bio: updated.bio ?? null, hideActivity: updated.hideActivity ?? false });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post(
    "/api/users/me/avatar",
    requireAuth,
    express.raw({
      type: [...AVATAR_UPLOAD_MIME_TYPES],
      limit: MAX_AVATAR_UPLOAD_BYTES,
    }),
    async (req, res) => {
      const image = Buffer.isBuffer(req.body) ? req.body : null;
      if (!image?.length) {
        return res.status(400).json({ error: "Choose a PNG, JPEG, or WebP image." });
      }

      try {
        const currentUser = await storage.getUserById(req.user!.id);
        if (!currentUser) return res.status(404).json({ error: "User not found" });

        let avatarUrl: string;
        try {
          avatarUrl = await storeAvatarImage(image);
        } catch (error) {
          if (error instanceof InvalidAvatarImageError) {
            return res.status(400).json({ error: error.message });
          }
          throw error;
        }

        let updated;
        try {
          updated = await storage.updateUser(req.user!.id, { avatarUrl });
        } catch (error) {
          await cleanStoredAvatar(avatarUrl);
          throw error;
        }

        if (!updated) {
          await cleanStoredAvatar(avatarUrl);
          return res.status(404).json({ error: "User not found" });
        }

        await cleanStoredAvatar(currentUser.avatarUrl);
        res.json({
          id: updated.id,
          username: updated.username,
          name: updated.name,
          avatarUrl: updated.avatarUrl ?? null,
        });
      } catch (error) {
        console.error("[Profile] Avatar upload failed", error);
        res.status(500).json({ error: "Failed to upload avatar" });
      }
    },
  );

  app.delete("/api/users/me", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const currentUser = await storage.getUserById(userId);
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((err) => err ? reject(err) : resolve());
      });
      await storage.deleteUser(userId);
      await cleanStoredAvatar(currentUser?.avatarUrl);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      if (req.user?.id && req.user.id !== id && await storage.isBlockedBetween(req.user.id, id)) {
        return res.status(404).json({ error: "User not found" });
      }
      const profile = await storage.getPublicProfile(id);
      if (!profile) return res.status(404).json({ error: "User not found" });
      const activity = req.user?.id && req.user.id !== id
        ? await activityStorage.getFriendActivity(req.user.id, [id])
        : {};
      profile.user.lastActiveAt = activity[id] ?? null;
      res.json(profile);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.get("/api/users/:id/activity", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });
      if (req.user?.id && req.user.id !== id && await storage.isBlockedBetween(req.user.id, id)) {
        return res.status(404).json({ error: "User not found" });
      }
      const activity = req.user?.id && req.user.id !== id
        ? await activityStorage.getFriendActivity(req.user.id, [id])
        : {};
      res.json({ lastActiveAt: activity[id] ?? null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile activity" });
    }
  });

  app.get("/api/usernames/:username/profile", async (req, res) => {
    try {
      const user = await storage.getUserByUsername(normalizeUsername(req.params.username));
      if (!user) return res.status(404).json({ error: "User not found" });
      if (req.user?.id && req.user.id !== user.id && await storage.isBlockedBetween(req.user.id, user.id)) {
        return res.status(404).json({ error: "User not found" });
      }
      const profile = await storage.getPublicProfile(user.id);
      if (!profile) return res.status(404).json({ error: "User not found" });
      const activity = req.user?.id && req.user.id !== user.id
        ? await activityStorage.getFriendActivity(req.user.id, [user.id])
        : {};
      profile.user.lastActiveAt = activity[user.id] ?? null;
      res.json(profile);
    } catch {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });
}
