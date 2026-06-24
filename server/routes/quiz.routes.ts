import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { QUIZ_MASTER_GAME_SLUGS } from "@shared/schema";

function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function registerQuizRoutes(app: Express): void {
  app.post("/api/quiz-sessions", requireAuth, async (req: any, res) => {
    try {
      if (!req.user.isPremium) return res.status(403).json({ error: "Quiz Master requires a Premium account." });
      const { gameSlug, title, description, params, closesAt } = req.body;
      if (!gameSlug || !title) return res.status(400).json({ error: "gameSlug and title are required" });
      if (!QUIZ_MASTER_GAME_SLUGS.has(gameSlug)) return res.status(400).json({ error: "Game does not support Quiz Master" });

      let finalParams = params ?? {};
      if (gameSlug === "letter-position") {
        const letter = (typeof finalParams.letter === "string" ? finalParams.letter : "").toUpperCase().trim();
        const position = Number(finalParams.position);
        if (!letter || !/^[A-Z]$/.test(letter)) return res.status(400).json({ error: "letter must be a single A-Z character" });
        if (!position || position < 1 || position > 8) return res.status(400).json({ error: "position must be between 1 and 8" });
        const count = await storage.countLetterPositionWords(letter, position);
        if (count < 10) return res.status(400).json({ error: `Only ${count} words match — need at least 10. Choose a different letter or position.` });
        finalParams = { ...finalParams, letter, position, mode: 1 };
      }

      const shareCode = generateShareCode();
      const session = await storage.createQuizSession({
        creatorId: req.user.id,
        gameSlug,
        title: title.trim().slice(0, 200),
        description: typeof description === "string" && description.trim() ? description.trim().slice(0, 500) : null,
        shareCode,
        params: finalParams,
        closesAt: closesAt ?? null,
      });
      res.json(session);
    } catch {
      res.status(500).json({ error: "Failed to create quiz session" });
    }
  });

  app.get("/api/quiz-sessions/my", requireAuth, async (req: any, res) => {
    try {
      const sessions = await storage.getQuizSessionsByCreator(req.user.id);
      const enriched = await Promise.all(
        sessions.map(async (s) => {
          const scores = await storage.getQuizSessionScores(s.id);
          return { ...s, playerCount: scores.length };
        })
      );
      res.json(enriched);
    } catch {
      res.status(500).json({ error: "Failed to fetch quiz sessions" });
    }
  });

  app.get("/api/users/:userId/quiz-sessions", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });
      const sessions = await storage.getQuizSessionsByCreator(userId);
      const enriched = await Promise.all(
        sessions.map(async (s) => {
          const scores = await storage.getQuizSessionScores(s.id);
          return { ...s, playerCount: scores.length };
        })
      );
      res.json(enriched);
    } catch {
      res.status(500).json({ error: "Failed to fetch quiz sessions" });
    }
  });

  app.delete("/api/quiz-sessions/:code", requireAuth, async (req: any, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      if (session.creatorId !== req.user.id) return res.status(403).json({ error: "Only the creator can delete this session" });
      await storage.deleteQuizSession(session.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete quiz session" });
    }
  });

  app.get("/api/quiz-sessions/:code", async (req, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      const creator = session.creatorId ? await storage.getUserById(session.creatorId) : undefined;
      const enriched = {
        ...session,
        creatorName: creator?.name ?? session.creatorName,
        creatorAvatarUrl: creator?.avatarUrl ?? null,
        isClosed: !!(session.closesAt && new Date(session.closesAt) < new Date()),
      };
      res.json(enriched);
    } catch {
      res.status(500).json({ error: "Failed to fetch quiz session" });
    }
  });

  app.post("/api/quiz-sessions/:code/scores", requireAuth, async (req: any, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      if (session.closesAt && new Date(session.closesAt) < new Date()) {
        return res.status(403).json({ error: "Quiz session is closed" });
      }
      const userId = req.user.id;
      const existing = await storage.getQuizSessionScore(session.id, userId);
      if (existing) return res.status(409).json({ error: "Already submitted", score: existing });
      const { score } = req.body;
      if (typeof score !== "number") return res.status(400).json({ error: "score is required" });
      const entry = await storage.addQuizSessionScore(session.id, userId, score);
      res.json(entry);
    } catch {
      res.status(500).json({ error: "Failed to submit score" });
    }
  });

  app.get("/api/quiz-sessions/:code/scores", async (req: any, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      const scores = await storage.getQuizSessionScores(session.id);
      const myScore = req.user ? scores.find((s: any) => s.userId === req.user.id) : undefined;
      res.json({ scores, myScore: myScore ?? null });
    } catch {
      res.status(500).json({ error: "Failed to fetch scores" });
    }
  });

  app.get("/api/quiz-sessions/:code/results", requireAuth, async (req: any, res) => {
    try {
      const session = await storage.getQuizSessionByCode(req.params.code.toUpperCase());
      if (!session) return res.status(404).json({ error: "Quiz session not found" });
      if (session.creatorId !== req.user.id) return res.status(403).json({ error: "Only the quiz creator can view results" });
      const [scores, creator] = await Promise.all([
        storage.getQuizSessionScores(session.id),
        session.creatorId ? storage.getUserById(session.creatorId) : Promise.resolve(undefined),
      ]);
      res.json({
        session: {
          ...session,
          creatorName: creator?.name ?? session.creatorName,
          creatorAvatarUrl: creator?.avatarUrl ?? null,
          isClosed: !!(session.closesAt && new Date(session.closesAt) < new Date()),
        },
        scores,
      });
    } catch {
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });
}
