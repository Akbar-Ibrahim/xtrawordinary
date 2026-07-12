import { test, expect } from "@playwright/test";

/**
 * E2E regression test for friends page URL sync.
 *
 * Verifies that when a user is already on /friends and the URL changes to
 * /friends?tab=<tab> (e.g. from a notification link like friend_challenge_result
 * which links to /friends?tab=challenges), the correct tab becomes active without
 * a full page reload.
 *
 * The fix was already present in client/src/pages/friends.tsx:
 *   useEffect(() => { setActiveTab(getTabFromSearch()); }, [location]);
 * This test confirms the pattern holds under the notification-link edge case.
 */
test.describe("Friends page URL sync (notification link edge case)", () => {
  test("updates active tab when URL param changes while already on the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const ts = Date.now();
    const email = `friends_urlsync_${ts}@test.com`;
    const password = "Password123!";

    // Register + login via page.request so cookies are shared with the browser
    const reg = await page.request.post("/api/auth/register", {
      data: { email, password, name: `FriendsSyncUser_${ts}` },
    });
    expect(reg.status()).toBe(201);

    const login = await page.request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(login.status()).toBe(200);

    // ── Step 1: Navigate to /friends (default "friends" tab) ──
    await page.goto("/friends");
    await page.waitForLoadState("networkidle");

    const friendsTab = page.getByTestId("tab-friends");
    await expect(friendsTab).toBeVisible();
    await expect(friendsTab).toHaveAttribute("data-state", "active");

    // ── Step 2: Simulate notification link → /friends?tab=challenges ──
    // This mirrors what happens when a friend_challenge_result notification is clicked
    await page.evaluate(() => {
      window.history.pushState({}, "", "/friends?tab=challenges");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const challengesTab = page.getByTestId("tab-challenges");
    await expect(challengesTab).toHaveAttribute("data-state", "active");
    await expect(friendsTab).not.toHaveAttribute("data-state", "active");

    // ── Step 3: Simulate another notification → /friends?tab=duels ──
    await page.evaluate(() => {
      window.history.pushState({}, "", "/friends?tab=duels");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const duelsTab = page.getByTestId("tab-duels");
    await expect(duelsTab).toHaveAttribute("data-state", "active");
    await expect(challengesTab).not.toHaveAttribute("data-state", "active");

    // ── Step 4: Switch to requests tab ──
    await page.evaluate(() => {
      window.history.pushState({}, "", "/friends?tab=requests");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    const requestsTab = page.getByTestId("tab-requests");
    await expect(requestsTab).toHaveAttribute("data-state", "active");

    // ── Step 5: Removing ?tab= param reverts to "friends" (default) ──
    await page.evaluate(() => {
      window.history.pushState({}, "", "/friends");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForTimeout(500);

    await expect(friendsTab).toHaveAttribute("data-state", "active");
  });
});
