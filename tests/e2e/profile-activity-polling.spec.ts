import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const PASSWORD = "ProfileActivity123!";

async function createAccount(request: APIRequestContext, label: string) {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `pa${unique}`;
  const email = `${label}_${unique}@example.com`;
  const registration = await request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const login = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  const response = await request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  const { user } = await response.json();
  return user as { id: number };
}

async function createAcceptedFriend(
  page: Page,
  browser: Browser,
  label: string,
) {
  const viewer = await createAccount(page.request, `${label}_viewer`);
  const friendContext = await browser.newContext();
  const friend = await createAccount(friendContext.request, `${label}_friend`);

  const requestResponse = await page.request.post("/api/friends/request", {
    data: { userId: friend.id },
  });
  expect(requestResponse.status()).toBe(200);
  const friendship = await requestResponse.json();

  const acceptResponse = await friendContext.request.post(
    `/api/friends/${friendship.id}/accept`,
  );
  expect(acceptResponse.status()).toBe(200);

  return { viewer, friend, friendContext, friendship };
}

test.describe("Profile friend-activity polling", () => {
  test("changes from active to last active at the threshold without refetching profile data", async ({
    page,
    browser,
  }) => {
    const { friend, friendContext } = await createAcceptedFriend(
      page,
      browser,
      "profile_activity_expiry",
    );
    const now = new Date();
    const activityAt = new Date(now.getTime() - 4 * 60_000 - 30_000).toISOString();
    let activityRequestCount = 0;
    const apiPaths: string[] = [];
    const finishedApiPaths = new Set<string>();
    const profileDataPaths = [
      `/api/users/${friend.id}/profile`,
      `/api/users/${friend.id}/streak`,
      `/api/users/${friend.id}/quiz-sessions`,
      `/api/users/${friend.id}/championships`,
      `/api/users/${friend.id}/word-wars-stats`,
      `/api/users/${friend.id}/guild-wars-championships`,
      `/api/duels/sessions/${friend.id}`,
      `/api/duels/ratings/${friend.id}`,
    ];

    await page.clock.install({ time: now });
    page.on("request", request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) apiPaths.push(pathname);
    });
    page.on("requestfinished", request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) finishedApiPaths.add(pathname);
    });
    page.on("requestfailed", request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) finishedApiPaths.add(pathname);
    });
    await page.route(`**/api/users/${friend.id}/activity`, async route => {
      activityRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ lastActiveAt: activityAt }),
      });
    });

    await page.goto(`/profile/${friend.id}`);
    await expect(page.getByTestId("text-profile-name")).toBeVisible();
    const activityIndicator = page.getByTestId("text-user-activity");
    await expect(activityIndicator).toHaveText("Active now");
    await expect.poll(() => profileDataPaths.every(path => finishedApiPaths.has(path)))
      .toBe(true);

    const baselineApiCounts = new Map<string, number>();
    for (const path of profileDataPaths) {
      const count = apiPaths.filter(requestedPath => requestedPath === path).length;
      baselineApiCounts.set(path, count);
    }
    expect(activityRequestCount).toBe(1);

    // The timestamp is unchanged; only the five-minute threshold should update the label.
    await page.clock.fastForward(31_000);
    await expect(activityIndicator).toHaveText(/Last active/);
    expect(activityRequestCount).toBe(1);

    const afterExpiryApiCounts = new Map<string, number>();
    for (const path of profileDataPaths) {
      afterExpiryApiCounts.set(
        path,
        apiPaths.filter(requestedPath => requestedPath === path).length,
      );
    }
    expect(afterExpiryApiCounts).toEqual(baselineApiCounts);

    await friendContext.close();
  });

  test("updates the indicator on its poll without refetching profile or history", async ({
    page,
    browser,
  }) => {
    const { friend, friendContext } = await createAcceptedFriend(
      page,
      browser,
      "profile_activity_poll",
    );
    const now = new Date();
    let activityAt = new Date(now.getTime() - 10 * 60_000).toISOString();
    let activityRequestCount = 0;
    const apiPaths: string[] = [];
    const finishedApiPaths = new Set<string>();

    await page.clock.install({ time: now });
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/")) apiPaths.push(url.pathname);
    });
    page.on("requestfinished", request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) finishedApiPaths.add(pathname);
    });
    page.on("requestfailed", request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/api/")) finishedApiPaths.add(pathname);
    });
    await page.route(`**/api/users/${friend.id}/activity`, async route => {
      activityRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ lastActiveAt: activityAt }),
      });
    });

    await page.goto(`/profile/${friend.id}`);
    await expect(page.getByTestId("text-profile-name")).toBeVisible();
    const activityIndicator = page.getByTestId("text-user-activity");
    await expect(activityIndicator).toHaveText(/Last active/);
    await expect.poll(() => finishedApiPaths.has(`/api/users/${friend.id}/profile`))
      .toBe(true);
    await expect.poll(() => finishedApiPaths.has(`/api/duels/sessions/${friend.id}`))
      .toBe(true);

    const baselineApiCounts = new Map<string, number>();
    for (const path of apiPaths) {
      baselineApiCounts.set(path, (baselineApiCounts.get(path) ?? 0) + 1);
    }
    const initialActivityRequestCount = activityRequestCount;

    activityAt = new Date(now.getTime() + 60_000).toISOString();
    await page.clock.fastForward(60_000);

    await expect(activityIndicator).toHaveText("Active now");
    await expect.poll(() => activityRequestCount).toBe(initialActivityRequestCount + 1);

    const afterPollApiCounts = new Map<string, number>();
    for (const path of apiPaths) {
      afterPollApiCounts.set(path, (afterPollApiCounts.get(path) ?? 0) + 1);
    }
    const isFriendProfileDataPath = (path: string) =>
      path.startsWith(`/api/users/${friend.id}/`) ||
      path === `/api/duels/sessions/${friend.id}` ||
      path === `/api/duels/ratings/${friend.id}`;
    for (const [path, count] of baselineApiCounts) {
      if (!isFriendProfileDataPath(path) || path === `/api/users/${friend.id}/activity`) continue;
      expect(afterPollApiCounts.get(path) ?? 0, `${path} should not refetch during activity polling`).toBe(count);
    }
    expect(afterPollApiCounts.get(`/api/users/${friend.id}/activity`))
      .toBe(initialActivityRequestCount + 1);

    await friendContext.close();
  });

  test("clears activity when it is hidden or the friendship is removed", async ({
    page,
    browser,
  }) => {
    const { friend, friendContext, friendship } = await createAcceptedFriend(
      page,
      browser,
      "profile_activity_privacy",
    );
    const visibleActivity = await page.request.get(`/api/users/${friend.id}/activity`);
    expect(visibleActivity.status()).toBe(200);
    expect((await visibleActivity.json()).lastActiveAt).toBeTruthy();

    await page.clock.install({ time: new Date() });
    await page.goto(`/profile/${friend.id}`);
    const activityIndicator = page.getByTestId("text-user-activity");
    await expect(activityIndicator).toBeVisible();

    const hideResponse = await friendContext.request.patch("/api/users/me", {
      data: { hideActivity: true },
    });
    expect(hideResponse.status()).toBe(200);
    await page.clock.fastForward(60_000);
    await expect(activityIndicator).toHaveCount(0);

    const showResponse = await friendContext.request.patch("/api/users/me", {
      data: { hideActivity: false },
    });
    expect(showResponse.status()).toBe(200);
    await page.clock.fastForward(60_000);
    await expect(activityIndicator).toBeVisible();

    const removeResponse = await page.request.delete(`/api/friends/${friendship.id}`);
    expect(removeResponse.status()).toBe(200);
    await page.clock.fastForward(60_000);
    await expect(activityIndicator).toHaveCount(0);

    await friendContext.close();
  });
});
