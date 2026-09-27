import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { buildAnalyticsReport } from "../../../../../server/analytics/analytics";
import { AnalyticsSections } from "./AnalyticsSections";

test("Overview exposes keyboard-accessible analytics tabs and displays one section at a time", () => {
  const report = buildAnalyticsReport([], "2026-09-01", "2026-09-07");
  const html = renderToStaticMarkup(
    <AnalyticsSections
      report={report}
      games={[]}
      stats={{ totalUsers: 3, totalGamesPlayed: 8, gamesPerSlug: { "word-fusion": 8 } }}
      isLoading={false}
      hasError={false}
    />,
  );

  assert.match(html, /role="tablist"/);
  for (const section of ["period", "pulse", "activation", "audience", "games", "daily", "totals"]) {
    assert.match(html, new RegExp(`data-testid="overview-section-${section}"`));
  }
  assert.match(html, /data-state="active"[^>]*data-testid="overview-section-period"/);
  assert.match(html, /data-testid="overview-panel-period"/);
  assert.match(html, /What changed/);
  assert.doesNotMatch(html, /How players moved through the collection/);
  assert.doesNotMatch(html, /Registered-player game totals/);
});

test("Site Totals remains in the navigation when the analytics report is unavailable", () => {
  const html = renderToStaticMarkup(
    <AnalyticsSections games={[]} isLoading={false} hasError={true} />,
  );

  assert.match(html, /data-testid="overview-section-totals"/);
  assert.match(html, /Analytics could not be loaded/);
});