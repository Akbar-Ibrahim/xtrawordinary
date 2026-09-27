import type { AnalyticsReport } from "@shared/schema";

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function analyticsReportToCsv(report: AnalyticsReport): string {
  const rows: Array<Array<string | number | null>> = [
    ["section", "date", "game_slug", "game_mode", "metric", "current_value", "previous_value", "change_percent"],
  ];

  for (const [metric, comparison] of Object.entries(report.comparison)) {
    rows.push(["summary", "", report.filters.gameSlug ?? "", report.filters.gameMode ?? "", metric, comparison.current, comparison.previous, comparison.changePercent]);
  }
  for (const day of report.daily) {
    rows.push(["daily", day.date, "", "", "uniqueVisitors", day.uniqueVisitors, "", ""]);
    rows.push(["daily", day.date, "", "", "sessions", day.sessions, "", ""]);
    rows.push(["daily", day.date, "", "", "gameStarts", day.gameStarts, "", ""]);
    rows.push(["daily", day.date, "", "", "gameCompletions", day.gameCompletions, "", ""]);
    rows.push(["daily", day.date, "", "", "registrations", day.registrations, "", ""]);
  }
  for (const game of report.games) {
    rows.push(["game", "", game.gameSlug, game.gameMode, "starts", game.starts, "", ""]);
    rows.push(["game", "", game.gameSlug, game.gameMode, "completions", game.completions, "", ""]);
    rows.push(["game", "", game.gameSlug, game.gameMode, "completionRate", game.completionRate, "", ""]);
  }
  for (const [metric, value] of Object.entries(report.funnel)) {
    rows.push(["funnel", "", report.filters.gameSlug ?? "", report.filters.gameMode ?? "", metric, value, "", ""]);
  }
  for (const [metric, value] of Object.entries(report.audience)) {
    rows.push(["audience", "", "", "", metric, value, "", ""]);
  }
  for (const cohort of report.retention) {
    rows.push(["retention", cohort.cohortDate, "", "", "cohortVisitors", cohort.visitors, "", ""]);
    rows.push(["retention", cohort.cohortDate, "", "", "day1Returning", cohort.day1, "", ""]);
    rows.push(["retention", cohort.cohortDate, "", "", "day7Returning", cohort.day7, "", ""]);
    rows.push(["retention", cohort.cohortDate, "", "", "day30Returning", cohort.day30, "", ""]);
  }

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}