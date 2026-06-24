import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../auth";
import { executeGuildBracketDraw } from "../guild-wars-engine";
import { pushNotifToUser } from "../notification-sse";

export function registerGuildWarsRoutes(app: Express): void {
  app.post("/api/guild-wars", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name, registrationDeadline, roundDeadlineHours, minGroups, maxGroups } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name is required" });
      }
      if (!registrationDeadline) {
        return res.status(400).json({ error: "registrationDeadline is required" });
      }
      const deadline = new Date(registrationDeadline);
      if (isNaN(deadline.getTime())) {
        return res.status(400).json({ error: "registrationDeadline must be a valid date" });
      }
      if (deadline <= new Date()) {
        return res.status(400).json({ error: "registrationDeadline must be in the future" });
      }
      const parsedRoundHours = Number(roundDeadlineHours ?? 24);
      if (isNaN(parsedRoundHours) || parsedRoundHours < 1 || parsedRoundHours > 168) {
        return res.status(400).json({ error: "roundDeadlineHours must be between 1 and 168" });
      }
      const parsedMin = Number(minGroups ?? 2);
      if (isNaN(parsedMin) || parsedMin < 2 || parsedMin > 64) {
        return res.status(400).json({ error: "minGroups must be between 2 and 64" });
      }
      const parsedMax = maxGroups != null ? Number(maxGroups) : null;
      if (parsedMax !== null && (isNaN(parsedMax) || parsedMax < parsedMin || parsedMax > 64)) {
        return res.status(400).json({ error: "maxGroups must be between minGroups and 64" });
      }
      const tournament = await storage.createGuildWarsTournament({
        name: name.trim(),
        registrationDeadline: deadline.toISOString(),
        roundDeadlineHours: parsedRoundHours,
        minGroups: parsedMin,
        maxGroups: parsedMax,
        createdBy: req.user!.id,
      });
      res.status(201).json(tournament);
    } catch (err) {
      console.error("[guild-wars] create tournament error", err);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  app.get("/api/guild-wars", async (req, res) => {
    try {
      const all = await storage.listGuildWarsTournaments();
      const { status } = req.query;
      const filtered = status ? all.filter((t) => t.status === status) : all;
      const enriched = await Promise.all(filtered.map(async (t) => {
        const regs = await storage.getGuildWarsRegistrationsForTournament(t.id);
        return { ...t, registrationCount: regs.length };
      }));
      res.json(enriched);
    } catch (err) {
      console.error("[guild-wars] list tournaments error", err);
      res.status(500).json({ error: "Failed to list tournaments" });
    }
  });

  app.get("/api/guild-wars/champions", async (req, res) => {
    try {
      const champions = await storage.listAllGuildWarsChampions();
      const enriched = await Promise.all(champions.map(async (c) => {
        const group = await storage.getGroup(c.groupId);
        return { ...c, groupName: group?.name ?? null };
      }));
      res.json(enriched);
    } catch (err) {
      console.error("[guild-wars] champions error", err);
      res.status(500).json({ error: "Failed to fetch champions" });
    }
  });

  app.get("/api/guild-wars/matches/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) return res.status(400).json({ error: "Invalid match ID" });
      const match = await storage.getGuildWarsMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const games = await storage.getGuildWarsMatchGames(matchId);
      res.json({ ...match, games });
    } catch (err) {
      console.error("[guild-wars] match detail error", err);
      res.status(500).json({ error: "Failed to fetch match" });
    }
  });

  app.get("/api/guild-wars/:id", async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      if (isNaN(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });
      const [tournament, registrations, matches] = await Promise.all([
        storage.getGuildWarsTournament(tournamentId),
        storage.getGuildWarsRegistrationsForTournament(tournamentId),
        storage.listGuildWarsMatchesForTournament(tournamentId),
      ]);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      const matchesWithGames = await Promise.all(
        matches.map(async (m) => ({
          ...m,
          games: await storage.getGuildWarsMatchGames(m.id),
        })),
      );
      const enriched = await Promise.all(
        registrations.map(async (r) => {
          const group = await storage.getGroup(r.groupId);
          return { ...r, groupName: group?.name ?? null };
        }),
      );
      const groupIds = new Set<number>();
      enriched.forEach((r) => groupIds.add(r.groupId));
      matchesWithGames.forEach((m) => {
        if (m.group1Id) groupIds.add(m.group1Id);
        if (m.group2Id) groupIds.add(m.group2Id);
        if (m.winnerGroupId) groupIds.add(m.winnerGroupId);
      });
      const groupsMap: Record<number, { id: number; name: string }> = {};
      await Promise.all(Array.from(groupIds).map(async (gid) => {
        const g = await storage.getGroup(gid);
        if (g) groupsMap[gid] = { id: g.id, name: g.name };
      }));
      res.json({ ...tournament, registrations: enriched, matches: matchesWithGames, groups: groupsMap });
    } catch (err) {
      console.error("[guild-wars] get tournament error", err);
      res.status(500).json({ error: "Failed to fetch tournament" });
    }
  });

  app.get("/api/groups/:id/guild-wars", async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const regs = await storage.getGuildWarsRegistrationsForGroup(groupId);
      const entries = await Promise.all(regs.map(async (r) => {
        const t = await storage.getGuildWarsTournament(r.tournamentId);
        return t ? { registration: r, tournament: t } : null;
      }));
      res.json(entries.filter(Boolean));
    } catch (err) {
      console.error("[guild-wars] group guild wars error", err);
      res.status(500).json({ error: "Failed to fetch group tournaments" });
    }
  });

  app.post("/api/guild-wars/:id/register", requireAuth, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      if (isNaN(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });
      const userId = req.user!.id;
      const { groupId } = req.body;
      if (!groupId) return res.status(400).json({ error: "groupId is required" });
      const tournament = await storage.getGuildWarsTournament(tournamentId);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Registration is closed" });
      if (new Date(tournament.registrationDeadline) <= new Date()) {
        return res.status(400).json({ error: "Registration deadline has passed" });
      }
      const membership = await storage.getGroupMember(Number(groupId), userId);
      if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
        return res.status(403).json({ error: "Only group owners or admins can register a group" });
      }
      const existing = await storage.getGuildWarsRegistration(tournamentId, Number(groupId));
      if (existing) return res.status(409).json({ error: "Group is already registered" });
      if (tournament.maxGroups) {
        const regs = await storage.getGuildWarsRegistrationsForTournament(tournamentId);
        if (regs.length >= tournament.maxGroups) {
          return res.status(400).json({ error: "Tournament is full" });
        }
      }
      const reg = await storage.createGuildWarsRegistration(tournamentId, Number(groupId), userId);
      res.status(201).json(reg);
    } catch (err) {
      console.error("[guild-wars] register error", err);
      res.status(500).json({ error: "Failed to register group" });
    }
  });

  app.delete("/api/guild-wars/:id/register", requireAuth, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      if (isNaN(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });
      const userId = req.user!.id;
      const { groupId } = req.body;
      if (!groupId) return res.status(400).json({ error: "groupId is required" });
      const tournament = await storage.getGuildWarsTournament(tournamentId);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Cannot withdraw after registration closes" });
      const membership = await storage.getGroupMember(Number(groupId), userId);
      if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
        return res.status(403).json({ error: "Only group owners or admins can withdraw a group" });
      }
      const existing = await storage.getGuildWarsRegistration(tournamentId, Number(groupId));
      if (!existing) return res.status(404).json({ error: "Group is not registered" });
      await storage.deleteGuildWarsRegistration(tournamentId, Number(groupId));
      res.json({ success: true });
    } catch (err) {
      console.error("[guild-wars] unregister error", err);
      res.status(500).json({ error: "Failed to withdraw group" });
    }
  });

  app.post("/api/guild-wars/:id/draw", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.id);
      if (isNaN(tournamentId)) return res.status(400).json({ error: "Invalid tournament ID" });
      const result = await executeGuildBracketDraw(tournamentId);
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true, matchCount: result.matches.length });
    } catch (err) {
      console.error("[guild-wars] draw error", err);
      res.status(500).json({ error: "Failed to draw bracket" });
    }
  });

  app.post("/api/guild-wars/matches/:matchId/games/:gameNumber/start", requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const gameNumber = parseInt(req.params.gameNumber);
      if (isNaN(matchId) || isNaN(gameNumber) || gameNumber < 1 || gameNumber > 3) {
        return res.status(400).json({ error: "Invalid match or game number" });
      }
      const match = await storage.getGuildWarsMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      if (!match.group1Id || !match.group2Id) return res.status(400).json({ error: "Match has a bye" });
      if (match.status === "completed" || match.status === "bye" || match.status === "forfeited") {
        return res.status(400).json({ error: "Match is already resolved" });
      }
      const userId = req.user!.id;
      const [mem1, mem2] = await Promise.all([
        storage.getGroupMember(match.group1Id, userId),
        storage.getGroupMember(match.group2Id, userId),
      ]);
      const isGroupAdmin =
        (mem1 && (mem1.role === "admin" || mem1.role === "owner")) ||
        (mem2 && (mem2.role === "admin" || mem2.role === "owner"));
      if (!isGroupAdmin) {
        return res.status(403).json({ error: "Only a group owner or admin of one of the competing groups can start games" });
      }
      const [reg1, reg2] = await Promise.all([
        storage.getGuildWarsRegistration(match.tournamentId, match.group1Id),
        storage.getGuildWarsRegistration(match.tournamentId, match.group2Id),
      ]);
      if (!reg1 || !reg2) {
        return res.status(400).json({ error: "Missing group registrations — cannot create game room" });
      }
      const matchGame = await storage.getGuildWarsMatchGame(matchId, gameNumber);
      if (!matchGame) return res.status(404).json({ error: "Match game not found" });
      if (matchGame.roomCode) {
        return res.json({ roomCode: matchGame.roomCode, gameSlug: matchGame.gameSlug });
      }
      if (matchGame.status !== "pending") {
        return res.status(400).json({ error: "Game is already completed" });
      }
      if (gameNumber > 1) {
        const prevGame = await storage.getGuildWarsMatchGame(matchId, gameNumber - 1);
        if (prevGame?.status !== "completed") {
          return res.status(400).json({ error: `Game ${gameNumber - 1} must be completed first` });
        }
        const allGames = await storage.getGuildWarsMatchGames(matchId);
        const completedBefore = allGames.filter(g => g.status === "completed" && g.gameNumber < gameNumber);
        let g1Wins = 0;
        let g2Wins = 0;
        for (const g of completedBefore) {
          if (g.winnerGroupId === match.group1Id) g1Wins++;
          else if (g.winnerGroupId === match.group2Id) g2Wins++;
        }
        if (g1Wins >= 2 || g2Wins >= 2) {
          return res.status(400).json({ error: "Series is already decided" });
        }
      }
      const { duelRegistry } = await import("../duel-ws");
      const { roomCode, seed: roomSeed, startWord: roomStartWord } = duelRegistry.createRoom(
        matchGame.gameSlug, reg1.registeredBy, "race", 10, 180,
      );
      const gameExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await storage.createHuddleChallenge({
        challengerGroupId: match.group1Id,
        challengeeGroupId: match.group2Id,
        challengerAdminId: reg1.registeredBy,
        challengeeAdminId: reg2.registeredBy,
        gameSlug: matchGame.gameSlug,
        format: "race",
        raceTarget: 10,
        raceTimeLimit: 180,
        status: "accepted",
        roomCode,
        seed: roomSeed,
        startWord: roomStartWord ?? null,
        expiresAt: gameExpiresAt,
      });
      await storage.createDuelChallenge({
        challengerId: reg1.registeredBy,
        challengeeId: reg2.registeredBy,
        gameSlug: matchGame.gameSlug,
        message: `Guild Wars Match ${matchId} — Game ${gameNumber}`,
        status: "accepted",
        roomCode,
        seed: roomSeed,
        startWord: roomStartWord ?? null,
        format: "race",
        raceTarget: 10,
        raceTimeLimit: 180,
        expiresAt: null,
      });
      await storage.updateGuildWarsMatchGame(matchGame.id, { roomCode, status: "active" });
      if (match.status === "pending") {
        await storage.updateGuildWarsMatch(matchId, { status: "active" });
      }
      try {
        const [group1Members, group2Members] = await Promise.all([
          storage.getGroupMembers(match.group1Id),
          storage.getGroupMembers(match.group2Id),
        ]);
        const adminIds = new Set<number>();
        for (const m of [...group1Members, ...group2Members]) {
          if (m.role === "admin" || m.role === "owner") adminIds.add(m.userId);
        }
        await Promise.all(
          Array.from(adminIds).map(async (pid) => {
            const prefs = await storage.getNotificationPreferences(pid);
            if (prefs["guild_war_round_start"]) {
              await storage.createNotification({
                userId: pid,
                type: "guild_war_round_start",
                title: "Room is live — join now!",
                body: `Guild Wars Game ${gameNumber} (${matchGame.gameSlug}) is ready. Click to enter the duel room.`,
                linkUrl: `/duel/${roomCode}`,
              });
              pushNotifToUser(pid);
            }
          }),
        );
      } catch (notifErr) {
        console.error("[guild-wars] start-game notification error", notifErr);
      }
      res.json({ roomCode, gameSlug: matchGame.gameSlug });
    } catch (err) {
      console.error("[guild-wars] start game error", err);
      res.status(500).json({ error: "Failed to start game" });
    }
  });

  app.get("/api/groups/:id/guild-wars-stats", async (req: any, res) => {
    try {
      const groupId = parseInt(req.params.id);
      if (isNaN(groupId)) return res.status(400).json({ error: "Invalid group ID" });
      const [stats, championships, registrations] = await Promise.all([
        storage.getGuildWarsStatsForGroup(groupId),
        storage.getGuildWarsChampionshipsForGroup(groupId),
        storage.getGuildWarsRegistrationsForGroup(groupId),
      ]);
      const tournamentDetails = await Promise.all(
        registrations.map((r) => storage.getGuildWarsTournament(r.tournamentId)),
      );
      const activeTournament = tournamentDetails.find(
        (t): t is NonNullable<typeof t> => t != null && t.status === "active",
      );
      const recentChampionships = [...championships]
        .reverse()
        .slice(0, 3)
        .map((c) => ({ tournamentId: c.tournamentId, tournamentName: c.tournamentName }));
      res.json({
        ...stats,
        championshipsWon: championships.length,
        activeTournament: activeTournament ? { id: activeTournament.id, name: activeTournament.name } : null,
        recentChampionships,
      });
    } catch (err) {
      console.error("[guild-wars] group stats error", err);
      res.status(500).json({ error: "Failed to get guild wars stats" });
    }
  });
}
