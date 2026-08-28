import { z } from "zod";

export const analyticsEventNameSchema = z.enum([
  "page_view",
  "game_start",
  "game_completion",
  "registration",
]);

export const analyticsEventSchema = z.object({
  eventName: analyticsEventNameSchema,
  visitorId: z.string().min(1).max(64).regex(/^[A-Za-z0-9:_-]+$/),
  sessionId: z.string().min(1).max(64).regex(/^[A-Za-z0-9:_-]+$/),
  dedupeKey: z.string().min(1).max(128).regex(/^[A-Za-z0-9:_-]+$/),
  route: z.string().max(255).optional(),
  gameSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  gameMode: z.string().min(1).max(32).regex(/^[a-z0-9_-]+$/).optional(),
});

export const analyticsClientEventSchema = analyticsEventSchema.omit({
  visitorId: true,
  sessionId: true,
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

export interface AnalyticsEventRecord extends AnalyticsEventInput {
  userId?: number | null;
  occurredAt: string;
}

export interface AnalyticsDailyReport {
  date: string;
  uniqueVisitors: number;
  sessions: number;
  gameStarts: number;
  gameCompletions: number;
  registrations: number;
}

export interface AnalyticsGameReport {
  gameSlug: string;
  gameMode: string;
  starts: number;
  completions: number;
  completionRate: number;
}

export interface AnalyticsFunnelReport {
  visitors: number;
  gameStarters: number;
  gameCompleters: number;
  registrations: number;
  postRegistrationPlayers: number;
  visitorToGameStartRate: number;
  gameStartToCompletionRate: number;
  visitorToRegistrationRate: number;
  registrationToPlayRate: number;
}

export interface AnalyticsAudienceReport {
  newVisitors: number;
  returningVisitors: number;
  newSessions: number;
  returningSessions: number;
  returningVisitorRate: number;
}

export interface AnalyticsRetentionCohort {
  cohortDate: string;
  visitors: number;
  day1: number | null;
  day7: number | null;
  day30: number | null;
}

export interface AnalyticsComparisonMetric {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface AnalyticsComparisonReport {
  uniqueVisitors: AnalyticsComparisonMetric;
  sessions: AnalyticsComparisonMetric;
  gameStarts: AnalyticsComparisonMetric;
  gameCompletions: AnalyticsComparisonMetric;
  registrations: AnalyticsComparisonMetric;
}

export interface AnalyticsReportFilters {
  gameSlug?: string;
  gameMode?: string;
}

export interface AnalyticsReport {
  startDate: string;
  endDate: string;
  filters: AnalyticsReportFilters;
  totals: Omit<AnalyticsDailyReport, "date">;
  daily: AnalyticsDailyReport[];
  games: AnalyticsGameReport[];
  funnel: AnalyticsFunnelReport;
  audience: AnalyticsAudienceReport;
  retention: AnalyticsRetentionCohort[];
  comparison: AnalyticsComparisonReport;
}