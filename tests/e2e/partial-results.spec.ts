import { test, expect } from "@playwright/test";
import { openResultGame, expectRecordedWin, holdGameIntervals, expireGameIntervals } from "./game-result-helpers";

test("Word Split skipped puzzles do not count as a recorded win", async ({ page }) => {
  await page.route("**/api/games/word-split/puzzles**", route => route.fulfill({
    json: [{ targetWord: "CATDOG" }],
  }));
  await openResultGame(page, "word-split");
  await page.getByTestId("button-difficulty-short").click();
  await page.getByTestId("button-skip").click();
  await expect(page.getByRole("heading", { name: "Session Complete", exact: true })).toBeVisible();
  await expectRecordedWin(page, "word-split", false);
});

test("Word Chain computer request failure ends without awarding a win", async ({ page }) => {
  await page.route("**/api/games/word-chain/start", route => route.fulfill({ json: { word: "CAT" } }));
  await page.route("**/api/games/validate-word", route => route.fulfill({ json: { valid: true } }));
  await page.route("**/api/games/word-chain/computer-word", route => route.fulfill({
    status: 503, json: { message: "Temporary failure" },
  }));
  await openResultGame(page, "word-chain");
  await page.getByTestId("button-level-1").click();
  await page.getByTestId("input-word").fill("TREE");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-completion-message")).toContainText("ended without a winner");
  await expectRecordedWin(page, "word-chain-survival", false);
});

test("Word Sweep partial clear uses the same non-win result when sharing", async ({ page }) => {
  await page.route("**/api/games/word-sweep/grid**", route => route.fulfill({
    json: { size: 6, grid: ["CATDOG", "AAAAAA", "AAAAAA", "AAAAAA", "AAAAAA", "AAAAAA"].map(row => row.split("")) },
  }));
  await page.route("**/api/games/validate-word", route => route.fulfill({ json: { valid: true } }));
  await page.addInitScript(() => {
    window.open = ((url?: string | URL) => {
      (window as any).__sharedUrl = String(url);
      return null;
    }) as typeof window.open;
  });
  await openResultGame(page, "word-sweep");
  await page.getByTestId("button-mode-classic").click();
  for (const id of [0, 1, 2]) await page.getByTestId(`grid-cell-${id}`).click();
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-current-word")).toHaveText("Select letters...");
  await page.getByTestId("button-give-up").click();
  await expect(page.getByTestId("text-result-title")).toHaveText("Partial Clear");
  await expectRecordedWin(page, "word-sweep", false);
  await page.getByTestId("button-share-twitter").click();
  await expect.poll(() => page.evaluate(() => (window as any).__sharedUrl)).toContain("played%20Word%20Sweep");
});

test("Word Sweep ignores a valid answer that arrives after ending the run", async ({ page }) => {
  await page.route("**/api/games/word-sweep/grid**", route => route.fulfill({
    json: { size: 6, grid: ["CATDOG", "AAAAAA", "AAAAAA", "AAAAAA", "AAAAAA", "AAAAAA"].map(row => row.split("")) },
  }));

  let releaseValidation!: () => void;
  let signalValidationStarted!: () => void;
  let signalValidationFinished!: () => void;
  const validationCanFinish = new Promise<void>(resolve => { releaseValidation = resolve; });
  const validationStarted = new Promise<void>(resolve => { signalValidationStarted = resolve; });
  const validationFinished = new Promise<void>(resolve => { signalValidationFinished = resolve; });
  await page.route("**/api/games/validate-word", async route => {
    signalValidationStarted();
    await validationCanFinish;
    await route.fulfill({ json: { valid: true } });
    signalValidationFinished();
  });

  await openResultGame(page, "word-sweep");
  await page.getByTestId("button-mode-classic").click();
  for (const id of [0, 1, 2]) await page.getByTestId(`grid-cell-${id}`).click();
  await page.getByTestId("button-submit").click();
  await validationStarted;

  await page.getByTestId("button-give-up").click();
  await expect(page.getByTestId("text-result-title")).toHaveText("Game Over");
  await expect(page.getByTestId("text-final-score")).toHaveText("0 points");
  await expect(page.getByTestId("text-result-detail")).toHaveText("You cleared 0 of 36 letters");

  releaseValidation();
  await validationFinished;
  await expect(page.getByTestId("text-final-score")).toHaveText("0 points");
  await expect(page.getByTestId("text-result-title")).toHaveText("Game Over");
  await expect(page.getByTestId("text-result-detail")).toHaveText("You cleared 0 of 36 letters");
});

test("Word Sweep ignores a delayed perfect-clear callback after replay starts", async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout.bind(window);
    const callbacks: Array<() => void> = [];
    (window as any).__delayedCompletionCallbacks = callbacks;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 600 && typeof handler === "function") {
        callbacks.push(() => handler(...args));
        return originalSetTimeout(() => {}, 2_000_000_000);
      }
      return originalSetTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout;
  });
  await page.route("**/api/games/word-sweep/grid**", route => route.fulfill({
    json: { size: 6, grid: ["ABCDEF", "GHIJKL", "MNOPQR", "STUVWX", "YZABCD", "EFGHIJ"].map(row => row.split("")) },
  }));
  await page.route("**/api/games/validate-word", route => route.fulfill({ json: { valid: true } }));

  await openResultGame(page, "word-sweep");
  await page.getByTestId("button-mode-classic").click();

  for (let wordIndex = 0; wordIndex < 12; wordIndex++) {
    const cellIds = await page.evaluate(() => Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-testid^="grid-cell-"]'),
    )
      .filter(cell => cell.textContent?.trim())
      .slice(0, 3)
      .map(cell => cell.dataset.testid?.replace("grid-cell-", "")));
    expect(cellIds).toHaveLength(3);
    for (const id of cellIds) await page.getByTestId(`grid-cell-${id}`).click();
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("text-current-word")).toHaveText("Select letters...");
  }

  await expect(page.getByTestId("badge-remaining")).toHaveText("0 / 36 left");
  await page.getByTestId("button-give-up").click();
  await expect(page.getByTestId("text-result-title")).toHaveText("Perfect Clear!");
  await expect(page.getByTestId("text-final-score")).toHaveText("120 points");
  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("badge-score")).toHaveText("0 pts");

  await page.evaluate(() => {
    const callbacks = (window as any).__delayedCompletionCallbacks as Array<() => void>;
    if (callbacks.length !== 1) throw new Error(`Expected one delayed completion callback, got ${callbacks.length}`);
    callbacks[0]();
  });

  await expect(page.getByTestId("badge-score")).toHaveText("0 pts");
  await expect(page.getByTestId("grid-container")).toBeVisible();
  await expect(page.getByTestId("text-result-title")).toHaveCount(0);
});

test("Word Stretch Classic does not celebrate four of five solutions as a win", async ({ page }) => {
  await holdGameIntervals(page);
  await page.route("**/api/games/word-stretch/puzzle**", route => route.fulfill({
    json: { word: "CAT", totalSolutions: 5 },
  }));
  await page.route("**/api/games/word-stretch/validate**", route => route.fulfill({
    json: { valid: true, isMiddle: false },
  }));
  await page.route("**/api/games/word-stretch/solutions**", route => route.fulfill({
    json: { solutions: ["CATS", "SCAT", "CART", "CHAT", "COAT"] },
  }));
  await page.route("**/api/leaderboard/word-stretch*", route => route.fulfill({ json: [] }));
  await openResultGame(page, "word-stretch");
  await page.getByTestId("button-mode-classic").click();
  for (const [index, word] of ["CATS", "SCAT", "CART", "CHAT"].entries()) {
    await page.getByTestId("input-word").fill(word);
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("text-live-word-count")).toHaveText(String(index + 1));
  }
  await expireGameIntervals(page, 121);
  await expect(page.getByText("You found 4 of 5 words before the run ended.", { exact: true })).toBeVisible();
  await expectRecordedWin(page, "word-stretch", false);
});
