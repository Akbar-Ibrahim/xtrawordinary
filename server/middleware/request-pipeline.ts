import express, { type Express } from "express";
import { applySecurityMiddleware, apiLimiter } from "./security";
import { requestLogger } from "./request-logger";
import { errorHandler } from "./error-handler";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function configureRequestPipeline(app: Express): void {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEV_DOMAIN) {
    // Replit forwards preview and production traffic through its proxy. Trust
    // only that single hop so Express resolves client IPs and secure cookies.
    app.set("trust proxy", 1);
  }

  applySecurityMiddleware(app);
  app.use("/api", apiLimiter);
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);
}

export function configureErrorHandling(app: Express): void {
  app.use(errorHandler);
}
