import { test, expect, type Page } from "@playwright/test";

const metric = { current: 2, previous: 1, changePercent: 100 };
const report = {
  startDate: "2026-09-01",
  endDate: "2026-09-07",
  filters: {},
  uniqueVisitorsInRetainedHistory: 37,
  totals: { uniqueVisitors: 2, sessions: 2, gameStarts: 1, gameCompletions: 0, registrations: 0 },
  daily: [],
  games: [],
  funnel: {
    visitors: 2, gameStarters: 1, gameCompleters: 0, registrations: 0, postRegistrationPlayers: 0,
    visitorToGameStartRate: 50, gameStartToCompletionRate: 0, visitorToRegistrationRate: 0, registrationToPlayRate: 0,
  },
  audience: { newVisitors: 2, returningVisitors: 0, newSessions: 2, returningSessions: 0, returningVisitorRate: 0 },
  retention: [],
  comparison: {
    uniqueVisitors: metric, sessions: metric, gameStarts: metric, gameCompletions: metric, registrations: metric,
  },
};

async function openOverview(
  page: Page,
  analyticsFails = false,
  reportOverrides: Record<string, unknown> = {},
  stats = { totalUsers: 3, totalGamesPlayed: 8, gamesPerSlug: { "word-fusion": 8 } },
) {
  await page.route("**/api/auth/me", route => route.fulfill({
    json: { user: { id: 1, username: "Admin", name: "Admin Tester", isAdmin: true } },
  }));
  await page.route("**/api/admin/stats", route => route.fulfill({
    json: stats,
  }));
  await page.route("**/api/admin/games", route => route.fulfill({
    json: [{ slug: "word-fusion", name: "Word Fusion" }],
  }));
  await page.route(/\/api\/admin\/analytics\?/, route => route.fulfill(
    analyticsFails ? { status: 500, json: { error: "Report unavailable" } } : { json: { ...report, ...reportOverrides } },
  ));
  await page.goto("/admin");
  await expect(page.getByTestId("overview-section-period")).toBeVisible();
  const closeAnnouncement = page.getByTestId("button-whats-new-close");
  if (await closeAnnouncement.isVisible()) await closeAnnouncement.click();
}

test("Overview sections switch with keyboard and preserve filters and visitor total", async ({ page }) => {
  await openOverview(page);
  await expect(page.getByTestId("total-retained-unique-visitors")).toHaveText("37");
  await expect(page.getByTestId("overview-panel-period")).toBeVisible();

  await page.getByTestId("overview-section-period").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("overview-section-pulse")).toHaveAttribute("data-state", "active");
  await expect(page.getByTestId("overview-panel-pulse")).toBeVisible();
  await expect(page.getByTestId("overview-panel-period")).not.toBeVisible();

  const endDate = await page.locator("#analytics-end").inputValue();
  const startDate = new Date(`${endDate}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 1);
  const narrowedStart = startDate.toISOString().slice(0, 10);
  await page.locator("#analytics-start").fill(narrowedStart);
  await page.getByTestId("overview-section-totals").click();
  await expect(page.locator("#analytics-start")).toHaveValue(narrowedStart);
  await expect(page.getByTestId("total-retained-unique-visitors")).toHaveText("37");
  await expect(page.getByTestId("card-total-users")).toContainText("3");
});

test("Site Totals remains available when the analytics report fails", async ({ page }) => {
  await openOverview(page, true);
  await expect(page.getByText("Analytics could not be loaded for this date range and filter.")).toBeVisible();
  await page.getByTestId("overview-section-totals").click();
  await expect(page.getByTestId("card-total-games")).toContainText("8");
});

for (const width of [390, 1440]) {
  test(`both admin tab rows stay single-line and hide scrollbars at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openOverview(page);
    for (const id of ["admin-tabs-scroll", "overview-sections-scroll"]) {
      const strip = page.getByTestId(id);
      const layout = await strip.evaluate(element => {
        const tops = [...element.querySelectorAll('[role="tab"]')].map(tab => tab.getBoundingClientRect().top);
        const style = getComputedStyle(element);
        return {
          rows: new Set(tops.map(top => Math.round(top))).size,
          overflow: style.overflowX,
          scrollbar: style.getPropertyValue("scrollbar-width"),
          webkitScrollbar: getComputedStyle(element, "::-webkit-scrollbar").display,
          overflows: element.scrollWidth > element.clientWidth,
        };
      });
      expect(layout.rows).toBe(1);
      expect(layout.overflow).toBe("auto");
      expect(layout.scrollbar).toBe("none");
      expect(layout.webkitScrollbar).toBe("none");
      if (width === 390) {
        expect(layout.overflows).toBe(true);
        await strip.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        expect(await strip.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
        await strip.evaluate(element => { element.scrollLeft = 0; });
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`admin-${width}.png`), fullPage: true });

    await page.getByTestId("overview-section-period").focus();
    await page.keyboard.press("End");
    await expect(page.getByTestId("overview-section-totals")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("overview-section-totals")).toBeInViewport();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("overview-section-period")).toHaveAttribute("data-state", "active");
    await page.getByTestId("tab-overview").focus();
    await page.keyboard.press("End");
    await expect(page.getByTestId("tab-site")).toBeInViewport();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("tab-overview")).toHaveAttribute("data-state", "active");
  });
}

test("analytics counts are compact across sections while percentages and dates stay unchanged", async ({ page }, testInfo) => {
  const largeMetric = { current: 10_000, previous: 1_500, changePercent: 100 };
  await openOverview(page, false, {
    uniqueVisitorsInRetainedHistory: 1_000_000,
    comparison: Object.fromEntries(Object.keys(report.comparison).map(key => [key, largeMetric])),
    daily: [{
      date: "2026-09-07", uniqueVisitors: 10_000, sessions: 1_000_000,
      gameStarts: 1_500, gameCompletions: 1_000, registrations: 37,
    }],
    games: [{ gameSlug: "word-fusion", gameMode: "standard", starts: 10_000, completions: 1_000, completionRate: 10 }],
    audience: { newVisitors: 10_000, returningVisitors: 1_500, newSessions: 1_000_000, returningSessions: 1_000, returningVisitorRate: 13 },
    retention: [{ cohortDate: "2026-09-01", visitors: 10_000, day1: 1_500, day7: 1_000, day30: null }],
    funnel: { ...report.funnel, visitors: 10_000, gameStarters: 1_500 },
  }, { totalUsers: 10_000, totalGamesPlayed: 1_000_000, gamesPerSlug: { "word-fusion": 1_500 } });
  await expect(page.getByTestId("total-retained-unique-visitors")).toHaveText("1M");
  const period = page.getByTestId("overview-panel-period");
  await expect(period.getByText("10K", { exact: true })).toHaveCount(5);
  await expect(period.getByText("previous 1.5K", { exact: true })).toHaveCount(5);
  await expect(period.getByText("100.0%", { exact: true })).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath("admin-compact.png"), fullPage: true });

  await page.getByTestId("overview-section-pulse").click();
  const chart = page.getByTestId("overview-panel-pulse");
  await expect(chart.locator(".recharts-yAxis").getByText("1M", { exact: true })).toBeVisible();
  const plot = chart.locator(".recharts-wrapper");
  await plot.scrollIntoViewIfNeeded();
  const box = await plot.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(chart.locator(".recharts-tooltip-wrapper")).toContainText("10K");
  await expect(chart.locator(".recharts-tooltip-wrapper")).toContainText("1M");

  await page.getByTestId("overview-section-activation").click();
  await expect(page.getByTestId("overview-panel-activation")).toContainText("10K");
  await expect(page.getByTestId("overview-panel-activation")).toContainText("1.5K");
  await page.getByTestId("overview-section-audience").click();
  const audience = page.getByTestId("overview-panel-audience");
  await expect(audience).toContainText("1M");
  await expect(audience).toContainText("1.5K");
  await expect(audience.getByRole("cell", { name: "10K", exact: true })).toBeVisible();
  await expect(audience).toContainText("13.0%");
  await page.getByTestId("overview-section-games").click();
  await expect(page.getByTestId("overview-panel-games")).toContainText("10K");
  await expect(page.getByTestId("overview-panel-games")).toContainText("1K");
  await expect(page.getByTestId("overview-panel-games")).toContainText("10.0%");
  await page.getByTestId("overview-section-daily").click();
  const daily = page.getByTestId("overview-panel-daily");
  for (const text of ["2026-09-07", "10K", "1M", "1.5K", "1K", "37"]) {
    await expect(daily.getByRole("cell", { name: text, exact: true })).toBeVisible();
  }
  await page.getByTestId("overview-section-totals").click();
  await expect(page.getByTestId("card-total-users")).toContainText("10K");
  await expect(page.getByTestId("card-total-games")).toContainText("1M");
  await expect(page.getByTestId("game-stat-word-fusion")).toContainText("1.5K");
});