import test from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "./mem-storage";
import { parseAnalyticsFilters, registerAnalyticsRoutes } from "./routes/analytics.routes";
import { requireAdmin } from "./auth";
import { analyticsRetentionDays, DEFAULT_ANALYTICS_RETENTION_DAYS } from "./analytics";

test("analytics deduplicates retried events", async () => {
  const storage = new MemStorage();
  const event = {
    eventName: "page_view" as const,
    visitorId: "guest-1",
    sessionId: "session-1",
    dedupeKey: "event-1",
    route: "/",
    occurredAt: "2026-08-27T10:00:00.000Z",
  };

  await storage.recordAnalyticsEvent(event);
  await storage.recordAnalyticsEvent(event);
  const report = await storage.getAnalyticsReport("2026-08-27", "2026-08-27");

  assert.equal(report.totals.uniqueVisitors, 1);
  assert.equal(report.totals.sessions, 1);
});

test("analytics groups guest traffic and game engagement by UTC day and mode", async () => {
  const storage = new MemStorage();
  const events = [
    { eventName: "page_view" as const, visitorId: "guest-1", sessionId: "session-1", dedupeKey: "pv-1", route: "/", occurredAt: "2026-08-26T23:59:59.000Z" },
    { eventName: "page_view" as const, visitorId: "guest-1", sessionId: "session-2", dedupeKey: "pv-2", route: "/game/word-fusion", occurredAt: "2026-08-27T00:00:00.000Z" },
    { eventName: "game_start" as const, visitorId: "guest-1", sessionId: "session-2", dedupeKey: "start-1", gameSlug: "word-fusion", gameMode: "timed", occurredAt: "2026-08-27T00:01:00.000Z" },
    { eventName: "game_start" as const, visitorId: "guest-2", sessionId: "session-3", dedupeKey: "start-2", gameSlug: "word-fusion", gameMode: "timed", occurredAt: "2026-08-27T00:02:00.000Z" },
    { eventName: "game_completion" as const, visitorId: "guest-1", sessionId: "session-2", dedupeKey: "complete-1", gameSlug: "word-fusion", gameMode: "timed", occurredAt: "2026-08-27T00:03:00.000Z" },
    { eventName: "registration" as const, visitorId: "guest-1", sessionId: "session-2", dedupeKey: "registration-1", userId: 42, occurredAt: "2026-08-27T00:04:00.000Z" },
  ];
  for (const event of events) await storage.recordAnalyticsEvent(event);

  const report = await storage.getAnalyticsReport("2026-08-26", "2026-08-27");
  assert.deepEqual(report.daily.map((day) => ({
    date: day.date,
    visitors: day.uniqueVisitors,
    sessions: day.sessions,
    starts: day.gameStarts,
    completions: day.gameCompletions,
    registrations: day.registrations,
  })), [
    { date: "2026-08-26", visitors: 1, sessions: 1, starts: 0, completions: 0, registrations: 0 },
    { date: "2026-08-27", visitors: 2, sessions: 2, starts: 2, completions: 1, registrations: 1 },
  ]);
  assert.equal(report.totals.uniqueVisitors, 2);
  assert.equal(report.totals.sessions, 3);
  assert.deepEqual(report.games, [{
    gameSlug: "word-fusion",
    gameMode: "timed",
    starts: 2,
    completions: 1,
    completionRate: 50,
  }]);
});

test("analytics derives activation, audience, retention, comparisons, and game filters", async () => {
  const storage = new MemStorage();
  const events = [
    { eventName: "page_view" as const, visitorId: "returning", sessionId: "old-session", dedupeKey: "old-page", route: "/", occurredAt: "2025-05-31T10:00:00.000Z" },
    { eventName: "page_view" as const, visitorId: "returning", sessionId: "return-session", dedupeKey: "return-page", route: "/", occurredAt: "2025-06-01T10:00:00.000Z" },
    { eventName: "page_view" as const, visitorId: "new-player", sessionId: "new-session", dedupeKey: "new-page", route: "/", occurredAt: "2025-06-01T10:01:00.000Z" },
    { eventName: "registration" as const, visitorId: "new-player", sessionId: "new-session", dedupeKey: "new-reg", userId: 7, occurredAt: "2025-06-01T10:02:00.000Z" },
    { eventName: "game_start" as const, visitorId: "new-player", sessionId: "new-session", dedupeKey: "new-start", userId: 7, gameSlug: "word-fusion", gameMode: "timed", occurredAt: "2025-06-01T10:03:00.000Z" },
    { eventName: "game_start" as const, visitorId: "returning", sessionId: "return-session", dedupeKey: "return-start", gameSlug: "other-game", gameMode: "timed", occurredAt: "2025-06-01T10:04:00.000Z" },
    { eventName: "game_completion" as const, visitorId: "new-player", sessionId: "new-session", dedupeKey: "new-complete", userId: 7, gameSlug: "word-fusion", gameMode: "timed", occurredAt: "2025-06-01T10:05:00.000Z" },
    { eventName: "page_view" as const, visitorId: "new-player", sessionId: "day-one", dedupeKey: "day-one", route: "/", occurredAt: "2025-06-02T10:00:00.000Z" },
    { eventName: "page_view" as const, visitorId: "new-player", sessionId: "day-seven", dedupeKey: "day-seven", route: "/", occurredAt: "2025-06-08T10:00:00.000Z" },
    { eventName: "page_view" as const, visitorId: "new-player", sessionId: "day-thirty", dedupeKey: "day-thirty", route: "/", occurredAt: "2025-07-01T10:00:00.000Z" },
  ];
  for (const event of events) await storage.recordAnalyticsEvent(event);

  const report = await storage.getAnalyticsReport("2025-06-01", "2025-06-07", { gameSlug: "word-fusion" });
  assert.deepEqual(report.filters, { gameSlug: "word-fusion" });
  assert.equal(report.totals.uniqueVisitors, 2);
  assert.equal(report.totals.gameStarts, 1);
  assert.equal(report.totals.gameCompletions, 1);
  assert.equal(report.funnel.gameStarters, 1);
  assert.equal(report.funnel.gameCompleters, 1);
  assert.equal(report.funnel.postRegistrationPlayers, 1);
  assert.equal(report.funnel.registrationToPlayRate, 100);
  assert.deepEqual(report.audience, {
    newVisitors: 1,
    returningVisitors: 1,
    newSessions: 2,
    returningSessions: 1,
    returningVisitorRate: 50,
  });
  assert.deepEqual(report.retention, [{
    cohortDate: "2025-06-01",
    visitors: 1,
    day1: 1,
    day7: 1,
    day30: 1,
  }]);
  assert.deepEqual(report.games.map((game) => game.gameSlug), ["word-fusion"]);
  assert.equal(report.comparison.uniqueVisitors.previous, 1);
});

test("analytics cleanup removes expired events without removing current activity", async () => {
  const storage = new MemStorage();
  await storage.recordAnalyticsEvent({
    eventName: "page_view",
    visitorId: "expired",
    sessionId: "expired",
    dedupeKey: "expired",
    route: "/",
    occurredAt: "2020-01-01T00:00:00.000Z",
  });
  await storage.recordAnalyticsEvent({
    eventName: "page_view",
    visitorId: "current",
    sessionId: "current",
    dedupeKey: "current",
    route: "/",
    occurredAt: new Date().toISOString(),
  });

  assert.equal(await storage.cleanupAnalyticsEvents(), 1);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal((await storage.getAnalyticsReport(today, today)).totals.uniqueVisitors, 1);
});

test("analytics reporting route is admin-only", () => {
  const routes: Array<{ method: string; path: string; handlers: unknown[] }> = [];
  const app = {
    post(path: string, ...handlers: unknown[]) {
      routes.push({ method: "post", path, handlers });
    },
    get(path: string, ...handlers: unknown[]) {
      routes.push({ method: "get", path, handlers });
    },
  };
  registerAnalyticsRoutes(app as never);
  const reportRoute = routes.find((route) => route.method === "get" && route.path === "/api/admin/analytics");
  assert.ok(reportRoute);
  assert.equal(reportRoute.handlers[0], requireAdmin);
  const csvRoute = routes.find((route) => route.method === "get" && route.path === "/api/admin/analytics.csv");
  assert.ok(csvRoute);
  assert.equal(csvRoute.handlers[0], requireAdmin);
});

test("analytics retention configuration stays within the documented bounds", () => {
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: "90" } as NodeJS.ProcessEnv), 90);
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: "7" } as NodeJS.ProcessEnv), DEFAULT_ANALYTICS_RETENTION_DAYS);
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: "731" } as NodeJS.ProcessEnv), DEFAULT_ANALYTICS_RETENTION_DAYS);
});

test("analytics accepts every tracked mode offered by the admin toolbar", () => {
  for (const gameMode of ["timed", "untimed", "custom"]) {
    assert.deepEqual(parseAnalyticsFilters({ gameMode }), { gameMode });
  }
  assert.equal(parseAnalyticsFilters({ gameMode: "word-sweep" }), null);
});

test("public analytics ingestion rejects fabricated registrations", async () => {
  const routes: Array<{ method: string; path: string; handlers: Array<(req: any, res: any) => unknown> }> = [];
  const app = {
    post(path: string, ...handlers: Array<(req: any, res: any) => unknown>) {
      routes.push({ method: "post", path, handlers });
    },
    get(path: string, ...handlers: Array<(req: any, res: any) => unknown>) {
      routes.push({ method: "get", path, handlers });
    },
  };
  registerAnalyticsRoutes(app as never);
  const ingestRoute = routes.find((route) => route.method === "post" && route.path === "/api/analytics/events");
  assert.ok(ingestRoute);

  let status = 200;
  let body: unknown;
  await ingestRoute.handlers[0]({
    body: {
      eventName: "registration",
      dedupeKey: "forged-registration",
    },
  }, {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  });

  assert.equal(status, 400);
  assert.deepEqual(body, { error: "Registration events are recorded by the server" });
});