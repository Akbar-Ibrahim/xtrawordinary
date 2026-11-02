import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { createNotificationIfEnabled } from "./helpers";
import type { FriendSearchResult } from "../friends/discovery";

export function registerFriendsRoutes(app: Express): void {
  app.get("/api/friends/search", requireAuth, async (req, res) => {
    try {
      const query = String(req.query.q ?? "").trim().slice(0, 50);
      if (query.length < 2) return res.json([]);

      const users = (await storage.searchUsers(query)).filter((user) => user.id !== req.user!.id);
      const blockedIds = new Set(await storage.getBlockedUserIds(req.user!.id, users.map((user) => user.id)));
      const visibleUsers = users.filter((user) => !blockedIds.has(user.id));
      const mutualCounts = await storage.getMutualFriendCounts(
        req.user!.id,
        visibleUsers.map((user) => user.id),
      );
      const activity = await storage.getFriendActivity(req.user!.id, visibleUsers.map((user) => user.id));
      const results: FriendSearchResult[] = visibleUsers.map((user) => ({
        ...user,
        mutualFriendsCount: mutualCounts[user.id] ?? 0,
        lastActiveAt: activity[user.id] ?? null,
      }));
      res.json(results);
    } catch {
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.get("/api/friends/suggestions", requireAuth, async (req, res) => {
    try {
      const suggestions = await storage.getFriendSuggestions(req.user!.id);
      const blockedIds = new Set(await storage.getBlockedUserIds(
        req.user!.id,
        suggestions.map((suggestion) => suggestion.id),
      ));
      const visibleSuggestions = suggestions.filter((suggestion) => !blockedIds.has(suggestion.id));
      const activity = await storage.getFriendActivity(req.user!.id, visibleSuggestions.map((suggestion) => suggestion.id));
      res.json(visibleSuggestions.map((suggestion) => ({
        ...suggestion,
        lastActiveAt: activity[suggestion.id] ?? null,
      })));
    } catch {
      res.status(500).json({ error: "Failed to fetch friend suggestions" });
    }
  });

  app.get("/api/friends", requireAuth, async (req, res) => {
    try {
      const friends = await storage.getFriends(req.user!.id);
      res.json(friends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  });

  app.get("/api/friends/requests", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getPendingFriendRequests(req.user!.id);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch friend requests" });
    }
  });

  app.get("/api/friends/requests/sent", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getOutgoingPendingFriendRequests(req.user!.id);
      res.json(requests);
    } catch {
      res.status(500).json({ error: "Failed to fetch sent friend requests" });
    }
  });

  app.post("/api/friends/request", requireAuth, async (req, res) => {
    try {
      if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ error: "Request body must be a JSON object" });
      }
      const { userId, note } = req.body;
      if (!Number.isSafeInteger(userId) || userId <= 0) return res.status(400).json({ error: "Valid userId is required" });
      if (note !== undefined && note !== null && typeof note !== "string") {
        return res.status(400).json({ error: "Note must be a string" });
      }
      if (typeof note === "string" && note.length > 200) {
        return res.status(400).json({ error: "Note must be 200 characters or fewer" });
      }
      if (userId === req.user!.id) return res.status(400).json({ error: "Cannot friend yourself" });
      if (await storage.isBlockedBetween(req.user!.id, userId)) {
        return res.status(403).json({ error: "You cannot interact with this user" });
      }
      const existing = await storage.getFriendship(req.user!.id, userId);
      if (existing) return res.status(400).json({ error: "Friend request already exists" });
      const targetUser = await storage.getUserById(userId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      const normalizedNote = typeof note === "string" ? note.trim() || null : null;
      const friendship = await storage.sendFriendRequest(req.user!.id, userId, normalizedNote);
      createNotificationIfEnabled({
        userId: userId,
        type: "friend_request_received",
        title: "New friend request",
        body: normalizedNote
          ? `@${req.user!.username} wants to be your friend: ${normalizedNote}`
          : `@${req.user!.username} wants to be your friend`,
        linkUrl: "/friends?tab=requests",
      });
      res.json(friendship);
    } catch (error) {
      res.status(500).json({ error: "Failed to send friend request" });
    }
  });

  app.post("/api/friends/:id/accept", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const existing = await storage.getFriendshipById(id);
      if (!existing) return res.status(404).json({ error: "Request not found" });
      if (existing.addresseeId !== req.user!.id) return res.status(403).json({ error: "Not your request" });
      if (await storage.isBlockedBetween(existing.requesterId, existing.addresseeId)) {
        return res.status(404).json({ error: "Request not found" });
      }
      const updated = await storage.acceptFriendRequest(id);
      if (!updated) return res.status(404).json({ error: "Request not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept friend request" });
    }
  });

  app.post("/api/friends/:id/decline", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const existing = await storage.getFriendshipById(id);
      if (!existing) return res.status(404).json({ error: "Request not found" });
      if (existing.addresseeId !== req.user!.id) return res.status(403).json({ error: "Not your request" });
      const updated = await storage.declineFriendRequest(id);
      if (!updated) return res.status(404).json({ error: "Request not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to decline friend request" });
    }
  });

  app.delete("/api/friends/requests/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const existing = await storage.getFriendshipById(id);
      if (!existing) return res.status(404).json({ error: "Request not found" });
      if (existing.requesterId !== req.user!.id) return res.status(403).json({ error: "Not your request" });
      if (existing.status !== "pending") return res.status(409).json({ error: "Request is no longer pending" });
      const cancelled = await storage.cancelFriendRequest(id, req.user!.id);
      if (!cancelled) return res.status(409).json({ error: "Request is no longer pending" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to cancel friend request" });
    }
  });

  app.delete("/api/friends/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const existing = await storage.getFriendshipById(id);
      if (!existing) return res.status(404).json({ error: "Friendship not found" });
      if (existing.requesterId !== req.user!.id && existing.addresseeId !== req.user!.id) return res.status(403).json({ error: "Not your friendship" });
      await storage.removeFriend(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove friend" });
    }
  });
}
