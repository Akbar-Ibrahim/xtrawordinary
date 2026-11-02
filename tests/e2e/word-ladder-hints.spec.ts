import { test, expect, type Page } from "@playwright/test";

const PUZZLE = {
  start: "COLD",
  target: "WARM",
  par: 3,
  optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
};

async function openWordLadder(page: Page, puzzle = PUZZLE) {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({ json: [puzzle] }),
  );
  await page.route("**/api/games/validate-word", (route) =>
    route.fulfill({ json: { valid: true } }),
  );

  await page.goto("/game/word-ladder");

  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) await announcementClose.click();

  const playButton = page.getByTestId("button-play");
  if (await playButton.isVisible()) await playButton.click();

  await expect(page.getByTestId("input-word")).toBeVisible();
}

test("live hint penalty is hidden initially and increases by 30 points per hint", async ({ page }) => {
  await openWordLadder(page);

  const penalty = page.getByTestId("badge-hint-penalty");
  await expect(penalty).toBeHidden();

  await page.getByTestId("button-hint").click();
  await expect(penalty).toHaveText("Hint penalty: -30 pts");

  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("input-word")).toHaveValue("");
  await page.getByTestId("button-hint").click();
  await expect(penalty).toHaveText("Hint penalty: -60 pts");
});

test("completed score deducts 30 points per hint and explains the deduction", async ({ page }) => {
  await openWordLadder(page);

  await page.getByTestId("button-hint").click();
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("input-word")).toHaveValue("");
  await page.getByTestId("button-hint").click();
  await expect(page.getByTestId("badge-hint-penalty")).toHaveText("Hint penalty: -60 pts");

  for (const word of ["CARD", "WARD", "WARM"]) {
    const input = page.getByTestId("input-word");
    const submit = page.getByTestId("button-submit");
    await input.fill(word);
    await expect(input).toHaveValue(word);
    await expect(submit).toBeEnabled();
    await submit.click();
    if (word !== "WARM") await expect(input).toHaveValue("");
  }

  await expect(page.getByText("Ladder Complete!")).toBeVisible();
  await expect(page.getByTestId("text-score")).toHaveText("Score: 240 pts");
  await expect(page.getByTestId("text-result-hint-penalty"))
    .toHaveText("2 hints used · Hint penalty: -60 pts");
});

test("signed-in player stats save the same hint-reduced score shown on completion", async ({ page }) => {
  const uniqueId = Date.now();
  const email = `word_ladder_score_${uniqueId}@test.com`;
  const password = "Password123!";
  const username = `ladder${String(uniqueId).slice(-8)}`;

  const registration = await page.request.post("/api/auth/register", {
    data: { email, username, password },
  });
  expect(registration.status()).toBe(201);

  const login = await page.request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(login.status()).toBe(200);

  await openWordLadder(page);

  await page.getByTestId("button-hint").click();
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("input-word")).toHaveValue("");
  await page.getByTestId("button-hint").click();

  for (const word of ["CARD", "WARD", "WARM"]) {
    const input = page.getByTestId("input-word");
    const submit = page.getByTestId("button-submit");
    await input.fill(word);
    await expect(submit).toBeEnabled();
    await submit.click();
    if (word !== "WARM") await expect(input).toHaveValue("");
  }

  const finalScore = 240;
  await expect(page.getByText("Ladder Complete!")).toBeVisible();
  await expect(page.getByTestId("text-score")).toHaveText(`Score: ${finalScore} pts`);
  await expect(page.getByTestId("text-result-hint-penalty"))
    .toHaveText("2 hints used · Hint penalty: -60 pts");

  await expect.poll(async () => {
    const response = await page.request.get("/api/user/stats");
    if (!response.ok()) return undefined;
    const stats = await response.json();
    return stats.find((entry: { gameSlug: string }) => entry.gameSlug === "word-ladder");
  }).toMatchObject({
    gameSlug: "word-ladder",
    bestScore: finalScore,
    lastScore: finalScore,
    gamesPlayed: 1,
    gamesWon: 1,
  });

  await expect.poll(async () => {
    const response = await page.request.get("/api/leaderboard/word-ladder");
    if (!response.ok()) return undefined;
    const entries = await response.json();
    return entries.find((entry: { username: string }) => entry.username === username);
  }).toMatchObject({
    score: finalScore,
    hintsUsed: 2,
  });
});

test("Word Ladder leaderboard labels known hint usage and keeps legacy usage unknown", async ({ page }) => {
  await page.route("**/api/leaderboard/word-ladder**", (route) =>
    route.fulfill({
      json: [
        { id: 1, userId: 1, gameSlug: "word-ladder", score: 300, hintsUsed: 0, playerName: "No Hints", username: "no-hints", playedAt: new Date().toISOString() },
        { id: 2, userId: 2, gameSlug: "word-ladder", score: 270, hintsUsed: 2, playerName: "Used Hints", username: "used-hints", playedAt: new Date().toISOString() },
        { id: 3, userId: 3, gameSlug: "word-ladder", score: 250, hintsUsed: null, playerName: "Old Score", username: "old-score", playedAt: new Date().toISOString() },
      ],
    }),
  );
  await page.route("**/api/streaks/batch**", (route) => route.fulfill({ json: {} }));

  await page.goto("/leaderboard?game=word-ladder");

  await expect(page.getByTestId("badge-hints-used-0")).toHaveText("No hints");
  await expect(page.getByTestId("badge-hints-used-1")).toHaveText("2 hints");
  await expect(page.getByTestId("badge-hints-used-2")).toHaveText("Hint usage unknown");
});

test("result explains when the 10-point minimum limits the hint deduction", async ({ page }) => {
  const path = ["COLD", "CORD", "CARD", "WARD", "WIRD", "WIRL", "WIRK", "WARK", "PARK", "PORK", "WORK", "WORM", "WARM"];
  await openWordLadder(page, {
    start: path[0],
    target: path[path.length - 1],
    par: 12,
    optimalPaths: [path],
  });

  for (let hint = 0; hint < 12; hint += 1) {
    await page.getByTestId("button-hint").click();
    await page.getByTestId("button-submit").click();
    if (hint < 11) await expect(page.getByTestId("input-word")).toHaveValue("");
  }

  for (const word of path.slice(13)) {
    const input = page.getByTestId("input-word");
    const submit = page.getByTestId("button-submit");
    await input.fill(word);
    await expect(submit).toBeEnabled();
    await submit.click();
    if (word !== "WARM") await expect(input).toHaveValue("");
  }

  await expect(page.getByTestId("text-score")).toHaveText("Score: 10 pts");
  await expect(page.getByTestId("text-result-hint-penalty")).toHaveText(
    "12 hints used · Hint deduction: -340 pts (10-point minimum score reached)",
  );
});
