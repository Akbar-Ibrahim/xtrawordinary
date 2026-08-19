import { log } from "./logger";
import { Sentry } from "./monitoring";

export function registerProcessHandlers() {
  process.on("uncaughtException", (err) => {
    log(`Uncaught exception: ${err.stack ?? err.message}`, "process", "error");
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
  });

  process.on("unhandledRejection", (reason) => {
    log(`Unhandled rejection: ${reason}`, "process", "error");
    if (process.env.SENTRY_DSN) Sentry.captureException(reason);
  });
}
