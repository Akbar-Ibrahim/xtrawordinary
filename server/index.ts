import "dotenv/config";
import { initSentry } from "./monitoring";
initSentry(); // must run before other imports to instrument them

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { serveStatic } from "./static";
import { initStorage } from "./storage";
import { setupDuelWebSocket } from "./duel-ws";
import { setupTeamRaceWebSocket } from "./team-race-ws";
import { applySecurityMiddleware, apiLimiter } from "./middleware/security";
import { requestLogger } from "./middleware/request-logger";
import { errorHandler } from "./middleware/error-handler";
import { scheduleAllJobs } from "./jobs";
import { registerProcessHandlers } from "./process-handlers";
import { Sentry } from "./monitoring";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const app = express();
const httpServer = createServer(app);

applySecurityMiddleware(app);
app.use("/api", apiLimiter);
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));
app.use(requestLogger);

(async () => {
  await initStorage();
  scheduleAllJobs();
  registerProcessHandlers();

  setupAuth(app);
  await registerRoutes(httpServer, app);
  setupDuelWebSocket(httpServer);
  setupTeamRaceWebSocket(httpServer);

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(errorHandler);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5005", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    import("./logger").then(({ log }) => log(`serving on port ${port}`));
  });
})();
