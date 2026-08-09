import { test, expect } from "@playwright/test";

/**
 * Accessibility test: leaderboard live region announcements.
 *
 * Verifies that the leaderboard results container carries aria-live="polite"
 * and that a visually-hidden status string updates when the user changes the
 * time filter or view toggle, so screen readers announce the change.
 */
test.describe("Leaderboard aria-live announcements", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");
  });

  test("leaderboard results container has aria-live=polite", async ({ page }) => {
    const resultsRegion = page.getByTestId("leaderboard-results").first();
    await expect(resultsRegion).toBeAttached();
    await expect(resultsRegion).toHaveAttribute("aria-live", "polite");
    await expect(resultsRegion).toHaveAttribute("aria-atomic", "true");
  });

  test("status text reflects 'all time' by default", async ({ page }) => {
    // Wait for results to load (skeleton disappears)
    await expect(page.getByTestId("leaderboard-results").first()).toBeAttached();
    await page.waitForTimeout(800);

    const status = page.getByTestId("leaderboard-status").first();
    await expect(status).toBeAttached();
    const text = await status.textContent();
    expect(text).toMatch(/global/i);
    expect(text).toMatch(/all time/i);
  });

  test("status text updates when time filter changes to Today", async ({ page }) => {
    await page.waitForTimeout(800);

    await page.getByTestId("filter-time-today").click();
    await page.waitForTimeout(600);

    const status = page.getByTestId("leaderboard-status").first();
    const text = await status.textContent();
    expect(text).toMatch(/today/i);
  });

  test("status text updates when time filter changes to This Week", async ({ page }) => {
    await page.waitForTimeout(800);

    await page.getByTestId("filter-time-week").click();
    await page.waitForTimeout(600);

    const status = page.getByTestId("leaderboard-status").first();
    const text = await status.textContent();
    expect(text).toMatch(/this week/i);
  });
});
