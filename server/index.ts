import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initStorage, getStorage } from "./storage";
import { setupDuelWebSocket } from "./duel-ws";
import { setupTeamRaceWebSocket } from "./team-race-ws";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
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

      log(logLine);
    }
  });

  next();
});

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runPruneJob() {
  try {
    const count = await getStorage().pruneNotifications();
    if (count > 0) {
      log(`[prune] Deleted ${count} old notification(s)`, "prune");
    }
  } catch (err) {
    log(`[prune] Error pruning notifications: ${err}`, "prune");
  }
}

async function runWordWarsJobs() {
  try {
    const st = getStorage();
    const { executeBracketDraw } = await import("./word-wars-engine");
    const tournaments = await st.listWordWarsTournaments();
    const now = new Date();

    for (const t of tournaments) {
      // Auto-draw bracket when registration window expires
      if (t.status === "registration" && new Date(t.registrationDeadline) <= now) {
        log(`[word-wars] Tournament ${t.id} registration closed — auto-drawing bracket`, "word-wars");
        const result = await executeBracketDraw(t.id);
        if ("error" in result) {
          log(`[word-wars] Tournament ${t.id} auto-draw failed: ${result.error}`, "word-wars");
        } else {
          log(`[word-wars] Tournament ${t.id} bracket drawn (${result.matches.length} matches)`, "word-wars");
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
            log(`[word-wars] Match ${m.id} timed out — winner: ${forfeitWinner}`, "word-wars");
          }
        }

        const unresolvedMatches = matches.filter(
          m => m.status !== "completed" && m.status !== "forfeited" && m.status !== "bye",
        );
        if (unresolvedMatches.length === 0 && matches.length > 0) {
          await st.updateWordWarsTournament(t.id, { status: "completed" });
          log(`[word-wars] Tournament ${t.id} completed`, "word-wars");
        }
      }
    }
  } catch (err) {
    log(`[word-wars] Scheduler error: ${err}`, "word-wars");
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
        log(`[guild-wars] Tournament ${t.id} registration closed — auto-drawing bracket`, "guild-wars");
        const result = await executeGuildBracketDraw(t.id);
        if ("error" in result) {
          log(`[guild-wars] Tournament ${t.id} auto-draw failed: ${result.error}`, "guild-wars");
        } else {
          log(`[guild-wars] Tournament ${t.id} bracket drawn (${result.matches.length} matches)`, "guild-wars");
        }
        continue;
      }

      if (t.status === "active") {
        // checkAndForfeitExpiredGuildMatches internally triggers bracket advancement,
        // which is also the sole owner of marking the tournament "completed" and
        // creating the champion record. Do NOT mark completed here to avoid a race.
        await checkAndForfeitExpiredGuildMatches(t);
      }
    }
  } catch (err) {
    log(`[guild-wars] Scheduler error: ${err}`, "guild-wars");
  }
}

function scheduleGuildWarsJobs() {
  runGuildWarsJobs();
  setInterval(runGuildWarsJobs, 60_000);
}

(async () => {
  await initStorage();
  runPruneJob();
  setInterval(runPruneJob, PRUNE_INTERVAL_MS);
  scheduleWordWarsJobs();
  scheduleGuildWarsJobs();
  setupAuth(app);
  await registerRoutes(httpServer, app);
  setupDuelWebSocket(httpServer);
  setupTeamRaceWebSocket(httpServer);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
