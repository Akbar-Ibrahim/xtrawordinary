import type { Express } from "express";
import type { GroupRound } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { createNotificationIfEnabled } from "./helpers";

function isRoundPastDeadline(round: GroupRound): boolean {
  return !!round.closesAt && new Date(round.closesAt).getTime() <= Date.now();
}

function withEffectiveStatus(round: GroupRound): GroupRound {
  if (round.status === "active" && isRoundPastDeadline(round)) {
    return { ...round, status: "closed" };
  }
  return round;
}

function isRoundActive(round: GroupRound): boolean {
  return round.status === "active" && !isRoundPastDeadline(round);
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const CHALLENGE_GAME_SLUGS = [
  "word-ladder", "anagram-solver", "word-scramble", "definition-match",
  "letter-pool", "word-maker", "word-length", "letter-position",
  "letter-hunt", "letter-balance", "letter-frequency", "no-repeats",
  "word-sweep", "word-roots", "shell-words", "deep-shell-words",
];

export function registerGroupsRoutes(app: Express): void {
  app.get("/api/groups/my/admin", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const myGroups = await storage.getUserGroups(userId);
      const adminGroups: typeof myGroups = [];
      for (const g of myGroups) {
        const membership = await storage.getGroupMember(g.id, userId);
        if (membership && (membership.role === "owner" || membership.role === "admin")) {
          adminGroups.push(g);
        }
      }
      res.json(adminGroups);
    } catch (err) {
      console.error("[groups] admin-groups error", err);
      res.status(500).json({ error: "Failed to fetch admin groups" });
    }
  });

  app.get("/api/groups/browse", async (req, res) => {
    try {
      let allPublic = await storage.getPublicGroups();
      const tagFilter = req.query.tag as string | undefined;
      if (tagFilter) {
        allPublic = allPublic.filter(g => Array.isArray(g.tags) && g.tags.includes(tagFilter));
      }
      res.json(allPublic);
    } catch {
      res.status(500).json({ error: "Failed to browse groups" });
    }
  });

  app.get("/api/groups", async (req, res) => {
    try {
      let publicGroups = await storage.getPublicGroups();
      const tagFilter = req.query.tag as string | undefined;
      if (tagFilter) {
        publicGroups = publicGroups.filter(g => Array.isArray(g.tags) && g.tags.includes(tagFilter));
      }
      if (!req.isAuthenticated()) {
        return res.json({ myGroups: [], discover: publicGroups, featured: publicGroups.filter(g => g.isFeatured) });
      }
      const userId = (req.user as any).id;
      const myGroups = await storage.getUserGroups(userId);
      const myGroupIds = new Set(myGroups.map((g: any) => g.id));
      const discover = publicGroups.filter((g: any) => !myGroupIds.has(g.id));
      const featured = publicGroups.filter(g => g.isFeatured && !myGroupIds.has(g.id));
      res.json({ myGroups, discover, featured });
    } catch {
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.post("/api/groups", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name, description, isPublic, tags, pinnedAnnouncement } = req.body;
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Group name must be at least 2 characters" });
      }
      const ALLOWED_TAGS = ["School", "Office", "Family", "Friends", "Gaming", "Book Club", "Other"];
      const sanitizedTags: string[] = Array.isArray(tags)
        ? tags.filter((t: any) => ALLOWED_TAGS.includes(t)).slice(0, 3)
        : [];
      let inviteCode = generateInviteCode();
      let attempts = 0;
      while (await storage.getGroupByInviteCode(inviteCode) && attempts < 10) {
        inviteCode = generateInviteCode();
        attempts++;
      }
      const group = await storage.createGroup({
        name: name.trim(),
        description: description?.trim() || null,
        creatorId: userId,
        inviteCode,
        isPublic: Boolean(isPublic),
        tags: sanitizedTags,
        pinnedAnnouncement: typeof pinnedAnnouncement === "string" && pinnedAnnouncement.trim() ? pinnedAnnouncement.trim() : null,
        isFeatured: false,
      });
      await storage.addGroupMember(group.id, userId, "owner");
      res.status(201).json(group);
    } catch {
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.post("/api/groups/join", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { inviteCode } = req.body;
      if (!inviteCode) return res.status(400).json({ error: "Invite code required" });
      const group = await storage.getGroupByInviteCode(inviteCode.trim().toUpperCase());
      if (!group) return res.status(404).json({ error: "Invalid invite code" });
      const existing = await storage.getGroupMember(group.id, userId);
      if (existing) return res.status(409).json({ error: "Already a member" });
      await storage.addGroupMember(group.id, userId, "member");
      await storage.logGroupActivity(group.id, userId, "joined", { name: (req.user as any).name });
      try {
        const allMembers = await storage.getGroupMembers(group.id);
        const joinerName = (req.user as any).name as string;
        for (const m of allMembers) {
          if (m.userId !== userId && (m.role === "owner" || m.role === "admin")) {
            createNotificationIfEnabled({
              userId: m.userId,
              type: "group_join",
              title: "New member joined your group",
              body: `${joinerName} joined "${group.name}"`,
              linkUrl: `/groups/${group.id}`,
            });
          }
        }
      } catch {}
      res.json(group);
    } catch {
      res.status(500).json({ error: "Failed to join group" });
    }
  });

  app.post("/api/groups/join-public/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ error: "Group not found" });
      if (!group.isPublic) return res.status(403).json({ error: "Group is not public" });
      const existing = await storage.getGroupMember(groupId, userId);
      if (existing) return res.status(409).json({ error: "Already a member" });
      await storage.addGroupMember(groupId, userId, "member");
      await storage.logGroupActivity(groupId, userId, "joined", { name: (req.user as any).name });
      try {
        const allMembers = await storage.getGroupMembers(groupId);
        const joinerName = (req.user as any).name as string;
        for (const m of allMembers) {
          if (m.userId !== userId && (m.role === "owner" || m.role === "admin")) {
            createNotificationIfEnabled({
              userId: m.userId,
              type: "group_join",
              title: "New member joined your group",
              body: `${joinerName} joined "${group.name}"`,
              linkUrl: `/groups/${groupId}`,
            });
          }
        }
      } catch {}
      res.json(group);
    } catch {
      res.status(500).json({ error: "Failed to join group" });
    }
  });

  app.get("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ error: "Group not found" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership && !group.isPublic) return res.status(403).json({ error: "Not a member" });
      res.json({ group, membership: membership || null });
    } catch {
      res.status(500).json({ error: "Failed to fetch group" });
    }
  });

  app.patch("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const { name, description, isPublic, tags, pinnedAnnouncement } = req.body;
      const updates: Record<string, any> = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (isPublic !== undefined) updates.isPublic = Boolean(isPublic);
      const ALLOWED_TAGS = ["School", "Office", "Family", "Friends", "Gaming", "Book Club", "Other"];
      if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags.filter((t: any) => ALLOWED_TAGS.includes(t)).slice(0, 3) : [];
      if (pinnedAnnouncement !== undefined) updates.pinnedAnnouncement = pinnedAnnouncement?.trim() || null;
      const updated = await storage.updateGroup(groupId, updates);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update group" });
    }
  });

  app.patch("/api/groups/:id/feature", requireAuth, async (req, res) => {
    try {
      if (!(req.user as any).isAdmin) return res.status(403).json({ error: "Site admin only" });
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const { isFeatured } = req.body;
      const updated = await storage.setGroupFeatured(groupId, Boolean(isFeatured));
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update featured status" });
    }
  });

  app.delete("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || membership.role !== "owner") {
        return res.status(403).json({ error: "Only the owner can delete the group" });
      }
      await storage.deleteGroup(groupId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  app.post("/api/groups/:id/leave", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(400).json({ error: "Not a member" });
      if (membership.role === "owner") return res.status(400).json({ error: "Owner cannot leave. Delete the group instead." });
      await storage.removeGroupMember(groupId, userId);
      await storage.logGroupActivity(groupId, userId, "left", { name: (req.user as any).name });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to leave group" });
    }
  });

  app.get("/api/groups/:id/members", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const members = await storage.getGroupMembers(groupId);
      res.json(members);
    } catch {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.patch("/api/groups/:id/members/:userId/role", requireAuth, async (req, res) => {
    try {
      const requestingUserId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      if (isNaN(groupId) || isNaN(targetUserId)) return res.status(400).json({ error: "Invalid ID" });
      const requesterMembership = await storage.getGroupMember(groupId, requestingUserId);
      if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
        return res.status(403).json({ error: "Only owners and admins can change roles" });
      }
      const { role } = req.body;
      if (!["admin", "member"].includes(role)) return res.status(400).json({ error: "Invalid role" });
      const targetMembership = await storage.getGroupMember(groupId, targetUserId);
      if (!targetMembership) return res.status(404).json({ error: "Member not found" });
      if (targetMembership.role === "owner") return res.status(403).json({ error: "Cannot change the owner's role" });
      if (requesterMembership.role === "admin" && targetMembership.role === "admin" && role === "member") {
        return res.status(403).json({ error: "Admins cannot demote other admins; only the owner can" });
      }
      const updated = await storage.updateGroupMemberRole(groupId, targetUserId, role);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/groups/:id/members/:userId", requireAuth, async (req, res) => {
    try {
      const requestingUserId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);
      if (isNaN(groupId) || isNaN(targetUserId)) return res.status(400).json({ error: "Invalid ID" });
      const requesterMembership = await storage.getGroupMember(groupId, requestingUserId);
      if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const targetMembershipForDelete = await storage.getGroupMember(groupId, targetUserId);
      if (targetMembershipForDelete?.role === "owner") {
        return res.status(403).json({ error: "Cannot remove the group owner" });
      }
      if (requesterMembership.role === "admin" && targetMembershipForDelete?.role === "admin") {
        return res.status(403).json({ error: "Admins cannot remove other admins; only the owner can" });
      }
      await storage.removeGroupMember(groupId, targetUserId);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.get("/api/groups/:id/rounds", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const rounds = await storage.getGroupRounds(groupId);
      res.json(rounds.map(withEffectiveStatus));
    } catch {
      res.status(500).json({ error: "Failed to fetch rounds" });
    }
  });

  app.post("/api/groups/:id/rounds", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return res.status(403).json({ error: "Only admins can create rounds" });
      }
      const { gameSlug, closesAt, gameConfig } = req.body;
      const slug = gameSlug && CHALLENGE_GAME_SLUGS.includes(gameSlug) ? gameSlug : CHALLENGE_GAME_SLUGS[Math.floor(Math.random() * CHALLENGE_GAME_SLUGS.length)];
      const seed = Math.floor(Math.random() * 2147483647);
      const configJson = ((slug === "letter-frequency" || slug === "letter-balance") && gameConfig && typeof gameConfig === "object")
        ? JSON.stringify(gameConfig)
        : null;
      const round = await storage.createGroupRound({
        groupId,
        gameSlug: slug,
        seed,
        status: "active",
        createdById: userId,
        closesAt: closesAt || null,
        gameConfig: configJson,
      });
      await storage.logGroupActivity(groupId, userId, "round_started", { gameSlug: slug, roundId: round.id, name: (req.user as any).name });
      try {
        const group = await storage.getGroup(groupId);
        const members = await storage.getGroupMembers(groupId);
        const creatorName = (req.user as any).name as string;
        const gameTitle = slug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        for (const m of members) {
          if (m.userId !== userId) {
            createNotificationIfEnabled({
              userId: m.userId,
              type: "group_round_start",
              title: "New group round started",
              body: `${creatorName} started a ${gameTitle} round in "${group?.name ?? "your group"}"`,
              linkUrl: `/groups/${groupId}`,
            });
          }
        }
      } catch {}
      res.status(201).json(round);
    } catch {
      res.status(500).json({ error: "Failed to create round" });
    }
  });

  app.get("/api/groups/:id/rounds/:roundId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      const myScore = await storage.getUserGroupRoundScore(roundId, userId);
      res.json({ round: withEffectiveStatus(round), myScore: myScore || null });
    } catch {
      res.status(500).json({ error: "Failed to fetch round" });
    }
  });

  app.post("/api/groups/:id/rounds/:roundId/attempt", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      if (!isRoundActive(round)) return res.status(400).json({ error: "Round is not active" });
      const attempt = await storage.createGroupRoundAttempt(roundId, userId);
      res.json(attempt);
    } catch {
      res.status(500).json({ error: "Failed to record attempt" });
    }
  });

  app.get("/api/groups/:id/rounds/:roundId/attempt", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      const attempt = await storage.getGroupRoundAttempt(roundId, userId);
      res.json({ attempt: attempt || null });
    } catch {
      res.status(500).json({ error: "Failed to fetch attempt" });
    }
  });

  app.post("/api/groups/:id/rounds/:roundId/score", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      if (!isRoundActive(round)) return res.status(400).json({ error: "Round is not active" });
      const { score, durationMs } = req.body;
      if (typeof score !== "number") return res.status(400).json({ error: "Score required" });
      const existing = await storage.getUserGroupRoundScore(roundId, userId);
      if (existing) return res.status(409).json({ error: "Score already submitted" });
      const result = await storage.submitGroupRoundScore(roundId, userId, score, typeof durationMs === "number" ? durationMs : undefined);
      await storage.logGroupActivity(groupId, userId, "score_submitted", { score, gameSlug: round.gameSlug, roundId, name: (req.user as any).name });
      res.json(result);
    } catch {
      res.status(500).json({ error: "Failed to submit score" });
    }
  });

  app.get("/api/groups/:id/rounds/:roundId/scores", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      const scores = await storage.getGroupRoundScores(roundId);
      res.json(scores);
    } catch {
      res.status(500).json({ error: "Failed to fetch scores" });
    }
  });

  app.patch("/api/groups/:id/rounds/:roundId/close", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found" });
      const closed = await storage.closeGroupRound(roundId);
      await storage.logGroupActivity(groupId, userId, "round_closed", { gameSlug: round.gameSlug, roundId, name: (req.user as any).name });
      res.json(closed);
    } catch {
      res.status(500).json({ error: "Failed to close round" });
    }
  });

  app.get("/api/groups/:id/leaderboard", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const leaderboard = await storage.getGroupLeaderboard(groupId);
      res.json(leaderboard);
    } catch {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.get("/api/groups/:id/seasons", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const seasons = await storage.getGroupSeasons(groupId);
      res.json(seasons);
    } catch {
      res.status(500).json({ error: "Failed to fetch seasons" });
    }
  });

  app.post("/api/groups/:id/seasons", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || membership.role !== "admin") return res.status(403).json({ error: "Admin only" });
      const { name, startsAt, endsAt } = req.body;
      if (!name || !startsAt || !endsAt) return res.status(400).json({ error: "name, startsAt, endsAt required" });
      const existing = await storage.getGroupSeasons(groupId);
      if (existing.some(s => s.status === "active")) return res.status(409).json({ error: "A season is already active" });
      const season = await storage.createGroupSeason({ groupId, name, startsAt, endsAt, status: "active" });
      res.status(201).json(season);
    } catch {
      res.status(500).json({ error: "Failed to create season" });
    }
  });

  app.get("/api/groups/:id/seasons/:seasonId/leaderboard", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const seasonId = parseInt(req.params.seasonId);
      if (isNaN(groupId) || isNaN(seasonId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const season = await storage.getGroupSeason(seasonId);
      if (!season || season.groupId !== groupId) return res.status(404).json({ error: "Season not found" });
      const leaderboard = await storage.getGroupSeasonLeaderboard(groupId, season.startsAt, season.endsAt);
      res.json(leaderboard);
    } catch {
      res.status(500).json({ error: "Failed to fetch season leaderboard" });
    }
  });

  app.patch("/api/groups/:id/seasons/:seasonId/end", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const seasonId = parseInt(req.params.seasonId);
      if (isNaN(groupId) || isNaN(seasonId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership || membership.role !== "admin") return res.status(403).json({ error: "Admin only" });
      const season = await storage.getGroupSeason(seasonId);
      if (!season || season.groupId !== groupId) return res.status(404).json({ error: "Season not found" });
      if (season.status === "ended") return res.status(400).json({ error: "Season already ended" });
      const lb = await storage.getGroupSeasonLeaderboard(groupId, season.startsAt, season.endsAt);
      const winner = lb[0] || null;
      const updated = await storage.endGroupSeason(seasonId, winner?.userId ?? null, winner?.name ?? null);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to end season" });
    }
  });

  app.get("/api/groups/:id/rounds/:roundId/reactions", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      if (isNaN(groupId) || isNaN(roundId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found in this group" });
      const reactions = await storage.getGroupRoundReactions(roundId);
      res.json(reactions);
    } catch {
      res.status(500).json({ error: "Failed to fetch reactions" });
    }
  });

  app.post("/api/groups/:id/rounds/:roundId/scores/:scoreId/reactions", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      const scoreId = parseInt(req.params.scoreId);
      if (isNaN(groupId) || isNaN(roundId) || isNaN(scoreId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found in this group" });
      const scores = await storage.getGroupRoundScores(roundId);
      const score = scores.find(s => s.id === scoreId);
      if (!score) return res.status(404).json({ error: "Score not found in this round" });
      const { emoji } = req.body;
      const ALLOWED_EMOJIS = ["🔥", "❤️", "😂", "👏"];
      if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ error: "Invalid emoji" });
      const reaction = await storage.addGroupReaction(roundId, scoreId, userId, emoji);
      await storage.logGroupActivity(groupId, userId, "reaction", { emoji, scoreId, name: (req.user as any).name });
      res.json(reaction);
    } catch {
      res.status(500).json({ error: "Failed to add reaction" });
    }
  });

  app.delete("/api/groups/:id/rounds/:roundId/scores/:scoreId/reactions/:emoji", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      const roundId = parseInt(req.params.roundId);
      const scoreId = parseInt(req.params.scoreId);
      if (isNaN(groupId) || isNaN(roundId) || isNaN(scoreId)) return res.status(400).json({ error: "Invalid ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const round = await storage.getGroupRound(roundId);
      if (!round || round.groupId !== groupId) return res.status(404).json({ error: "Round not found in this group" });
      const scores = await storage.getGroupRoundScores(roundId);
      const score = scores.find(s => s.id === scoreId);
      if (!score) return res.status(404).json({ error: "Score not found in this round" });
      const emoji = decodeURIComponent(req.params.emoji);
      await storage.removeGroupReaction(roundId, scoreId, userId, emoji);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to remove reaction" });
    }
  });

  app.get("/api/groups/:id/activity", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const membership = await storage.getGroupMember(groupId, userId);
      if (!membership) return res.status(403).json({ error: "Not a member" });
      const activity = await storage.getGroupActivity(groupId, 30);
      res.json(activity);
    } catch {
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });
}
