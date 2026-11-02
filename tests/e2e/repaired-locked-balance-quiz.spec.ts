import { test, expect } from "@playwright/test";

const TEST_USER = {
  id: 78501,
  username: "quiz-repair-tester",
  name: "Quiz Repair Tester",
  avatarUrl: null,
  bio: null,
  isPremium: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "quiz-repair@example.com",
  emailVerified: true,
  isAdmin: false,
};

const QUIZ_CODE = "REPAIRLB";
const QUIZ_ID = 78502;

test("reopening a repaired Locked Balance quiz shows its new rules and allows play", async ({ page }) => {
  const availabilityResponse = await page.request.get(
    "/api/games/letter-balance/locked-balance-availability",
  );
  expect(availabilityResponse.ok()).toBe(true);
  const { availability } = await availabilityResponse.json() as {
    availability: Record<string, boolean>;
  };
  const unavailablePair = Object.entries(availability).find(([, available]) => !available);
  const availablePair = Object.entries(availability).find(([, available]) => available);
  expect(unavailablePair, "the active dictionary should include an unavailable setting").toBeDefined();
  expect(availablePair, "the active dictionary should include a playable setting").toBeDefined();

  const [oldLength, oldConsonantCount] = unavailablePair![0].split(":").map(Number);
  const [newLength, newConsonantCount] = availablePair![0].split(":").map(Number);
  let quiz = {
    id: QUIZ_ID,
    creatorId: TEST_USER.id,
    creatorName: TEST_USER.name,
    creatorAvatarUrl: null,
    gameSlug: "letter-balance",
    title: "Repaired Locked Balance quiz",
    description: null,
    shareCode: QUIZ_CODE,
    params: {
      category: "locked_balance",
      level: oldLength,
      consonantCount: oldConsonantCount,
    },
    closesAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isClosed: false,
  };

  await page.route("**/api/auth/me", route =>
    route.fulfill({ json: { user: TEST_USER } }),
  );
  await page.route("**/api/games/letter-balance/locked-balance-availability", route =>
    route.fulfill({ json: { availability } }),
  );
  await page.route("**/api/quiz-sessions/my", route =>
    route.fulfill({ json: [{ ...quiz, playerCount: 0 }] }),
  );
  await page.route(`**/api/quiz-sessions/${QUIZ_CODE}`, async route => {
    if (route.request().method() === "PATCH") {
      const { length, consonantCount } = route.request().postDataJSON();
      quiz = {
        ...quiz,
        params: { ...quiz.params, level: length, consonantCount },
      };
      await route.fulfill({ json: quiz });
      return;
    }
    await route.fulfill({ json: quiz });
  });
  await page.route(`**/api/quiz-sessions/${QUIZ_CODE}/scores`, route =>
    route.fulfill({ json: { scores: [], myScore: null } }),
  );
  await page.route("**/api/games/letter-balance/config", route =>
    route.fulfill({ json: { wordsPerRound: 20, timePerWord: 12 } }),
  );

  await page.goto(`/quiz/${QUIZ_CODE}`);
  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) await announcementClose.click();
  await expect(page.getByRole("alert")).toContainText(
    "No valid dictionary words match this saved Locked Balance setting",
  );
  await expect(page.getByTestId("button-play-quiz")).toBeDisabled();

  await page.getByTestId("link-repair-locked-balance").click();
  await expect(page).toHaveURL("/my-quizzes");
  await page.getByTestId(`button-edit-quiz-rules-${QUIZ_ID}`).click();

  await page.getByTestId(`button-edit-locked-balance-length-${newLength}`).click();
  await page.getByTestId(`button-edit-locked-balance-consonants-${newConsonantCount}`).click();
  await page.getByTestId("button-save-locked-balance-rules").click();
  await expect(page.getByText("Quiz rules updated")).toBeVisible();

  await page.getByTestId(`button-play-quiz-${QUIZ_ID}`).click();
  await expect(page).toHaveURL(`/quiz/${QUIZ_CODE}`);
  await expect(page.getByTestId("text-quiz-variant-summary")).toContainText(
    `Locked Balance · ${newLength}L / ${newConsonantCount}C / ${newLength - newConsonantCount}V`,
  );
  await expect(page.getByTestId("button-play-quiz")).toBeEnabled();
  await page.getByTestId("button-play-quiz").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await expect(page.getByTestId("badge-constraint")).toContainText(
    `${newLength}-letter word`,
  );
});
