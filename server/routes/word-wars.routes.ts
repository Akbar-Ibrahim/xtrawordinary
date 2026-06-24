import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { executeBracketDraw, checkAndForfeitExpiredMatches } from "../word-wars-engine";
import { registerSSEClient, unregisterSSEClient, ssePublishToUsers } from "../word-wars-sse";
import { pushNotifToUser } from "../notification-sse";
import { createNotificationIfEnabled } from "./helpers";

export function registerWordWarsRoutes(app: Express): void {
  app.post("/api/word-wars", requireAuth, async (req, res) => {
    try {
      if (!req.user!.isAdmin) return res.status(403).json({ error: "Admin only" });
      const { name, registrationDeadline, roundDeadlineHours, minPlayers, maxPlayers, recurringCron } = req.body;
      if (!name || !registrationDeadline) return res.status(400).json({ error: "name and registrationDeadline required" });
      const parsedMin = minPlayers ? Number(minPlayers) : 2;
      if (!Number.isInteger(parsedMin) || parsedMin < 2) return res.status(400).json({ error: "minPlayers must be an integer >= 2" });
      const parsedMax = maxPlayers ? Number(maxPlayers) : null;
      if (parsedMax !== null && parsedMax < parsedMin) return res.status(400).json({ error: "maxPlayers must be >= minPlayers" });
      const tournament = await storage.createWordWarsTournament({
        name: String(name),
        registrationDeadline: new Date(registrationDeadline).toISOString(),
        roundDeadlineHours: Number(roundDeadlineHours) || 24,
        minPlayers: parsedMin,
        maxPlayers: parsedMax,
        recurringCron: recurringCron ? String(recurringCron) : null,
        createdBy: req.user!.id,
      });
      res.status(201).json(tournament);
    } catch (err) {
      console.error("[word-wars] create tournament error", err);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  app.get("/api/word-wars", async (_req, res) => {
    try {
      const tournaments = await storage.listWordWarsTournaments();
      const withCounts = await Promise.all(
        tournaments.map(async (t) => {
          const regs = await storage.getWordWarsRegistrationsForTournament(t.id);
          return { ...t, registrationCount: regs.length };
        })
      );
      res.json(withCounts);
    } catch {
      res.status(500).json({ error: "Failed to list tournaments" });
    }
  });

  app.get("/api/word-wars/champions", async (_req, res) => {
    try {
      const champions = await storage.listAllWordWarsChampions();
      if (champions.length === 0) return res.json([]);
      const [users, tournaments] = await Promise.all([
        Promise.all(champions.map(c => storage.getUserById(c.userId))),
        Promise.all(champions.map(c => storage.getWordWarsTournament(c.tournamentId))),
      ]);
      res.json(champions.map((c, i) => ({
        ...c,
        user: users[i] ? { id: users[i]!.id, name: users[i]!.name, avatarUrl: users[i]!.avatarUrl } : null,
        tournament: tournaments[i] ? { id: tournaments[i]!.id, name: tournaments[i]!.name } : null,
      })));
    } catch {
      res.status(500).json({ error: "Failed to get champions" });
    }
  });

  app.get("/api/word-wars/matches/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) return res.status(400).json({ error: "Invalid match ID" });
      const match = await storage.getWordWarsMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const games = await storage.getWordWarsMatchGames(matchId);
      res.json({ match, games });
    } catch {
      res.status(500).json({ error: "Failed to get match" });
    }
  });

  app.get("/api/word-wars/:id/sse", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).end(); return; }
    const userId = req.user!.id;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    registerSSEClient(id, userId, res);
    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); }
    }, 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unregisterSSEClient(id, userId);
    });
  });

  app.get("/api/word-wars/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const tournament = await storage.getWordWarsTournament(id);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      await checkAndForfeitExpiredMatches(id);
      const [registrations, matches] = await Promise.all([
        storage.getWordWarsRegistrationsForTournament(id),
        storage.listWordWarsMatchesForTournament(id),
      ]);
      const matchesWithGames = await Promise.all(
        matches.map(async (m) => ({ ...m, games: await storage.getWordWarsMatchGames(m.id) }))
      );
      const playerIds = new Set<number>();
      matchesWithGames.forEach(m => {
        if (m.player1Id) playerIds.add(m.player1Id);
        if (m.player2Id) playerIds.add(m.player2Id);
      });
      const playerUsers = await Promise.all([...playerIds].map(uid => storage.getUserById(uid)));
      const players: Record<number, { id: number; name: string; avatarUrl: string | null }> = {};
      playerUsers.forEach(u => {
        if (u) players[u.id] = { id: u.id, name: u.name, avatarUrl: u.avatarUrl };
      });
      res.json({ tournament, registrations, matches: matchesWithGames, players });
    } catch {
      res.status(500).json({ error: "Failed to get tournament" });
    }
  });

  app.post("/api/word-wars/:id/register", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const tournament = await storage.getWordWarsTournament(id);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Registration is closed" });
      if (new Date(tournament.registrationDeadline) <= new Date()) {
        return res.status(400).json({ error: "Registration deadline has passed" });
      }
      const userId = req.user!.id;
      const existing = await storage.getWordWarsRegistration(id, userId);
      if (existing) {
        await storage.deleteWordWarsRegistration(id, userId);
        return res.json({ registered: false });
      }
      const registrations = await storage.getWordWarsRegistrationsForTournament(id);
      if (tournament.maxPlayers && registrations.length >= tournament.maxPlayers) {
        return res.status(400).json({ error: "Tournament is full" });
      }
      await storage.createWordWarsRegistration(id, userId);
      res.json({ registered: true });
    } catch (err) {
      console.error("[word-wars] register error", err);
      res.status(500).json({ error: "Failed to register" });
    }
  });

  app.patch("/api/word-wars/:id", requireAuth, async (req, res) => {
    try {
      if (!req.user!.isAdmin) return res.status(403).json({ error: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const tournament = await storage.getWordWarsTournament(id);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Only registration-status tournaments can be edited" });
      const { name, registrationDeadline, roundDeadlineHours, minPlayers, maxPlayers } = req.body;
      const updates: Parameters<typeof storage.updateWordWarsTournament>[1] = {};
      if (name !== undefined) {
        const trimmed = String(name).trim();
        if (!trimmed) return res.status(400).json({ error: "Name cannot be empty" });
        updates.name = trimmed;
      }
      if (registrationDeadline !== undefined) {
        const d = new Date(registrationDeadline);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid registrationDeadline" });
        updates.registrationDeadline = d.toISOString();
      }
      if (roundDeadlineHours !== undefined) {
        const rh = parseInt(roundDeadlineHours);
        if (isNaN(rh) || rh < 1) return res.status(400).json({ error: "roundDeadlineHours must be a positive integer" });
        updates.roundDeadlineHours = rh;
      }
      if (minPlayers !== undefined) {
        const mp = parseInt(minPlayers);
        if (isNaN(mp) || mp < 2) return res.status(400).json({ error: "minPlayers must be at least 2" });
        updates.minPlayers = mp;
      }
      if (maxPlayers !== undefined) {
        if (maxPlayers === null || maxPlayers === "" || maxPlayers === 0) {
          updates.maxPlayers = null;
        } else {
          const mx = parseInt(maxPlayers);
          if (isNaN(mx) || mx < 2) return res.status(400).json({ error: "maxPlayers must be at least 2" });
          const effectiveMin = updates.minPlayers ?? tournament.minPlayers;
          if (mx < effectiveMin) return res.status(400).json({ error: "maxPlayers must be >= minPlayers" });
          updates.maxPlayers = mx;
        }
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
      const updated = await storage.updateWordWarsTournament(id, updates);
      res.json(updated);
    } catch (err) {
      console.error("[word-wars] update tournament error", err);
      res.status(500).json({ error: "Failed to update tournament" });
    }
  });

  app.post("/api/word-wars/:id/cancel", requireAuth, async (req, res) => {
    try {
      if (!req.user!.isAdmin) return res.status(403).json({ error: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const tournament = await storage.getWordWarsTournament(id);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      if (tournament.status !== "registration") return res.status(400).json({ error: "Only registration-status tournaments can be cancelled" });
      const updated = await storage.updateWordWarsTournament(id, { status: "cancelled" });
      const registrations = await storage.getWordWarsRegistrationsForTournament(id);
      await Promise.all(registrations.map((r) =>
        createNotificationIfEnabled({
          userId: r.userId,
          type: "word_war_cancelled",
          title: "Tournament Cancelled",
          body: `"${tournament.name}" has been cancelled by an admin.`,
          linkUrl: "/word-wars",
        })
      ));
      res.json(updated);
    } catch (err) {
      console.error("[word-wars] cancel tournament error", err);
      res.status(500).json({ error: "Failed to cancel tournament" });
    }
  });

  app.post("/api/word-wars/:id/draw", requireAuth, async (req, res) => {
    try {
      if (!req.user!.isAdmin) return res.status(403).json({ error: "Admin only" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const result = await executeBracketDraw(id);
      if ("error" in result) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ matches: result.matches });
    } catch (err) {
      console.error("[word-wars] draw error", err);
      res.status(500).json({ error: "Failed to draw bracket" });
    }
  });

  app.get("/api/word-wars/:id/champions", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const champions = await storage.getChampionsForTournament(id);
      if (champions.length === 0) return res.json([]);
      const users = await Promise.all(champions.map(c => storage.getUserById(c.userId)));
      res.json(champions.map((c, i) => ({ ...c, user: users[i] ? { id: users[i]!.id, name: users[i]!.name, avatarUrl: users[i]!.avatarUrl } : null })));
    } catch {
      res.status(500).json({ error: "Failed to get champions" });
    }
  });

  app.get("/api/users/:id/championships", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const championships = await storage.getChampionshipsForUser(id);
      if (championships.length === 0) return res.json([]);
      const tournaments = await Promise.all(championships.map(c => storage.getWordWarsTournament(c.tournamentId)));
      res.json(championships.map((c, i) => ({
        ...c,
        tournamentName: tournaments[i]?.name ?? `Tournament #${c.tournamentId}`,
      })));
    } catch {
      res.status(500).json({ error: "Failed to get championships" });
    }
  });

  app.get("/api/users/:id/word-wars-stats", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const stats = await storage.getWordWarsStatsForUser(id);
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Failed to get Word Wars stats" });
    }
  });

  app.get("/api/users/:id/guild-wars-championships", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const groups = await storage.getUserGroups(id);
      const allChampionships = await Promise.all(groups.map(async (g) => {
        const champs = await storage.getGuildWarsChampionshipsForGroup(g.id);
        return champs.map((c) => ({ ...c, groupName: g.name }));
      }));
      const flat = allChampionships.flat();
      flat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(flat);
    } catch {
      res.status(500).json({ error: "Failed to get Guild Wars championships" });
    }
  });

  app.post("/api/word-wars/matches/:matchId/games/:gameNumber/start", requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      const gameNumber = parseInt(req.params.gameNumber);
      if (isNaN(matchId) || isNaN(gameNumber) || gameNumber < 1 || gameNumber > 3) {
        return res.status(400).json({ error: "Invalid match or game number" });
      }
      const match = await storage.getWordWarsMatch(matchId);
      if (!match) return res.status(404).json({ error: "Match not found" });
      const userId = req.user!.id;
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return res.status(403).json({ error: "You are not a participant in this match" });
      }
      if (match.status !== "pending" && match.status !== "active") {
        return res.status(400).json({ error: "Match is not active" });
      }
      const matchGame = await storage.getWordWarsMatchGame(matchId, gameNumber);
      if (!matchGame) return res.status(404).json({ error: "Game not found" });
      if (matchGame.roomCode) return res.json({ roomCode: matchGame.roomCode });
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let roomCode = "";
      for (let i = 0; i < 8; i++) roomCode += chars[Math.floor(Math.random() * chars.length)];
      const seed = Math.floor(Math.random() * 1000000);
      await storage.createDuelChallenge({
        challengerId: match.player1Id!,
        challengeeId: match.player2Id!,
        gameSlug: matchGame.gameSlug,
        message: `Word Wars Match — Game ${gameNumber}`,
        status: "accepted",
        roomCode,
        seed,
        startWord: null,
        format: "race",
        raceTarget: 10,
        raceTimeLimit: 180,
        expiresAt: null,
      });
      await storage.updateWordWarsMatchGame(matchGame.id, { roomCode, status: "active" });
      if (match.status === "pending") {
        await storage.updateWordWarsMatch(matchId, { status: "active" });
      }
      const participantIds = [match.player1Id, match.player2Id].filter((id): id is number => id != null);
      ssePublishToUsers(match.tournamentId, participantIds, { type: "game_started", matchId, gameNumber });
      const opponentId = userId === match.player1Id ? match.player2Id : match.player1Id;
      if (opponentId) {
        try {
          const [starter, prefs] = await Promise.all([
            storage.getUserById(userId),
            storage.getNotificationPreferences(opponentId),
          ]);
          if (prefs["word_war_matched"]) {
            const notifLink = roomCode
              ? `/duel/${roomCode}`
              : `/word-wars/${match.tournamentId}/match/${matchId}`;
            await storage.createNotification({
              userId: opponentId,
              type: "word_war_matched",
              title: "Your opponent is ready",
              body: `${starter?.name ?? "Your opponent"} has started Game ${gameNumber} of Round ${match.round}. Jump straight into the room!`,
              linkUrl: notifLink,
            });
            pushNotifToUser(opponentId);
          }
        } catch (notifErr) {
          console.error("[word-wars] start-game notification error", notifErr);
        }
      }
      if (roomCode) {
        const bothPlayerIds = [userId, opponentId].filter((id): id is number => id != null);
        try {
          const prefsResults = await Promise.all(
            bothPlayerIds.map((pid) => storage.getNotificationPreferences(pid)),
          );
          await Promise.all(
            bothPlayerIds.map(async (pid, i) => {
              if (prefsResults[i]["word_war_round_start"]) {
                await storage.createNotification({
                  userId: pid,
                  type: "word_war_round_start",
                  title: "Room is live — join now!",
                  body: `Game ${gameNumber} of Round ${match.round} (Word Wars) is ready. Click to enter the duel room.`,
                  linkUrl: `/duel/${roomCode}`,
                });
                pushNotifToUser(pid);
              }
            }),
          );
        } catch (notifErr) {
          console.error("[word-wars] room-ready notification error", notifErr);
        }
      }
      res.json({ roomCode });
    } catch (err) {
      console.error("[word-wars] start game error", err);
      res.status(500).json({ error: "Failed to start game" });
    }
  });
}
