import type { Request, Response, NextFunction } from "express";
import { log } from "../logger";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Unhandled error: ${err.message}`, "express", "error");
  res.status(status).json({ message });
  throw err;
}
