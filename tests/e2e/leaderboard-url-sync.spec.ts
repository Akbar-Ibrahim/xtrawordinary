import { test, expect } from "@playwright/test";

/**
 * E2E regression test for leaderboard URL sync.
 *
 * Verifies that when a user is already on the /leaderboard page and the URL
 * changes to /leaderboard?game=<slug> (e.g. by clicking a leaderboard_overtaken
 * notification), the correct game tab becomes active without a full page reload.
 *
 * The fix lives in a useEffect in client/src/pages/leaderboard.tsx that watches
 * the URL search string and calls setSelectedGame() when the ?game= param changes.
 */
test.describe("Leaderboard URL sync (notification link edge case)", () => {
  test("updates selected game when URL param changes while already on the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // ── Step 1: Load /leaderboard with no game param (defaults to "overall") ──
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");

    // Sidebar should be visible (desktop layout)
    const gameFilter = page.getByTestId("input-game-filter");
    await expect(gameFilter).toBeVisible();

    // "Overall" sidebar item should be active (bg-primary class)
    const overallItem = page.getByTestId("sidebar-game-overall");
    await expect(overallItem).toBeVisible();
    await expect(overallItem).toHaveClass(/bg-primary/);

    // ── Step 2: Simulate notification link — change URL while staying on page ──
    // Uses pushState + popstate to mimic Wouter's client-side navigation,
    // exactly as a notification link click would trigger.
    await page.evaluate(() => {
      window.history.pushState({}, "", "/leaderboard?game=word-chain");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    // "Word Chain" sidebar item should now be active
    const wordChainItem = page.getByTestId("sidebar-game-word-chain");
    await expect(wordChainItem).toBeVisible();
    await expect(wordChainItem).toHaveClass(/bg-primary/);

    // "Overall" should no longer be active
    await expect(overallItem).not.toHaveClass(/bg-primary/);

    // Card title should reflect the new selection
    const gameNameSpan = page.getByTestId("text-selected-game-name");
    await expect(gameNameSpan).toBeVisible();
    await expect(gameNameSpan).toHaveText("Word Chain");

    // ── Step 3: Change to a second different game — confirm it also updates ──
    await page.evaluate(() => {
      window.history.pushState({}, "", "/leaderboard?game=word-scramble");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const wordScrambleItem = page.getByTestId("sidebar-game-word-scramble");
    await expect(wordScrambleItem).toBeVisible();
    await expect(wordScrambleItem).toHaveClass(/bg-primary/);

    await expect(wordChainItem).not.toHaveClass(/bg-primary/);

    await expect(gameNameSpan).toHaveText("Word Scramble");
  });
});
