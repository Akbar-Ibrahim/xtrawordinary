import { test, expect, type Page } from "@playwright/test";

const gameLeaderboardRow = {
  id: 1,
  userId: 101,
  gameSlug: "test-game",
  score: 123,
  hintsUsed: null,
  playerName: "Game-specific score",
  username: "game-player",
  playedAt: "2026-01-01T00:00:00.000Z",
};

const overallLeaderboardRow = {
  ...gameLeaderboardRow,
  id: 2,
  gameSlug: "overall",
  playerName: "Overall-only score",
};

async function mockLeaderboards(page: Page): Promise<string[]> {
  const requestPaths: string[] = [];
  await page.route("**/api/leaderboard**", async (route) => {
    const url = new URL(route.request().url());
    requestPaths.push(`${url.pathname}${url.search}`);
    await route.fulfill({
      json: [url.pathname === "/api/leaderboard" ? overallLeaderboardRow : gameLeaderboardRow],
    });
  });
  return requestPaths;
}

async function openGame(page: Page, slug: string): Promise<void> {
  await page.goto(`/game/${slug}`);
  await page.waitForLoadState("networkidle");

  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) await announcementClose.click();

  await page.getByTestId("button-play").click();
}

test("Ladder Rush: Double Swap shows the selected word-length leaderboard", async ({ page }) => {
  const requestPaths = await mockLeaderboards(page);
  await page.route("**/api/games/ladder-rush/puzzles**", async (route) => {
    const url = new URL(route.request().url());
    const wordLength = Number(url.searchParams.get("wordLength"));
    await route.fulfill({ json: [{ wordLength, start: wordLength === 5 ? "CLEAN" : "COLD" }] });
  });

  await openGame(page, "ladder-rush-double");
  await page.getByTestId("button-mode-5").click();
  await page.getByTestId("button-start").click();
  await expect(page.getByText("Top: 123")).toBeVisible();
  expect(requestPaths).toContain("/api/leaderboard/ladder-rush-double-5");

  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("section-mode-leaderboard")).toContainText("Game-specific score");
});

test("Word Stretch completion shows its Survival leaderboard", async ({ page }) => {
  const requestPaths = await mockLeaderboards(page);
  await page.route("**/api/games/word-stretch/puzzle**", async (route) => {
    await route.fulfill({ json: { word: "CAT", totalSolutions: 2 } });
  });

  await openGame(page, "word-stretch");
  await page.getByTestId("button-mode-survival").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await expect(page.getByTestId("button-play-again")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByTestId("section-leaderboard")).toContainText("Game-specific score");
  expect(requestPaths).toContain("/api/leaderboard/word-stretch-survival");
});

test("Word Bloom completion shows its Survival leaderboard", async ({ page }) => {
  const requestPaths = await mockLeaderboards(page);
  await page.route("**/api/games/word-bloom/puzzle**", async (route) => {
    await route.fulfill({ json: { seed: "BE", maxDepth: 5 } });
  });

  await openGame(page, "word-bloom");
  await page.getByTestId("button-mode-survival").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await page.getByTestId("button-give-up").click();
  await expect(page.getByTestId("section-leaderboard")).toContainText("Game-specific score");
  expect(requestPaths).toContain("/api/leaderboard/word-bloom-survival");
});
