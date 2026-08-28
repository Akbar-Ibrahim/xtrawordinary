import type { Express, Request } from "express";
import { analyticsClientEventSchema } from "@shared/schema";
import { storage } from "../storage";
import { requireAdmin } from "../auth";
import { recordAnalyticsEventSafely } from "../analytics-events";
import {
  getExistingAnalyticsIdentity,
  getOrCreateAnalyticsIdentity,
  namespacedDedupeKey,
} from "../analytics-identity";
import type { AnalyticsReportFilters } from "@shared/schema";
import { analyticsReportToCsv } from "../analytics-export";

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export function parseAnalyticsFilters(query: Request["query"]): AnalyticsReportFilters | null {
  const filters: AnalyticsReportFilters = {};
  if (query.gameSlug !== undefined) {
    if (typeof query.gameSlug !== "string" || !/^[a-z0-9-]{1,100}$/.test(query.gameSlug)) return null;
    filters.gameSlug = query.gameSlug;
  }
  if (query.gameMode !== undefined) {
    if (typeof query.gameMode !== "string" || !["timed", "untimed", "custom"].includes(query.gameMode)) return null;
    filters.gameMode = query.gameMode;
  }
  return filters;
}

function parseRange(query: Request["query"]): { startDate: string; endDate: string } | null {
  const defaults = defaultDateRange();
  const startDate = query.startDate ?? defaults.startDate;
  const endDate = query.endDate ?? defaults.endDate;
  if (!isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate) return null;
  const rangeLength = Math.round((new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${startDate}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
  return rangeLength <= 90 ? { startDate, endDate } : null;
}

export async function recordRegistrationAnalytics(req: Request, userId: number): Promise<void> {
  try {
    const ids = getExistingAnalyticsIdentity(req) ?? {
      visitorId: `server:registration:${userId}`,
      sessionId: `server:registration:${userId}`,
    };
    await recordAnalyticsEventSafely({
      eventName: "registration",
      ...ids,
      dedupeKey: `registration:${userId}`,
      userId,
      route: "/api/auth/register",
    });
  } catch (error) {
    console.error("[Analytics] Registration recording failed (non-fatal)", error);
  }
}

export function registerAnalyticsRoutes(app: Express): void {
  app.post("/api/analytics/events", async (req, res) => {
    try {
      const parsed = analyticsClientEventSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid analytics event" });
      if (parsed.data.eventName === "registration") {
        return res.status(400).json({ error: "Registration events are recorded by the server" });
      }
      if (parsed.data.eventName === "page_view" && (parsed.data.gameSlug || parsed.data.gameMode)) {
        return res.status(400).json({ error: "Page views cannot include game details" });
      }
      if (parsed.data.eventName !== "page_view") {
        if (!parsed.data.gameSlug || !["timed", "untimed", "custom"].includes(parsed.data.gameMode ?? "")) {
          return res.status(400).json({ error: "Game events require a valid game and mode" });
        }
        if (!await storage.getGameBySlug(parsed.data.gameSlug)) {
          return res.status(400).json({ error: "Unknown game" });
        }
      }
      const identity = getOrCreateAnalyticsIdentity(req, res);
      await recordAnalyticsEventSafely({
        ...parsed.data,
        ...identity,
        dedupeKey: namespacedDedupeKey(identity.sessionId, parsed.data.dedupeKey),
        userId: req.user?.id ?? null,
        occurredAt: new Date().toISOString(),
      });
      res.status(202).json({ ok: true });
    } catch {
      // Analytics must never turn a user-facing request into an application error.
      res.status(202).json({ ok: true });
    }
  });

  app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
    const range = parseRange(req.query);
    const filters = parseAnalyticsFilters(req.query);
    if (!range) return res.status(400).json({ error: "Dates must be valid YYYY-MM-DD values spanning no more than 90 days" });
    if (!filters) return res.status(400).json({ error: "Invalid analytics filter" });

    try {
      res.json(await storage.getAnalyticsReport(range.startDate, range.endDate, filters));
    } catch {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/analytics.csv", requireAdmin, async (req, res) => {
    const range = parseRange(req.query);
    const filters = parseAnalyticsFilters(req.query);
    if (!range) return res.status(400).json({ error: "Dates must be valid YYYY-MM-DD values spanning no more than 90 days" });
    if (!filters) return res.status(400).json({ error: "Invalid analytics filter" });
    try {
      const report = await storage.getAnalyticsReport(range.startDate, range.endDate, filters);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="analytics-${range.startDate}-to-${range.endDate}.csv"`);
      res.send(analyticsReportToCsv(report));
    } catch {
      res.status(500).json({ error: "Failed to export analytics" });
    }
  });
}