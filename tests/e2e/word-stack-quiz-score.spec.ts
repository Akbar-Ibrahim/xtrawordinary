import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "WordStackQuiz123!";
const PUZZLES = [{ targetWord: "CAT", startWord: "AT" }];

type User = {
  id: number;
  username: string;
};

type QuizSession = {
  id: number;
  title: string;
  gameSlug: string;
  shareCode: string;
  params: Record<string, unknown> | null;
};

async function createPremiumAccount(request: APIRequestContext): Promise<User> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `word_stack_quiz_${suffix}@example.com`;
  const username = `wsq${suffix}`;

  const registration = await request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status()).toBe(201);

  const login = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  const premium = await request.post("/api/users/me/upgrade-premium");
  expect(premium.status()).toBe(200);

  const response = await request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  return (await response.json()).user as User;
}

async function mockWordStackPuzzleApis(page: Page) {
  await page.route("**/api/games/word-stack/puzzles", route =>
    route.fulfill({ json: PUZZLES }),
  );
  await page.route("**/api/games/validate-word", route =>
    route.fulfill({ json: { valid: true } }),
  );
}

async function dismissAnnouncement(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible()) await closeButton.click();
}

async function completeWordStackQuizPuzzle(page: Page) {
  const input = page.getByTestId("input-word");
  await input.fill("AT");
  await page.getByTestId("button-submit").click();
  await expect(input).toHaveValue("");

  await input.fill("CAT");
  await page.getByTestId("button-submit").click();
  await expect(page.getByRole("heading", { name: "All Puzzles Complete!" })).toBeVisible();
  await expect(page.getByText("Puzzles Completed: 1 of 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Score saved!", { exact: true })).toBeVisible();
}

test("Word Stack quiz shares its puzzle and saves one quiz score per player", async ({ page, browser }) => {
  await mockWordStackPuzzleApis(page);
  const creator = await createPremiumAccount(page.request);
  const title = `Word Stack browser quiz ${Date.now()}`;

  await page.goto("/");
  await dismissAnnouncement(page);
  await page.goto("/game/word-stack?create-quiz=1");

  const createDialog = page.getByRole("dialog", { name: "Create Quiz" });
  await expect(createDialog).toBeVisible();
  await createDialog.getByTestId("input-quiz-title").fill(title);

  await createDialog.getByTestId("select-word-stack-challenge").click();
  await page.getByRole("option", { name: "Build Up" }).click();
  await createDialog.getByTestId("select-word-stack-puzzle-count").click();
  await page.getByRole("option", { name: "Short (5 puzzles)" }).click();

  await createDialog.getByTestId("button-create-quiz-submit").click();
  const review = page.getByTestId("quiz-review-step");
  await expect(review).toContainText("Build Up");
  await expect(review).toContainText("Short · 5 puzzles");
  await review.getByTestId("button-quiz-review-create").click();
  await expect(createDialog).toContainText("Quiz session created!");

  const quizUrl = await createDialog.getByTestId("text-quiz-link").inputValue();
  const shareCode = new URL(quizUrl).pathname.split("/").at(-1)!;
  const myQuizzesResponse = await page.request.get("/api/quiz-sessions/my");
  expect(myQuizzesResponse.status()).toBe(200);
  const quizzes = await myQuizzesResponse.json() as QuizSession[];
  const savedQuiz = quizzes.find(quiz => quiz.shareCode === shareCode);
  expect(savedQuiz).toBeDefined();
  expect(savedQuiz).toMatchObject({
    creatorId: creator.id,
    gameSlug: "word-stack",
    title,
    params: { challenge: "build-up", puzzleCount: "short" },
  });

  await createDialog.getByTestId("button-play-quiz").click();
  await expect(page).toHaveURL(`/quiz/${shareCode}`);
  await expect(page.getByTestId("text-quiz-title")).toHaveText(title);
  await expect(page.getByTestId("text-quiz-variant-summary")).toContainText("Build Up");
  await expect(page.getByTestId("text-quiz-variant-summary")).toContainText("Short · 5 puzzles");

  const normalLeaderboardRequests: string[] = [];
  let creatorQuizScoreSubmissions = 0;
  page.on("request", request => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/api/leaderboard") {
      normalLeaderboardRequests.push(url.pathname);
    }
    if (
      request.method() === "POST" &&
      url.pathname === `/api/quiz-sessions/${shareCode}/scores`
    ) {
      creatorQuizScoreSubmissions += 1;
    }
  });

  await page.getByTestId("button-play-quiz").click();
  await expect(page.getByTestId("text-progress")).toContainText("Build Up: CAT");
  const creatorInitialPuzzle = await page.getByTestId("text-progress").innerText();
  await completeWordStackQuizPuzzle(page);
  expect(creatorQuizScoreSubmissions).toBe(1);

  const participantContext = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000",
  });
  try {
    const participantPage = await participantContext.newPage();
    await mockWordStackPuzzleApis(participantPage);
    const participant = await createPremiumAccount(participantPage.request);
    let participantQuizScoreSubmissions = 0;
    participantPage.on("request", request => {
      const url = new URL(request.url());
      if (
        request.method() === "POST" &&
        url.pathname === `/api/quiz-sessions/${shareCode}/scores`
      ) {
        participantQuizScoreSubmissions += 1;
      }
    });

    await participantPage.goto(`/quiz/${shareCode}`);
    await dismissAnnouncement(participantPage);
    await expect(participantPage.getByTestId("text-quiz-title")).toHaveText(title);
    await expect(participantPage.getByTestId("text-quiz-variant-summary")).toContainText("Build Up");
    await expect(participantPage.getByTestId("text-quiz-variant-summary")).toContainText("Short · 5 puzzles");
    await participantPage.getByTestId("button-play-quiz").click();
    await expect(participantPage.getByTestId("text-progress")).toContainText("Build Up: CAT");
    await expect(participantPage.getByTestId("text-progress")).toHaveText(creatorInitialPuzzle);
    await completeWordStackQuizPuzzle(participantPage);
    expect(participantQuizScoreSubmissions).toBe(1);

    const scoresResponse = await participantPage.request.get(`/api/quiz-sessions/${shareCode}/scores`);
    expect(scoresResponse.status()).toBe(200);
    const { scores } = await scoresResponse.json() as {
      scores: Array<{ userId: number; score: number }>;
    };
    expect(scores).toHaveLength(2);
    expect(scores.map(score => score.userId).sort((a, b) => a - b)).toEqual(
      [creator.id, participant.id].sort((a, b) => a - b),
    );
    expect(scores.every(score => score.score > 0)).toBe(true);
    expect(normalLeaderboardRequests).toEqual([]);

    const leaderboardResponse = await participantPage.request.get(
      "/api/leaderboard/word-stack-build-up",
    );
    expect(leaderboardResponse.status()).toBe(200);
    const leaderboard = await leaderboardResponse.json() as Array<{ userId: number }>;
    expect(leaderboard.some(entry => entry.userId === creator.id || entry.userId === participant.id)).toBe(false);
  } finally {
    await participantContext.close();
  }
});
