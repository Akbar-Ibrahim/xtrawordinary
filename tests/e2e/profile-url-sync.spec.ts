import { test, expect } from "@playwright/test";

/**
 * E2E regression test for profile page URL sync.
 *
 * Verifies that when a user is already on their /profile/:id page and the URL
 * changes to /profile/:id?tab=<tab> (e.g. from a notification link), the correct
 * tab becomes active without a full page reload.
 *
 * The fix lives in a useEffect in client/src/pages/profile.tsx that watches
 * wouter's location and calls setActiveTab(getProfileTabFromSearch()).
 * ProfileTabs.tsx uses a controlled <Tabs value={activeTab}> instead of defaultValue.
 */
test.describe("Profile page URL sync (notification link edge case)", () => {
  let userId: number;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `profile_urlsync_${ts}@test.com`;
    const password = "Password123!";

    const reg = await request.post("/api/auth/register", {
      data: { email, password, name: `ProfileSyncUser_${ts}` },
    });
    expect(reg.status()).toBe(201);

    const login = await request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(login.status()).toBe(200);

    const me = await request.get("/api/auth/me");
    const body = await me.json();
    userId = body.user.id;
    expect(userId).toBeGreaterThan(0);
  });

  test("updates active tab when URL param changes while already on the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const ts = Date.now();
    const email = `profile_urlsync2_${ts}@test.com`;
    const password = "Password123!";

    const reg = await page.request.post("/api/auth/register", {
      data: { email, password, name: `ProfileSyncUser2_${ts}` },
    });
    expect(reg.status()).toBe(201);

    const login = await page.request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(login.status()).toBe(200);

    const me = await page.request.get("/api/auth/me");
    const meBody = await me.json();
    const uid = meBody.user.id;

    // ── Step 1: Navigate to profile (no tab param → defaults to "stats") ──
    await page.goto(`/profile/${uid}`);
    await page.waitForLoadState("networkidle");

    const statsTab = page.getByTestId("tab-game-stats");
    await expect(statsTab).toBeVisible();
    await expect(statsTab).toHaveAttribute("data-state", "active");

    // ── Step 2: Simulate notification link — switch to "achievements" tab ──
    await page.evaluate(() => {
      const url = window.location.pathname + "?tab=achievements";
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const achievementsTab = page.getByTestId("tab-achievements");
    await expect(achievementsTab).toHaveAttribute("data-state", "active");
    await expect(statsTab).not.toHaveAttribute("data-state", "active");

    // ── Step 3: Switch to "rankings" tab ──
    await page.evaluate(() => {
      const url = window.location.pathname + "?tab=rankings";
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const rankingsTab = page.getByTestId("tab-rankings");
    await expect(rankingsTab).toHaveAttribute("data-state", "active");
    await expect(achievementsTab).not.toHaveAttribute("data-state", "active");

    // ── Step 4: Switch to "duels" tab ──
    await page.evaluate(() => {
      const url = window.location.pathname + "?tab=duels";
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const duelsTab = page.getByTestId("tab-duels");
    await expect(duelsTab).toHaveAttribute("data-state", "active");

    // ── Step 5: Removing tab param reverts to "stats" (default) ──
    await page.evaluate(() => {
      window.history.pushState({}, "", window.location.pathname);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    await expect(statsTab).toHaveAttribute("data-state", "active");
  });
});
