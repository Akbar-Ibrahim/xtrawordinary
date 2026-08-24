import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { SEEDED_GAME_SLUGS } from "@shared/schema";
import { createNotificationIfEnabled } from "./helpers";

export function registerChallengesRoutes(app: Express): void {
  app.post("/api/challenges", requireAuth, async (req, res) => {
    try {
      const { friendId, gameSlug, score, message, seed, gameConfig } = req.body;
      if (!friendId || typeof friendId !== "number") return res.status(400).json({ error: "Valid friendId is required" });
      if (friendId === req.user!.id) return res.status(400).json({ error: "You cannot challenge yourself" });
      if (!gameSlug || typeof gameSlug !== "string") return res.status(400).json({ error: "Valid gameSlug is required" });
      if (!SEEDED_GAME_SLUGS.has(gameSlug)) return res.status(400).json({ error: "Game does not support challenges" });
      if (score === undefined || typeof score !== "number" || score < 0) return res.status(400).json({ error: "Valid non-negative score is required" });
      if (message && typeof message === "string" && message.length > 200) return res.status(400).json({ error: "Message too long (max 200 chars)" });
      if (seed !== undefined && (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > 2147483647)) return res.status(400).json({ error: "Seed must be a non-negative integer" });
      const targetUser = await storage.getUserById(friendId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      const existing = await storage.getPendingFriendChallenge(req.user!.id, friendId, gameSlug);
      if (existing) return res.status(409).json({ error: "You already have a pending challenge for this game with that player" });
      const configJson = (gameSlug === "letter-balance" && gameConfig && typeof gameConfig === "object")
        ? JSON.stringify(gameConfig)
        : null;
      const challenge = await storage.createFriendChallenge({
        senderId: req.user!.id,
        receiverId: friendId,
        gameSlug,
        senderScore: score,
        receiverScore: null,
        status: "pending",
        message: message || null,
        seed: typeof seed === "number" ? seed : null,
        gameConfig: configJson,
        senderViewed: false,
        receiverViewed: false,
      });
      try {
        const senderName = `@${(req.user as any).username as string}`;
        const gameTitle = gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        createNotificationIfEnabled({
          userId: friendId,
          type: "friend_challenge_received",
          title: `${senderName} challenged you!`,
          body: `${senderName} wants you to beat their ${gameTitle} score`,
          linkUrl: "/friends?tab=challenges",
        });
      } catch {}
      res.json(challenge);
    } catch (error) {
      res.status(500).json({ error: "Failed to create challenge" });
    }
  });

  app.get("/api/challenges", requireAuth, async (req, res) => {
    try {
      const challenges = await storage.getFriendChallenges(req.user!.id);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = challenges.filter((c) => {
        if (c.status !== "declined" && c.status !== "cancelled") return true;
        const createdAt = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        return createdAt >= cutoff;
      });
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  app.get("/api/challenges/unread-count", requireAuth, async (req, res) => {
    try {
      const challenges = await storage.getFriendChallenges(req.user!.id);
      const resultCount = challenges.filter(
        (c) => c.status === "completed" && c.senderId === req.user!.id && !c.senderViewed
      ).length;
      const pendingCount = challenges.filter(
        (c) => c.status === "pending" && c.receiverId === req.user!.id
      ).length;
      const sentPendingCount = challenges.filter(
        (c) => c.status === "pending" && c.senderId === req.user!.id
      ).length;
      res.json({ count: resultCount + pendingCount + sentPendingCount, resultCount, pendingCount, sentPendingCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.get("/api/challenges/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const challenge = await storage.getFriendChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.senderId !== req.user!.id && challenge.receiverId !== req.user!.id) {
        return res.status(403).json({ error: "Not your challenge" });
      }
      if (challenge.receiverId === req.user!.id && !challenge.receiverViewed) {
        await storage.markChallengeReceiverViewed(id);
        challenge.receiverViewed = true;
      }
      res.json(challenge);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  });

  app.post("/api/challenges/:id/complete", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const { score } = req.body;
      if (score === undefined || typeof score !== "number" || score < 0) return res.status(400).json({ error: "Valid non-negative score is required" });
      const challenge = await storage.getFriendChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.receiverId !== req.user!.id) return res.status(403).json({ error: "Not your challenge" });
      if (challenge.status !== "pending") return res.status(400).json({ error: "Challenge is no longer pending" });
      const updated = await storage.completeFriendChallenge(id, score);
      if (challenge.senderId && challenge.senderId !== req.user!.id) {
        try {
          const receiverName = `@${(req.user as any).username as string}`;
          const gameTitle = challenge.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          createNotificationIfEnabled({
            userId: challenge.senderId,
            type: "friend_challenge_result",
            title: "Challenge result ready",
            body: `${receiverName} completed your ${gameTitle} challenge`,
            linkUrl: "/friends?tab=challenges",
          });
        } catch {}
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete challenge" });
    }
  });

  app.post("/api/challenges/:id/cancel", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const challenge = await storage.getFriendChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.senderId !== req.user!.id) return res.status(403).json({ error: "Only the sender can cancel" });
      if (challenge.status !== "pending") return res.status(400).json({ error: "Only pending challenges can be cancelled" });
      const updated = await storage.cancelFriendChallenge(id);
      const senderName = `@${(req.user as any).username as string}`;
      const gameTitle = challenge.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      try {
        createNotificationIfEnabled({
          userId: challenge.senderId,
          type: "friend_challenge_cancelled",
          title: "Challenge cancelled",
          body: `Your ${gameTitle} challenge has been cancelled`,
          linkUrl: "/friends?tab=challenges",
        });
      } catch {}
      try {
        createNotificationIfEnabled({
          userId: challenge.receiverId,
          type: "friend_challenge_cancelled",
          title: "Challenge withdrawn",
          body: `${senderName} cancelled their ${gameTitle} challenge`,
          linkUrl: "/friends?tab=challenges",
        });
      } catch {}
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel challenge" });
    }
  });

  app.post("/api/challenges/:id/decline", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const challenge = await storage.getFriendChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.receiverId !== req.user!.id) return res.status(403).json({ error: "Only the receiver can decline" });
      if (challenge.status !== "pending") return res.status(400).json({ error: "Only pending challenges can be declined" });
      const updated = await storage.declineFriendChallenge(id);
      if (challenge.senderId) {
        try {
          const receiverName = `@${(req.user as any).username as string}`;
          const gameTitle = challenge.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          createNotificationIfEnabled({
            userId: challenge.senderId,
            type: "friend_challenge_declined",
            title: "Challenge declined",
            body: `${receiverName} declined your ${gameTitle} challenge`,
            linkUrl: "/friends?tab=challenges",
          });
        } catch {}
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to decline challenge" });
    }
  });

  app.post("/api/challenges/:id/viewed", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const challenge = await storage.getFriendChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.senderId !== req.user!.id) return res.status(403).json({ error: "Only the sender can mark as viewed" });
      if (challenge.status !== "completed") return res.status(400).json({ error: "Only completed challenges can be marked as viewed" });
      await storage.markChallengeViewed(id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark challenge as viewed" });
    }
  });
}
