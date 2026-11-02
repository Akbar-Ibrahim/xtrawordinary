import { test, expect, type Page, type Route } from "@playwright/test";

const leaderboardGames = [
  {
    id: 1,
    slug: "ladder-rush",
    name: "Ladder Rush",
    description: "Build word chains against the clock.",
    longDescription: "Choose a word length and build a word chain.",
    rules: [],
    difficulty: "hard",
    estimatedTime: "1-2 min",
    icon: "Zap",
    color: "hsl(38, 92%, 50%)",
    playCount: 0,
    hasSurvival: true,
    modes: [
      { label: "Easy (4L)", slug: "ladder-rush-4" },
      { label: "Medium (5L)", slug: "ladder-rush-5" },
      { label: "Hard (6L)", slug: "ladder-rush-6" },
    ],
  },
  {
    id: 2,
    slug: "letter-position",
    name: "Letter Position",
    description: "Find words with a target letter.",
    longDescription: "Find words matching the selected letter challenge.",
    rules: [],
    difficulty: "medium",
    estimatedTime: "1-2 min",
    icon: "Type",
    color: "hsl(200, 80%, 50%)",
    playCount: 0,
    hasSurvival: false,
    modes: [
      { label: "Challenge 1", slug: "letter-position-1" },
      { label: "Challenge 2", slug: "letter-position-2" },
    ],
  },
  {
    id: 3,
    slug: "letter-hunt",
    name: "Letter Hunt",
    description: "Find words with exact letter counts.",
    longDescription: "Find words that match the required letter counts.",
    rules: [],
    difficulty: "medium",
    estimatedTime: "6-10 min",
    icon: "Search",
    color: "hsl(320, 70%, 50%)",
    playCount: 0,
    hasSurvival: true,
  },
  {
    id: 4,
    slug: "word-scramble",
    name: "Word Scramble",
    description: "Unscramble letters to reveal hidden words.",
    longDescription: "Unscramble words before running out of lives.",
    rules: [],
    difficulty: "hard",
    estimatedTime: "5-10 min",
    icon: "Puzzle",
    color: "hsl(35, 92%, 50%)",
    playCount: 0,
    hasSurvival: false,
  },
];

async function mockLeaderboardApi(
  page: Page,
  requestedPaths: string[] = [],
  options: {
    user?: { id: number; username: string; name: string };
    friends?: Array<{ id: number }>;
    onGamesRequest?: (route: Route) => Promise<void>;
    onLeaderboardRequest?: (route: Route, path: string) => Promise<void>;
  } = {},
) {
  await page.route("**/api/games", async (route) => {
    if (options.onGamesRequest) {
      await options.onGamesRequest(route);
    } else {
      await route.fulfill({ json: leaderboardGames });
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: options.user ?? null } }),
  );
  await page.route("**/api/friends", (route) =>
    route.fulfill({ json: options.friends ?? [] }),
  );
  const handleLeaderboardRequest = async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    requestedPaths.push(path);
    if (options.onLeaderboardRequest) {
      await options.onLeaderboardRequest(route, path);
    } else {
      await route.fulfill({ json: [] });
    }
  };
  await page.route("**/api/leaderboard", handleLeaderboardRequest);
  await page.route("**/api/leaderboard/**", handleLeaderboardRequest);
}

async function expectRetryToReachEmptyResults(
  page: Page,
  expectedEmptyMessage = "No scores yet. Be the first to play!",
) {
  const error = page.getByTestId("leaderboard-error");
  await expect(error).toContainText("Leaderboard results couldn't be loaded");
  await expect(page.getByTestId("text-no-entries")).toHaveCount(0);

  await page.getByTestId("button-retry-leaderboard").click();
  await expect(error).toHaveCount(0);
  await expect(page.getByTestId("text-no-entries")).toBeVisible();
  await expect(page.getByText(expectedEmptyMessage)).toBeVisible();
}

async function dismissWhatsNew(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible()) await closeButton.click();
}

test.describe("Leaderboard shared links", () => {
  test("keeps Overall available through repeated catalog failures and recovers on a later retry", async ({
    page,
  }) => {
    let failuresRemaining = 4;
    let gameCatalogRequests = 0;
    await mockLeaderboardApi(page, [], {
      onGamesRequest: async (route) => {
        gameCatalogRequests += 1;
        const shouldFail = failuresRemaining > 0;
        if (shouldFail) failuresRemaining -= 1;
        await route.fulfill(
          shouldFail
            ? { status: 500, json: { error: "Game list unavailable" } }
            : { json: leaderboardGames },
        );
      },
    });

    await page.goto("/leaderboard");
    await dismissWhatsNew(page);

    const catalogError = page.getByTestId("game-catalog-error");
    await expect(catalogError).toContainText(
      "Game-specific leaderboards couldn’t be loaded",
    );
    await expect(catalogError).toContainText(
      "The Overall leaderboard is still available.",
    );
    await expect(page.getByTestId("sidebar-game-overall")).toBeVisible();
    await expect(page.getByTestId("text-no-entries")).toBeVisible();
    await expect(page.getByTestId("sidebar-game-ladder-rush")).toHaveCount(0);

    const retryButton = page.getByTestId("button-retry-game-catalog");
    await retryButton.click();
    await expect(catalogError).toContainText(
      "Game-specific leaderboards couldn’t be loaded",
    );
    await expect(catalogError).toContainText(
      "The Overall leaderboard is still available.",
    );
    await expect(retryButton).toBeEnabled();
    await expect(retryButton).toHaveText("Retry");
    await expect(page.getByTestId("sidebar-game-overall")).toBeVisible();
    await expect(page.getByTestId("text-no-entries")).toBeVisible();
    await expect(page.getByTestId("sidebar-game-ladder-rush")).toHaveCount(0);

    await retryButton.click();
    await expect(catalogError).toHaveCount(0);
    await expect(page.getByTestId("sidebar-game-overall")).toBeVisible();
    await expect(page.getByTestId("sidebar-game-ladder-rush")).toBeVisible();
    expect(gameCatalogRequests).toBe(5);
  });

  test("restores the requested game and mode after the catalog retry succeeds", async ({
    page,
  }) => {
    let failuresRemaining = 2;
    let gameCatalogRequests = 0;
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths, {
      onGamesRequest: async (route) => {
        gameCatalogRequests += 1;
        const shouldFail = failuresRemaining > 0;
        if (shouldFail) failuresRemaining -= 1;
        await route.fulfill(
          shouldFail
            ? { status: 500, json: { error: "Game list unavailable" } }
            : { json: leaderboardGames },
        );
      },
    });

    await page.goto(
      "/leaderboard?game=ladder-rush&mode=ladder-rush-6&survival=1",
    );
    await dismissWhatsNew(page);

    const catalogError = page.getByTestId("game-catalog-error");
    await expect(catalogError).toBeVisible();
    await expect(page).toHaveURL(
      /\/leaderboard\?game=ladder-rush&mode=ladder-rush-6&survival=1$/,
    );
    await expect(page.getByText("Overall Rankings")).toBeVisible();

    await page.getByTestId("button-retry-game-catalog").click();

    await expect(catalogError).toHaveCount(0);
    await expect(page.getByTestId("text-selected-game-name")).toHaveText(
      "Ladder Rush",
    );
    await expect(page.getByTestId("tab-mode-ladder-rush-6")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("button-toggle-survival")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page).toHaveURL(
      /\/leaderboard\?game=ladder-rush&mode=ladder-rush-6&survival=1$/,
    );
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/ladder-rush-6-survival");
  });

  test("shows a retryable error for a failed global leaderboard request", async ({
    page,
  }) => {
    let failuresRemaining = 2;
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths, {
      onLeaderboardRequest: async (route, path) => {
        const shouldFail = path === "/api/leaderboard" && failuresRemaining > 0;
        if (shouldFail) failuresRemaining -= 1;
        await route.fulfill(
          shouldFail
            ? { status: 500, json: { error: "Leaderboard unavailable" } }
            : { json: [] },
        );
      },
    });

    await page.goto("/leaderboard");
    await dismissWhatsNew(page);
    await expectRetryToReachEmptyResults(page);
    expect(requestedPaths.filter((path) => path === "/api/leaderboard").length).toBeGreaterThanOrEqual(3);
  });

  test("shows a retryable error for a failed friends leaderboard request", async ({
    page,
  }) => {
    let failuresRemaining = 2;
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths, {
      user: { id: 1, username: "player", name: "Player" },
      friends: [{ id: 2 }],
      onLeaderboardRequest: async (route, path) => {
        const shouldFail =
          path === "/api/leaderboard/overall/friends" && failuresRemaining > 0;
        if (shouldFail) failuresRemaining -= 1;
        await route.fulfill(
          shouldFail
            ? { status: 500, json: { error: "Leaderboard unavailable" } }
            : { json: [] },
        );
      },
    });

    await page.goto("/leaderboard");
    await dismissWhatsNew(page);
    await page.getByTestId("toggle-view-friends").click();
    await expectRetryToReachEmptyResults(
      page,
      "None of your friends have played this yet. Challenge them!",
    );
    expect(requestedPaths.filter((path) => path === "/api/leaderboard/overall/friends").length).toBeGreaterThanOrEqual(3);
  });

  test("shows a retryable error for a failed mode leaderboard request", async ({
    page,
  }) => {
    let failuresRemaining = 2;
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths, {
      onLeaderboardRequest: async (route, path) => {
        const shouldFail =
          path === "/api/leaderboard/ladder-rush-4" && failuresRemaining > 0;
        if (shouldFail) failuresRemaining -= 1;
        await route.fulfill(
          shouldFail
            ? { status: 500, json: { error: "Leaderboard unavailable" } }
            : { json: [] },
        );
      },
    });

    await page.goto("/leaderboard?game=ladder-rush&mode=ladder-rush-4");
    await dismissWhatsNew(page);
    await expectRetryToReachEmptyResults(page);
    expect(requestedPaths).toContain("/api/leaderboard/ladder-rush-4");
  });

  test("restores a selected mode and Survival after reload and requests that board", async ({
    page,
  }) => {
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths);

    await page.goto("/leaderboard?game=ladder-rush&mode=ladder-rush-4");
    const whatsNewClose = page.getByTestId("button-whats-new-close");
    if (await whatsNewClose.isVisible()) await whatsNewClose.click();

    const hardMode = page.getByTestId("tab-mode-ladder-rush-6");
    await expect(hardMode).toHaveAttribute("aria-selected", "false");
    await hardMode.click();
    await expect(hardMode).toHaveAttribute("aria-selected", "true");

    await page.getByTestId("button-toggle-survival").click();
    await expect(page.getByTestId("button-toggle-survival")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page).toHaveURL(
      /\/leaderboard\?game=ladder-rush&mode=ladder-rush-6&survival=1$/,
    );

    requestedPaths.length = 0;
    await page.reload();

    await expect(page.getByTestId("text-selected-game-name")).toHaveText(
      "Ladder Rush",
    );
    await expect(hardMode).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("button-toggle-survival")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/ladder-rush-6-survival");
    expect(requestedPaths).not.toContain("/api/leaderboard/ladder-rush-4-survival");
  });

  test("keeps a direct no-mode Classic link on the Classic board after reload", async ({
    page,
  }) => {
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths);

    await page.goto("/leaderboard?game=letter-hunt");
    await dismissWhatsNew(page);

    const classicToggle = page.getByTestId("button-toggle-classic");
    await expect(classicToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("button-toggle-survival")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/letter-hunt");
    expect(requestedPaths).not.toContain("/api/leaderboard/letter-hunt-survival");

    requestedPaths.length = 0;
    await page.reload();

    await expect(classicToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("button-toggle-survival")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/letter-hunt");
    expect(requestedPaths).not.toContain("/api/leaderboard/letter-hunt-survival");
  });

  test("restores Survival for a game without modes and requests its Survival board", async ({
    page,
  }) => {
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths);

    await page.goto("/leaderboard?game=letter-hunt&survival=1");

    await expect(page.getByTestId("text-selected-game-name")).toHaveText(
      "Letter Hunt",
    );
    await expect(page.getByTestId("button-toggle-survival")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("button-toggle-classic")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page).toHaveURL(
      /\/leaderboard\?game=letter-hunt&survival=1$/,
    );
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/letter-hunt-survival");
    expect(requestedPaths).not.toContain("/api/leaderboard/letter-hunt");
  });

  test("removes a stale mode from a no-mode Survival link", async ({ page }) => {
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths);

    await page.goto(
      "/leaderboard?game=letter-hunt&mode=ladder-rush-6&survival=1",
    );

    await expect(page).toHaveURL(
      /\/leaderboard\?game=letter-hunt&survival=1$/,
    );
    await expect(page.getByTestId("button-toggle-survival")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(() => requestedPaths)
      .toEqual(["/api/leaderboard/letter-hunt-survival"]);
  });

  test("switches from Survival to Classic when choosing another Survival-capable game", async ({
    page,
  }) => {
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths);

    await page.goto(
      "/leaderboard?game=ladder-rush&mode=ladder-rush-6&survival=1",
    );
    await dismissWhatsNew(page);
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/ladder-rush-6-survival");
    requestedPaths.length = 0;

    await page.getByTestId("sidebar-game-letter-hunt").click();

    await expect(page.getByTestId("text-selected-game-name")).toHaveText(
      "Letter Hunt",
    );
    await expect(page.getByTestId("button-toggle-classic")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("button-toggle-survival")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page).toHaveURL(/\/leaderboard\?game=letter-hunt$/);
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/letter-hunt");
    expect(requestedPaths).not.toContain(
      "/api/leaderboard/letter-hunt-survival",
    );
  });

  test("switches a no-mode game from Survival to Classic and requests its Classic board", async ({
    page,
  }) => {
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths);

    await page.goto("/leaderboard?game=letter-hunt&survival=1");
    const whatsNewClose = page.getByTestId("button-whats-new-close");
    if (await whatsNewClose.isVisible()) await whatsNewClose.click();
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/letter-hunt-survival");

    requestedPaths.length = 0;
    await page.getByTestId("button-toggle-classic").click();

    await expect(page.getByTestId("button-toggle-classic")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page).toHaveURL(/\/leaderboard\?game=letter-hunt$/);
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/letter-hunt");
    expect(requestedPaths).not.toContain("/api/leaderboard/letter-hunt-survival");
  });

  test("falls back to the first mode for an invalid mode query", async ({ page }) => {
    await mockLeaderboardApi(page);

    await page.goto("/leaderboard?game=ladder-rush&mode=not-a-mode");

    await expect(page).toHaveURL(
      /\/leaderboard\?game=ladder-rush&mode=ladder-rush-4$/,
    );
    await expect(page.getByTestId("tab-mode-ladder-rush-4")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("button-toggle-classic")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("normalizes a removed game to Overall and requests its leaderboard", async ({
    page,
  }) => {
    const requestedPaths: string[] = [];
    let failuresRemaining = 2;
    await mockLeaderboardApi(page, requestedPaths, {
      onGamesRequest: async (route) => {
        const shouldFail = failuresRemaining > 0;
        if (shouldFail) failuresRemaining -= 1;
        await route.fulfill(
          shouldFail
            ? { status: 500, json: { error: "Game list unavailable" } }
            : { json: leaderboardGames },
        );
      },
    });

    await page.goto(
      "/leaderboard?game=removed-game&mode=removed-mode&survival=1",
    );
    await dismissWhatsNew(page);

    const catalogError = page.getByTestId("game-catalog-error");
    await expect(catalogError).toBeVisible();
    await expect(page).toHaveURL(
      /\/leaderboard\?game=removed-game&mode=removed-mode&survival=1$/,
    );
    await page.getByTestId("button-retry-game-catalog").click();

    await expect(catalogError).toHaveCount(0);
    await expect(page).toHaveURL(/\/leaderboard$/);
    await expect(page.getByText("Overall Rankings")).toBeVisible();
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard");
    expect(requestedPaths).not.toContain("/api/leaderboard/removed-game");
  });

  test("removes Survival from games that do not support it", async ({ page }) => {
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths);

    await page.goto(
      "/leaderboard?game=letter-position&mode=letter-position-2&survival=1",
    );

    await expect(page).toHaveURL(
      /\/leaderboard\?game=letter-position&mode=letter-position-2$/,
    );
    await expect(
      page.getByTestId("tab-mode-letter-position-2"),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("toggle-survival")).toHaveCount(0);
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/letter-position-2");
    expect(requestedPaths).not.toContain("/api/leaderboard/letter-position-2-survival");
  });

  test("normalizes an unsupported Survival link to Classic for a game without modes", async ({
    page,
  }) => {
    const requestedPaths: string[] = [];
    await mockLeaderboardApi(page, requestedPaths);

    await page.goto("/leaderboard?game=word-scramble&survival=1");

    await expect(page).toHaveURL(/\/leaderboard\?game=word-scramble$/);
    await expect(page.getByTestId("text-selected-game-name")).toHaveText(
      "Word Scramble",
    );
    await expect(page.getByTestId("tabs-mode")).toHaveCount(0);
    await expect(page.getByTestId("toggle-survival")).toHaveCount(0);
    await expect
      .poll(() => requestedPaths)
      .toContain("/api/leaderboard/word-scramble");
    expect(requestedPaths).toEqual(["/api/leaderboard/word-scramble"]);
  });
});
