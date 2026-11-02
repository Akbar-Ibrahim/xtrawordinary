import type { Request, Response, NextFunction } from "express";
import { log } from "../logger";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err?.type === "entity.parse.failed") {
    const isQuizMutation =
      (req.method === "POST" &&
        (req.path === "/api/quiz-sessions" ||
          /^\/api\/quiz-sessions\/[^/]+\/duplicate\/?$/.test(req.path) ||
          /^\/api\/quiz-sessions\/[^/]+\/scores\/?$/.test(req.path))) ||
      (req.method === "PATCH" && /^\/api\/quiz-sessions\/[^/]+\/?$/.test(req.path));
    const isChallengeOrGroupMutation =
      ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
      /^\/api\/(challenges|groups)(?:\/|$)/.test(req.path);
    if (isQuizMutation || isChallengeOrGroupMutation) {
      res.status(400).json({ error: "Invalid JSON request body" });
      return;
    }
    res.status(400).json({ message: "Invalid JSON request body" });
    return;
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Unhandled error: ${err.message}`, "express", "error");
  res.status(status).json({ message });
  throw err;
}
