import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { createNotificationIfEnabled } from "./helpers";

export function registerTeamRaceRoutes(app: Express): void {
  app.post("/api/team-races", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { challengerGroupId, challengeeGroupId, gameSlug, raceTarget, raceTimeLimit } = req.body;
      if (!challengerGroupId || !challengeeGroupId || !gameSlug) {
        return res.status(400).json({ error: "challengerGroupId, challengeeGroupId, and gameSlug are required" });
      }
      if (challengerGroupId === challengeeGroupId) {
        return res.status(400).json({ error: "Cannot challenge your own group" });
      }
      const { TEAM_RACE_GAME_SLUGS } = await import("@shared/schema");
      if (!TEAM_RACE_GAME_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game is not supported for Team Race" });
      }
      const validRaceTargets = [10, 15, 20, 25, 30];
      const parsedTarget = raceTarget != null ? Number(raceTarget) : 20;
      if (!validRaceTargets.includes(parsedTarget)) {
        return res.status(400).json({ error: "raceTarget must be 10, 15, 20, 25, or 30" });
      }
      const validTimeLimits = [180, 300, 480, 600];
      const parsedTimeLimit = raceTimeLimit != null ? Number(raceTimeLimit) : 300;
      if (!validTimeLimits.includes(parsedTimeLimit)) {
        return res.status(400).json({ error: "raceTimeLimit must be 180, 300, 480, or 600 seconds" });
      }
      const challengerMembership = await storage.getGroupMember(Number(challengerGroupId), userId);
      if (!challengerMembership || (challengerMembership.role !== "owner" && challengerMembership.role !== "admin")) {
        return res.status(403).json({ error: "Only group admins can send Team Race challenges" });
      }
      const challengeeGroup = await storage.getGroup(Number(challengeeGroupId));
      if (!challengeeGroup) return res.status(404).json({ error: "Challengee group not found" });
      const existing = await storage.getTeamRaceChallengesForGroup(Number(challengerGroupId));
      const alreadyPending = existing.some(
        tr => tr.status === "pending" &&
          ((tr.challengerGroupId === Number(challengerGroupId) && tr.challengeeGroupId === Number(challengeeGroupId)) ||
           (tr.challengerGroupId === Number(challengeeGroupId) && tr.challengeeGroupId === Number(challengerGroupId)))
      );
      if (alreadyPending) {
        return res.status(409).json({ error: "There is already a pending Team Race challenge between these groups" });
      }
      const seed = Math.floor(Math.random() * 100000);
      const { teamRaceRegistry } = await import("../team-race-ws");
      const challengerGroup = await storage.getGroup(Number(challengerGroupId));
      const { roomCode, startWord } = teamRaceRegistry.createRoom({
        challengeId: 0,
        challengerGroupId: Number(challengerGroupId),
        challengeeGroupId: Number(challengeeGroupId),
        adminUserIds: [userId],
        gameSlug,
        seed,
        raceTarget: parsedTarget,
        raceTimeLimitMs: parsedTimeLimit * 1000,
      });
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const tr = await storage.createTeamRaceChallenge({
        challengerGroupId: Number(challengerGroupId),
        challengeeGroupId: Number(challengeeGroupId),
        challengerAdminId: userId,
        challengeeAdminId: null,
        gameSlug,
        raceTarget: parsedTarget,
        raceTimeLimit: parsedTimeLimit,
        status: "pending",
        roomCode,
        seed,
        startWord,
        winnerGroupId: null,
        expiresAt,
      });
      const room = teamRaceRegistry.getRoom(roomCode);
      if (room) (room as any).challengeId = tr.id;
      try {
        const challengeeMembers = await storage.getGroupMembers(Number(challengeeGroupId));
        const gameTitle = gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        for (const m of challengeeMembers) {
          if (m.role !== "owner" && m.role !== "admin") continue;
          createNotificationIfEnabled({
            userId: m.userId,
            type: "team_race_challenge_received",
            title: "Team Race challenge!",
            body: `${challengerGroup?.name ?? "Another group"} challenged your group to a ${gameTitle} Team Race`,
            linkUrl: `/groups/${challengeeGroupId}`,
            readAt: null,
          });
        }
      } catch {}
      res.status(201).json(tr);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create Team Race challenge" });
    }
  });

  app.get("/api/groups/:id/team-races", requireAuth, async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user.id;
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member of this group" });
      const teamRaces = await storage.getTeamRaceChallengesForGroup(groupId);
      const enriched = await Promise.all(teamRaces.map(async (tr) => {
        const [cg, eg] = await Promise.all([
          storage.getGroup(tr.challengerGroupId),
          storage.getGroup(tr.challengeeGroupId),
        ]);
        return {
          ...tr,
          challengerGroupName: cg?.name ?? "Unknown Group",
          challengeeGroupName: eg?.name ?? "Unknown Group",
        };
      }));
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch Team Race challenges" });
    }
  });

  app.patch("/api/team-races/:id/accept", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const tr = await storage.getTeamRaceChallenge(id);
      if (!tr) return res.status(404).json({ error: "Team Race challenge not found" });
      if (tr.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      if (tr.expiresAt && new Date(tr.expiresAt) < new Date()) {
        await storage.updateTeamRaceChallenge(id, { status: "cancelled" });
        return res.status(410).json({ error: "Challenge has expired" });
      }
      const membership = await storage.getGroupMember(tr.challengeeGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenged group can accept" });
      }
      if (userId === tr.challengerAdminId) {
        return res.status(400).json({ error: "Cannot accept your own group's challenge" });
      }
      if (tr.roomCode) {
        const { teamRaceRegistry } = await import("../team-race-ws");
        const room = teamRaceRegistry.getRoom(tr.roomCode);
        if (room) room.adminUserIds.add(userId);
      }
      const updated = await storage.updateTeamRaceChallenge(id, { status: "accepted", challengeeAdminId: userId });
      try {
        const [challengerGroup, challengeeGroup] = await Promise.all([
          storage.getGroup(tr.challengerGroupId),
          storage.getGroup(tr.challengeeGroupId),
        ]);
        const gameTitle = tr.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const [cMembers, eeMembers] = await Promise.all([
          storage.getGroupMembers(tr.challengerGroupId),
          storage.getGroupMembers(tr.challengeeGroupId),
        ]);
        for (const m of [...cMembers, ...eeMembers]) {
          createNotificationIfEnabled({
            userId: m.userId,
            type: "team_race_accepted",
            title: "Team Race starting!",
            body: `${challengerGroup?.name ?? "Your group"} vs ${challengeeGroup?.name ?? "another group"} — ${gameTitle} Team Race`,
            linkUrl: tr.roomCode ? `/team-race/${tr.roomCode}` : null,
            readAt: null,
          });
        }
      } catch {}
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to accept Team Race challenge" });
    }
  });

  app.patch("/api/team-races/:id/decline", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const tr = await storage.getTeamRaceChallenge(id);
      if (!tr) return res.status(404).json({ error: "Team Race challenge not found" });
      if (tr.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const membership = await storage.getGroupMember(tr.challengeeGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenged group can decline" });
      }
      const updated = await storage.updateTeamRaceChallenge(id, { status: "declined" });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to decline Team Race challenge" });
    }
  });

  app.patch("/api/team-races/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const tr = await storage.getTeamRaceChallenge(id);
      if (!tr) return res.status(404).json({ error: "Team Race challenge not found" });
      if (tr.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const membership = await storage.getGroupMember(tr.challengerGroupId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return res.status(403).json({ error: "Only admins of the challenger group can cancel" });
      }
      const updated = await storage.updateTeamRaceChallenge(id, { status: "cancelled" });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to cancel Team Race challenge" });
    }
  });

  app.get("/api/team-races/:roomCode/room", async (req: any, res) => {
    try {
      const { roomCode } = req.params;
      const tr = await storage.getTeamRaceChallengeByRoom(roomCode);
      if (!tr) return res.status(404).json({ error: "Team Race room not found" });
      const [cg, eg] = await Promise.all([
        storage.getGroup(tr.challengerGroupId),
        storage.getGroup(tr.challengeeGroupId),
      ]);
      res.json({
        ...tr,
        challengerGroupName: cg?.name ?? "Unknown",
        challengeeGroupName: eg?.name ?? "Unknown",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch Team Race room" });
    }
  });
}
