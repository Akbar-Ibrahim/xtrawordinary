import { and, gte, lt, min } from "drizzle-orm";
import * as schema from "../db-schema";
import type { AnalyticsEventInput, AnalyticsEventRecord, AnalyticsReport, AnalyticsReportFilters } from "@shared/schema";
import { analyticsRetentionDays, buildAnalyticsReport, utcDateKey } from "../analytics";

export async function verifyAnalyticsPersistence(db: any): Promise<void> {
  await db.select({ id: schema.analyticsEvents.id }).from(schema.analyticsEvents).limit(1);
}

export async function recordAnalyticsEvent(
  db: any,
  event: AnalyticsEventInput & { userId?: number | null; occurredAt?: string },
): Promise<void> {
  await db.insert(schema.analyticsEvents).values({
    eventName: event.eventName,
    visitorId: event.visitorId,
    sessionId: event.sessionId,
    dedupeKey: event.dedupeKey,
    userId: event.userId ?? null,
    route: event.route ?? null,
    gameSlug: event.gameSlug ?? null,
    gameMode: event.gameMode ?? null,
    occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
  }).onDuplicateKeyUpdate({ set: { dedupeKey: event.dedupeKey } });
}

export async function getAnalyticsReport(
  db: any,
  startDate: string,
  endDate: string,
  filters: AnalyticsReportFilters = {},
): Promise<AnalyticsReport> {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const rangeDays = Math.round((new Date(`${endDate}T00:00:00.000Z`).getTime() - start.getTime()) / 86_400_000) + 1;
  start.setUTCDate(start.getUTCDate() - rangeDays);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 31);
  const rows = await db.select({
    eventName: schema.analyticsEvents.eventName,
    visitorId: schema.analyticsEvents.visitorId,
    sessionId: schema.analyticsEvents.sessionId,
    dedupeKey: schema.analyticsEvents.dedupeKey,
    userId: schema.analyticsEvents.userId,
    route: schema.analyticsEvents.route,
    gameSlug: schema.analyticsEvents.gameSlug,
    gameMode: schema.analyticsEvents.gameMode,
    occurredAt: schema.analyticsEvents.occurredAt,
  }).from(schema.analyticsEvents).where(and(
    gte(schema.analyticsEvents.occurredAt, start),
    lt(schema.analyticsEvents.occurredAt, end),
  ));
  const firstSeenRows = await db.select({
    visitorId: schema.analyticsEvents.visitorId,
    firstSeenAt: min(schema.analyticsEvents.occurredAt),
  }).from(schema.analyticsEvents).groupBy(schema.analyticsEvents.visitorId);

  return buildAnalyticsReport(
    rows.map((row: any): AnalyticsEventRecord => ({
      eventName: row.eventName,
      visitorId: row.visitorId,
      sessionId: row.sessionId,
      dedupeKey: row.dedupeKey,
      userId: row.userId ?? null,
      route: row.route ?? undefined,
      gameSlug: row.gameSlug ?? undefined,
      gameMode: row.gameMode ?? undefined,
      occurredAt: row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt),
    })),
    startDate,
    endDate,
    filters,
    new Map(firstSeenRows.map((row: any) => [
      row.visitorId,
      utcDateKey(row.firstSeenAt instanceof Date ? row.firstSeenAt : String(row.firstSeenAt)),
    ])),
  );
}

export async function cleanupAnalyticsEvents(db: any): Promise<number> {
  const cutoff = new Date(Date.now() - analyticsRetentionDays() * 86_400_000);
  const result = await db.delete(schema.analyticsEvents).where(lt(schema.analyticsEvents.occurredAt, cutoff));
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
}