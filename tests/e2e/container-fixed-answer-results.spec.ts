import { test, expect, type Page } from "@playwright/test";

const TEST_USER = {
  id: 824,
  username: "results-tester",
  name: "Results Tester",
  avatarUrl: null,
  bio: null,
  isPremium: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "results-tester@example.com",
  emailVerified: true,
  isAdmin: false,
};

const QUIZ_CODE = "RESULT824";
const DAILY_DATE = "2026-10-17";
const DEFINITION_WORDS = [{
  word: "CAT",
  definitions: ["A small pet", "A feline", "An animal that meows"],
  partOfSpeech: "noun",
}];
const PARTIAL_DEFINITION_WORDS = [
  ...DEFINITION_WORDS,
  {
    word: "DOG",
    definitions: ["A loyal pet", "A canine", "An animal that barks"],
    partOfSpeech: "noun",
  },
];
const SCRAMBLE_WORDS = [{ word: "CAT", category: "animals" }];

const QUIZ_SESSION = {
  id: 824,
  creatorId: TEST_USER.id,
  shareCode: QUIZ_CODE,
  title: "Fixed Answer Results",
  gameSlug: "definition-match",
  createdAt: "2026-01-01T00:00:00.000Z",
  closesAt: null,
  description: null,
  params: { words: DEFINITION_WORDS },
  playerCount: 0,
  isClosed: false,
};

type QuizResultState = {
  scoreWrites: number[];
  scores: Array<Record<string, unknown>>;
};

async function installShareCapture(page: Page) {
  await page.addInitScript(() => {
    const state = window as any;
    state.copiedResults = [];
    state.nativeShares = [];
    state.socialShares = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => {
        state.copiedResults.push(text);
        return Promise.resolve();
      } },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (payload: ShareData) => {
        state.nativeShares.push(payload);
        return Promise.resolve();
      },
    });
    window.open = ((url?: string | URL) => {
      state.socialShares.push(String(url));
      return null;
    }) as typeof window.open;
  });
}

async function dismissAnnouncement(page: Page) {
  const close = page.getByTestId("button-whats-new-close");
  if (await close.isVisible()) await close.click();
}

async function mockDailyApis(page: Page) {
  await page.route("**/api/**", route => route.fulfill({ json: [] }));
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: null } }));
  await page.route("**/api/analytics/events", route => route.fulfill({ status: 202, json: { ok: true } }));
  await page.route("**/api/daily-challenge", route => route.fulfill({
    json: {
      date: DAILY_DATE,
      slug: "definition-match",
      seed: 824,
      game: {
        id: 1,
        slug: "definition-match",
        name: "Definition Match",
        description: "Match words to their definitions.",
        icon: "BookOpen",
        color: "#2563eb",
      },
    },
  }));
  await page.route("**/api/daily-challenge/attempt**", route => route.fulfill({
    status: 401,
    json: { attempt: null },
  }));
  await page.route("**/api/daily-challenge/leaderboard**", route => route.fulfill({
    json: { entries: [], myRank: undefined },
  }));
  await page.route("**/api/daily-challenge/score", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/leaderboard/definition-match/percentile**", route =>
    route.fulfill({ json: { percentile: 50, totalPlayers: 4 } }));
  await page.route("**/api/games/definition-match/words**", route =>
    route.fulfill({ json: DEFINITION_WORDS }));
}

async function startDaily(page: Page) {
  await page.goto("/daily");
  await dismissAnnouncement(page);
  await page.getByTestId("button-play-daily").click();
  await expect(page.getByTestId("input-answer")).toBeVisible();
}

async function mockQuizApis(page: Page): Promise<QuizResultState> {
  const state: QuizResultState = { scoreWrites: [], scores: [] };
  await page.route("**/api/**", route => route.fulfill({ json: [] }));
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: TEST_USER } }));
  await page.route("**/api/analytics/events", route => route.fulfill({ status: 202, json: { ok: true } }));
  await page.route(`**/api/quiz-sessions/${QUIZ_CODE}`, route =>
    route.fulfill({ json: QUIZ_SESSION }));
  await page.route(`**/api/quiz-sessions/${QUIZ_CODE}/scores`, async route => {
    if (route.request().method() === "POST") {
      const score = route.request().postDataJSON().score as number;
      state.scoreWrites.push(score);
      state.scores = [{
        id: 824,
        sessionId: QUIZ_SESSION.id,
        userId: TEST_USER.id,
        score,
        completedAt: "2026-10-17T12:00:00.000Z",
        playerName: TEST_USER.name,
        playerAvatarUrl: null,
      }];
      await route.fulfill({ json: { score } });
      return;
    }

    await route.fulfill({
      json: {
        scores: state.scores,
        myScore: state.scores[0] ?? null,
      },
    });
  });
  await page.route(`**/api/quiz-sessions/${QUIZ_CODE}/results`, route =>
    route.fulfill({ json: { session: QUIZ_SESSION, scores: state.scores } }));
  return state;
}

async function startQuiz(page: Page) {
  await page.goto(`/quiz/${QUIZ_CODE}`);
  await dismissAnnouncement(page);
  await page.getByTestId("button-play-quiz").click();
}

async function revealDefinitionAnswer(page: Page) {
  await page.getByTestId("button-reveal-hint").click();
  await page.getByTestId("button-reveal-hint").click();
  await page.getByTestId("button-show-answer").click();
}

async function getLocalGameResult(page: Page, slug: string) {
  return page.evaluate(gameSlug => {
    const stats = JSON.parse(localStorage.getItem("wordplay_stats") ?? "{}");
    const daily = JSON.parse(localStorage.getItem("wordplay_daily_challenge") ?? "[]");
    return {
      game: stats.perGame?.[gameSlug] ?? null,
      history: stats.history ?? [],
      daily,
    };
  }, slug);
}

async function shareTextFromTwitter(page: Page) {
  await page.getByTestId("button-share-twitter").click();
  return page.evaluate(() => {
    const url = new URL((window as any).socialShares.at(-1));
    return url.searchParams.get("text");
  });
}

test.describe("Daily Challenge fixed-answer outcomes", () => {
  test.beforeEach(async ({ page }) => {
    await installShareCapture(page);
    await mockDailyApis(page);
  });

  test("older score-only records keep their score and share text without showing an outcome", async ({ page }) => {
    await page.addInitScript((date: string) => {
      localStorage.setItem("wordplay_daily_challenge", JSON.stringify([{
        date,
        slug: "definition-match",
        score: 321,
        completedAt: 1792238400000,
      }]));
    }, DAILY_DATE);

    await page.goto("/daily");
    await dismissAnnouncement(page);

    await expect(page.getByText("Challenge Complete", { exact: true })).toBeVisible();
    await expect(page.getByTestId("text-daily-score")).toHaveText("Score: 321");
    await expect(page.getByTestId("text-daily-outcome")).toHaveCount(0);

    await page.getByTestId("button-share-daily").click();
    await expect.poll(() => page.evaluate(() => (window as any).copiedResults.length)).toBe(1);
    const copied = await page.evaluate(() => (window as any).copiedResults[0]);
    expect(copied).toContain("xtraWordinary Daily Challenge");
    expect(copied).toContain("Definition Match");
    expect(copied).toContain("Score: 321");
    expect(copied).toContain("Can you beat it?");
    expect(copied).toContain("/daily");
  });

  test("revealing the only answer records a non-win and shares the score without a win claim", async ({ page }) => {
    await startDaily(page);
    await revealDefinitionAnswer(page);

    await expect(page.getByText("Challenge Complete", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("text-daily-score")).toHaveText("Score: 0", { timeout: 15000 });
    await expect(page.getByTestId("text-daily-outcome")).toHaveText("Outcome: Not won", { timeout: 15000 });
    await expect.poll(async () => {
      const result = await getLocalGameResult(page, "definition-match");
      return {
        wins: result.game?.gamesWon ?? 0,
        dailyScore: result.daily[0]?.score,
        dailyWon: result.daily[0]?.won,
      };
    }).toEqual({ wins: 0, dailyScore: 0, dailyWon: false });

    await page.getByTestId("button-share-daily").click();
    await expect.poll(() => page.evaluate(() => (window as any).copiedResults.length)).toBe(1);
    const copied = await page.evaluate(() => (window as any).copiedResults);
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain("Score: 0");
    expect(copied[0]).not.toMatch(/\bwon\b|\bwin\b/i);
    expect(await page.evaluate(() => (window as any).nativeShares)).toEqual([]);
  });

  test("solving the only answer records and shares the completed score", async ({ page }) => {
    await startDaily(page);
    await page.getByTestId("input-answer").fill("CAT");
    await page.getByTestId("button-submit").click();

    await expect(page.getByText("Challenge Complete", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("text-daily-score")).toHaveText("Score: 100", { timeout: 15000 });
    await expect(page.getByTestId("text-daily-outcome")).toHaveText("Outcome: Won", { timeout: 15000 });
    await expect.poll(async () => {
      const result = await getLocalGameResult(page, "definition-match");
      return {
        wins: result.game?.gamesWon ?? 0,
        dailyScore: result.daily[0]?.score,
        dailyWon: result.daily[0]?.won,
        historyWon: result.history[0]?.won,
      };
    }).toEqual({ wins: 1, dailyScore: 100, dailyWon: true, historyWon: true });

    await page.getByTestId("button-share-daily").click();
    await expect.poll(() => page.evaluate(() => (window as any).copiedResults.length)).toBe(1);
    const copied = await page.evaluate(() => (window as any).copiedResults);
    expect(copied[0]).toContain("Score: 100");
    expect(copied[0]).not.toMatch(/\bwon\b|\bwin\b/i);
    expect(await page.evaluate(() => (window as any).nativeShares)).toEqual([]);
  });
});

test.describe("Quiz fixed-answer outcomes", () => {
  test.beforeEach(async ({ page }) => {
    await installShareCapture(page);
  });

  test("revealing a quiz answer submits its score but keeps the result and share wording as a non-win", async ({ page }) => {
    const quiz = await mockQuizApis(page);
    await startQuiz(page);
    await revealDefinitionAnswer(page);

    await expect(page.getByRole("heading", { name: "Game Over", exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("0 of 1 definitions matched.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("text-completion-message")).toBeVisible();
    await expect(page.getByText("Score saved!", { exact: true })).toBeVisible();
    await expect.poll(() => quiz.scoreWrites).toEqual([0]);
    await expect.poll(async () => {
      const result = await getLocalGameResult(page, "definition-match");
      return { wins: result.game?.gamesWon, lastWon: result.history.at(-1)?.won };
    }).toEqual({ wins: 0, lastWon: false });

    const sharedText = await shareTextFromTwitter(page);
    expect(sharedText).toContain("I just played Definition Match");
    expect(sharedText).toContain("Score: 0 points");
    expect(sharedText).not.toContain("I just completed");

    await page.getByTestId("button-back-to-quiz").click();
    await expect(page.getByTestId("button-quiz-results-dashboard")).toBeVisible();
    await page.getByTestId("button-quiz-results-dashboard").click();
    await expect(page.getByTestId("text-score-result-824")).toHaveText("0");
  });

  test("a positive partial quiz score is submitted and recorded without becoming a win", async ({ page }) => {
    const quiz = await mockQuizApis(page);
    const session = {
      ...QUIZ_SESSION,
      params: { words: PARTIAL_DEFINITION_WORDS },
    };
    await page.route(`**/api/quiz-sessions/${QUIZ_CODE}`, route => route.fulfill({ json: session }));
    await startQuiz(page);

    // The quiz's seeded word order starts with CAT; leave DOG unrevealed after earning points.
    await page.getByTestId("input-answer").fill("CAT");
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("input-answer")).toHaveValue("", { timeout: 5000 });
    await revealDefinitionAnswer(page);

    await expect(page.getByRole("heading", { name: "Game Over", exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("1 of 2 definitions matched.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("text-completion-message")).toBeVisible();
    await expect(page.getByText("Vocabulary Master!", { exact: true })).toHaveCount(0);
    await expect(page.getByText("100 points", { exact: true })).toBeVisible();
    await expect(page.getByText("Score saved!", { exact: true })).toBeVisible();
    await expect.poll(() => quiz.scoreWrites).toEqual([100]);
    await expect.poll(async () => {
      const result = await getLocalGameResult(page, "definition-match");
      return {
        wins: result.game?.gamesWon,
        lastWon: result.history.at(-1)?.won,
        lastScore: result.history.at(-1)?.score,
      };
    }).toEqual({ wins: 0, lastWon: false, lastScore: 100 });

    const sharedText = await shareTextFromTwitter(page);
    expect(sharedText).toContain("I just played Definition Match");
    expect(sharedText).toContain("Score: 100 points");
    expect(sharedText).not.toContain("I just completed");

    await page.getByTestId("button-back-to-quiz").click();
    await expect(page.getByTestId("button-quiz-results-dashboard")).toBeVisible();
    await page.getByTestId("button-quiz-results-dashboard").click();
    await expect(page.getByTestId("text-score-result-824")).toHaveText("100");
  });

  test("skipping the only quiz target stores zero without turning it into a win", async ({ page }) => {
    const quiz = await mockQuizApis(page);
    const session = { ...QUIZ_SESSION, gameSlug: "word-scramble", params: { words: SCRAMBLE_WORDS } };
    await page.route(`**/api/quiz-sessions/${QUIZ_CODE}`, route => route.fulfill({ json: session }));
    await startQuiz(page);
    await page.getByTestId("button-skip").click();

    await expect(page.getByRole("heading", { name: "Game Over", exact: true })).toBeVisible();
    await expect(page.getByText(/You solved 0 of 1 words/)).toBeVisible();
    await expect(page.getByText("Score saved!", { exact: true })).toBeVisible();
    await expect.poll(() => quiz.scoreWrites).toEqual([0]);
    await expect.poll(async () => {
      const result = await getLocalGameResult(page, "word-scramble");
      return { wins: result.game?.gamesWon, lastWon: result.history.at(-1)?.won };
    }).toEqual({ wins: 0, lastWon: false });

    const sharedText = await shareTextFromTwitter(page);
    expect(sharedText).toContain("I just played Word Scramble");
    expect(sharedText).toContain("Score: 0 points");
  });

  test("leaving a quiz before its result does not submit or record a result", async ({ page }) => {
    const quiz = await mockQuizApis(page);
    await startQuiz(page);
    await page.getByTestId("button-back-to-quiz").click();
    await expect(page.getByRole("alertdialog", { name: "Leave the game?" })).toBeVisible();
    await page.getByTestId("button-guard-leave").click();

    await expect(page.getByTestId("button-play-quiz")).toBeVisible();
    expect(quiz.scoreWrites).toEqual([]);
    const result = await getLocalGameResult(page, "definition-match");
    expect(result.game).toBeNull();
    expect(result.history).toEqual([]);
  });

  test("solving every quiz target submits and displays the score as a completed result", async ({ page }) => {
    const quiz = await mockQuizApis(page);
    await startQuiz(page);
    await page.getByTestId("input-answer").fill("CAT");
    await page.getByTestId("button-submit").click();

    await expect(page.getByRole("heading", { name: "Vocabulary Master!" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("You matched all 1 definitions!", { exact: true })).toBeVisible();
    await expect(page.getByText("Score saved!", { exact: true })).toBeVisible();
    await expect.poll(() => quiz.scoreWrites).toEqual([100]);
    await expect.poll(async () => {
      const result = await getLocalGameResult(page, "definition-match");
      return { wins: result.game?.gamesWon, lastWon: result.history.at(-1)?.won };
    }).toEqual({ wins: 1, lastWon: true });

    const sharedText = await shareTextFromTwitter(page);
    expect(sharedText).toContain("I just completed Definition Match");
    expect(sharedText).toContain("Score: 100 points");

    await page.getByTestId("button-back-to-quiz").click();
    await expect(page.getByTestId("button-quiz-results-dashboard")).toBeVisible();
    await page.getByTestId("button-quiz-results-dashboard").click();
    await expect(page.getByTestId("text-score-result-824")).toHaveText("100");
  });
});
