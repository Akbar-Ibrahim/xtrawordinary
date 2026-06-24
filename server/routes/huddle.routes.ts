import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { createNotificationIfEnabled } from "./helpers";

export function registerHuddleRoutes(app: Express): void {
  app.post("/api/huddles", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { challengerGroupId, challengeeGroupId, gameSlug, format, raceTarget, raceTimeLimit } = req.body;
      if (!challengerGroupId || !challengeeGroupId || !gameSlug) {
        return res.status(400).json({ error: "challengerGroupId, challengeeGroupId, and gameSlug are required" });
      }
      if (challengerGroupId === challengeeGroupId) {
        return res.status(400).json({ error: "Cannot challenge your own group" });
      }
      const { DUEL_GAME_SLUGS, DUEL_TURN_SLUGS, DUEL_RACE_SLUGS } = await import("@shared/schema");
      if (!DUEL_GAME_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support duels" });
      }
      const duelFormat: "turn" | "race" = format === "race" ? "race" : "turn";
      if (duelFormat === "turn" && !DUEL_TURN_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support turn-based format" });
      }
      if (duelFormat === "race" && !DUEL_RACE_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support race format" });
      }
      const validRaceTargets = [5, 10, 15, 20, 25];
      const parsedRaceTarget = raceTarget != null ? Number(raceTarget) : 15;
      if (!validRaceTargets.includes(parsedRaceTarget)) {
        return res.status(400).json({ error: "raceTarget must be 5, 10, 15, 20, or 25" });
      }
      const validTimeLimits = [180, 300, 600];
      const parsedRaceTimeLimit = raceTimeLimit != null ? Number(raceTimeLimit) : 300;
      if (!validTimeLimits.includes(parsedRaceTimeLimit)) {
        return res.status(400).json({ error: "raceTimeLimit must be 180, 300, or 600 seconds" });
      }
      const challengerMembership = await storage.getGroupMember(Number(challengerGroupId), userId);
      if (!challengerMembership || (challengerMembership.role !== "owner" && challengerMembership.role !== "admin")) {
        return res.status(403).json({ error: "Only group admins can send huddle challenges" });
      }
      const challengeeMembership = await storage.getGroupMember(Number(challengeeGroupId), userId);
      if (challengeeMembership && (challengeeMembership.role === "owner" || challengeeMembership.role === "admin")) {
        return res.status(400).json({ error: "You cannot challenge a group that you are also an admin of" });
      }
      const challengeeGroup = await storage.getGroup(Number(challengeeGroupId));
      if (!challengeeGroup) return res.status(404).json({ error: "Challengee group not found" });
      const existing = await storage.getHuddleChallengesForGroup(Number(challengerGroupId));
      const alreadyPending = existing.some(h =>
        h.status === "pending" &&
        ((h.challengerGroupId === Number(challengerGroupId) && h.challengeeGroupId === Number(challengeeGroupId)) ||
         (h.challengerGroupId === Number(challengeeGroupId) && h.challengeeGroupId === Number(challengerGroupId)))
      );
      if (alreadyPending) {
        return res.status(409).json({ error: "There is already a pending huddle challenge between these groups" });
      }
      const { duelRegistry } = await import("../duel-ws");
      const { roomCode, seed: roomSeed, startWord: roomStartWord } = duelRegistry.createRoom(
        gameSlug, userId, duelFormat, parsedRaceTarget, parsedRaceTimeLimit,
      );
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const huddle = await storage.createHuddleChallenge({
        challengerGroupId: Number(challengerGroupId),
        challengeeGroupId: Number(challengeeGroupId),
        challengerAdminId: userId,
        challengeeAdminId: null,
        gameSlug,
        format: duelFormat,
        raceTarget: parsedRaceTarget,
        raceTimeLimit: parsedRaceTimeLimit,
        status: "pending",
        roomCode,
        seed: roomSeed,
        startWord: roomStartWord,
        expiresAt,
      });
      try {
        const challengeeMembers = await storage.getGroupMembers(Number(challengeeGroupId));
        const challengerGroup = await storage.getGroup(Number(challengerGroupId));
        const gameTitle = gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        for (const m of challengeeMembers) {
          if (m.role === "owner" || m.role === "admin") {
            createNotificationIfEnabled({
              userId: m.userId,
              type: "huddle_challenge_received",
              title: "Your group has been challenged!",
              body: `${challengerGroup?.name ?? "Another group"} challenged your group to a ${gameTitle} Huddle`,
              linkUrl: `/groups/${challengeeGroupId}`,
            });
          }
        }
      } catch {}
      res.status(201).json(huddle);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create huddle challenge" });
    }
  });

  app.get("/api/groups/:id/huddles", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const huddles = await storage.getHuddleChallengesForGroup(groupId);
      const enriched = await Promise.all(huddles.map(async (h) => {
        const [cGroup, eeGroup, cAdmin, eeAdmin] = await Promise.all([
          storage.getGroup(h.challengerGroupId),
          storage.getGroup(h.challengeeGroupId),
          storage.getUserById(h.challengerAdminId),
          h.challengeeAdminId ? storage.getUserById(h.challengeeAdminId) : Promise.resolve(undefined),
        ]);
        return {
          ...h,
          challengerGroupName: cGroup?.name ?? "Unknown",
          challengeeGroupName: eeGroup?.name ?? "Unknown",
          challengerAdminName: cAdmin?.name ?? "Unknown",
          challengeeAdminName: eeAdmin?.name ?? null,
        };
      }));
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch huddle challenges" });
    }
  });

  app.patch("/api/huddles/:id/accept", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const huddle = await storage.getHuddleChallenge(id);
      if (!huddle) return res.status(404).json({ error: "Huddle challenge not found" });
      if (huddle.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      if (huddle.expiresAt && new Date(huddle.expiresAt) < new Date()) {
        await storage.updateHuddleChallenge(id, { status: "cancelled" });
        return res.status(410).json({ error: "Challenge has expired" });
      }
      const membership = await storage.getGroupMember(huddle.challengeeGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenged group can accept" });
      }
      if (userId === huddle.challengerAdminId) {
        return res.status(400).json({ error: "Cannot accept your own group's challenge" });
      }
      const updated = await storage.updateHuddleChallenge(id, { status: "accepted", challengeeAdminId: userId });
      try {
        const challengerGroup = await storage.getGroup(huddle.challengerGroupId);
        const challengeeGroup = await storage.getGroup(huddle.challengeeGroupId);
        const gameTitle = huddle.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        createNotificationIfEnabled({
          userId: huddle.challengerAdminId,
          type: "huddle_accepted",
          title: "Huddle challenge accepted!",
          body: `${challengeeGroup?.name ?? "Another group"} accepted your ${gameTitle} Huddle challenge`,
          linkUrl: huddle.roomCode ? `/duel/${huddle.roomCode}` : `/groups/${huddle.challengerGroupId}`,
        });
        const [cMembers, eeMembers] = await Promise.all([
          storage.getGroupMembers(huddle.challengerGroupId),
          storage.getGroupMembers(huddle.challengeeGroupId),
        ]);
        const allMembers = [...cMembers, ...eeMembers];
        const gameWords = gameTitle;
        for (const m of allMembers) {
          if (m.userId === huddle.challengerAdminId || m.userId === userId) continue;
          createNotificationIfEnabled({
            userId: m.userId,
            type: "huddle_accepted",
            title: "Group Huddle is starting!",
            body: `${challengerGroup?.name ?? "Your group"} vs ${challengeeGroup?.name ?? "another group"} — ${gameWords} Huddle`,
            linkUrl: huddle.roomCode ? `/duel/${huddle.roomCode}` : null,
          });
        }
      } catch {}
      res.json({ ...updated, roomCode: huddle.roomCode });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to accept huddle challenge" });
    }
  });

  app.patch("/api/huddles/:id/decline", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const huddle = await storage.getHuddleChallenge(id);
      if (!huddle) return res.status(404).json({ error: "Huddle challenge not found" });
      if (huddle.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const membership = await storage.getGroupMember(huddle.challengeeGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenged group can decline" });
      }
      if (huddle.roomCode) {
        const { duelRegistry } = await import("../duel-ws");
        duelRegistry.notifyChallengeCancelled(huddle.roomCode, "declined");
      }
      const updated = await storage.updateHuddleChallenge(id, { status: "declined" });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to decline huddle challenge" });
    }
  });

  app.patch("/api/huddles/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const huddle = await storage.getHuddleChallenge(id);
      if (!huddle) return res.status(404).json({ error: "Huddle challenge not found" });
      if (huddle.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const membership = await storage.getGroupMember(huddle.challengerGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenger group can cancel" });
      }
      if (huddle.roomCode) {
        const { duelRegistry } = await import("../duel-ws");
        duelRegistry.notifyChallengeCancelled(huddle.roomCode, "cancelled");
      }
      const updated = await storage.updateHuddleChallenge(id, { status: "cancelled" });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to cancel huddle challenge" });
    }
  });
}
