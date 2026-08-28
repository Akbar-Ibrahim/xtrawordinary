import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalyticsQuery, TRACKED_ANALYTICS_MODES } from "./query";

test("analytics UI sends the tracked game and mode filters to reports and exports", () => {
  assert.equal(
    buildAnalyticsQuery("2026-08-01", "2026-08-07", "word-fusion", "timed"),
    "startDate=2026-08-01&endDate=2026-08-07&gameSlug=word-fusion&gameMode=timed",
  );
  assert.deepEqual(TRACKED_ANALYTICS_MODES.map((mode) => mode.slug), ["timed", "untimed", "custom"]);
});

test("analytics UI omits filters when the report covers all games and modes", () => {
  assert.equal(
    buildAnalyticsQuery("2026-08-01", "2026-08-07"),
    "startDate=2026-08-01&endDate=2026-08-07",
  );
});