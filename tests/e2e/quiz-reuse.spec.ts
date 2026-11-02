import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "QuizReuse123!";

type User = {
  id: number;
  username: string;
};

type QuizSession = {
  id: number;
  title: string;
  gameSlug: string;
  shareCode: string;
  closesAt: string | null;
  params: Record<string, unknown> | null;
};

async function createPremiumAccount(request: APIRequestContext): Promise<User> {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `quiz_reuse_${unique}@example.com`;
  const username = `qr${unique}`;

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
  const { user } = await response.json();
  return user as User;
}

async function createQuizWithScore(
  request: APIRequestContext,
  creatorId: number,
): Promise<QuizSession> {
  const response = await request.post("/api/quiz-sessions", {
    data: {
      gameSlug: "definition-match",
      title: `Quiz reuse source ${Date.now()}`,
      params: { difficulty: "standard" },
    },
  });
  expect(response.status()).toBe(200);
  const quiz = await response.json() as QuizSession & { creatorId: number };
  expect(quiz.creatorId).toBe(creatorId);

  const scoreResponse = await request.post(`/api/quiz-sessions/${quiz.shareCode}/scores`, {
    data: { score: 42 },
  });
  expect(scoreResponse.status()).toBe(200);

  return quiz;
}

function futureLocalDateTime(daysFromNow: number): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function dismissAnnouncement(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible()) await closeButton.click();
}

for (const entrypoint of [
  { name: "My Quizzes", path: (userId: number) => "/my-quizzes", withCloseDate: true },
  {
    name: "the owner's profile tab",
    path: (userId: number) => `/profile/${userId}?tab=quizzes`,
    withCloseDate: false,
  },
] as const) {
  test(`reuses a quiz from ${entrypoint.name} without copying scores`, async ({ page }) => {
    const user = await createPremiumAccount(page.request);
    const source = await createQuizWithScore(page.request, user.id);
    const title = `Reused quiz ${Date.now()}`;

    await page.goto(entrypoint.path(user.id));
    await dismissAnnouncement(page);

    await page.getByTestId(`button-reuse-quiz-${source.id}`).click();
    const dialog = page.getByRole("dialog", { name: "Reuse quiz settings" });
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("input-reuse-quiz-title").fill(title);

    let submittedCloseDate: string | null = null;
    if (entrypoint.withCloseDate) {
      const inputValue = futureLocalDateTime(14);
      await dialog.getByTestId("input-reuse-quiz-closes-at").fill(inputValue);
      submittedCloseDate = await dialog.getByTestId("input-reuse-quiz-closes-at").evaluate(
        (input: HTMLInputElement) => new Date(input.value).toISOString(),
      );
    }

    await dialog.getByTestId("button-confirm-reuse-quiz").click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    const quizzesResponse = await page.request.get("/api/quiz-sessions/my");
    expect(quizzesResponse.status()).toBe(200);
    const quizzes = await quizzesResponse.json() as QuizSession[];
    const reusedQuiz = quizzes.find(quiz => quiz.title === title);
    expect(reusedQuiz).toBeDefined();
    expect(reusedQuiz!.id).not.toBe(source.id);
    expect(reusedQuiz!.shareCode).not.toBe(source.shareCode);
    expect(reusedQuiz!.gameSlug).toBe(source.gameSlug);
    expect(reusedQuiz!.params).toEqual(source.params);
    expect(reusedQuiz!.closesAt).toBe(submittedCloseDate);

    const sourceScoresResponse = await page.request.get(
      `/api/quiz-sessions/${source.shareCode}/scores`,
    );
    expect(sourceScoresResponse.status()).toBe(200);
    const sourceScores = await sourceScoresResponse.json();
    expect(sourceScores.scores).toHaveLength(1);

    const reusedScoresResponse = await page.request.get(
      `/api/quiz-sessions/${reusedQuiz!.shareCode}/scores`,
    );
    expect(reusedScoresResponse.status()).toBe(200);
    const reusedScores = await reusedScoresResponse.json();
    expect(reusedScores.scores).toEqual([]);
  });
}
