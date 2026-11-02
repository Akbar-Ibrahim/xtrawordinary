import { test, expect, type Page } from "@playwright/test";

const START_WORD = "COLD";
const PLAYER_WORDS = ["CORD", "CARD", "WARD"];

async function prepareLadderRush(
  page: Page,
  slug: "ladder-rush" | "ladder-rush-double",
  hintWord: string | string[],
) {
  let hintRequest: Record<string, unknown> | undefined;
  const hintWords = Array.isArray(hintWord) ? hintWord : [hintWord];
  let hintCount = 0;

  await page.route("**/api/games/ladder-rush/puzzles**", async route => {
    await route.fulfill({ json: [{ wordLength: 4, start: START_WORD }] });
  });
  await page.route("**/api/games/validate-word", async route => {
    await route.fulfill({ json: { valid: true } });
  });
  await page.route("**/api/games/ladder-rush/hint", async route => {
    hintRequest = route.request().postDataJSON();
    const word = hintWords[Math.min(hintCount, hintWords.length - 1)];
    hintCount += 1;
    await route.fulfill({ json: { word } });
  });

  await page.goto(`/game/${slug}`);
  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) {
    await announcementClose.click();
  }
  await page.getByTestId("button-play").click();
  await expect(page.getByTestId("button-mode-4")).toBeVisible();

  return {
    async start({ survival = false } = {}) {
      if (survival) {
        await page.getByTestId("button-mode-survival").click();
        await page.getByTestId("button-survival-time-easy").click();
      }
      await page.getByTestId("button-mode-4").click();
      await page.getByTestId("button-start").click();
      await expect(page.getByTestId("input-word")).toBeVisible();
    },
    getHintRequest: () => hintRequest,
  };
}

test("a successful hint adds one rung, uses one hint, and applies its score penalty once", async ({ page }) => {
  const game = await prepareLadderRush(page, "ladder-rush", "WARM");
  await game.start();

  for (const word of PLAYER_WORDS) {
    await page.getByTestId("input-word").fill(word);
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("text-live-word-count")).toHaveText(
      String(PLAYER_WORDS.indexOf(word) + 1),
    );
  }

  await page.getByTestId("button-hint").click();

  await expect(page.getByTestId("text-live-word-count")).toHaveText("4");
  await expect(page.getByTestId("chain-rung-4")).toContainText("WARM");
  await expect(page.getByTestId("button-hint")).toContainText("Hint (2)");
  await expect(page.getByTestId("animated-number")).toHaveText("1");
  await expect(page.getByTestId("text-live-hint-deduction")).toHaveText("1 hint used · −2 pts");

  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("text-score")).toHaveText("1");
  await expect(page.getByTestId("text-hints-used")).toContainText("1 hint used (−2 pts)");
});

test("the live hint deduction tracks multiple hints and the net score", async ({ page }) => {
  const game = await prepareLadderRush(page, "ladder-rush", ["BOLD", "BOND"]);
  await game.start();

  await page.getByTestId("button-hint").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(page.getByTestId("text-live-hint-deduction")).toHaveText("1 hint used · −2 pts");

  await page.getByTestId("button-hint").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
  await expect(page.getByTestId("text-live-hint-deduction")).toHaveText("2 hints used · −4 pts");
  await expect(page.getByTestId("animated-number")).toHaveText("0");

  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("text-score")).toHaveText("0");
  await expect(page.getByTestId("text-hints-used")).toContainText("2 hints used (−4 pts)");
});

for (const mode of [
  { slug: "ladder-rush" as const, hintWord: "BOLD", doubleSwap: false },
  { slug: "ladder-rush-double" as const, hintWord: "BOND", doubleSwap: true },
]) {
  test(`a successful Survival hint resets the timer in ${mode.doubleSwap ? "Double Swap" : "standard"} play`, async ({ page }) => {
    const game = await prepareLadderRush(page, mode.slug, mode.hintWord);
    await game.start({ survival: true });

    const timer = page.getByTestId("badge-timer");
    await expect(timer).toHaveText("15s");
    await page.waitForTimeout(2200);
    await expect(timer).not.toHaveText("15s");

    await page.getByTestId("button-hint").click();

    await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
    await expect(page.getByTestId("chain-rung-1")).toContainText(mode.hintWord);
    await expect(page.getByTestId("button-hint")).toContainText("Hint (2)");
    await expect(timer).toHaveText("15s");
    expect(game.getHintRequest()).toMatchObject({ doubleSwap: mode.doubleSwap });
  });
}

test("a hint-using round saves the net score to player stats and its leaderboard", async ({ page }) => {
  const uniqueId = Date.now();
  const email = `ladder_rush_score_${uniqueId}@test.com`;
  const password = "Password123!";
  const username = `rush${String(uniqueId).slice(-8)}`;

  const registration = await page.request.post("/api/auth/register", {
    data: { email, username, password },
  });
  expect(registration.status()).toBe(201);

  const login = await page.request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(login.status()).toBe(200);

  const game = await prepareLadderRush(page, "ladder-rush", "WARM");
  await game.start();

  for (const word of PLAYER_WORDS) {
    await page.getByTestId("input-word").fill(word);
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("text-live-word-count")).toHaveText(
      String(PLAYER_WORDS.indexOf(word) + 1),
    );
  }

  await page.getByTestId("button-hint").click();
  await expect(page.getByTestId("chain-rung-4")).toContainText("WARM");
  await page.getByTestId("button-end-game").click();

  const finalScore = 1; // Four rungs, minus one hint-provided rung and the two-point hint penalty.
  await expect(page.getByTestId("text-score")).toHaveText(String(finalScore));
  await expect(page.getByTestId("text-hints-used")).toContainText("1 hint used (−2 pts)");

  const gameSlug = "ladder-rush-4";
  await expect.poll(async () => {
    const statsResponse = await page.request.get("/api/user/stats");
    if (!statsResponse.ok()) return undefined;
    const stats = await statsResponse.json();
    return stats.find((entry: { gameSlug: string }) => entry.gameSlug === gameSlug);
  }).toMatchObject({
    gameSlug,
    bestScore: finalScore,
    lastScore: finalScore,
  });

  await expect.poll(async () => {
    const leaderboardResponse = await page.request.get(`/api/leaderboard/${gameSlug}`);
    if (!leaderboardResponse.ok()) return undefined;
    const leaderboard = await leaderboardResponse.json();
    return leaderboard.find((entry: { username: string }) => entry.username === username);
  }).toMatchObject({ score: finalScore });
});
