import { test, expect, type Page } from "@playwright/test";
import { expireGameIntervals, holdGameIntervals } from "./game-result-helpers";

async function openGame(page: Page, slug: string) {
  await page.goto(`/game/${slug}`);
  await page.waitForLoadState("networkidle");

  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) await announcementClose.click();

  const playButton = page.getByTestId("button-play");
  if (await playButton.isVisible()) await playButton.click();
}

async function mockWordValidation(
  page: Page,
  isValid: (word: string) => boolean,
) {
  await page.route("**/api/games/validate-word", async (route) => {
    const { word } = route.request().postDataJSON() as { word: string };
    await route.fulfill({ json: { valid: isValid(word.toUpperCase()) } });
  });
}

async function completeWordLadder(
  page: Page,
  hintsUsed: number,
  words = ["CORD", "CARD", "WARD", "WARM"],
) {
  const input = page.getByTestId("input-word");
  const submit = page.getByTestId("button-submit");
  for (const [index, word] of words.entries()) {
    if (index < hintsUsed) {
      await page.getByTestId("button-hint").click();
    }
    await input.fill(word);
    await submit.click();
    await expect(page.getByTestId(`rung-${index + 1}`)).toBeVisible();
  }

  const score = page.getByTestId("text-score");
  await expect(score).toHaveText(/^Score: \d+ pts$/);
  return Number((await score.innerText()).match(/\d+/)?.[0]);
}

async function startLadderRushSurvival(page: Page) {
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-survival-time-easy").click();
  await page.getByTestId("button-mode-4").click();
  await page.getByTestId("button-start").click();
  await expect(page.getByTestId("badge-timer")).toHaveText("15s");
}

async function rejectThenAccept(
  input: ReturnType<Page["getByTestId"]>,
  submit: ReturnType<Page["getByTestId"]>,
  invalidWord: string,
  validWord: string,
  error: ReturnType<Page["getByTestId"]>,
) {
  await expect(input).toBeFocused();

  await input.fill(invalidWord);
  await submit.click();
  await expect(error).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });

  await input.fill(validWord);
  await submit.click();
  await expect(input).toBeFocused({ timeout: 5000 });
}

async function playAgainAndCheckFocus(page: Page, endButton: string) {
  const input = page.getByTestId("input-word");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();

  await page.getByTestId(endButton).click();
  const playAgain = page.getByTestId("button-play-again");
  await expect(playAgain).toBeVisible();
  await playAgain.click();

  await expect(input).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });
}

async function expectInputInsideVisualViewport(page: Page, input: ReturnType<Page["getByTestId"]>) {
  await expect.poll(() => input.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    return rect.top >= top && rect.bottom <= bottom;
  })).toBe(true);
}

async function replayAndCheckLandscapeFocus(
  page: Page,
  setupGame: (page: Page) => Promise<void>,
  finishGame: (page: Page) => Promise<void>,
  submitAfterReplay: (page: Page) => Promise<void>,
) {
  await setupGame(page);

  const input = page.getByTestId("input-word");
  const portraitViewport = page.viewportSize()!;
  expect(portraitViewport.height).toBeGreaterThan(portraitViewport.width);
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();

  await finishGame(page);
  await page.getByTestId("button-play-again").click();
  await expect(input).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });

  await page.setViewportSize({
    width: portraitViewport.height,
    height: portraitViewport.width,
  });
  await expect.poll(() => page.evaluate(() => window.innerWidth > window.innerHeight)).toBe(true);
  await expect(input).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });
  await expectInputInsideVisualViewport(page, input);
  await submitAfterReplay(page);
}

async function replayAndCheckReducedMobileViewportFocus(
  page: Page,
  setupGame: (page: Page) => Promise<void>,
  finishGame: (page: Page) => Promise<void>,
  submitAfterReplay: (page: Page) => Promise<void>,
) {
  const initialViewport = page.viewportSize()!;
  const mobileWidth = Math.min(initialViewport.width, 430);
  await page.setViewportSize({ width: mobileWidth, height: 844 });
  await setupGame(page);

  const input = page.getByTestId("input-word");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();

  await finishGame(page);
  const playAgain = page.getByTestId("button-play-again");
  await expect(playAgain).toBeVisible();

  // Playwright device emulation has no operating-system keyboard. Shrinking the
  // viewport represents the remaining visible area; it does not open a real keyboard.
  await page.setViewportSize({ width: mobileWidth, height: 600 });
  await playAgain.click();

  await expect(input).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });
  await expectInputInsideVisualViewport(page, input);
  await submitAfterReplay(page);
  await expect(input).toBeFocused();
  await expectInputInsideVisualViewport(page, input);
}

const replayScenarios: {
  name: string;
  setup: (page: Page) => Promise<void>;
  finishGame: (page: Page) => Promise<void>;
  submitAfterReplay: (page: Page) => Promise<void>;
}[] = [
  {
    name: "Word Length",
    setup: async (page) => {
      await mockWordValidation(page, () => true);
      await openGame(page, "word-length");
      await page.getByTestId("button-var-1").click();
    },
    finishGame: async (page) => page.getByTestId("button-end-game").click(),
    submitAfterReplay: async (page) => {
      const input = page.getByTestId("input-word");
      const answer = "A".repeat(await page.locator('[data-testid^="letter-box-"]').count());
      await input.pressSequentially(answer);
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
    },
  },
  {
    name: "No Repeats",
    setup: async (page) => {
      await mockWordValidation(page, () => true);
      await openGame(page, "no-repeats");
      await page.getByTestId("button-play-mode-free").click();
      await page.getByTestId("card-challenge-3").click();
    },
    finishGame: async (page) => page.getByTestId("button-end-game").click(),
    submitAfterReplay: async (page) => {
      const input = page.getByTestId("input-word");
      const wordLength = await input.evaluate((element) => (element as HTMLInputElement).maxLength);
      await input.pressSequentially("ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, wordLength));
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
    },
  },
  {
    name: "Word Ladder",
    setup: async (page) => {
      await page.route("**/api/games/word-ladder/puzzles**", (route) =>
        route.fulfill({
          json: [{
            start: "COLD",
            target: "WARM",
            par: 4,
            optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
          }],
        }),
      );
      await mockWordValidation(page, () => true);
      await openGame(page, "word-ladder");
    },
    finishGame: async (page) => page.getByTestId("button-end-game").click(),
    submitAfterReplay: async (page) => {
      const input = page.getByTestId("input-word");
      await input.pressSequentially("CORD");
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("rung-1")).toBeVisible();
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
    },
  },
  {
    name: "Word Stack",
    setup: async (page) => {
      await page.route("**/api/games/word-stack/puzzles", (route) =>
        route.fulfill({ json: [{ targetWord: "CAT", startWord: "AT" }] }),
      );
      await mockWordValidation(page, () => true);
      await openGame(page, "word-stack");
      await page.getByTestId("button-challenge-build-up").click();
    },
    finishGame: async (page) => page.getByTestId("button-end-game").click(),
    submitAfterReplay: async (page) => {
      const input = page.getByTestId("input-word");
      await input.pressSequentially("AT");
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("text-progress")).toContainText("1 level remaining");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused({ timeout: 5000 });
    },
  },
  {
    name: "Word Stretch",
    setup: async (page) => {
      let puzzleRequests = 0;
      await page.route("**/api/games/word-stretch/puzzle**", (route) => {
        puzzleRequests += 1;
        return route.fulfill({
          json: { word: "CAT", totalSolutions: puzzleRequests === 1 ? 1 : 2 },
        });
      });
      await page.route("**/api/games/word-stretch/validate**", (route) =>
        route.fulfill({ json: { valid: true, isMiddle: false } }),
      );
      await openGame(page, "word-stretch");
      await page.getByTestId("button-mode-classic").click();
    },
    finishGame: async (page) => {
      await page.getByTestId("input-word").fill("CATS");
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("button-play-again")).toBeVisible();
    },
    submitAfterReplay: async (page) => {
      const input = page.getByTestId("input-word");
      await input.pressSequentially("CATS");
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("badge-found-count")).toHaveText("1 / 2 found");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
    },
  },
  {
    name: "Word Bloom",
    setup: async (page) => {
      await page.route("**/api/games/word-bloom/puzzle**", (route) =>
        route.fulfill({ json: { seed: "BE", maxDepth: 5 } }),
      );
      await page.route("**/api/games/word-bloom/validate**", (route) =>
        route.fulfill({ json: { valid: true, isMiddle: false } }),
      );
      await openGame(page, "word-bloom");
      await page.getByTestId("button-mode-classic").click();
    },
    finishGame: async (page) => page.getByTestId("button-give-up").click(),
    submitAfterReplay: async (page) => {
      const input = page.getByTestId("input-word");
      await input.pressSequentially("BET");
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
    },
  },
  {
    name: "Ladder Rush",
    setup: async (page) => {
      await page.route("**/api/games/ladder-rush/puzzles**", (route) =>
        route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
      );
      await mockWordValidation(page, () => true);
      await openGame(page, "ladder-rush");
      await page.getByTestId("button-mode-4").click();
      await page.getByTestId("button-start").click();
    },
    finishGame: async (page) => page.getByTestId("button-end-game").click(),
    submitAfterReplay: async (page) => {
      const input = page.getByTestId("input-word");
      await input.pressSequentially("CORD");
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("chain-rung-1")).toContainText("CORD");
      await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
    },
  },
];

for (const scenario of replayScenarios) {
  test(`${scenario.name} keeps the answer visible and focused after replay in landscape, then accepts an answer`, async ({ page }) => {
    await replayAndCheckLandscapeFocus(
      page,
      scenario.setup,
      scenario.finishGame,
      scenario.submitAfterReplay,
    );
  });

  test(`${scenario.name} keeps the replayed answer visible and usable after replay with a reduced mobile viewport (not a real software keyboard)`, async ({ page }) => {
    await replayAndCheckReducedMobileViewportFocus(
      page,
      scenario.setup,
      scenario.finishGame,
      scenario.submitAfterReplay,
    );
  });
}

test("Word Length keeps focus on startup, after an invalid answer, and after a correct answer", async ({ page }) => {
  await mockWordValidation(page, (word) => !word.startsWith("Z"));
  await openGame(page, "word-length");
  await page.getByTestId("button-var-1").click();

  const input = page.getByTestId("input-word");
  const submit = page.getByTestId("button-submit");
  const wordLength = await page.locator('[data-testid^="letter-box-"]').count();
  await rejectThenAccept(
    input,
    submit,
    "Z".repeat(wordLength),
    "A".repeat(wordLength),
    page.getByTestId("text-feedback"),
  );
});

test("No Repeats keeps focus on startup, after an invalid answer, and after a correct answer", async ({ page }) => {
  await mockWordValidation(page, (word) => word !== "DOG");
  await openGame(page, "no-repeats");
  await page.getByTestId("button-play-mode-free").click();
  await page.getByTestId("card-challenge-3").click();

  await rejectThenAccept(
    page.getByTestId("input-word"),
    page.getByTestId("button-submit"),
    "DOG",
    "CAT",
    page.getByTestId("text-feedback"),
  );
});

test("Word Stack keeps focus on startup, after an invalid answer, and after a correct answer", async ({ page }) => {
  await page.route("**/api/games/word-stack/puzzles", (route) =>
    route.fulfill({ json: [{ targetWord: "CAT", startWord: "AT" }] }),
  );
  await mockWordValidation(page, (word) => word !== "NO");
  await openGame(page, "word-stack");
  await page.getByTestId("button-challenge-build-up").click();

  await rejectThenAccept(
    page.getByTestId("input-word"),
    page.getByTestId("button-submit"),
    "NO",
    "AT",
    page.getByTestId("text-feedback-message"),
  );
});

test("Word Stretch keeps focus on startup, after an invalid answer, and after a correct answer", async ({ page }) => {
  await page.route("**/api/games/word-stretch/puzzle**", (route) =>
    route.fulfill({ json: { word: "CAT", totalSolutions: 10 } }),
  );
  await page.route("**/api/games/word-stretch/validate**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: { valid: url.searchParams.get("stretched") === "CATS", isMiddle: false } });
  });
  await openGame(page, "word-stretch");
  await page.getByTestId("button-mode-classic").click();

  await rejectThenAccept(
    page.getByTestId("input-word"),
    page.getByTestId("button-submit"),
    "CATZ",
    "CATS",
    page.getByTestId("text-error"),
  );
});

test("Word Bloom keeps focus on startup, after an invalid answer, and after a correct answer", async ({ page }) => {
  await page.route("**/api/games/word-bloom/puzzle**", (route) =>
    route.fulfill({ json: { seed: "BE", maxDepth: 5 } }),
  );
  await page.route("**/api/games/word-bloom/validate**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({ json: { valid: url.searchParams.get("next") === "BET" } });
  });
  await openGame(page, "word-bloom");
  await page.getByTestId("button-mode-classic").click();

  await rejectThenAccept(
    page.getByTestId("input-word"),
    page.getByTestId("button-submit"),
    "BEX",
    "BET",
    page.getByTestId("text-error"),
  );
});

test("Ladder Rush keeps focus on startup, after an invalid answer, and after a correct answer", async ({ page }) => {
  await page.route("**/api/games/ladder-rush/puzzles**", (route) =>
    route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
  );
  await mockWordValidation(page, (word) => word !== "BOLD");
  await openGame(page, "ladder-rush");
  await page.getByTestId("button-mode-4").click();
  await page.getByTestId("button-start").click();

  await rejectThenAccept(
    page.getByTestId("input-word"),
    page.getByTestId("button-submit"),
    "BOLD",
    "CORD",
    page.getByTestId("text-error"),
  );
});

test("Word Ladder keeps focus on startup, after an invalid answer, and after a correct answer", async ({ page }) => {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 4,
        optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
      }],
    }),
  );
  await mockWordValidation(page, (word) => word !== "BOLD");
  await openGame(page, "word-ladder");

  await rejectThenAccept(
    page.getByTestId("input-word"),
    page.getByTestId("button-submit"),
    "BOLD",
    "CORD",
    page.getByTestId("text-error"),
  );
});

test("Word Ladder ignores a validation response that arrives after ending and replaying", async ({ page }) => {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 4,
        optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
      }],
    }),
  );

  let releaseValidation!: () => void;
  let notifyValidationStarted!: () => void;
  const validationStarted = new Promise<void>((resolve) => {
    notifyValidationStarted = resolve;
  });
  await page.route("**/api/games/validate-word", async (route) => {
    const { word } = route.request().postDataJSON() as { word: string };
    if (word.toUpperCase() === "WARM") {
      notifyValidationStarted();
      await new Promise<void>((resolve) => {
        releaseValidation = resolve;
      });
    }
    await route.fulfill({ json: { valid: true } });
  });

  await openGame(page, "word-ladder");
  const input = page.getByTestId("input-word");
  for (const [index, word] of ["CORD", "CARD", "WARD"].entries()) {
    await input.fill(word);
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId(`rung-${index + 1}`)).toBeVisible();
  }
  await input.fill("WARM");
  await page.getByTestId("button-submit").click();
  await validationStarted;

  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("text-score")).toHaveText("Score: 0 pts");
  await expect(page.getByTestId("rung-3")).toBeVisible();

  await page.getByTestId("button-replay").click();
  await expect(input).toBeVisible();
  await input.fill("CORD");

  const lateResponse = page.waitForResponse((response) =>
    response.url().includes("/api/games/validate-word") &&
    response.request().postDataJSON().word === "WARM",
  );
  releaseValidation();
  await lateResponse;

  await expect(input).toHaveValue("CORD");
  await expect(page.getByTestId("rung-1")).toHaveCount(0);
  await expect(page.getByTestId("button-end-game")).toBeVisible();
  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("text-score")).toHaveText("Score: 0 pts");
  await expect(page.getByTestId("rung-1")).toHaveCount(0);
});

test("Ladder Rush ignores a validation response that arrives after ending and replaying", async ({ page }) => {
  await holdGameIntervals(page);
  await page.route("**/api/games/ladder-rush/puzzles**", route =>
    route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
  );

  let releaseValidation!: () => void;
  let notifyValidationStarted!: () => void;
  const validationStarted = new Promise<void>(resolve => {
    notifyValidationStarted = resolve;
  });
  let validationRequests = 0;
  await page.route("**/api/games/validate-word", async route => {
    const { word } = route.request().postDataJSON() as { word: string };
    validationRequests += 1;
    if (validationRequests === 1) {
      notifyValidationStarted();
      await new Promise<void>(resolve => {
        releaseValidation = resolve;
      });
    }
    await route.fulfill({ json: { valid: true } });
  });

  await openGame(page, "ladder-rush");
  await page.getByTestId("button-mode-4").click();
  await page.getByTestId("button-start").click();
  const input = page.getByTestId("input-word");
  await input.fill("CORD");
  await page.getByTestId("button-submit").click();
  await validationStarted;

  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("text-score")).toHaveText("0");
  await page.getByTestId("button-replay").click();
  await expect(input).toBeVisible();
  await input.fill("BOLD");
  const hintButton = page.getByTestId("button-hint");
  await hintButton.focus();

  const lateResponse = page.waitForResponse(response =>
    response.url().includes("/api/games/validate-word") &&
    response.request().postDataJSON().word === "CORD",
  );
  releaseValidation();
  await lateResponse;

  await expect(input).toHaveValue("BOLD");
  await expect(hintButton).toBeFocused();
  await expect(page.getByTestId("chain-rung-1")).toHaveCount(0);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("chain-rung-1")).toContainText("BOLD");
});

test("Ladder Rush ignores a timer callback from the ended run after replay", async ({ page }) => {
  await holdGameIntervals(page);
  await page.route("**/api/games/ladder-rush/puzzles**", route =>
    route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
  );
  await openGame(page, "ladder-rush");
  await page.getByTestId("button-mode-4").click();
  await page.getByTestId("button-start").click();

  await expect(page.getByTestId("badge-timer")).toHaveText("1:30");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length > 0,
  );
  await page.getByTestId("button-end-game").click();
  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("badge-timer")).toHaveText("1:30");

  await page.evaluate(() => {
    const callbacks = (window as any).__gameIntervalCallbacks as (() => void)[];
    callbacks[0]();
  });

  await expect(page.getByTestId("badge-timer")).toHaveText("1:30");
  await expect(page.getByTestId("chain-rung-0")).toContainText("COLD");
  await expect(page.getByTestId("button-end-game")).toBeVisible();
});

async function startWordChainWithPace(page: Page, pace: { label: string; seconds: number }) {
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout.bind(window);
    const callbacks: (() => void)[] = [];
    (window as any).__wordChainTimerCallbacks = callbacks;
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 1000 && typeof handler === "function") {
        callbacks.push(() => handler(...args));
        return originalSetTimeout(() => {}, 2_000_000_000);
      }
      return originalSetTimeout(handler, delay, ...args);
    }) as typeof window.setTimeout;
  });
  await page.route("**/api/games/word-chain/start", route =>
    route.fulfill({ json: { word: "CAT" } }),
  );

  await openGame(page, "word-chain");
  if (pace.label !== "Normal") {
    await page.getByTestId(`button-survival-time-${pace.label.toLowerCase()}`).click();
  }
  await page.getByTestId("button-level-1").click();
  const timer = page.getByTestId("badge-timer");
  await expect(timer).toHaveText(`${pace.seconds}s`);
  await page.waitForFunction(() =>
    ((window as any).__wordChainTimerCallbacks as (() => void)[]).length >= 1,
  );
  return timer;
}

async function advanceWordChainTimer(page: Page, timer: ReturnType<Page["getByTestId"]>, seconds: number) {
  const callbacksBeforeTick = await page.evaluate(() =>
    ((window as any).__wordChainTimerCallbacks as (() => void)[]).length,
  );
  await page.evaluate(() => {
    const callbacks = (window as any).__wordChainTimerCallbacks as (() => void)[];
    callbacks[callbacks.length - 1]();
  });
  await expect(timer).toHaveText(`${seconds}s`);
  await page.waitForFunction((previousCount) =>
    ((window as any).__wordChainTimerCallbacks as (() => void)[]).length > previousCount,
    callbacksBeforeTick,
  );
}

async function expireWordChainTimer(page: Page, timer: ReturnType<Page["getByTestId"]>, seconds: number) {
  for (let remaining = seconds - 1; remaining > 0; remaining--) {
    await advanceWordChainTimer(page, timer, remaining);
  }

  await page.evaluate(() => {
    const callbacks = (window as any).__wordChainTimerCallbacks as (() => void)[];
    callbacks[callbacks.length - 1]();
  });
  await expect(timer).toHaveText("0s");
  await expect(page.getByTestId("heading-times-up")).toBeVisible();
}

for (const pace of [
  { label: "Easy", seconds: 20 },
  { label: "Normal", seconds: 10 },
  { label: "Hard", seconds: 6 },
]) {
  test(`Word Chain keeps the ${pace.label} Survival timer full after correct answers`, async ({ page }) => {
    await page.addInitScript(() => {
      const originalSetTimeout = window.setTimeout.bind(window);
      const callbacks: (() => void)[] = [];
      (window as any).__wordChainTimerCallbacks = callbacks;
      window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (delay === 1000 && typeof handler === "function") {
          callbacks.push(() => handler(...args));
          return originalSetTimeout(() => {}, 2_000_000_000);
        }
        return originalSetTimeout(handler, delay, ...args);
      }) as typeof window.setTimeout;
    });
    await page.route("**/api/games/word-chain/start", route =>
      route.fulfill({ json: { word: "CAT" } }),
    );
    await page.route("**/api/games/validate-word", route =>
      route.fulfill({ json: { valid: true } }),
    );
    await page.route("**/api/games/word-chain/computer-word", route =>
      route.fulfill({ json: { word: "ECHO" } }),
    );

    await openGame(page, "word-chain");
    await page.getByTestId(`button-survival-time-${pace.label.toLowerCase()}`).click();
    await page.getByTestId("button-level-1").click();
    const timer = page.getByTestId("badge-timer");
    await expect(timer).toHaveText(`${pace.seconds}s`);
    await page.waitForFunction(() =>
      ((window as any).__wordChainTimerCallbacks as (() => void)[]).length >= 1,
    );

    await page.evaluate(() => {
      ((window as any).__wordChainTimerCallbacks as (() => void)[])[0]();
    });
    await expect(timer).toHaveText(`${pace.seconds - 1}s`);
    await page.waitForFunction(() =>
      ((window as any).__wordChainTimerCallbacks as (() => void)[]).length >= 2,
    );
    await page.evaluate(() => {
      (window as any).__oldWordChainTimerCallback =
        (window as any).__wordChainTimerCallbacks[1] as () => void;
    });

    await page.getByTestId("input-word").fill("TREE");
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
    await expect(page.getByText("ECHO", { exact: true }).last()).toBeVisible();
    await expect(timer).toHaveText(`${pace.seconds}s`);

    await page.evaluate(() => {
      ((window as any).__oldWordChainTimerCallback as () => void)();
    });
    await expect(timer).toHaveText(`${pace.seconds}s`);
    await page.getByTestId("input-word").fill("OWL");
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
  });

  test(`Word Chain ends when the restarted or replayed ${pace.label} Survival timer runs out`, async ({ page }) => {
    const timer = await startWordChainWithPace(page, pace);
    await advanceWordChainTimer(page, timer, pace.seconds - 1);

    const callbacksBeforeRestart = await page.evaluate(() =>
      ((window as any).__wordChainTimerCallbacks as (() => void)[]).length,
    );
    await page.getByTestId("button-menu").click();
    await page.getByTestId("button-level-1").click();
    await expect(timer).toHaveText(`${pace.seconds}s`);
    await page.waitForFunction((previousCount) =>
      ((window as any).__wordChainTimerCallbacks as (() => void)[]).length > previousCount,
      callbacksBeforeRestart,
    );

    await expireWordChainTimer(page, timer, pace.seconds);
    const callbacksBeforeReplay = await page.evaluate(() =>
      ((window as any).__wordChainTimerCallbacks as (() => void)[]).length,
    );
    await page.getByTestId("button-play-again").click();
    await expect(timer).toHaveText(`${pace.seconds}s`);
    await page.waitForFunction((previousCount) =>
      ((window as any).__wordChainTimerCallbacks as (() => void)[]).length > previousCount,
      callbacksBeforeReplay,
    );
    await expireWordChainTimer(page, timer, pace.seconds);
  });
}

test("Word Stretch ignores the previous Survival word's timer after a valid answer", async ({ page }) => {
  await holdGameIntervals(page);
  let puzzleRequests = 0;
  await page.route("**/api/games/word-stretch/puzzle**", route => {
    puzzleRequests += 1;
    return route.fulfill({
      json: { word: puzzleRequests === 1 ? "CAT" : "DOG", totalSolutions: 2 },
    });
  });
  await page.route("**/api/games/word-stretch/validate**", route =>
    route.fulfill({ json: { valid: true, isMiddle: false } }),
  );

  await openGame(page, "word-stretch");
  await page.getByTestId("button-mode-survival").click();
  await expect(page.getByTestId("seed-word-display")).toContainText("CAT");
  await expect(page.getByTestId("text-timer")).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  await page.getByTestId("input-word").fill("SCAT");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("seed-word-display")).toContainText("DOG");
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(page.getByTestId("text-timer")).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const previousTimer = (window as any).__gameIntervalCallbacks[0] as () => void;
    previousTimer();
  });
  await expect(page.getByTestId("text-timer")).toHaveText("8s");

  await page.getByTestId("input-word").fill("DOGS");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
});

test("Word Bloom ignores the previous Survival word's timer after a valid answer", async ({ page }) => {
  await holdGameIntervals(page);
  await page.route("**/api/games/word-bloom/puzzle**", route =>
    route.fulfill({ json: { seed: "BE", maxDepth: 5 } }),
  );
  await page.route("**/api/games/word-bloom/validate**", route =>
    route.fulfill({ json: { valid: true } }),
  );

  await openGame(page, "word-bloom");
  await page.getByTestId("button-mode-survival").click();
  await expect(page.getByTestId("current-word-display")).toContainText("BE");
  await expect(page.getByTestId("text-timer")).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  await page.getByTestId("input-word").fill("BET");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(page.getByTestId("current-word-display")).toContainText("BET");
  await expect(page.getByTestId("text-timer")).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const previousTimer = (window as any).__gameIntervalCallbacks[0] as () => void;
    previousTimer();
  });
  await expect(page.getByTestId("text-timer")).toHaveText("8s");

  await page.getByTestId("input-word").fill("BETS");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
});

test("Letter Hunt ignores the previous Survival word's timer after a valid answer", async ({ page }) => {
  await holdGameIntervals(page);
  await mockWordValidation(page, () => true);
  await openGame(page, "letter-hunt");
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-challenge-1").click();
  await page.getByTestId("button-mode-unordered").click();

  const timer = page.getByTestId("badge-timer");
  const input = page.getByTestId("input-word");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  const letters = await page.locator('[data-testid^="required-letter-"]').allInnerTexts();
  const firstAnswer = `${letters.join("")}S`;
  const secondAnswer = `${letters.join("")}T`;
  await input.fill(firstAnswer);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const previousTimer = (window as any).__gameIntervalCallbacks[0] as () => void;
    previousTimer();
  });
  await expect(timer).toHaveText("8s");

  await input.fill(secondAnswer);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
});

test("Word Length ignores the previous Survival word's timer after a valid answer", async ({ page }) => {
  await holdGameIntervals(page);
  await mockWordValidation(page, () => true);
  await openGame(page, "word-length");
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-var-1").click();

  const timer = page.getByTestId("badge-timer");
  const input = page.getByTestId("input-word");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  const wordLength = await page.locator('[data-testid^="letter-box-"]').count();
  const firstAnswer = "A".repeat(wordLength);
  const secondAnswer = `B${"A".repeat(wordLength - 1)}`;
  await input.fill(firstAnswer);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const previousTimer = (window as any).__gameIntervalCallbacks[0] as () => void;
    previousTimer();
  });
  await expect(timer).toHaveText("8s");

  await input.fill(secondAnswer);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
});

test("Letter Position ignores the previous Survival word's timer after a valid answer", async ({ page }) => {
  await holdGameIntervals(page);
  await mockWordValidation(page, () => true);
  await openGame(page, "letter-position");
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-challenge-1").click();

  const timer = page.getByTestId("badge-timer");
  const input = page.getByTestId("input-word");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  const constraintText = await page.getByText(/Position \d+ must be letter/).innerText();
  const [, positionText, letter] = constraintText.match(/Position (\d+) must be letter '([A-Z])'/)!;
  const position = Number(positionText);
  const makeAnswer = (filler: string) =>
    Array.from({ length: Math.max(position, 2) }, (_, index) =>
      index === position - 1 ? letter : filler,
    ).join("");
  await input.fill(makeAnswer("A"));
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const previousTimer = (window as any).__gameIntervalCallbacks[0] as () => void;
    previousTimer();
  });
  await expect(timer).toHaveText("8s");

  await input.fill(makeAnswer("B"));
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
});

test("Letter Balance ignores the previous Survival word's timer after a valid answer", async ({ page }) => {
  await holdGameIntervals(page);
  await mockWordValidation(page, () => true);
  await openGame(page, "letter-balance");
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-category-start_end_vowel").click();
  await page.getByTestId("button-level-4").click();

  const timer = page.getByTestId("badge-timer");
  const input = page.getByTestId("input-word");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  await input.fill("AREA");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const previousTimer = (window as any).__gameIntervalCallbacks[0] as () => void;
    previousTimer();
  });
  await expect(timer).toHaveText("8s");

  await input.fill("IDEA");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
});

test("No Repeats ignores the previous Survival word's timer after a valid answer", async ({ page }) => {
  await holdGameIntervals(page);
  await mockWordValidation(page, () => true);
  await openGame(page, "no-repeats");
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-play-mode-free").click();
  await page.getByTestId("card-challenge-3").click();

  const timer = page.getByTestId("badge-timer");
  const input = page.getByTestId("input-word");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  await input.fill("CAT");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const previousTimer = (window as any).__gameIntervalCallbacks[0] as () => void;
    previousTimer();
  });
  await expect(timer).toHaveText("8s");

  await input.fill("DOG");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
});

test("Letter Frequency ignores the previous Survival word's timer after a valid answer", async ({ page }) => {
  await holdGameIntervals(page);
  await mockWordValidation(page, () => true);
  await openGame(page, "letter-frequency");
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-challenge-1").click();

  const timer = page.getByTestId("badge-timer");
  const input = page.getByTestId("input-word");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  const constraint = (await page.getByTestId("badge-constraint").innerText()).match(/^(\d+)× ([A-Z])$/)!;
  const count = Number(constraint[1]);
  const letter = constraint[2];
  const otherLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".replace(letter, "");
  const firstAnswer = `${letter.repeat(count)}${otherLetters.slice(0, 3)}`;
  const secondAnswer = `${letter.repeat(count)}${otherLetters.slice(3, 6)}`;
  await input.fill(firstAnswer);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(timer).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const previousTimer = (window as any).__gameIntervalCallbacks[0] as () => void;
    previousTimer();
  });
  await expect(timer).toHaveText("8s");

  await input.fill(secondAnswer);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("2");
});

test("Word Stretch ignores a validation response that arrives after ending and replaying", async ({ page }) => {
  await holdGameIntervals(page);
  await page.route("**/api/games/word-stretch/puzzle**", route =>
    route.fulfill({ json: { word: "CAT", totalSolutions: 2 } }),
  );

  let releaseValidation!: () => void;
  let notifyValidationStarted!: () => void;
  const validationStarted = new Promise<void>(resolve => {
    notifyValidationStarted = resolve;
  });
  let validationRequests = 0;
  await page.route("**/api/games/word-stretch/validate**", async route => {
    validationRequests += 1;
    if (validationRequests === 1) {
      notifyValidationStarted();
      await new Promise<void>(resolve => {
        releaseValidation = resolve;
      });
    }
    await route.fulfill({ json: { valid: true, isMiddle: false } });
  });

  await openGame(page, "word-stretch");
  await page.getByTestId("button-mode-classic").click();
  const input = page.getByTestId("input-word");
  await input.fill("SCAT");
  await page.getByTestId("button-submit").click();
  await validationStarted;

  await expireGameIntervals(page, 121);
  await expect(page.getByTestId("button-replay")).toBeVisible();
  await page.getByTestId("button-replay").click();
  await expect(input).toBeVisible();
  await input.fill("SCAT");

  const lateResponse = page.waitForResponse(response =>
    response.url().includes("/api/games/word-stretch/validate") &&
    new URL(response.url()).searchParams.get("stretched") === "SCAT",
  );
  releaseValidation();
  await lateResponse;

  await expect(input).toHaveValue("SCAT");
  await expect(page.getByTestId("badge-found-count")).toHaveText("0 / 2 found");
  await expect(page.getByTestId("button-quit")).toBeVisible();

  await input.fill("CATS");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("badge-found-count")).toHaveText("1 / 2 found");
});

test("Word Stretch ignores a delayed Survival puzzle after replay", async ({ page }) => {
  await holdGameIntervals(page);

  let releaseNextPuzzle!: () => void;
  let notifyNextPuzzleRequested!: () => void;
  let notifyNextPuzzleFulfilled!: () => void;
  const nextPuzzleRequested = new Promise<void>(resolve => {
    notifyNextPuzzleRequested = resolve;
  });
  const nextPuzzleFulfilled = new Promise<void>(resolve => {
    notifyNextPuzzleFulfilled = resolve;
  });
  let puzzleRequests = 0;
  let initialSeed = "";
  let delayedSeed = "";
  let replaySeed = "";

  await page.route("**/api/games/word-stretch/puzzle**", async route => {
    puzzleRequests += 1;
    const requestSeed = new URL(route.request().url()).searchParams.get("seed")!;
    if (puzzleRequests === 1) initialSeed = requestSeed;

    if (puzzleRequests === 2) {
      delayedSeed = requestSeed;
      notifyNextPuzzleRequested();
      await new Promise<void>(resolve => {
        releaseNextPuzzle = resolve;
      });
      await route.fulfill({ json: { word: "DOG", totalSolutions: 2 } });
      notifyNextPuzzleFulfilled();
      return;
    }

    if (puzzleRequests === 3) replaySeed = requestSeed;
    await route.fulfill({
      json: { word: "CAT", totalSolutions: 2 },
    });
  });
  await page.route("**/api/games/word-stretch/validate**", route =>
    route.fulfill({ json: { valid: true, isMiddle: false } }),
  );

  await openGame(page, "word-stretch");
  await page.getByTestId("button-mode-survival").click();
  await expect(page.getByTestId("seed-word-display")).toContainText("CAT");
  await expect(page.getByTestId("text-timer")).toHaveText("8s");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  await page.getByTestId("input-word").fill("SCAT");
  await page.getByTestId("button-submit").click();
  await nextPuzzleRequested;
  await expect(page.getByTestId("animated-number")).toHaveText("10");
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");

  // The old timer callback can still be queued when the next puzzle load is pending.
  await expireGameIntervals(page, 8);
  await expect(page.getByTestId("button-replay")).toBeVisible();
  await page.getByTestId("button-replay").click();

  await expect(page.getByTestId("seed-word-display")).toContainText("CAT");
  await expect(page.getByTestId("animated-number")).toHaveText("0");
  await expect(page.getByTestId("text-timer")).toHaveText("8s");
  await expect(page.getByTestId("button-quit")).toBeVisible();
  expect(replaySeed).toBe(initialSeed);
  expect(Number(delayedSeed)).toBe(Number(initialSeed) + 1);

  releaseNextPuzzle();
  await nextPuzzleFulfilled;
  await expect(page.getByTestId("seed-word-display")).toContainText("CAT");
  await expect(page.getByTestId("seed-word-display")).not.toContainText("DOG");
  await expect(page.getByTestId("animated-number")).toHaveText("0");
  await expect(page.getByTestId("text-timer")).toHaveText("8s");
  await expect(page.getByTestId("button-quit")).toBeVisible();

  await page.getByTestId("input-word").fill("CATS");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("animated-number")).toHaveText("10");
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
});

test("Word Bloom ignores a validation response that arrives after ending and replaying", async ({ page }) => {
  await page.route("**/api/games/word-bloom/puzzle**", route =>
    route.fulfill({ json: { seed: "BE", maxDepth: 5 } }),
  );

  let releaseValidation!: () => void;
  let notifyValidationStarted!: () => void;
  const validationStarted = new Promise<void>(resolve => {
    notifyValidationStarted = resolve;
  });
  let validationRequests = 0;
  await page.route("**/api/games/word-bloom/validate**", async route => {
    validationRequests += 1;
    if (validationRequests === 1) {
      notifyValidationStarted();
      await new Promise<void>(resolve => {
        releaseValidation = resolve;
      });
    }
    await route.fulfill({ json: { valid: true } });
  });

  await openGame(page, "word-bloom");
  await page.getByTestId("button-mode-classic").click();
  const input = page.getByTestId("input-word");
  await input.fill("BET");
  await page.getByTestId("button-submit").click();
  await validationStarted;

  await page.getByTestId("button-give-up").click();
  await expect(page.getByTestId("button-replay")).toBeVisible();
  await page.getByTestId("button-replay").click();
  await expect(input).toBeVisible();
  await input.fill("BET");

  const lateResponse = page.waitForResponse(response =>
    response.url().includes("/api/games/word-bloom/validate") &&
    new URL(response.url()).searchParams.get("next") === "BET",
  );
  releaseValidation();
  await lateResponse;

  await expect(input).toHaveValue("BET");
  await expect(page.getByTestId("current-word-display")).toContainText("BE");
  await expect(page.getByTestId("text-live-word-count")).toHaveText("0");
  await expect(page.getByTestId("chain-step-1")).toHaveCount(0);

  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
});

test("Word Stretch ignores a timer callback from the ended run after replay", async ({ page }) => {
  await holdGameIntervals(page);
  await page.route("**/api/games/word-stretch/puzzle**", route =>
    route.fulfill({ json: { word: "CAT", totalSolutions: 2 } }),
  );
  await page.route("**/api/games/word-stretch/validate**", route =>
    route.fulfill({ json: { valid: true, isMiddle: false } }),
  );

  await openGame(page, "word-stretch");
  await page.getByTestId("button-mode-classic").click();
  const timer = page.getByTestId("text-timer");
  await expect(timer).toHaveText("2:00");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  await page.evaluate(() => {
    (window as any).__oldRunTimerCallback =
      (window as any).__gameIntervalCallbacks[0] as () => void;
  });
  await expireGameIntervals(page, 121);
  await expect(page.getByTestId("button-replay")).toBeVisible();
  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await expect(timer).toHaveText("2:00");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    ((window as any).__oldRunTimerCallback as () => void)();
  });

  await expect(timer).toHaveText("2:00");
  await expect(page.getByTestId("button-quit")).toBeVisible();
  await page.getByTestId("input-word").fill("CATS");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("badge-found-count")).toHaveText("1 / 2 found");
});

test("Word Bloom ignores a timer callback from the ended run after replay", async ({ page }) => {
  await holdGameIntervals(page);
  await page.route("**/api/games/word-bloom/puzzle**", route =>
    route.fulfill({ json: { seed: "BE", maxDepth: 5 } }),
  );
  await page.route("**/api/games/word-bloom/validate**", route =>
    route.fulfill({ json: { valid: true } }),
  );

  await openGame(page, "word-bloom");
  await page.getByTestId("button-mode-classic").click();
  const timer = page.getByTestId("text-timer");
  await expect(timer).toHaveText("2:00");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 1,
  );

  await page.getByTestId("button-give-up").click();
  await expect(page.getByTestId("button-replay")).toBeVisible();
  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await expect(timer).toHaveText("2:00");
  await page.waitForFunction(() =>
    ((window as any).__gameIntervalCallbacks as (() => void)[]).length >= 2,
  );

  await page.evaluate(() => {
    const oldRunCallback = (window as any).__gameIntervalCallbacks[0] as () => void;
    oldRunCallback();
  });

  await expect(timer).toHaveText("2:00");
  await expect(page.getByTestId("button-give-up")).toBeVisible();
  await page.getByTestId("input-word").fill("BET");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(page.getByTestId("chain-step-1")).toContainText("BET");
});

test("Word Ladder shows the hint cost before use and the accumulated penalty afterward", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 4,
        optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
      }],
    }),
  );
  await openGame(page, "word-ladder");

  const hintCost = page.getByTestId("text-hint-cost");
  await expect(hintCost).toHaveText("30 points per hint; score won't drop below 10.");
  await expect(hintCost).toBeInViewport();
  await expect(page.getByTestId("button-hint")).toHaveAttribute("aria-describedby", "hint-cost");
  await page.getByTestId("button-hint").click();

  await expect(page.getByTestId("text-hint-cost")).toBeHidden();
  await expect(page.getByTestId("button-hint")).toHaveAttribute("aria-describedby", "hint-unavailable");
  await expect(page.getByTestId("text-hint-unavailable"))
    .toHaveText("Hint already shown for this step.");
  await expect(page.getByTestId("badge-hint-penalty")).toHaveText("Hint penalty: -30 pts");
});

test("Word Ladder results show hint count and penalty on wins and losses only when hints were used", async ({ page }) => {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 4,
        optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
      }],
    }),
  );
  await mockWordValidation(page, () => true);
  await openGame(page, "word-ladder");

  await completeWordLadder(page, 0);
  await expect(page.getByTestId("text-result-hint-penalty")).toBeHidden();

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await completeWordLadder(page, 1);
  await expect(page.getByTestId("text-result-hint-penalty"))
    .toHaveText("1 hint used · Hint penalty: -30 pts");

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await page.getByTestId("button-hint").click();
  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("text-result-hint-penalty").last())
    .toHaveText("1 hint used · Hint penalty: -30 pts");
});

test("Word Ladder disables a hint after showing it for the current path step", async ({ page }) => {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 4,
        optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
      }],
    }),
  );
  await mockWordValidation(page, () => true);
  await openGame(page, "word-ladder");

  const hintButton = page.getByTestId("button-hint");
  const input = page.getByTestId("input-word");
  await hintButton.click();

  await expect(input).toHaveValue("CORD");
  await expect(hintButton).toBeDisabled();
  await expect(page.getByTestId("text-hint-unavailable"))
    .toHaveText("Hint already shown for this step.");
  await expect(page.getByTestId("badge-hints")).toHaveText("Hints: 1");
  await expect(page.getByTestId("badge-hint-penalty")).toHaveText("Hint penalty: -30 pts");

  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("rung-1")).toBeVisible();
  await expect(hintButton).toBeEnabled();
  await hintButton.click();

  await expect(input).toHaveValue("CARD");
  await expect(hintButton).toBeDisabled();
  await expect(page.getByTestId("badge-hints")).toHaveText("Hints: 2");
  await expect(page.getByTestId("badge-hint-penalty")).toHaveText("Hint penalty: -60 pts");
});

test("Word Ladder explains when the current ladder has exhausted the optimal path", async ({ page }) => {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 4,
        optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
      }],
    }),
  );
  await mockWordValidation(page, () => true);
  await openGame(page, "word-ladder");

  const words = ["BOLD", "GOLD", "GOAD", "LOAD"];
  for (const [index, word] of words.entries()) {
    await page.getByTestId("input-word").fill(word);
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId(`rung-${index + 1}`)).toBeVisible();
  }

  const hintButton = page.getByTestId("button-hint");
  await expect(hintButton).toBeDisabled();
  await expect(hintButton).toHaveAttribute("aria-describedby", "hint-unavailable");
  await expect(page.getByTestId("text-hint-unavailable"))
    .toHaveText("No hints remain on the optimal path.");
});

test("Word Ladder resets hint costs and penalties when starting a new puzzle", async ({ page }) => {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [
        {
          start: "COLD",
          target: "WARM",
          par: 4,
          optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
        },
        {
          start: "HEAD",
          target: "TAIL",
          par: 4,
          optimalPaths: [["HEAD", "HEAL", "TEAL", "TELL", "TALL", "TAIL"]],
        },
      ],
    }),
  );
  await openGame(page, "word-ladder");

  const initialStart = await page.getByTestId("rung-0").textContent();
  expect(initialStart).not.toBeNull();
  await page.getByTestId("button-hint").click();
  await expect(page.getByTestId("badge-hints")).toHaveText("Hints: 1");
  await expect(page.getByTestId("badge-hint-penalty")).toHaveText("Hint penalty: -30 pts");
  await expect(page.getByTestId("text-hint-cost")).toBeHidden();

  await page.getByTestId("button-restart").click();

  await expect(page.getByTestId("rung-0")).not.toHaveText(initialStart!);
  await expect(page.getByTestId("text-hint-cost")).toHaveText("30 points per hint; score won't drop below 10.");
  await expect(page.getByTestId("badge-hints")).toBeHidden();
  await expect(page.getByTestId("badge-hint-penalty")).toBeHidden();
});

test("Word Ladder deducts 30 points per hint from the final score until the minimum score applies", async ({ page }) => {
  const longRoute = [
    "COLD", "COTD", "COTI", "COTQ", "DOTQ", "KOTQ", "YOTQ",
    "JOTQ", "JZTQ", "JATQ", "JATM", "JAAM", "JARM", "WARM",
  ];
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 12,
        optimalPaths: [longRoute],
      }],
    }),
  );
  await mockWordValidation(page, () => true);
  await openGame(page, "word-ladder");

  const scoreWithoutHints = await completeWordLadder(page, 0, longRoute.slice(1));
  expect(scoreWithoutHints).toBe(300);

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  const scoreWithOneHint = await completeWordLadder(page, 1, longRoute.slice(1));
  expect(scoreWithOneHint).toBe(scoreWithoutHints - 30);
  await expect(page.getByTestId("text-result-hint-penalty")).toHaveText("1 hint used · Hint penalty: -30 pts");

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  const scoreWithTwoHints = await completeWordLadder(page, 2, longRoute.slice(1));
  expect(scoreWithTwoHints).toBe(scoreWithoutHints - 60);
  await expect(page.getByTestId("text-result-hint-penalty")).toHaveText("2 hints used · Hint penalty: -60 pts");

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  const scoreAtMinimum = await completeWordLadder(page, 12, longRoute.slice(1));
  expect(scoreAtMinimum).toBe(10);
  await expect(page.getByTestId("text-result-hint-penalty")).toHaveText(
    "12 hints used · Hint deduction: -290 pts (10-point minimum score reached)",
  );
});

test("Word Ladder applies 30-point hint deductions on a longer route with a different par relationship", async ({ page }) => {
  const longerRoute = ["HEAL", "TEAL", "TELL", "TALL", "TAIL"];
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "HEAD",
        target: "TAIL",
        par: 3,
        optimalPaths: [["HEAD", ...longerRoute]],
      }],
    }),
  );
  await mockWordValidation(page, () => true);
  await openGame(page, "word-ladder");

  const scoreWithoutHints = await completeWordLadder(page, 0, longerRoute);
  expect(scoreWithoutHints).toBe(235);
  await expect(page.getByTestId("badge-par-result")).toHaveText("1 over par");

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  const scoreWithOneHint = await completeWordLadder(page, 1, longerRoute);
  expect(scoreWithOneHint).toBe(scoreWithoutHints - 30);
  await expect(page.getByTestId("text-result-hint-penalty")).toHaveText("1 hint used · Hint penalty: -30 pts");

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  const scoreWithTwoHints = await completeWordLadder(page, 2, longerRoute);
  expect(scoreWithTwoHints).toBe(scoreWithoutHints - 60);
  await expect(page.getByTestId("text-result-hint-penalty")).toHaveText("2 hints used · Hint penalty: -60 pts");

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  const scoreWithMaximumHints = await completeWordLadder(page, longerRoute.length, longerRoute);
  expect(scoreWithMaximumHints).toBe(scoreWithoutHints - 30 * longerRoute.length);
  await expect(page.getByTestId("text-result-hint-penalty")).toHaveText(
    `${longerRoute.length} hints used · Hint penalty: -${30 * longerRoute.length} pts`,
  );
});

test("Ladder Rush returns focus to the answer after using a hint", async ({ page }) => {
  await page.route("**/api/games/ladder-rush/puzzles**", (route) =>
    route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
  );
  await page.route("**/api/games/ladder-rush/hint", (route) =>
    route.fulfill({ json: { word: "CORD" } }),
  );
  await openGame(page, "ladder-rush");
  await page.getByTestId("button-mode-4").click();
  await page.getByTestId("button-start").click();

  const input = page.getByTestId("input-word");
  await expect(input).toBeFocused();
  await page.getByTestId("button-hint").click();

  await expect(page.getByTestId("chain-rung-1")).toContainText("CORD");
  await expect(page.getByTestId("button-hint")).toContainText("Hint (2)");
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();

  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("text-hints-used")).toContainText("1 hint used");
  await expect(page.getByTestId("text-hints-used")).toContainText("2 pts");
  await expect(page.getByTestId("text-score")).toHaveText("0");
});

test("Ladder Rush ignores a hint response that arrives after ending and replaying", async ({ page }) => {
  await holdGameIntervals(page);
  await page.route("**/api/games/ladder-rush/puzzles**", route =>
    route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
  );

  let releaseHint!: () => void;
  let notifyHintStarted!: () => void;
  const hintStarted = new Promise<void>(resolve => {
    notifyHintStarted = resolve;
  });
  let hintRequests = 0;
  await page.route("**/api/games/ladder-rush/hint", async route => {
    hintRequests += 1;
    if (hintRequests === 1) {
      notifyHintStarted();
      await new Promise<void>(resolve => {
        releaseHint = resolve;
      });
    }
    await route.fulfill({ json: { word: "CORD" } });
  });

  await openGame(page, "ladder-rush");
  await page.getByTestId("button-mode-4").click();
  await page.getByTestId("button-start").click();
  await page.getByTestId("button-hint").click();
  await hintStarted;

  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("text-score")).toHaveText("0");
  await page.getByTestId("button-replay").click();
  const input = page.getByTestId("input-word");
  const hintButton = page.getByTestId("button-hint");
  await input.fill("BOLD");
  await hintButton.focus();

  const lateResponse = page.waitForResponse(response =>
    response.url().includes("/api/games/ladder-rush/hint"),
  );
  releaseHint();
  await lateResponse;

  await expect(input).toHaveValue("BOLD");
  await expect(hintButton).toBeFocused();
  await expect(hintButton).toContainText("Hint (3)");
  await expect(page.getByTestId("chain-rung-1")).toHaveCount(0);

  await hintButton.click();
  await expect(page.getByTestId("chain-rung-1")).toContainText("CORD");
  await expect(hintButton).toContainText("Hint (2)");
  expect(hintRequests).toBe(2);
});

test("Ladder Rush preserves game state and allows retry when hint request fails", async ({ page }) => {
  await page.route("**/api/games/ladder-rush/puzzles**", (route) =>
    route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
  );

  let hintAttempts = 0;
  await page.route("**/api/games/ladder-rush/hint", async (route) => {
    hintAttempts += 1;
    if (hintAttempts === 1) {
      await route.fulfill({ status: 404, json: { message: "No hint available" } });
    } else {
      await route.fulfill({ json: { word: "CORD" } });
    }
  });
  await openGame(page, "ladder-rush");
  await startLadderRushSurvival(page);

  const hintButton = page.getByTestId("button-hint");
  const timer = page.getByTestId("badge-timer");
  await page.waitForTimeout(2200);
  await expect(timer).not.toHaveText("15s");
  const timeBeforeHint = Number((await timer.innerText()).replace("s", ""));

  await hintButton.click();
  await expect(page.getByTestId("text-hint-error")).toHaveText("Hint unavailable. Try again.");
  await expect(hintButton).toBeEnabled();
  await expect(hintButton).toContainText("Hint (3)");
  const timeAfterHintFailure = Number((await timer.innerText()).replace("s", ""));
  expect(timeAfterHintFailure).toBeLessThanOrEqual(timeBeforeHint);
  await expect(page.getByTestId("chain-rung-0")).toContainText("COLD");
  await expect(page.getByTestId("chain-rung-1")).toHaveCount(0);
  await expect(page.getByTestId("text-live-word-count")).toHaveText("0");
  await expect(page.getByText("Score", { exact: true }).locator("..").getByTestId("animated-number")).toHaveText("0");

  await hintButton.click();
  await expect(page.getByTestId("chain-rung-1")).toContainText("CORD");
  await expect(hintButton).toContainText("Hint (2)");
  expect(hintAttempts).toBe(2);
});

test("Ladder Rush preserves game state and allows retry when hint response has no word", async ({ page }) => {
  await page.route("**/api/games/ladder-rush/puzzles**", (route) =>
    route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
  );

  let hintAttempts = 0;
  await page.route("**/api/games/ladder-rush/hint", async (route) => {
    hintAttempts += 1;
    if (hintAttempts === 1) {
      await route.fulfill({ json: {} });
    } else {
      await route.fulfill({ json: { word: "CORD" } });
    }
  });
  await openGame(page, "ladder-rush");
  await startLadderRushSurvival(page);

  const hintButton = page.getByTestId("button-hint");
  const timer = page.getByTestId("badge-timer");
  await page.waitForTimeout(2200);
  await expect(timer).not.toHaveText("15s");
  const timeBeforeHint = Number((await timer.innerText()).replace("s", ""));

  await hintButton.click();
  await expect(page.getByTestId("text-hint-error")).toHaveText("Hint unavailable. Try again.");
  await expect(hintButton).toBeEnabled();
  await expect(hintButton).toContainText("Hint (3)");
  const timeAfterHintFailure = Number((await timer.innerText()).replace("s", ""));
  expect(timeAfterHintFailure).toBeLessThanOrEqual(timeBeforeHint);
  await expect(page.getByTestId("chain-rung-0")).toContainText("COLD");
  await expect(page.getByTestId("chain-rung-1")).toHaveCount(0);
  await expect(page.getByTestId("text-live-word-count")).toHaveText("0");
  await expect(page.getByText("Score", { exact: true }).locator("..").getByTestId("animated-number")).toHaveText("0");

  await hintButton.click();
  await expect(page.getByTestId("chain-rung-1")).toContainText("CORD");
  await expect(hintButton).toContainText("Hint (2)");
  expect(hintAttempts).toBe(2);
});

test("Word Ladder returns focus to the suggested answer after using a hint", async ({ page }) => {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 4,
        optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
      }],
    }),
  );
  await openGame(page, "word-ladder");

  const input = page.getByTestId("input-word");
  await expect(input).toBeFocused();
  await page.getByTestId("button-hint").click();

  await expect(input).toHaveValue("CORD");
  await expect(page.getByTestId("badge-hints")).toHaveText("Hints: 1");
  await expect(page.getByTestId("rung-0")).toBeVisible();
  await expect(page.getByTestId("rung-1")).toHaveCount(0);
  await expect(input).toBeFocused();
});

test("Word Length focuses the answer after Play Again", async ({ page }) => {
  await openGame(page, "word-length");
  await page.getByTestId("button-var-1").click();
  await playAgainAndCheckFocus(page, "button-end-game");
});

test("No Repeats focuses the answer after Play Again", async ({ page }) => {
  await openGame(page, "no-repeats");
  await page.getByTestId("button-play-mode-free").click();
  await page.getByTestId("card-challenge-3").click();
  await playAgainAndCheckFocus(page, "button-end-game");
});

test("Word Stack focuses the answer after Play Again", async ({ page }) => {
  await page.route("**/api/games/word-stack/puzzles", (route) =>
    route.fulfill({ json: [{ targetWord: "CAT", startWord: "AT" }] }),
  );
  await openGame(page, "word-stack");
  await page.getByTestId("button-challenge-build-up").click();
  await playAgainAndCheckFocus(page, "button-end-game");
});

test("Word Stretch focuses the answer after Play Again", async ({ page }) => {
  await page.route("**/api/games/word-stretch/puzzle**", (route) =>
    route.fulfill({ json: { word: "CAT", totalSolutions: 1 } }),
  );
  await page.route("**/api/games/word-stretch/validate**", (route) =>
    route.fulfill({ json: { valid: true, isMiddle: false } }),
  );
  await openGame(page, "word-stretch");
  await page.getByTestId("button-mode-classic").click();

  const input = page.getByTestId("input-word");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill("CATS");
  await page.getByTestId("button-submit").click();

  const playAgain = page.getByTestId("button-play-again");
  await expect(playAgain).toBeVisible();
  await playAgain.click();
  await expect(input).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });
});

test("Word Bloom focuses the answer after Play Again", async ({ page }) => {
  await page.route("**/api/games/word-bloom/puzzle**", (route) =>
    route.fulfill({ json: { seed: "BE", maxDepth: 5 } }),
  );
  await openGame(page, "word-bloom");
  await page.getByTestId("button-mode-classic").click();
  await playAgainAndCheckFocus(page, "button-give-up");
});

test("Ladder Rush focuses the answer after Play Again", async ({ page }) => {
  await page.route("**/api/games/ladder-rush/puzzles**", (route) =>
    route.fulfill({ json: [{ start: "COLD", wordLength: 4 }] }),
  );
  await openGame(page, "ladder-rush");
  await page.getByTestId("button-mode-4").click();
  await page.getByTestId("button-start").click();
  await playAgainAndCheckFocus(page, "button-end-game");
});

test("Word Ladder focuses the answer after Play Again", async ({ page }) => {
  await page.route("**/api/games/word-ladder/puzzles**", (route) =>
    route.fulfill({
      json: [{
        start: "COLD",
        target: "WARM",
        par: 4,
        optimalPaths: [["COLD", "CORD", "CARD", "WARD", "WARM"]],
      }],
    }),
  );
  await openGame(page, "word-ladder");
  await playAgainAndCheckFocus(page, "button-end-game");
});

test("Word Length focuses the answer after returning to the menu and starting again", async ({ page }) => {
  await openGame(page, "word-length");
  await page.getByTestId("button-var-1").click();

  await page.getByTestId("button-menu").click();
  await page.getByTestId("button-var-1").click();

  const input = page.getByTestId("input-word");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });
});

test("No Repeats focuses the answer after returning to the menu and starting again", async ({ page }) => {
  await openGame(page, "no-repeats");
  await page.getByTestId("button-play-mode-free").click();
  await page.getByTestId("card-challenge-3").click();

  await page.getByTestId("button-menu").click();
  await page.getByTestId("card-challenge-3").click();

  const input = page.getByTestId("input-word");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });
});

test("Word Stack focuses the answer after changing the challenge and starting again", async ({ page }) => {
  await page.route("**/api/games/word-stack/puzzles", (route) =>
    route.fulfill({
      json: [
        { targetWord: "CAT", startWord: "AT" },
        { targetWord: "DOG", startWord: "DO" },
      ],
    }),
  );
  await openGame(page, "word-stack");
  await page.getByTestId("button-challenge-build-up").click();

  await page.getByRole("button", { name: "Change Challenge" }).click();
  await page.getByTestId("button-challenge-build-up").click();

  const input = page.getByTestId("input-word");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused({ timeout: 5000 });
});
