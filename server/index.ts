import "dotenv/config";
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.2,
  });
}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initStorage, getStorage } from "./storage";
import { setupDuelWebSocket } from "./duel-ws";
import { setupTeamRaceWebSocket } from "./team-race-ws";
import { applySecurityMiddleware, apiLimiter } from "./middleware/security";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

applySecurityMiddleware(app);
app.use("/api", apiLimiter);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export type LogLevel = "info" | "warn" | "error";

export function log(message: string, source = "express", level: LogLevel = "info") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const levelTag = level === "error" ? " [ERROR]" : level === "warn" ? " [WARN]" : "";
  console.log(`${formattedTime} [${source}]${levelTag} ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      const level: LogLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      log(logLine, "express", level);
    }
  });

  next();
});

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runPruneJob() {
  try {
    const count = await getStorage().pruneNotifications();
    if (count > 0) {
      log(`Deleted ${count} old notification(s)`, "prune");
    }
  } catch (err) {
    log(`Error pruning notifications: ${err}`, "prune", "error");
  }
}

async function runWordWarsJobs() {
  try {
    const st = getStorage();
    const { executeBracketDraw } = await import("./word-wars-engine");
    const tournaments = await st.listWordWarsTournaments();
    const now = new Date();

    for (const t of tournaments) {
      if (t.status === "registration" && new Date(t.registrationDeadline) <= now) {
        log(`Tournament ${t.id} registration closed — auto-drawing bracket`, "word-wars");
        const result = await executeBracketDraw(t.id);
        if ("error" in result) {
          log(`Tournament ${t.id} auto-draw failed: ${result.error}`, "word-wars", "warn");
        } else {
          log(`Tournament ${t.id} bracket drawn (${result.matches.length} matches)`, "word-wars");
        }
        continue;
      }

      if (t.status === "active") {
        const matches = await st.listWordWarsMatchesForTournament(t.id);
        for (const m of matches) {
          if (m.status === "active" && m.deadline && new Date(m.deadline) <= now) {
            const games = await st.getWordWarsMatchGames(m.id);
            const p1Wins = games.filter(g => g.winnerId === m.player1Id).length;
            const p2Wins = games.filter(g => g.winnerId === m.player2Id).length;
            let forfeitWinner: number | null = null;
            if (p1Wins > p2Wins) forfeitWinner = m.player1Id;
            else if (p2Wins > p1Wins) forfeitWinner = m.player2Id;
            else forfeitWinner = Math.random() < 0.5 ? m.player1Id : m.player2Id;
            await st.updateWordWarsMatch(m.id, { status: "forfeited", winnerId: forfeitWinner });
            log(`Match ${m.id} timed out — winner: ${forfeitWinner}`, "word-wars", "warn");
          }
        }

        const unresolvedMatches = matches.filter(
          m => m.status !== "completed" && m.status !== "forfeited" && m.status !== "bye",
        );
        if (unresolvedMatches.length === 0 && matches.length > 0) {
          await st.updateWordWarsTournament(t.id, { status: "completed" });
          log(`Tournament ${t.id} completed`, "word-wars");
        }
      }
    }
  } catch (err) {
    log(`Scheduler error: ${err}`, "word-wars", "error");
  }
}

function scheduleWordWarsJobs() {
  runWordWarsJobs();
  setInterval(runWordWarsJobs, 60_000);
}

async function runGuildWarsJobs() {
  try {
    const st = getStorage();
    const { executeGuildBracketDraw, checkAndForfeitExpiredGuildMatches } = await import("./guild-wars-engine");
    const tournaments = await st.listGuildWarsTournaments();
    const now = new Date();

    for (const t of tournaments) {
      if (t.status === "registration" && new Date(t.registrationDeadline) <= now) {
        log(`Tournament ${t.id} registration closed — auto-drawing bracket`, "guild-wars");
        const result = await executeGuildBracketDraw(t.id);
        if ("error" in result) {
          log(`Tournament ${t.id} auto-draw failed: ${result.error}`, "guild-wars", "warn");
        } else {
          log(`Tournament ${t.id} bracket drawn (${result.matches.length} matches)`, "guild-wars");
        }
        continue;
      }

      if (t.status === "active") {
        await checkAndForfeitExpiredGuildMatches(t);
      }
    }
  } catch (err) {
    log(`Scheduler error: ${err}`, "guild-wars", "error");
  }
}

function scheduleGuildWarsJobs() {
  runGuildWarsJobs();
  setInterval(runGuildWarsJobs, 60_000);
}

let lastStreakAtRiskDate: string | null = null;

async function runDailyJobs() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastStreakAtRiskDate === today) return;
  lastStreakAtRiskDate = today;
  try {
    const st = getStorage();
    const usersAtRisk = await st.getUsersWithStreakAtRisk();
    for (const { userId, currentStreak } of usersAtRisk) {
      const prefs = await st.getNotificationPreferences(userId);
      if (prefs["streak_at_risk"] === false) continue;
      await st.createNotification({
        userId,
        type: "streak_at_risk",
        title: "Your streak is at risk!",
        body: `Play a game today to keep your ${currentStreak}-day streak alive.`,
        linkUrl: "/",
      });
    }
  } catch (err) {
    log(`Job error: ${err}`, "daily", "error");
  }
}

async function runFriendChallengeExpiry() {
  try {
    const expired = await getStorage().expireFriendChallenges();
    if (expired > 0) log(`Expired ${expired} pending challenge(s)`, "friend-challenges");
  } catch (err) {
    log(`Expiry error: ${err}`, "friend-challenges", "error");
  }
}

process.on("uncaughtException", (err) => {
  log(`Uncaught exception: ${err.stack ?? err.message}`, "process", "error");
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
});

process.on("unhandledRejection", (reason) => {
  log(`Unhandled rejection: ${reason}`, "process", "error");
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
});

(async () => {
  await initStorage();
  runPruneJob();
  setInterval(runPruneJob, PRUNE_INTERVAL_MS);
  scheduleWordWarsJobs();
  scheduleGuildWarsJobs();
  runDailyJobs();
  setInterval(runDailyJobs, 60 * 60 * 1000);
  runFriendChallengeExpiry();
  setInterval(runFriendChallengeExpiry, 30 * 60 * 1000);
  setupAuth(app);
  await registerRoutes(httpServer, app);
  setupDuelWebSocket(httpServer);
  setupTeamRaceWebSocket(httpServer);

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    log(`Unhandled error: ${err.message}`, "express", "error");
    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
