import type {
  AnalyticsAudienceReport,
  AnalyticsComparisonMetric,
  AnalyticsComparisonReport,
  AnalyticsDailyReport,
  AnalyticsEventName,
  AnalyticsEventRecord,
  AnalyticsFunnelReport,
  AnalyticsReport,
  AnalyticsReportFilters,
  AnalyticsRetentionCohort,
} from "@shared/schema";

export const ANALYTICS_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const MAX_ANALYTICS_EVENTS = 50_000;
export const DEFAULT_ANALYTICS_RETENTION_DAYS = 730;

export function analyticsRetentionDays(environment: NodeJS.ProcessEnv = process.env): number {
  const configured = Number.parseInt(environment.ANALYTICS_RETENTION_DAYS ?? "", 10);
  return Number.isFinite(configured) && configured >= 30 && configured <= DEFAULT_ANALYTICS_RETENTION_DAYS
    ? configured
    : DEFAULT_ANALYTICS_RETENTION_DAYS;
}

export function utcDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function dateAtUtcStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function nextUtcDate(dateKey: string): string {
  const date = dateAtUtcStart(dateKey);
  date.setUTCDate(date.getUTCDate() + 1);
  return utcDateKey(date);
}

function addUtcDays(dateKey: string, days: number): string {
  const date = dateAtUtcStart(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateKey(date);
}

function emptyDaily(date: string): AnalyticsDailyReport {
  return { date, uniqueVisitors: 0, sessions: 0, gameStarts: 0, gameCompletions: 0, registrations: 0 };
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function comparisonMetric(current: number, previous: number): AnalyticsComparisonMetric {
  return {
    current,
    previous,
    changePercent: previous === 0 ? (current === 0 ? 0 : null) : Math.round(((current - previous) / previous) * 100),
  };
}

function emptyComparison(): AnalyticsComparisonReport {
  return {
    uniqueVisitors: comparisonMetric(0, 0),
    sessions: comparisonMetric(0, 0),
    gameStarts: comparisonMetric(0, 0),
    gameCompletions: comparisonMetric(0, 0),
    registrations: comparisonMetric(0, 0),
  };
}

function isGameEvent(event: AnalyticsEventRecord): boolean {
  return event.eventName === "game_start" || event.eventName === "game_completion";
}

function matchesGameFilter(event: AnalyticsEventRecord, filters: AnalyticsReportFilters): boolean {
  if (!isGameEvent(event)) return true;
  if (filters.gameSlug && event.gameSlug !== filters.gameSlug) return false;
  if (filters.gameMode && event.gameMode !== filters.gameMode) return false;
  return true;
}

function eventTime(event: AnalyticsEventRecord): number {
  return new Date(event.occurredAt).getTime();
}

function buildRetention(
  events: AnalyticsEventRecord[],
  startDate: string,
  endDate: string,
  firstSeenByVisitor: Map<string, string>,
  filters: AnalyticsReportFilters,
): AnalyticsRetentionCohort[] {
  const cohorts = new Map<string, Set<string>>();
  for (const [visitorId, firstSeen] of firstSeenByVisitor) {
    if (firstSeen >= startDate && firstSeen <= endDate) {
      const visitors = cohorts.get(firstSeen) ?? new Set<string>();
      visitors.add(visitorId);
      cohorts.set(firstSeen, visitors);
    }
  }

  const activityByDate = new Map<string, Set<string>>();
  for (const event of events) {
    if (!matchesGameFilter(event, filters)) continue;
    const date = utcDateKey(event.occurredAt);
    const visitors = activityByDate.get(date) ?? new Set<string>();
    visitors.add(event.visitorId);
    activityByDate.set(date, visitors);
  }

  const today = utcDateKey(new Date());
  return [...cohorts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cohortDate, visitors]) => {
    const returning = (days: number): number | null => {
      const targetDate = addUtcDays(cohortDate, days);
      if (targetDate > today) return null;
      const targetVisitors = activityByDate.get(targetDate) ?? new Set<string>();
      return [...visitors].filter((visitorId) => targetVisitors.has(visitorId)).length;
    };
    return {
      cohortDate,
      visitors: visitors.size,
      day1: returning(1),
      day7: returning(7),
      day30: returning(30),
    };
  });
}

interface ReportCore extends AnalyticsReport {
  comparison: AnalyticsComparisonReport;
}

function buildReportCore(
  events: AnalyticsEventRecord[],
  startDate: string,
  endDate: string,
  filters: AnalyticsReportFilters,
  firstSeenByVisitor: Map<string, string>,
): ReportCore {
  const endExclusive = nextUtcDate(endDate);
  const startMs = dateAtUtcStart(startDate).getTime();
  const endMs = dateAtUtcStart(endExclusive).getTime();
  const inRange = events.filter((event) => {
    const time = eventTime(event);
    return Number.isFinite(time) && time >= startMs && time < endMs;
  });
  const relevantEvents = inRange.filter((event) => matchesGameFilter(event, filters));

  const dailyMap = new Map<string, AnalyticsDailyReport>();
  const dailyVisitors = new Map<string, Set<string>>();
  const dailySessions = new Map<string, Set<string>>();
  for (let date = startDate; date <= endDate; date = nextUtcDate(date)) {
    dailyMap.set(date, emptyDaily(date));
    dailyVisitors.set(date, new Set());
    dailySessions.set(date, new Set());
  }

  const totals = emptyDaily("totals");
  const totalVisitors = new Set<string>();
  const totalSessions = new Set<string>();
  const visitorBySession = new Map<string, string>();
  const gameStartVisitors = new Set<string>();
  const gameCompletionVisitors = new Set<string>();
  const registrationUsers = new Set<number>();
  const registrationTimes = new Map<number, number>();
  const postRegistrationPlayers = new Set<number>();
  const games = new Map<string, { gameSlug: string; gameMode: string; starts: number; completions: number }>();

  for (const event of relevantEvents) {
    const date = utcDateKey(event.occurredAt);
    const daily = dailyMap.get(date);
    if (!daily) continue;
    dailyVisitors.get(date)!.add(event.visitorId);
    dailySessions.get(date)!.add(event.sessionId);
    totalVisitors.add(event.visitorId);
    totalSessions.add(event.sessionId);
    visitorBySession.set(event.sessionId, event.visitorId);

    if (event.eventName === "game_start") {
      daily.gameStarts++;
      totals.gameStarts++;
      gameStartVisitors.add(event.visitorId);
      if (event.userId !== null && event.userId !== undefined && registrationTimes.has(event.userId)
        && eventTime(event) > registrationTimes.get(event.userId)!) {
        postRegistrationPlayers.add(event.userId);
      }
    } else if (event.eventName === "game_completion") {
      daily.gameCompletions++;
      totals.gameCompletions++;
      gameCompletionVisitors.add(event.visitorId);
    } else if (event.eventName === "registration") {
      daily.registrations++;
      totals.registrations++;
      if (event.userId !== null && event.userId !== undefined) {
        registrationUsers.add(event.userId);
        registrationTimes.set(event.userId, eventTime(event));
      }
    }

    if (isGameEvent(event) && event.gameSlug) {
      const gameMode = event.gameMode ?? "unknown";
      const key = `${event.gameSlug}\u0000${gameMode}`;
      const current = games.get(key) ?? { gameSlug: event.gameSlug, gameMode, starts: 0, completions: 0 };
      if (event.eventName === "game_start") current.starts++;
      else current.completions++;
      games.set(key, current);
    }
  }

  // Registration events may occur after the game start event in the input order.
  for (const event of relevantEvents) {
    if (event.eventName === "game_start" && event.userId !== null && event.userId !== undefined
      && registrationTimes.has(event.userId) && eventTime(event) > registrationTimes.get(event.userId)!) {
      postRegistrationPlayers.add(event.userId);
    }
  }

  for (const [date, daily] of dailyMap) {
    daily.uniqueVisitors = dailyVisitors.get(date)!.size;
    daily.sessions = dailySessions.get(date)!.size;
  }
  totals.uniqueVisitors = totalVisitors.size;
  totals.sessions = totalSessions.size;

  const newVisitors = [...totalVisitors].filter((id) => {
    const firstSeen = firstSeenByVisitor.get(id);
    return firstSeen ? firstSeen >= startDate && firstSeen <= endDate : true;
  }).length;
  const newSessions = [...totalSessions].filter((sessionId) => {
    const visitorId = visitorBySession.get(sessionId);
    const firstSeen = visitorId ? firstSeenByVisitor.get(visitorId) : undefined;
    return firstSeen ? firstSeen >= startDate && firstSeen <= endDate : true;
  }).length;
  const audience: AnalyticsAudienceReport = {
    newVisitors,
    returningVisitors: totalVisitors.size - newVisitors,
    newSessions,
    returningSessions: totalSessions.size - newSessions,
    returningVisitorRate: rate(totalVisitors.size - newVisitors, totalVisitors.size),
  };
  const funnel: AnalyticsFunnelReport = {
    visitors: totalVisitors.size,
    gameStarters: gameStartVisitors.size,
    gameCompleters: gameCompletionVisitors.size,
    registrations: registrationUsers.size || totals.registrations,
    postRegistrationPlayers: postRegistrationPlayers.size,
    visitorToGameStartRate: rate(gameStartVisitors.size, totalVisitors.size),
    gameStartToCompletionRate: rate(gameCompletionVisitors.size, gameStartVisitors.size),
    visitorToRegistrationRate: rate(registrationUsers.size || totals.registrations, totalVisitors.size),
    registrationToPlayRate: rate(postRegistrationPlayers.size, registrationUsers.size || totals.registrations),
  };

  return {
    startDate,
    endDate,
    filters,
    totals: {
      uniqueVisitors: totals.uniqueVisitors,
      sessions: totals.sessions,
      gameStarts: totals.gameStarts,
      gameCompletions: totals.gameCompletions,
      registrations: totals.registrations,
    },
    daily: [...dailyMap.values()],
    games: [...games.values()]
      .map((game) => ({ ...game, completionRate: rate(game.completions, game.starts) }))
      .sort((a, b) => b.starts - a.starts || b.completions - a.completions || a.gameSlug.localeCompare(b.gameSlug)),
    funnel,
    audience,
    retention: buildRetention(events, startDate, endDate, firstSeenByVisitor, filters),
    comparison: emptyComparison(),
  };
}

export function buildAnalyticsReport(
  events: Array<Omit<AnalyticsEventRecord, "occurredAt"> & { occurredAt: string | Date }>,
  startDate: string,
  endDate: string,
  filters: AnalyticsReportFilters = {},
  firstSeenInput?: Map<string, string>,
): AnalyticsReport {
  const normalizedEvents = events.map((event) => ({ ...event, occurredAt: event.occurredAt instanceof Date ? event.occurredAt.toISOString() : event.occurredAt }));
  const firstSeenByVisitor = firstSeenInput ?? new Map<string, string>();
  if (!firstSeenInput) {
    for (const event of normalizedEvents) {
      const date = utcDateKey(event.occurredAt);
      const current = firstSeenByVisitor.get(event.visitorId);
      if (!current || date < current) firstSeenByVisitor.set(event.visitorId, date);
    }
  }

  const current = buildReportCore(normalizedEvents, startDate, endDate, filters, firstSeenByVisitor);
  const rangeDays = Math.round((dateAtUtcStart(endDate).getTime() - dateAtUtcStart(startDate).getTime()) / 86_400_000) + 1;
  const previousEnd = addUtcDays(startDate, -1);
  const previousStart = addUtcDays(previousEnd, -(rangeDays - 1));
  const previous = buildReportCore(normalizedEvents, previousStart, previousEnd, filters, firstSeenByVisitor);
  current.comparison = {
    uniqueVisitors: comparisonMetric(current.totals.uniqueVisitors, previous.totals.uniqueVisitors),
    sessions: comparisonMetric(current.totals.sessions, previous.totals.sessions),
    gameStarts: comparisonMetric(current.totals.gameStarts, previous.totals.gameStarts),
    gameCompletions: comparisonMetric(current.totals.gameCompletions, previous.totals.gameCompletions),
    registrations: comparisonMetric(current.totals.registrations, previous.totals.registrations),
  };
  return current;
}