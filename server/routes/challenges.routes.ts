import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { SEEDED_GAME_SLUGS } from "@shared/schema";
import type { FriendChallenge } from "@shared/schema/social";
import { LETTER_DODGE_VARIANTS, parseLetterDodgeDifficulty } from "@shared/letter-dodge";
import { validateLetterBalanceChallengeConfig } from "@shared/letter-balance-challenge";
import { createNotificationIfEnabled } from "./helpers";
import { isLockedBalancePairAvailable } from "../games/letter-balance-availability";

export { validateLetterBalanceChallengeConfig };

const LETTER_BALANCE_CATEGORY_LABELS: Record<string, string> = {
  consonant_count: "Consonant Count",
  vowel_count: "Vowel Count",
  start_end_vowel: "Start & End Vowels",
  start_end_consonant: "Start & End Consonants",
  start_vowel_end_consonant: "Start Vowel, End Consonant",
  start_consonant_end_vowel: "Start Consonant, End Vowel",
  locked_balance: "Locked Balance",
};

function getLetterDodgeCompletionSummary(gameConfig: string | null | undefined): string {
  if (!gameConfig) return "";

  try {
    const config: unknown = JSON.parse(gameConfig);
    if (typeof config !== "object" || config === null) return "";

    const difficulty = parseLetterDodgeDifficulty(
      (config as Record<string, unknown>).difficulty,
    );
    if (!difficulty) return "";

    const label = LETTER_DODGE_VARIANTS.find(
      (variant) => variant.difficulty === difficulty,
    )?.label;
    if (!label) return "";

    const survival = (config as Record<string, unknown>).survival === true;
    return ` · ${label}${survival ? " · Survival" : ""}`;
  } catch {
    return "";
  }
}

function getLetterBalanceCompletionSummary(gameConfig: string | null | undefined): string {
  if (!gameConfig) return " · Random";

  try {
    const config: unknown = JSON.parse(gameConfig);
    if (typeof config !== "object" || config === null || Array.isArray(config)) return "";

    const settings = config as Record<string, unknown>;
    const category = typeof settings.category === "string"
      ? LETTER_BALANCE_CATEGORY_LABELS[settings.category]
      : undefined;
    if (!category) return "";

    const parts = [category];
    const level = settings.level;
    if (category === "Locked Balance" && typeof level === "number") {
      parts.push(`${level}-letter words`);
      if (typeof settings.consonantCount === "number") {
        parts.push(`${settings.consonantCount}C/${level - settings.consonantCount}V`);
      }
    } else if (typeof level === "number" || level === "advanced") {
      if (level === "advanced") {
        parts.push("Advanced");
      } else if (category === "Consonant Count") {
        parts.push(`${level} consonants`);
      } else if (category === "Vowel Count") {
        parts.push(`${level} vowels`);
      } else {
        parts.push(`${level}-letter words`);
      }
    }
    return ` · ${parts.join(" · ")}`;
  } catch {
    return "";
  }
}

export function getChallengeCompletionConfigSummary(
  gameSlug: string,
  gameConfig: string | null | undefined,
): string {
  if (gameSlug === "letter-balance") return getLetterBalanceCompletionSummary(gameConfig);
  if (gameSlug === "letter-dodge") return getLetterDodgeCompletionSummary(gameConfig);
  return "";
}

export function getChallengeResultNotificationBody(
  receiverName: string,
  completedChallenge: Pick<FriendChallenge, "gameSlug" | "gameConfig" | "receiverScore"> & { receiverScore: number },
): string {
  const gameTitle = completedChallenge.gameSlug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const configSummary = getChallengeCompletionConfigSummary(completedChallenge.gameSlug, completedChallenge.gameConfig);
  return `${receiverName} completed your ${gameTitle} challenge with a score of ${completedChallenge.receiverScore}${configSummary}`;
}

export function getChallengeInvitationNotificationBody(
  senderName: string,
  gameSlug: string,
  senderScore: number,
  gameConfig: string | null | undefined,
): string {
  const gameTitle = gameSlug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const configSummary = gameSlug === "letter-balance"
    ? getLetterBalanceCompletionSummary(gameConfig)
    : gameSlug === "letter-dodge"
      ? getLetterDodgeCompletionSummary(gameConfig)
    : "";
  return `${senderName} wants you to beat their ${gameTitle} score of ${senderScore}${configSummary}`;
}

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
      let configJson: string | null = null;
      if (gameSlug === "letter-balance" && gameConfig !== undefined && gameConfig !== null) {
        const configError = validateLetterBalanceChallengeConfig(gameConfig);
        if (configError) return res.status(400).json({ error: configError });
        if (gameConfig.category === "locked_balance") {
          const dictionary = await storage.getWordDictionary();
          if (!isLockedBalancePairAvailable(dictionary, gameConfig.level, gameConfig.consonantCount)) {
            return res.status(400).json({ error: "No valid dictionary words match this Locked Balance setting" });
          }
        }
        configJson = JSON.stringify(gameConfig);
      }
      const targetUser = await storage.getUserById(friendId);
      if (!targetUser) return res.status(404).json({ error: "User not found" });
      const existing = await storage.getPendingFriendChallenge(req.user!.id, friendId, gameSlug);
      if (existing) return res.status(409).json({ error: "You already have a pending challenge for this game with that player" });
      if (gameSlug === "letter-dodge" && gameConfig !== undefined) {
        const difficulty = gameConfig && typeof gameConfig === "object"
          ? parseLetterDodgeDifficulty(gameConfig.difficulty)
          : undefined;
        if (!difficulty) return res.status(400).json({ error: "Valid Letter Dodge difficulty is required" });
        if (gameConfig.survival !== undefined && typeof gameConfig.survival !== "boolean") {
          return res.status(400).json({ error: "Valid Letter Dodge mode is required" });
        }
        configJson = JSON.stringify({ difficulty, survival: gameConfig.survival === true });
      }
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
        createNotificationIfEnabled({
          userId: friendId,
          type: "friend_challenge_received",
          title: `${senderName} challenged you!`,
          body: getChallengeInvitationNotificationBody(senderName, gameSlug, score, configJson),
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
      if (updated && typeof updated.receiverScore === "number" && challenge.senderId && challenge.senderId !== req.user!.id) {
        try {
          const receiverName = `@${(req.user as any).username as string}`;
          createNotificationIfEnabled({
            userId: challenge.senderId,
            type: "friend_challenge_result",
            title: "Challenge result ready",
            body: getChallengeResultNotificationBody(receiverName, {
              gameSlug: updated.gameSlug,
              gameConfig: updated.gameConfig,
              receiverScore: updated.receiverScore,
            }),
            linkUrl: `/friends?tab=challenges&challengeId=${updated.id}`,
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
