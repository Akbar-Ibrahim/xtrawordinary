import assert from "node:assert/strict";
import test from "node:test";
import { analyticsReportToCsv } from "./analytics-export";
import { buildAnalyticsReport } from "./analytics";

test("analytics CSV contains aggregate sections without raw identities", () => {
  const report = buildAnalyticsReport([{
    eventName: "game_start",
    visitorId: "private-visitor-id",
    sessionId: "private-session-id",
    dedupeKey: "private-dedupe-key",
    gameSlug: "word-fusion",
    gameMode: "timed",
    occurredAt: "2025-06-01T12:00:00.000Z",
  }], "2025-06-01", "2025-06-01");
  const csv = analyticsReportToCsv(report);

  assert.match(csv, /^section,date,game_slug,game_mode,metric,current_value,previous_value,change_percent/m);
  assert.match(csv, /summary/);
  assert.match(csv, /funnel/);
  assert.match(csv, /retention/);
  assert.match(csv, /word-fusion/);
  assert.doesNotMatch(csv, /private-visitor-id|private-session-id|private-dedupe-key/);
});