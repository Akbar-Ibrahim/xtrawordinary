import { test, expect } from "@playwright/test";

/**
 * E2E regression test for group detail page URL sync.
 *
 * Verifies that when a user is already on /groups/:id and the URL changes to
 * /groups/:id?tab=<tab> (e.g. from a notification link like group_round_start
 * which could link to /groups/:id?tab=rounds), the correct tab becomes active
 * without a full page reload.
 *
 * The fix lives in a useEffect in client/src/pages/group-detail.tsx that watches
 * wouter's location and calls setActiveTab(getGroupTabFromSearch()).
 * The <Tabs> component uses value={activeTab} instead of defaultValue.
 */
test.describe("Group detail page URL sync (notification link edge case)", () => {
  test("updates active tab when URL param changes while already on the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const ts = Date.now();
    const email = `group_urlsync_${ts}@test.com`;
    const password = "Password123!";

    // Register + login via page.request so cookies are shared with the browser
    const reg = await page.request.post("/api/auth/register", {
      data: { email, password, name: `GroupSyncUser_${ts}` },
    });
    expect(reg.status()).toBe(201);

    const login = await page.request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(login.status()).toBe(200);

    // Create a group to navigate to
    const groupRes = await page.request.post("/api/groups", {
      data: { name: `URLSyncGroup_${ts}`, description: "E2E test group", isPublic: true },
    });
    expect(groupRes.status()).toBe(201);
    const group = await groupRes.json();
    const groupId = group.id;
    expect(groupId).toBeGreaterThan(0);

    // ── Step 1: Navigate to group detail (default "rounds" tab) ──
    await page.goto(`/groups/${groupId}`);
    await page.waitForLoadState("networkidle");

    const roundsTab = page.getByTestId("tab-rounds");
    await expect(roundsTab).toBeVisible();
    await expect(roundsTab).toHaveAttribute("data-state", "active");

    // ── Step 2: Simulate notification link → ?tab=members ──
    await page.evaluate(() => {
      const url = window.location.pathname + "?tab=members";
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const membersTab = page.getByTestId("tab-members");
    await expect(membersTab).toHaveAttribute("data-state", "active");
    await expect(roundsTab).not.toHaveAttribute("data-state", "active");

    // ── Step 3: Simulate another notification → ?tab=activity ──
    await page.evaluate(() => {
      const url = window.location.pathname.split("?")[0] + "?tab=activity";
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const activityTab = page.getByTestId("tab-activity");
    await expect(activityTab).toHaveAttribute("data-state", "active");
    await expect(membersTab).not.toHaveAttribute("data-state", "active");

    // ── Step 4: Switch to leaderboard tab ──
    await page.evaluate(() => {
      const url = window.location.pathname.split("?")[0] + "?tab=leaderboard";
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const leaderboardTab = page.getByTestId("tab-leaderboard");
    await expect(leaderboardTab).toHaveAttribute("data-state", "active");

    // ── Step 5: Removing ?tab= param reverts to "rounds" (default) ──
    await page.evaluate(() => {
      window.history.pushState({}, "", window.location.pathname.split("?")[0]);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    await expect(roundsTab).toHaveAttribute("data-state", "active");
  });
});
