import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const PASSWORD = "GameCreatorPinTest123!";
const ADMIN_EMAIL = "creator-pin-admin@example.com";
const OWNED_GAME = "word-scramble";
const OTHER_GAME = "word-chain";

type Account = {
  id: number;
  username: string;
};

async function createAccount(
  request: APIRequestContext,
  label: string,
  options: { email?: string } = {},
): Promise<Account> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const username = `gcp${label}${suffix}`.slice(0, 20);
  const email = options.email ?? `${username}@example.com`;

  const registration = await request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const login = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(200);

  const response = await request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  const { user } = await response.json();
  return { id: user.id, username: user.username };
}

async function postGameComment(request: APIRequestContext, gameSlug: string, content: string) {
  const response = await request.post("/api/comments", {
    data: { targetType: "game", targetId: gameSlug, content },
  });
  expect(response.status(), await response.text()).toBe(201);
  return await response.json() as { id: number };
}

async function dismissWhatsNew(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

async function loginAs(
  context: BrowserContext,
  email: string,
): Promise<void> {
  const response = await context.request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(response.status(), await response.text()).toBe(200);
}

test("admins assign game creators who can manage only their game's discussion pins", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const creatorContext = await browser.newContext();
  const regularContext = await browser.newContext();
  const creatorPage = await creatorContext.newPage();
  const regularPage = await regularContext.newPage();
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const creatorEmail = `creator-${suffix}@example.com`;
  const regularEmail = `player-${suffix}@example.com`;

  try {
    const admin = await createAccount(page.request, "admin", { email: ADMIN_EMAIL });
    const creator = await createAccount(creatorContext.request, "creator", { email: creatorEmail });
    await createAccount(regularContext.request, "player", { email: regularEmail });

    const adminResponse = await page.request.get("/api/auth/me");
    const { user: adminUser } = await adminResponse.json();
    expect(adminUser.isAdmin).toBe(true);
    expect(admin.id).toBe(adminUser.id);

    await page.goto("/admin");
    await dismissWhatsNew(page);
    await expect(page.getByTestId("text-admin-title")).toBeVisible();
    await page.getByTestId("tab-games").click();
    const creatorSelector = page.getByTestId(`select-game-creator-${OWNED_GAME}`);
    await expect(creatorSelector).toBeVisible();
    await creatorSelector.selectOption(String(creator.id));
    await expect.poll(async () => {
      const gamesResponse = await page.request.get("/api/admin/games");
      const games = await gamesResponse.json();
      return games.find((game: { slug: string }) => game.slug === OWNED_GAME)?.creatorId;
    }).toBe(creator.id);

    const ownComment = await postGameComment(
      regularContext.request,
      OWNED_GAME,
      `Creator pin test comment ${suffix}`,
    );
    const otherGameComment = await postGameComment(
      regularContext.request,
      OTHER_GAME,
      `Other game pin test comment ${suffix}`,
    );
    await postGameComment(
      regularContext.request,
      OTHER_GAME,
      `Other unpinned game comment ${suffix}`,
    );

    await page.goto(`/game/${OTHER_GAME}#comments`);
    await dismissWhatsNew(page);
    const adminPin = page.getByTestId(`button-pin-comment-${otherGameComment.id}`);
    await expect(adminPin).toBeVisible();
    await adminPin.click();
    await expect(page.getByTestId(`button-unpin-comment-${otherGameComment.id}`)).toBeVisible();
    await expect(page.getByTestId("pinned-comment")).toContainText(
      `Other game pin test comment ${suffix}`,
    );

    await page.getByTestId("button-sort-comments-oldest").click();
    await expect(page.getByTestId("pinned-comment")).toContainText(
      `Other game pin test comment ${suffix}`,
    );
    await expect(page.getByTestId("comments-list")).toBeVisible();

    await page.getByTestId("input-search-comments").fill("no game comment matches this phrase");
    await expect(page.getByTestId("comments-list")).toHaveCount(0);
    await expect(page.getByTestId("pinned-comment")).toContainText(
      `Other game pin test comment ${suffix}`,
    );

    await page.getByTestId("button-clear-comment-search").click();
    await expect(page.getByTestId("comments-list")).toBeVisible();

    await page.reload();
    await dismissWhatsNew(page);
    await expect(page.getByTestId("pinned-comment")).toContainText(
      `Other game pin test comment ${suffix}`,
    );
    await expect(page.getByTestId(`button-unpin-comment-${otherGameComment.id}`)).toBeVisible();
    await page.getByTestId(`button-unpin-comment-${otherGameComment.id}`).click();
    await expect(page.getByTestId("pinned-comment")).toHaveCount(0);
    await expect(page.getByTestId(`button-pin-comment-${otherGameComment.id}`)).toBeVisible();

    await loginAs(creatorContext, creatorEmail);
    await creatorPage.goto(`/game/${OWNED_GAME}#comments`);
    await dismissWhatsNew(creatorPage);
    const ownPin = creatorPage.getByTestId(`button-pin-comment-${ownComment.id}`);
    await expect(ownPin).toBeVisible();
    await ownPin.click();
    await expect(creatorPage.getByTestId(`button-unpin-comment-${ownComment.id}`)).toBeVisible();
    await expect(creatorPage.getByTestId("pinned-comment")).toContainText(
      `Creator pin test comment ${suffix}`,
    );
    await creatorPage.getByTestId(`button-unpin-comment-${ownComment.id}`).click();
    await expect(creatorPage.getByTestId("pinned-comment")).toHaveCount(0);
    await expect(creatorPage.getByTestId(`button-pin-comment-${ownComment.id}`)).toBeVisible();

    await loginAs(regularContext, regularEmail);
    await regularPage.goto(`/game/${OWNED_GAME}#comments`);
    await dismissWhatsNew(regularPage);
    await expect(regularPage.getByTestId("comments-list")).toBeVisible();
    await expect(regularPage.locator(
      '[data-testid^="button-pin-comment-"], [data-testid^="button-unpin-comment-"]',
    )).toHaveCount(0);
    const regularPinAttempt = await regularContext.request.patch(
      `/api/comments/${ownComment.id}/pin`,
      { data: { targetType: "game", targetId: OWNED_GAME, isPinned: true } },
    );
    expect(regularPinAttempt.status()).toBe(403);

    await creatorPage.goto(`/game/${OTHER_GAME}#comments`);
    await dismissWhatsNew(creatorPage);
    await expect(creatorPage.getByTestId("comments-list")).toBeVisible();
    await expect(creatorPage.locator(
      '[data-testid^="button-pin-comment-"], [data-testid^="button-unpin-comment-"]',
    )).toHaveCount(0);
    const otherGamePinAttempt = await creatorContext.request.patch(
      `/api/comments/${otherGameComment.id}/pin`,
      { data: { targetType: "game", targetId: OTHER_GAME, isPinned: true } },
    );
    expect(otherGamePinAttempt.status()).toBe(403);
  } finally {
    await Promise.all([creatorContext.close(), regularContext.close()]);
  }
});
