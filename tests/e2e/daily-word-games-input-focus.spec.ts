import { test, expect, type Page } from "@playwright/test";

const DAILY_DATE = "2026-10-15";
const DAILY_SEED = 0;

const EXTENSION_PUZZLES = [
  { shownWord: "TRAIN", validAnswers: ["STRAIN", "TRAINS"] },
  { shownWord: "REACH", validAnswers: ["BREACH", "PREACH"] },
];

const ROOTS_PUZZLES = [
  {
    canonicalWord: "FANTASTIC",
    derivatives: ["FIST", "CAST", "FACT", "STAIN", "ANTICS"],
  },
  {
    canonicalWord: "CHALLENGE",
    derivatives: ["LANE", "HALL", "HANG", "ANGEL", "ANGLE"],
  },
];

async function launchDailyGame(page: Page, slug: "word-extension" | "word-roots") {
  let attemptWrites = 0;
  const game = {
    id: slug === "word-extension" ? 1 : 2,
    slug,
    name: slug === "word-extension" ? "Word Extension" : "Word Roots",
    description: "Daily focus regression test",
    color: "#2563eb",
    icon: "BookOpen",
  };

  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: null } }));
  await page.route("**/api/analytics/events", route => route.fulfill({ status: 202, json: { ok: true } }));
  await page.route("**/api/daily-challenge", route =>
    route.fulfill({ json: { date: DAILY_DATE, slug, game, seed: DAILY_SEED } }),
  );
  await page.route("**/api/daily-challenge/attempt**", route => {
    if (route.request().method() === "POST") attemptWrites += 1;
    return route.fulfill({ status: 401, json: {} });
  });

  await page.goto("/daily");
  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) await announcementClose.click();

  await page.getByTestId("button-play-daily").click();
  await expect(page.getByTestId("button-play-daily")).not.toBeVisible();
  await expect(page.getByTestId("button-exit-daily")).toBeVisible();

  return {
    getAttemptWrites: () => attemptWrites,
  };
}

test("Daily Word Extension focuses its seeded input and the next round after a correct answer", async ({ page }) => {
  const puzzleRequests: string[] = [];
  await page.route("**/api/games/word-extension/puzzles**", route => {
    puzzleRequests.push(route.request().url());
    return route.fulfill({ json: EXTENSION_PUZZLES });
  });
  await page.route("**/api/games/word-extension/validate", route =>
    route.fulfill({ json: { valid: true } }),
  );

  const { getAttemptWrites } = await launchDailyGame(page, "word-extension");
  const input = page.getByTestId("word-input");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await expect(page.getByTestId("shown-word")).toHaveText("TRAIN");
  await expect(page.getByTestId("button-end-game")).toHaveCount(0);
  await expect(page.getByTestId("button-menu")).toHaveCount(0);
  expect(getAttemptWrites()).toBe(1);
  expect(puzzleRequests.some(url => url.includes("lettersToAdd=1") && url.includes("seed=0"))).toBe(true);

  await input.fill("STRAIN");
  await input.press("Enter");

  await expect(page.getByTestId("shown-word")).toHaveText("REACH", { timeout: 5000 });
  await expect(input).toHaveValue("");
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  expect(getAttemptWrites()).toBe(1);
});

test("Daily Word Roots focuses its seeded input and the next round after a correct answer", async ({ page }) => {
  const puzzleRequests: string[] = [];
  await page.route("**/api/games/word-roots/puzzles**", route => {
    puzzleRequests.push(route.request().url());
    return route.fulfill({ json: ROOTS_PUZZLES });
  });
  await page.route("**/api/games/validate-word", route =>
    route.fulfill({ json: { valid: true } }),
  );

  const { getAttemptWrites } = await launchDailyGame(page, "word-roots");
  const input = page.getByTestId("input-word");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await expect(page.getByTestId("badge-round")).toHaveText("Round 1/5");
  await expect(page.getByTestId("button-end-game")).toHaveCount(0);
  await expect(page.getByTestId("button-menu")).toHaveCount(0);
  expect(getAttemptWrites()).toBe(1);
  expect(puzzleRequests.some(url => url.includes("seed=0"))).toBe(true);

  await input.fill("FANTASTIC");
  await page.getByTestId("button-submit").click();

  await expect(page.getByTestId("badge-round")).toHaveText("Round 2/5", { timeout: 5000 });
  await expect(input).toHaveValue("");
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  expect(getAttemptWrites()).toBe(1);
});

test("Daily Word Roots records its score and stays completed after all seeded rounds", async ({ page }) => {
  const completionPuzzles = Array.from({ length: 5 }, (_, index) => ROOTS_PUZZLES[index % ROOTS_PUZZLES.length]);
  const puzzleRequests: string[] = [];
  await page.route("**/api/games/word-roots/puzzles**", route => {
    puzzleRequests.push(route.request().url());
    return route.fulfill({ json: completionPuzzles });
  });
  await page.route("**/api/games/validate-word", route =>
    route.fulfill({ json: { valid: true } }),
  );

  const { getAttemptWrites } = await launchDailyGame(page, "word-roots");
  const input = page.getByTestId("input-word");
  const dailyControls = page.getByTestId("button-end-game");

  await expect(input).toBeVisible();
  await expect(dailyControls).toHaveCount(0);
  await expect(page.getByTestId("button-menu")).toHaveCount(0);
  expect(getAttemptWrites()).toBe(1);
  expect(puzzleRequests.some(url => url.includes("seed=0"))).toBe(true);

  for (let index = 0; index < completionPuzzles.length; index++) {
    await input.fill(completionPuzzles[index].canonicalWord);
    await page.getByTestId("button-submit").click();

    if (index < completionPuzzles.length - 1) {
      await expect(page.getByTestId("badge-round")).toHaveText(`Round ${index + 2}/5`, { timeout: 5000 });
      await expect(input).toBeFocused();
      expect(getAttemptWrites()).toBe(1);
    }
  }

  await expect(page.getByTestId("stat-total-score")).toHaveText("750", { timeout: 10000 });
  await expect(page.getByTestId("button-play-again")).toHaveCount(0);
  await expect(page.getByTestId("button-main-menu")).toHaveCount(0);
  await expect(page.getByTestId("button-play-daily")).not.toBeVisible();
  await expect(page.getByText("Challenge Complete", { exact: true })).toBeVisible();
  await expect(page.getByTestId("text-daily-score")).toHaveText("Score: 750");
  await expect.poll(() => page.evaluate(date => {
    const records = JSON.parse(localStorage.getItem("wordplay_daily_challenge") ?? "[]");
    return records.find((record: { date: string }) => record.date === date)?.score;
  }, DAILY_DATE)).toBe(750);
  expect(getAttemptWrites()).toBe(1);

  await page.reload();
  await expect(page.getByText("Challenge Complete", { exact: true })).toBeVisible();
  await expect(page.getByTestId("text-daily-score")).toHaveText("Score: 750");
  await expect(page.getByTestId("button-play-daily")).not.toBeVisible();
  expect(getAttemptWrites()).toBe(1);
});

test("Daily Word Extension keeps a rejected answer editable for correction", async ({ page }) => {
  await page.route("**/api/games/word-extension/puzzles**", route =>
    route.fulfill({ json: EXTENSION_PUZZLES }),
  );
  let validationCount = 0;
  await page.route("**/api/games/word-extension/validate", route => {
    validationCount += 1;
    return route.fulfill({ json: { valid: validationCount > 1 } });
  });

  const { getAttemptWrites } = await launchDailyGame(page, "word-extension");
  const input = page.getByTestId("word-input");

  await input.fill("XTRAIN");
  await input.press("Enter");
  await expect(page.getByTestId("feedback-message")).toContainText("Not a valid extension");
  await expect(page.getByTestId("feedback-message")).toBeHidden({ timeout: 5000 });

  await expect(input).toHaveValue("XTRAIN");
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(page.getByTestId("button-end-game")).toHaveCount(0);
  await expect(page.getByTestId("button-menu")).toHaveCount(0);
  expect(getAttemptWrites()).toBe(1);

  await input.fill("STRAIN");
  await input.press("Enter");
  await expect(page.getByTestId("shown-word")).toHaveText("REACH", { timeout: 5000 });
  await expect(input).toHaveValue("");
  expect(getAttemptWrites()).toBe(1);
});

test("Daily Word Roots refocuses its input after a rejected dictionary word", async ({ page }) => {
  await page.route("**/api/games/word-roots/puzzles**", route =>
    route.fulfill({ json: ROOTS_PUZZLES }),
  );
  await page.route("**/api/games/validate-word", route =>
    route.fulfill({ json: { valid: false } }),
  );

  const { getAttemptWrites } = await launchDailyGame(page, "word-roots");
  const input = page.getByTestId("input-word");

  await input.fill("FANTASTIC");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("feedback-message")).toHaveText("Not a valid dictionary word");
  await expect(page.getByTestId("feedback-message")).toBeHidden({ timeout: 5000 });

  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(page.getByTestId("button-end-game")).toHaveCount(0);
  await expect(page.getByTestId("button-menu")).toHaveCount(0);
  expect(getAttemptWrites()).toBe(1);
});

test("Daily Word Extension restores its input after a validation request fails", async ({ page }) => {
  await page.route("**/api/games/word-extension/puzzles**", route =>
    route.fulfill({ json: EXTENSION_PUZZLES }),
  );
  await page.route("**/api/games/word-extension/validate", route => route.abort());

  const { getAttemptWrites } = await launchDailyGame(page, "word-extension");
  const input = page.getByTestId("word-input");
  const attemptsBeforeSubmit = getAttemptWrites();

  await input.fill("STRAIN");
  await input.press("Enter");
  await expect(page.getByTestId("feedback-message")).toHaveText("Error checking word — try again");
  await expect(page.getByTestId("feedback-message")).toBeHidden({ timeout: 5000 });

  await expect(input).toHaveValue("STRAIN");
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(page.getByTestId("button-end-game")).toHaveCount(0);
  await expect(page.getByTestId("button-menu")).toHaveCount(0);
  expect(getAttemptWrites()).toBe(attemptsBeforeSubmit);
});

test("Daily Word Roots restores its input after a validation request fails", async ({ page }) => {
  await page.route("**/api/games/word-roots/puzzles**", route =>
    route.fulfill({ json: ROOTS_PUZZLES }),
  );
  await page.route("**/api/games/validate-word", route => route.abort());

  const { getAttemptWrites } = await launchDailyGame(page, "word-roots");
  const input = page.getByTestId("input-word");
  const attemptsBeforeSubmit = getAttemptWrites();

  await input.fill("FANTASTIC");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("feedback-message")).toHaveText("Error checking word");
  await expect(page.getByTestId("feedback-message")).toBeHidden({ timeout: 5000 });

  await expect(input).toHaveValue("FANTASTIC");
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
  await expect(page.getByTestId("button-end-game")).toHaveCount(0);
  await expect(page.getByTestId("button-menu")).toHaveCount(0);
  expect(getAttemptWrites()).toBe(attemptsBeforeSubmit);
});
