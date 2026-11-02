import { test, expect } from "@playwright/test";

const DAILY_DATE = "2026-10-15";
const DAILY_SEED = 0;
const DAILY_GAME = {
  id: 1,
  slug: "ladder-rush",
  name: "Ladder Rush",
  description: "Daily Ladder Rush regression test",
  color: "#f59e0b",
  icon: "Zap",
};

test("Daily Ladder Rush launches its seeded puzzle and records completion", async ({ page }) => {
  test.setTimeout(120_000);

  let attemptWrites = 0;
  let puzzleRequest = "";
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: null } }));
  await page.route("**/api/analytics/events", route => route.fulfill({ status: 202, json: { ok: true } }));
  await page.route("**/api/daily-challenge", route =>
    route.fulfill({ json: { date: DAILY_DATE, slug: "ladder-rush", game: DAILY_GAME, seed: DAILY_SEED } }),
  );
  await page.route("**/api/daily-challenge/attempt**", route => {
    if (route.request().method() === "POST") attemptWrites += 1;
    return route.fulfill({ status: 401, json: {} });
  });
  await page.route("**/api/games/ladder-rush/puzzles**", route => {
    puzzleRequest = route.request().url();
    return route.fulfill({
      json: [
        { start: "CATS", wordLength: 4 },
        { start: "BATS", wordLength: 4 },
        { start: "COLD", wordLength: 4 },
      ],
    });
  });
  await page.route("**/api/games/validate-word", route =>
    route.fulfill({ json: { valid: true } }),
  );
  await page.route("**/api/leaderboard/**", route => route.fulfill({ json: [] }));

  await page.goto("/daily");
  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) await announcementClose.click();
  await page.getByTestId("button-play-daily").click();

  const input = page.getByTestId("input-word");
  await expect(input).toBeVisible();
  await expect(page.getByTestId("badge-length")).toHaveText("4-letter");
  await expect(page.getByText("BATS", { exact: true })).toBeVisible();
  await expect(page.getByTestId("button-end-game")).toHaveCount(0);
  await expect(page.getByTestId("button-menu")).toHaveCount(0);
  expect(new URL(puzzleRequest).searchParams.get("wordLength")).toBe("4");
  expect(attemptWrites).toBe(1);

  await input.fill("CATS");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText("CATS", { exact: true })).toBeVisible();
  await expect(page.getByText("Challenge Complete", { exact: true })).toBeVisible({ timeout: 100_000 });
  await expect(page.getByTestId("text-daily-score")).toHaveText("Score: 1");
  await expect.poll(() => page.evaluate(date => {
    const records = JSON.parse(localStorage.getItem("wordplay_daily_challenge") ?? "[]");
    return records.find((record: { date: string }) => record.date === date)?.score;
  }, DAILY_DATE)).toBe(1);
  expect(attemptWrites).toBe(1);
});
