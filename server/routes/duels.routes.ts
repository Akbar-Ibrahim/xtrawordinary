import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import type { DuelChallengeStatus } from "@shared/schema";
import { createNotificationIfEnabled } from "./helpers";

function formatDuelVariationServer(gameSlug: string, startWord: string | null | undefined): string | null {
  if (!startWord) return null;
  switch (gameSlug) {
    case "letter-hunt":
    case "letter-frequency":
      if (/^[A-Z]$/i.test(startWord)) return `Letter ${startWord.toUpperCase()}`;
      return null;
    case "word-length":
      if (/^\d+$/.test(startWord)) return `${startWord}-letter words`;
      return null;
    case "letter-position": {
      const parts = startWord.split(":");
      if (parts.length === 2 && /^[A-Z]$/i.test(parts[0]) && /^\d+$/.test(parts[1]))
        return `Letter ${parts[0].toUpperCase()} at position ${parts[1]}`;
      return null;
    }
    case "letter-balance": {
      const m = startWord.match(/^(\d+)([VC])$/i);
      if (m) {
        const count = parseInt(m[1]);
        const type = m[2].toUpperCase() === "V" ? "vowel" : "consonant";
        return `${count} ${type}${count !== 1 ? "s" : ""}`;
      }
      return null;
    }
    case "definition-match": {
      const DUEL_DEF_CATS = ["ANIMALS", "COLORS", "FOODS", "SPORTS", "SCIENCE"] as const;
      if ((DUEL_DEF_CATS as readonly string[]).includes(startWord.toUpperCase()))
        return startWord.charAt(0).toUpperCase() + startWord.slice(1).toLowerCase();
      return null;
    }
    case "no-repeats":
      if (/^\d+$/.test(startWord)) return `${startWord}+ letter words`;
      return null;
    default:
      return null;
  }
}

export function registerDuelsRoutes(app: Express): void {
  app.post("/api/duels/challenges", requireAuth, async (req: any, res) => {
    try {
      const { challengeeId, gameSlug, message, format, raceTarget, raceTimeLimit, startWord: requestedStartWord } = req.body;
      if (challengeeId != null && Number(challengeeId) === req.user.id) {
        return res.status(400).json({ error: "You cannot challenge yourself" });
      }
      if (!gameSlug) {
        return res.status(400).json({ error: "gameSlug is required" });
      }
      const {
        DUEL_GAME_SLUGS, DUEL_TURN_SLUGS, DUEL_RACE_SLUGS,
        DUEL_HUNT_LETTERS, DUEL_WORD_LENGTHS, DUEL_POSITIONS, DUEL_BALANCE_CONSTRAINTS, DUEL_NO_REPEATS_LENGTHS, DUEL_DEFINITION_CATEGORIES,
      } = await import("@shared/schema");
      if (!DUEL_GAME_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support duels" });
      }
      const duelFormat: "turn" | "race" = format === "race" ? "race" : "turn";
      if (duelFormat === "turn" && !DUEL_TURN_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support the turn-based format" });
      }
      if (duelFormat === "race" && !DUEL_RACE_SLUGS.has(gameSlug)) {
        return res.status(400).json({ error: "That game does not support the race format" });
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
      let overrideStartWord: string | undefined;
      if (requestedStartWord != null) {
        const sw = String(requestedStartWord).toUpperCase().trim();
        let valid = false;
        switch (gameSlug) {
          case "letter-hunt":
          case "letter-frequency":
            valid = (DUEL_HUNT_LETTERS as readonly string[]).includes(sw);
            break;
          case "word-length":
            valid = (DUEL_WORD_LENGTHS as readonly string[]).includes(sw);
            break;
          case "letter-position": {
            const [letter, posStr] = sw.split(":");
            valid = (DUEL_HUNT_LETTERS as readonly string[]).includes(letter) &&
                    (DUEL_POSITIONS as readonly number[]).includes(Number(posStr));
            break;
          }
          case "letter-balance":
            valid = (DUEL_BALANCE_CONSTRAINTS as readonly string[]).includes(sw);
            break;
          case "no-repeats":
            valid = (DUEL_NO_REPEATS_LENGTHS as readonly string[]).includes(sw);
            break;
          case "definition-match":
            valid = (DUEL_DEFINITION_CATEGORIES as readonly string[]).includes(sw);
            break;
          default:
            valid = false;
        }
        if (!valid) {
          return res.status(400).json({ error: "Invalid startWord for this game" });
        }
        overrideStartWord = sw;
      }
      const challengerId = req.user.id;
      const targetId: number | null = challengeeId != null ? Number(challengeeId) : null;
      if (targetId !== null) {
        if (!Number.isFinite(targetId) || targetId <= 0 || !Number.isInteger(targetId)) {
          return res.status(400).json({ error: "Invalid challengeeId" });
        }
        if (targetId === challengerId) {
          return res.status(400).json({ error: "Cannot challenge yourself" });
        }
        const targetUser = await storage.getUserById(targetId);
        if (!targetUser) {
          return res.status(404).json({ error: "Target player not found" });
        }
      }
      const { duelRegistry } = await import("../duel-ws");
      const { roomCode, seed: roomSeed, startWord: roomStartWord } = duelRegistry.createRoom(
        gameSlug, challengerId, duelFormat, parsedRaceTarget, parsedRaceTimeLimit, overrideStartWord,
      );
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const challenge = await storage.createDuelChallenge({
        challengerId,
        challengeeId: targetId,
        gameSlug,
        message: message ?? null,
        status: "pending",
        expiresAt,
        roomCode,
        seed: roomSeed,
        startWord: roomStartWord,
        format: duelFormat,
        raceTarget: parsedRaceTarget,
        raceTimeLimit: parsedRaceTimeLimit,
      });
      const [challenger, challengee] = await Promise.all([
        storage.getUserById(challengerId),
        targetId != null ? storage.getUserById(targetId) : Promise.resolve(undefined),
      ]);
      if (targetId !== null && challengee) {
        const gameTitle = gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const variationLabel = formatDuelVariationServer(gameSlug, roomStartWord);
        createNotificationIfEnabled({
          userId: targetId,
          type: "duel_challenge_received",
          title: "You've been challenged to a duel!",
          body: `${challenger?.name ?? "Someone"} challenged you to a ${gameTitle}${variationLabel ? ` (${variationLabel})` : ""} duel`,
          linkUrl: "/friends?tab=duels",
        });
      }
      res.status(201).json({
        ...challenge,
        roomCode,
        challengerName: challenger?.name,
        challengeeName: challengee?.name ?? null,
        challengerAvatarUrl: challenger?.avatarUrl ?? null,
        challengeeAvatarUrl: challengee?.avatarUrl ?? null,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create duel challenge" });
    }
  });

  app.get("/api/duels/challenges", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const type = req.query.type as string | undefined;
      let challenges = await storage.getDuelChallengesForUser(userId);
      if (type === "incoming") {
        challenges = challenges.filter((c) => c.challengeeId === userId);
      } else if (type === "outgoing") {
        challenges = challenges.filter((c) => c.challengerId === userId);
      }
      const enriched = await Promise.all(
        challenges.map(async (c) => {
          const [challenger, challengee] = await Promise.all([
            storage.getUserById(c.challengerId),
            c.challengeeId != null ? storage.getUserById(c.challengeeId) : Promise.resolve(undefined),
          ]);
          return {
            ...c,
            challengerName: challenger?.name ?? null,
            challengeeName: challengee?.name ?? null,
            challengerAvatarUrl: challenger?.avatarUrl ?? null,
            challengeeAvatarUrl: challengee?.avatarUrl ?? null,
          };
        }),
      );
      res.json(enriched);
    } catch (err) {
      console.error("Failed to fetch duel challenges:", err);
      res.status(500).json({ error: "Failed to fetch duel challenges" });
    }
  });

  app.get("/api/duels/open/count", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const challenges = await storage.getOpenDuelChallenges(userId);
      res.json({ count: challenges.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to count open duel challenges" });
    }
  });

  app.get("/api/duels/open", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const rawSlug = req.query.gameSlug as string | undefined;
      const { DUEL_GAME_SLUGS } = await import("@shared/schema");
      if (rawSlug && !DUEL_GAME_SLUGS.has(rawSlug)) {
        return res.status(400).json({ error: "Invalid gameSlug filter" });
      }
      const gameSlug = rawSlug;
      const challenges = await storage.getOpenDuelChallenges(userId, gameSlug);
      const enriched = await Promise.all(
        challenges.map(async (c) => {
          const challenger = await storage.getUserById(c.challengerId);
          return {
            ...c,
            challengerName: challenger?.name ?? null,
            challengerAvatarUrl: challenger?.avatarUrl ?? null,
          };
        }),
      );
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch open duel challenges" });
    }
  });

  app.patch("/api/duels/challenges/:id/accept", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const challenge = await storage.getDuelChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      const isOpen = challenge.challengeeId === null;
      if (!isOpen && challenge.challengeeId !== userId) return res.status(403).json({ error: "Not your challenge" });
      if (isOpen && challenge.challengerId === userId) return res.status(400).json({ error: "Cannot accept your own open challenge" });
      if (challenge.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      if (challenge.expiresAt && new Date(challenge.expiresAt) < new Date()) {
        await storage.updateDuelChallengeStatus(id, "expired");
        if (challenge.roomCode) {
          const { duelRegistry } = await import("../duel-ws");
          duelRegistry.notifyChallengeCancelled(challenge.roomCode, "expired");
        }
        return res.status(410).json({ error: "Challenge has expired" });
      }
      let roomCode = challenge.roomCode;
      if (!roomCode) {
        const { duelRegistry } = await import("../duel-ws");
        const created = duelRegistry.createRoom(
          challenge.gameSlug,
          challenge.challengerId,
          (challenge.format ?? "turn") as "turn" | "race",
          challenge.raceTarget ?? 15,
          challenge.raceTimeLimit ?? 300,
          challenge.startWord ?? undefined,
        );
        roomCode = created.roomCode;
        await storage.updateDuelChallengeStatus(id, challenge.status as DuelChallengeStatus, created.roomCode, created.seed, created.startWord);
      }
      let updated: any;
      if (isOpen) {
        updated = await storage.acceptOpenDuelChallenge(id, userId);
        if (!updated) {
          return res.status(409).json({ error: "This open challenge was already taken by another player" });
        }
      } else {
        updated = await storage.updateDuelChallengeStatus(id, "accepted", roomCode ?? undefined);
      }
      try {
        const accepterName = (req.user as any).name as string;
        const gameTitle = challenge.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const variationLabel = formatDuelVariationServer(challenge.gameSlug, challenge.startWord);
        createNotificationIfEnabled({
          userId: challenge.challengerId,
          type: "duel_accepted",
          title: "Duel challenge accepted!",
          body: `${accepterName} accepted your ${gameTitle}${variationLabel ? ` (${variationLabel})` : ""} duel`,
          linkUrl: roomCode ? `/duel/${roomCode}` : "/duels",
        });
      } catch {}
      res.json({ ...updated, roomCode });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to accept challenge" });
    }
  });

  app.patch("/api/duels/challenges/:id/decline", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const challenge = await storage.getDuelChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.challengeeId !== userId) return res.status(403).json({ error: "Not your challenge" });
      if (challenge.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const updated = await storage.updateDuelChallengeStatus(id, "declined");
      if (challenge.roomCode) {
        const { duelRegistry } = await import("../duel-ws");
        duelRegistry.notifyChallengeCancelled(challenge.roomCode, "declined");
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to decline challenge" });
    }
  });

  app.patch("/api/duels/challenges/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const challenge = await storage.getDuelChallenge(id);
      if (!challenge) return res.status(404).json({ error: "Challenge not found" });
      if (challenge.challengerId !== userId) return res.status(403).json({ error: "Only the challenger can cancel" });
      if (challenge.status !== "pending") return res.status(409).json({ error: "Challenge is no longer pending" });
      const updated = await storage.updateDuelChallengeStatus(id, "cancelled");
      if (challenge.roomCode) {
        const { duelRegistry } = await import("../duel-ws");
        duelRegistry.notifyChallengeCancelled(challenge.roomCode, "cancelled");
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to cancel challenge" });
    }
  });

  app.get("/api/duels/live", requireAuth, async (_req, res) => {
    try {
      const { duelRegistry } = await import("../duel-ws");
      res.json(duelRegistry.getActiveLiveRooms());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch live rooms" });
    }
  });

  app.get("/api/duels/rooms/:roomCode", requireAuth, async (req: any, res) => {
    try {
      const roomCode = req.params.roomCode.toUpperCase();
      const userId = req.user.id;
      const challenge = await storage.getDuelChallengeByRoom(roomCode);
      if (!challenge) return res.status(404).json({ error: "Room not found" });

      const isParticipant = challenge.challengerId === userId || challenge.challengeeId === userId;
      const isOpenChallenge = challenge.challengeeId === null;

      if (!isParticipant && !isOpenChallenge) {
        const { duelRegistry: reg } = await import("../duel-ws");
        const liveRoom = reg.getRoom(roomCode);
        if (!liveRoom || liveRoom.status !== "playing") {
          return res.status(403).json({ error: "Not a participant" });
        }
      }

      if (
        isParticipant &&
        (challenge.status === "declined" ||
          challenge.status === "cancelled" ||
          challenge.status === "expired" ||
          challenge.status === "completed")
      ) {
        return res.status(410).json({ error: `This challenge has been ${challenge.status}` });
      }
      const { duelRegistry } = await import("../duel-ws");
      const room =
        duelRegistry.getRoom(roomCode) ??
        duelRegistry.restoreRoom(
          roomCode,
          challenge.gameSlug,
          challenge.challengerId,
          challenge.seed,
          challenge.startWord,
          (challenge.format as "turn" | "race") ?? "turn",
          challenge.raceTarget ?? 15,
          challenge.raceTimeLimit ?? 300,
        );
      res.json({
        gameSlug: room.gameSlug,
        seed: room.seed,
        startWord: room.startWord,
        challengerId: challenge.challengerId,
        challengeeId: challenge.challengeeId,
        format: room.format,
        raceTarget: room.raceTarget,
        raceTimeLimitMs: room.raceTimeLimitMs,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch room info" });
    }
  });

  app.get("/api/duels/leaderboard", async (req, res) => {
    try {
      const rawFormat = req.query.format;
      const format = rawFormat === "turn" || rawFormat === "race" ? rawFormat : undefined;
      const entries = await storage.getDuelLeaderboard(100, format);
      res.json(entries);
    } catch {
      res.status(500).json({ error: "Failed to fetch duel leaderboard" });
    }
  });

  app.get("/api/duels/ratings/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
      const rating = await storage.getDuelRating(userId);
      if (!rating) {
        return res.json({ userId, elo: 1200, wins: 0, losses: 0, draws: 0, rank: null, totalPlayers: 0 });
      }
      const rankContext = await storage.getDuelRankContext(userId);
      res.json({ ...rating, rank: rankContext?.rank ?? null, totalPlayers: rankContext?.totalPlayers ?? 0 });
    } catch {
      res.status(500).json({ error: "Failed to fetch duel rating" });
    }
  });

  app.get("/api/duels/sessions/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
      const sessions = await storage.getDuelSessionsForUser(userId);
      const opponentIds = [...new Set(sessions.map(s => s.player1Id === userId ? s.player2Id : s.player1Id))];
      const opponentUsers = await Promise.all(opponentIds.map(id => storage.getUserById(id)));
      const opponentMap = new Map<number, { name: string; avatarUrl: string | null }>();
      opponentUsers.forEach(user => { if (user) opponentMap.set(user.id, { name: user.name, avatarUrl: user.avatarUrl }); });
      const result = sessions.map(s => {
        const isPlayer1 = s.player1Id === userId;
        const opponentId = isPlayer1 ? s.player2Id : s.player1Id;
        const eloDelta = isPlayer1 ? s.eloDeltaPlayer1 : s.eloDeltaPlayer2;
        const isForfeit = s.outcome === "forfeit_player1" || s.outcome === "forfeit_player2";
        let outcome: "win" | "loss" | "draw" | null = null;
        if (s.outcome) {
          if (s.outcome === "draw") {
            outcome = "draw";
          } else if (
            (isPlayer1 && (s.outcome === "player1_wins" || s.outcome === "forfeit_player2")) ||
            (!isPlayer1 && (s.outcome === "player2_wins" || s.outcome === "forfeit_player1"))
          ) {
            outcome = "win";
          } else {
            outcome = "loss";
          }
        }
        const opponent = opponentMap.get(opponentId);
        return {
          id: s.id,
          roomCode: s.roomCode,
          opponentId,
          opponentName: opponent?.name ?? "Unknown",
          opponentAvatarUrl: opponent?.avatarUrl ?? null,
          gameSlug: s.gameSlug,
          outcome,
          isForfeit,
          eloDelta,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
        };
      });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch duel sessions" });
    }
  });

  app.get("/api/duels/open-counts", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id as number;
      const challenges = await storage.getOpenDuelChallenges(userId);
      const counts: Record<string, number> = {};
      for (const c of challenges) {
        counts[c.gameSlug] = (counts[c.gameSlug] ?? 0) + 1;
      }
      res.json(counts);
    } catch (err) {
      console.error("[duels] open-counts error", err);
      res.status(500).json({ error: "Failed to get open counts" });
    }
  });
}
