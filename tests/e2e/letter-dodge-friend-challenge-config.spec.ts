import { test, expect, type Browser, type Page } from "@playwright/test";

const PASSWORD = "ChallengeTest123!";
const CHALLENGE_DIFFICULTIES = [
  { difficulty: 1, testId: "button-challenge-dodge-difficulty-1", label: "Easy (1 letter)" },
  { difficulty: 2, testId: "button-challenge-dodge-difficulty-2", label: "Medium (2 letters)" },
  { difficulty: 3, testId: "button-challenge-dodge-difficulty-3", label: "Hard (3 letters)" },
  { difficulty: 4, testId: "button-challenge-dodge-difficulty-4", label: "Expert (4 letters)" },
  { difficulty: 5, testId: "button-challenge-dodge-difficulty-5", label: "Master (5 letters)" },
  { difficulty: "savant", testId: "button-challenge-dodge-difficulty-savant", label: "Savant (6–12 letters)" },
  { difficulty: "advanced", testId: "button-challenge-dodge-difficulty-advanced", label: "Advanced (random 1–5)" },
] as const;
const CHALLENGE_MODES = [
  {
    survival: false,
    modeTestId: "button-challenge-dodge-mode-classic",
    modeLabel: "Standard",
    timerTicks: 600,
  },
  {
    survival: true,
    modeTestId: "button-challenge-dodge-mode-survival",
    modeLabel: "Survival",
    timerTicks: 8,
  },
] as const;
const CHALLENGE_SCENARIOS = CHALLENGE_DIFFICULTIES.flatMap(difficulty =>
  CHALLENGE_MODES.map(mode => ({ ...difficulty, ...mode })),
);
const LOCKED_BALANCE_BOUNDARY_SCENARIOS = [
  {
    level: 4,
    consonantCount: 1,
    word: "AERO",
    constraint: "4-letter word: 1 consonant, 3 vowels",
    label: "Locked Balance · 4-letter words · 1C/3V",
  },
  {
    level: 4,
    consonantCount: 3,
    word: "BARK",
    constraint: "4-letter word: 3 consonants, 1 vowel",
    label: "Locked Balance · 4-letter words · 3C/1V",
  },
  {
    level: 10,
    consonantCount: 1,
    word: "AEIOUAEIOR",
    constraint: "10-letter word: 1 consonant, 9 vowels",
    label: "Locked Balance · 10-letter words · 1C/9V",
  },
  {
    level: 10,
    consonantCount: 9,
    word: "BCDFGHJKLA",
    constraint: "10-letter word: 9 consonants, 1 vowel",
    label: "Locked Balance · 10-letter words · 9C/1V",
  },
] as const;
const LETTER_BALANCE_POSITIONAL_CHALLENGE_SCENARIOS = [
  {
    category: "start_end_vowel",
    level: 6,
    levelTestId: "button-challenge-lb-category-level-6",
    expectedConstraint: "6-letter words starting AND ending with a vowel",
  },
  {
    category: "start_vowel_end_consonant",
    level: "advanced",
    levelTestId: "button-challenge-lb-category-level-advanced",
    expectedConstraint: /^\d+-letter word: vowel start, consonant end$/,
  },
] as const;

async function createTestAccount(page: Page, suffix: string) {
  const username = `dodge${suffix[0]}${Date.now().toString().slice(-10)}`;
  const email = `${username}@example.com`;
  const registration = await page.request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status()).toBe(201);
  const { user } = await registration.json();

  const login = await page.request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);
  return user as { id: number; username: string; name: string };
}

async function installLetterDodgeTimer(page: Page) {
  await page.clock.install({ time: new Date("2026-10-16T12:00:00.000Z") });
  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const callbacks = new Map<number, TimerHandler>();

    window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay !== 1000) return nativeSetInterval(handler, delay, ...args);
      const id = nativeSetInterval(handler, 3_600_000, ...args) as unknown as number;
      callbacks.set(id, handler);
      return id as unknown as ReturnType<typeof window.setInterval>;
    }) as typeof window.setInterval;
    window.clearInterval = ((id: number | undefined) => {
      if (id !== undefined) callbacks.delete(id);
      nativeClearInterval(id);
    }) as typeof window.clearInterval;
    (window as any).__advanceLetterDodgeTimer = (ticks: number) => {
      const activeTimer = Array.from(callbacks.entries()).at(-1);
      if (!activeTimer) throw new Error("Letter Dodge timer was not registered");
      const [id, handler] = activeTimer;
      for (let tick = 0; tick < ticks; tick++) {
        if (!callbacks.has(id)) break;
        if (typeof handler === "function") handler();
      }
    };
  });
}

async function cacheStableApiReads(page: Page) {
  const responses = new Map<string, {
    status: number;
    contentType: string;
    body: Buffer;
  }>();

  await page.route("**/api/**", async route => {
    const request = route.request();
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    if (
      url.pathname === "/api/notifications/stream" ||
      url.pathname === "/api/notifications" ||
      url.pathname === "/api/notifications/unread-count" ||
      url.pathname === "/api/challenges" ||
      url.pathname === "/api/challenges/unread-count" ||
      /^\/api\/challenges\/\d+$/.test(url.pathname)
    ) {
      await route.continue();
      return;
    }

    const cached = responses.get(url.href);
    if (cached) {
      await route.fulfill(cached);
      return;
    }

    const response = await route.fetch();
    const cachedResponse = {
      status: response.status(),
      contentType: response.headers()["content-type"] ?? "application/json",
      body: await response.body(),
    };
    responses.set(url.href, cachedResponse);
    await route.fulfill(cachedResponse);
  });
}

async function setupFriendChallengePlayers(page: Page, browser: Browser) {
  const receiverContext = await browser.newContext();
  const receiverPage = await receiverContext.newPage();
  const [sender, receiver] = await Promise.all([
    createTestAccount(page, "sender"),
    createTestAccount(receiverPage, "receiver"),
  ]);
  const friendshipResponse = await page.request.post("/api/friends/request", {
    data: { userId: receiver.id },
  });
  expect(friendshipResponse.status()).toBe(200);
  const friendship = await friendshipResponse.json();
  const acceptedFriendship = await receiverPage.request.post(
    `/api/friends/${friendship.id}/accept`,
  );
  expect(acceptedFriendship.status()).toBe(200);

  await Promise.all([
    installLetterDodgeTimer(page),
    installLetterDodgeTimer(receiverPage),
  ]);
  await Promise.all([
    cacheStableApiReads(page),
    cacheStableApiReads(receiverPage),
  ]);
  await Promise.all([
    page.route("**/api/games/validate-word", route =>
      route.fulfill({ json: { valid: true } }),
    ),
    receiverPage.route("**/api/games/validate-word", route =>
      route.fulfill({ json: { valid: true } }),
    ),
  ]);

  return { receiverContext, receiverPage, receiver };
}

async function submitSafeWord(page: Page) {
  const forbiddenLetters = await page.locator('[data-testid^="badge-forbidden-"]').allTextContents();
  const word = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    .filter(letter => !forbiddenLetters.includes(letter))
    .slice(0, 4)
    .join("");
  expect(word).toHaveLength(4);

  await page.getByTestId("input-word").fill(word);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
}

function makeLetterBalancePositionalAnswer(category: string, constraint: string) {
  const length = Number(constraint.match(/^(\d+)-letter/)?.[1]);
  expect(Number.isInteger(length)).toBe(true);
  expect(length).toBeGreaterThanOrEqual(4);

  if (category === "start_end_vowel") {
    return `A${"B".repeat(length - 2)}E`;
  }
  if (category === "start_vowel_end_consonant") {
    return `A${"B".repeat(length - 1)}`;
  }
  throw new Error(`No positional answer builder for Letter Balance category: ${category}`);
}

async function expectCompletedChallengeSettings(
  page: Page,
  challengeId: number,
  settings: (typeof CHALLENGE_SCENARIOS)[number],
) {
  await page.goto("/friends?tab=challenges");
  await assertCompletedChallengeSettings(page, challengeId, settings);
}

async function assertCompletedChallengeSettings(
  page: Page,
  challengeId: number,
  settings: (typeof CHALLENGE_SCENARIOS)[number],
) {
  const expectSettings = async () => {
    await expect(page.getByTestId(`row-challenge-${challengeId}`)).toBeVisible();
    await expect(page.getByTestId(`badge-challenge-difficulty-${challengeId}`))
      .toHaveText(settings.label);

    const survivalBadge = page.getByTestId(`badge-challenge-survival-${challengeId}`);
    if (settings.survival) {
      await expect(survivalBadge).toHaveText("Survival");
    } else {
      await expect(survivalBadge).toHaveCount(0);
    }
  };

  await expectSettings();
  await page.reload();
  await expectSettings();
}

async function openCompletionNotification(
  page: Page,
  challengeId: number,
  existingNotificationIds: Set<number>,
  receiverUsername: string,
  settings: (typeof CHALLENGE_SCENARIOS)[number],
) {
  let resultNotification: {
    id: number;
    type: string;
    title: string;
    body: string;
    linkUrl: string;
  } | undefined;
  await expect.poll(async () => {
    const response = await page.request.get("/api/notifications");
    expect(response.status()).toBe(200);
    const notifications = await response.json();
    resultNotification = notifications.find((notification: {
      id: number;
      type: string;
      title: string;
      body: string;
      linkUrl: string;
    }) =>
      !existingNotificationIds.has(notification.id) &&
      notification.type === "friend_challenge_result",
    );
    return resultNotification ?? null;
  }, { timeout: 10_000 }).not.toBeNull();
  if (!resultNotification) {
    throw new Error("The friend challenge completion notification was not created");
  }

  expect(resultNotification).toMatchObject({
    type: "friend_challenge_result",
    title: "Challenge result ready",
    body: `@${receiverUsername} completed your Letter Dodge challenge · ${settings.label}${settings.survival ? " · Survival" : ""}`,
    linkUrl: "/friends?tab=challenges",
  });

  await page.getByTestId("button-notifications-bell").click();
  const notificationButton = page.getByTestId(`notification-db-${resultNotification.id}`);
  await expect(notificationButton).toBeVisible();
  await expect(notificationButton).toContainText(
    `@${receiverUsername} completed your Letter Dodge challenge · ${settings.label}${settings.survival ? " · Survival" : ""}`,
  );
  await notificationButton.click();
  await expect(page).toHaveURL(/\/friends\?tab=challenges$/);
  await assertCompletedChallengeSettings(page, challengeId, settings);
}

async function runFriendChallengeLifecycle(
  page: Page,
  receiverPage: Page,
  receiverId: number,
  receiverUsername: string,
  settings: (typeof CHALLENGE_SCENARIOS)[number],
  viaCompletionNotification = false,
) {
  await page.goto("/game/letter-dodge");
  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) await announcementClose.click();
  await page.getByTestId("button-challenge-friend").click();
  await page.getByTestId(`button-select-challenge-friend-${receiverId}`).click();
  await page.getByTestId(settings.modeTestId).click();
  await page.getByTestId(settings.testId).click();
  await page.getByTestId("button-start-challenge").click();

  await expect(page.getByTestId("text-challenge-mode-title")).toBeVisible();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await submitSafeWord(page);
  const challengeCreated = page.waitForResponse(response =>
    response.url().endsWith("/api/challenges") &&
    response.request().method() === "POST",
  );
  await page.evaluate(ticks =>
    (window as any).__advanceLetterDodgeTimer(ticks),
  settings.timerTicks);
  const createResponse = await challengeCreated;
  expect(createResponse.status()).toBe(200);
  const savedChallenge = await createResponse.json();
  const expectedConfig = { difficulty: settings.difficulty, survival: settings.survival };
  expect(JSON.parse(savedChallenge.gameConfig)).toEqual(expectedConfig);

  await receiverPage.goto(`/game/letter-dodge?challenge=${savedChallenge.id}`);
  const receiverAnnouncementClose = receiverPage.getByTestId("button-whats-new-close");
  if (await receiverAnnouncementClose.isVisible()) await receiverAnnouncementClose.click();
  await expect(receiverPage.getByTestId("text-challenge-banner-title")).toBeVisible();
  await expect(receiverPage.getByTestId("input-word")).toBeVisible();
  await submitSafeWord(receiverPage);

  let existingNotificationIds = new Set<number>();
  if (viaCompletionNotification) {
    const notificationsResponse = await page.request.get("/api/notifications");
    expect(notificationsResponse.status()).toBe(200);
    const notificationsBeforeCompletion = await notificationsResponse.json();
    existingNotificationIds = new Set<number>(
      notificationsBeforeCompletion.map((notification: { id: number }) => notification.id),
    );
  }

  await receiverPage.evaluate(ticks =>
    (window as any).__advanceLetterDodgeTimer(ticks),
  settings.timerTicks);

  const configOnResult = receiverPage.getByTestId("text-challenge-dodge-config");
  await expect(configOnResult).toBeVisible();
  await expect(configOnResult).toHaveText(
    settings.modeLabel === "Survival"
      ? `${settings.label} · Survival`
      : settings.label,
  );
  if (settings.modeLabel === "Standard") {
    await expect(configOnResult).not.toContainText("Survival");
  }

  const persistedChallengeResponse = await receiverPage.request.get(
    `/api/challenges/${savedChallenge.id}`,
  );
  expect(persistedChallengeResponse.status()).toBe(200);
  const persistedChallenge = await persistedChallengeResponse.json();
  expect(JSON.parse(persistedChallenge.gameConfig)).toEqual(expectedConfig);
  expect(persistedChallenge.status).toBe("completed");

  if (viaCompletionNotification) {
    await openCompletionNotification(
      page,
      savedChallenge.id,
      existingNotificationIds,
      receiverUsername,
      settings,
    );
    await expectCompletedChallengeSettings(receiverPage, savedChallenge.id, settings);
  } else {
    await expectCompletedChallengeSettings(receiverPage, savedChallenge.id, settings);
    await expectCompletedChallengeSettings(page, savedChallenge.id, settings);
  }
}

test("every Letter Dodge difficulty survives a Standard and Survival friend challenge", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const { receiverContext, receiverPage, receiver } =
    await setupFriendChallengePlayers(page, browser);

  try {
    for (const settings of CHALLENGE_SCENARIOS) {
      await runFriendChallengeLifecycle(
        page,
        receiverPage,
        receiver.id,
        receiver.username,
        settings,
      );
    }
  } finally {
    await receiverContext.close().catch(() => undefined);
  }
});

test("switching away from Locked Balance only sends the selected Letter Balance settings", async ({
  page,
  browser,
}) => {
  const { receiverContext, receiver } =
    await setupFriendChallengePlayers(page, browser);

  try {
    const startChallengeAfterLockedSettings = async (mode: "random" | "category") => {
      await page.goto("/game/letter-balance");
      const announcementClose = page.getByTestId("button-whats-new-close");
      if (await announcementClose.isVisible()) await announcementClose.click();
      await page.getByTestId("button-challenge-friend").click();
      await page.getByTestId(`button-select-challenge-friend-${receiver.id}`).click();
      await page.getByTestId("button-challenge-lb-locked").click();
      await page.getByTestId("button-challenge-lb-level-6").click();
      await page.getByTestId("button-challenge-lb-consonant-2").click();

      if (mode === "random") {
        await page.getByTestId("button-challenge-lb-random").click();
      } else {
        await page.getByTestId("button-challenge-lb-category").click();
        await page.getByTestId("button-challenge-lb-cat-consonant_count").click();
        await page.getByTestId("button-challenge-lb-category-level-3").click();
      }

      await page.getByTestId("button-start-challenge").click();
      return new URL(page.url());
    };

    const randomUrl = await startChallengeAfterLockedSettings("random");
    expect(randomUrl.pathname).toBe("/game/letter-balance");
    expect(randomUrl.searchParams.get("challenge-new")).toBe(String(receiver.id));
    expect(randomUrl.searchParams.get("lbCategory")).toBeNull();
    expect(randomUrl.searchParams.get("lbLevel")).toBeNull();
    expect(randomUrl.searchParams.get("lbConsonantCount")).toBeNull();

    const categoryUrl = await startChallengeAfterLockedSettings("category");
    expect(categoryUrl.pathname).toBe("/game/letter-balance");
    expect(categoryUrl.searchParams.get("challenge-new")).toBe(String(receiver.id));
    expect(
      [...categoryUrl.searchParams.entries()].filter(([key]) => key.startsWith("lb")),
    ).toEqual([
      ["lbCategory", "consonant_count"],
      ["lbLevel", "3"],
    ]);

    await page.goto("/game/letter-balance");
    const announcementClose = page.getByTestId("button-whats-new-close");
    if (await announcementClose.isVisible()) await announcementClose.click();
    await page.getByTestId("button-challenge-friend").click();
    await page.getByTestId(`button-select-challenge-friend-${receiver.id}`).click();
    await page.getByTestId("button-challenge-lb-category").click();
    await page.getByTestId("button-challenge-lb-cat-start_end_vowel").click();
    await page.getByTestId("button-challenge-lb-category-level-6").click();
    await page.getByTestId("button-challenge-lb-random").click();
    await page.getByTestId("button-start-challenge").click();

    const categoryToRandomUrl = new URL(page.url());
    expect(categoryToRandomUrl.pathname).toBe("/game/letter-balance");
    expect(categoryToRandomUrl.searchParams.get("challenge-new")).toBe(String(receiver.id));
    expect(
      [...categoryToRandomUrl.searchParams.entries()].filter(([key]) => key.startsWith("lb")),
    ).toEqual([]);
  } finally {
    await receiverContext.close().catch(() => undefined);
  }
});

for (const settings of [CHALLENGE_SCENARIOS[0], CHALLENGE_SCENARIOS[1]]) {
  test(`completion notification opens ${settings.modeLabel} Letter Dodge settings`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const { receiverContext, receiverPage, receiver } =
      await setupFriendChallengePlayers(page, browser);

    try {
      await runFriendChallengeLifecycle(
        page,
        receiverPage,
        receiver.id,
        receiver.username,
        settings,
        true,
      );
    } finally {
      await receiverContext.close().catch(() => undefined);
    }
  });
}

test("Locked Balance boundary settings survive the complete friend challenge flow", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const { receiverContext, receiverPage, receiver } =
    await setupFriendChallengePlayers(page, browser);

  try {
    // One valid answer completes each challenge game quickly while keeping the
    // sender/receiver on the real gameplay and completion paths.
    for (const playerPage of [page, receiverPage]) {
      await playerPage.route("**/api/games/letter-balance/config", route =>
        route.fulfill({ json: { wordsPerRound: 1, timePerWord: 12 } }),
      );
      await playerPage.route("**/api/games/validate-word", route =>
        route.fulfill({ json: { valid: true } }),
      );
    }

    for (const settings of LOCKED_BALANCE_BOUNDARY_SCENARIOS) {
      const expectedConfig = {
        category: "locked_balance",
        level: settings.level,
        consonantCount: settings.consonantCount,
      };

      await page.goto("/game/letter-balance");
      const announcementClose = page.getByTestId("button-whats-new-close");
      if (await announcementClose.isVisible()) await announcementClose.click();
      await page.getByTestId("button-challenge-friend").click();
      await page.getByTestId(`button-select-challenge-friend-${receiver.id}`).click();
      await page.getByTestId("button-challenge-lb-locked").click();
      await page.getByTestId(`button-challenge-lb-level-${settings.level}`).click();
      await page.getByTestId(
        `button-challenge-lb-consonant-${settings.consonantCount}`,
      ).click();
      await page.getByTestId("button-start-challenge").click();

      await expect(page).toHaveURL(
        new RegExp(
          `/game/letter-balance\\?challenge-new=${receiver.id}.*lbCategory=locked_balance.*lbLevel=${settings.level}.*lbConsonantCount=${settings.consonantCount}`,
        ),
      );
      await expect(page.getByTestId("text-challenge-mode-title")).toBeVisible();
      await expect(page.getByTestId("badge-constraint")).toHaveText(settings.constraint);

      const challengeCreated = page.waitForResponse(response =>
        response.url().endsWith("/api/challenges") &&
        response.request().method() === "POST",
      );
      await page.getByTestId("input-word").fill(settings.word);
      await page.getByTestId("button-submit").click();
      await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
      const createResponse = await challengeCreated;
      expect(createResponse.status()).toBe(200);
      const challenge = await createResponse.json();
      expect(challenge.gameSlug).toBe("letter-balance");
      expect(JSON.parse(challenge.gameConfig)).toEqual(expectedConfig);

      await expect(page).toHaveURL("/game/letter-balance");
      await receiverPage.goto(`/game/letter-balance?challenge=${challenge.id}`);
      const receiverAnnouncementClose = receiverPage.getByTestId("button-whats-new-close");
      if (await receiverAnnouncementClose.isVisible()) await receiverAnnouncementClose.click();
      await expect(receiverPage.getByTestId("text-challenge-banner-title")).toBeVisible();
      await expect(receiverPage.getByTestId("badge-constraint")).toHaveText(settings.constraint);

      const completionResponsePromise = receiverPage.waitForResponse(response =>
        response.url().endsWith(`/api/challenges/${challenge.id}/complete`) &&
        response.request().method() === "POST",
      );
      await receiverPage.getByTestId("input-word").fill(settings.word);
      await receiverPage.getByTestId("button-submit").click();
      await expect(receiverPage.getByTestId("text-live-word-count")).toHaveText("1");
      const completionResponse = await completionResponsePromise;
      expect(completionResponse.status()).toBe(200);
      await expect(receiverPage.getByTestId("text-challenge-lb-config"))
        .toHaveText(settings.label);

      const persistedChallengeResponse = await receiverPage.request.get(
        `/api/challenges/${challenge.id}`,
      );
      expect(persistedChallengeResponse.status()).toBe(200);
      const persistedChallenge = await persistedChallengeResponse.json();
      expect(persistedChallenge.status).toBe("completed");
      expect(JSON.parse(persistedChallenge.gameConfig)).toEqual(expectedConfig);

      await page.goto("/friends?tab=challenges");
      await receiverPage.getByTestId("button-back").click();
      await expect(receiverPage).toHaveURL("/friends");
      await receiverPage.getByTestId("tab-challenges").click();

      for (const playerPage of [page, receiverPage]) {
        const configBadge = playerPage.getByTestId(
          `badge-challenge-letter-balance-config-${challenge.id}`,
        );
        await expect(configBadge).toHaveText(settings.label);
        await playerPage.reload();
        await playerPage.getByTestId("tab-challenges").click();
        await expect(configBadge).toHaveText(settings.label);
      }
    }
  } finally {
    await receiverContext.close().catch(() => undefined);
  }
});

test("Locked Balance challenges require a consonant count for the selected word length", async ({
  page,
  browser,
}) => {
  const { receiverContext, receiver } = await setupFriendChallengePlayers(page, browser);

  try {
    await page.goto("/game/letter-balance");
    const announcementClose = page.getByTestId("button-whats-new-close");
    if (await announcementClose.isVisible()) await announcementClose.click();
    await page.getByTestId("button-challenge-friend").click();
    await page.getByTestId(`button-select-challenge-friend-${receiver.id}`).click();
    await page.getByTestId("button-challenge-lb-locked").click();

    const startButton = page.getByTestId("button-start-challenge");
    await expect(startButton).toBeDisabled();

    await page.getByTestId("button-challenge-lb-level-4").click();
    await expect(startButton).toBeDisabled();
    await page.getByTestId("button-challenge-lb-consonant-3").click();
    await expect(startButton).toBeEnabled();

    await page.getByTestId("button-challenge-lb-level-5").click();
    await expect(startButton).toBeDisabled();
    await page.getByTestId("button-challenge-lb-consonant-2").click();
    await expect(startButton).toBeEnabled();
  } finally {
    await receiverContext.close().catch(() => undefined);
  }
});

test("Selected Letter Balance categories are shared with the challenge receiver", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const { receiverContext, receiverPage, receiver } =
    await setupFriendChallengePlayers(page, browser);

  try {
    const expectedConfig = { category: "consonant_count", level: 3 };
    const expectedConstraint = "Words with exactly 3 consonants";

    for (const playerPage of [page, receiverPage]) {
      await playerPage.route("**/api/games/letter-balance/config", route =>
        route.fulfill({ json: { wordsPerRound: 1, timePerWord: 12 } }),
      );
    }

    await page.goto("/game/letter-balance");
    const announcementClose = page.getByTestId("button-whats-new-close");
    if (await announcementClose.isVisible()) await announcementClose.click();
    await page.getByTestId("button-challenge-friend").click();
    await page.getByTestId(`button-select-challenge-friend-${receiver.id}`).click();
    await page.getByTestId("button-challenge-lb-category").click();
    await page.getByTestId("button-challenge-lb-cat-consonant_count").click();
    await page.getByTestId("button-challenge-lb-category-level-3").click();
    await page.getByTestId("button-start-challenge").click();

    await expect(page).toHaveURL(
      new RegExp(`/game/letter-balance\\?challenge-new=${receiver.id}.*lbCategory=consonant_count.*lbLevel=3`),
    );
    await expect(page.getByTestId("badge-constraint")).toHaveText(expectedConstraint);

    const challengeCreated = page.waitForResponse(response =>
      response.url().endsWith("/api/challenges") &&
      response.request().method() === "POST",
    );
    await page.getByTestId("input-word").fill("ORANGE");
    await page.getByTestId("button-submit").click();
    const createResponse = await challengeCreated;
    expect(createResponse.status()).toBe(200);
    const challenge = await createResponse.json();
    expect(JSON.parse(challenge.gameConfig)).toEqual(expectedConfig);

    await receiverPage.goto(`/game/letter-balance?challenge=${challenge.id}`);
    const receiverAnnouncementClose = receiverPage.getByTestId("button-whats-new-close");
    if (await receiverAnnouncementClose.isVisible()) await receiverAnnouncementClose.click();
    await expect(receiverPage.getByTestId("badge-constraint")).toHaveText(expectedConstraint);
  } finally {
    await receiverContext.close().catch(() => undefined);
  }
});

test("positional and Advanced Letter Balance challenge rules match for both players", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const { receiverContext, receiverPage, receiver } =
    await setupFriendChallengePlayers(page, browser);

  try {
    for (const playerPage of [page, receiverPage]) {
      await playerPage.route("**/api/games/letter-balance/config", route =>
        route.fulfill({ json: { wordsPerRound: 1, timePerWord: 12 } }),
      );
    }

    for (const settings of LETTER_BALANCE_POSITIONAL_CHALLENGE_SCENARIOS) {
      const expectedConfig = { category: settings.category, level: settings.level };
      await page.goto("/game/letter-balance");
      const announcementClose = page.getByTestId("button-whats-new-close");
      if (await announcementClose.isVisible()) await announcementClose.click();
      await page.getByTestId("button-challenge-friend").click();
      await page.getByTestId(`button-select-challenge-friend-${receiver.id}`).click();
      await page.getByTestId("button-challenge-lb-category").click();
      await page.getByTestId(`button-challenge-lb-cat-${settings.category}`).click();
      await page.getByTestId(settings.levelTestId).click();
      await page.getByTestId("button-start-challenge").click();

      const senderUrl = new URL(page.url());
      expect(senderUrl.pathname).toBe("/game/letter-balance");
      expect(senderUrl.searchParams.get("challenge-new")).toBe(String(receiver.id));
      expect(senderUrl.searchParams.get("lbCategory")).toBe(settings.category);
      expect(senderUrl.searchParams.get("lbLevel")).toBe(String(settings.level));

      const senderConstraintBadge = page.getByTestId("badge-constraint");
      await expect(senderConstraintBadge).toHaveText(settings.expectedConstraint);
      const senderConstraint = (await senderConstraintBadge.textContent())?.trim();
      expect(senderConstraint).toBeTruthy();
      const answer = makeLetterBalancePositionalAnswer(settings.category, senderConstraint!);

      const challengeCreated = page.waitForResponse(response =>
        response.url().endsWith("/api/challenges") &&
        response.request().method() === "POST",
      );
      await page.getByTestId("input-word").fill(answer);
      await page.getByTestId("button-submit").click();
      const createResponse = await challengeCreated;
      expect(createResponse.status()).toBe(200);
      const challenge = await createResponse.json();
      expect(challenge.gameSlug).toBe("letter-balance");
      expect(JSON.parse(challenge.gameConfig)).toEqual(expectedConfig);
      expect(challenge.seed).toBe(Number(senderUrl.searchParams.get("seed")));

      await receiverPage.goto(`/game/letter-balance?challenge=${challenge.id}`);
      const receiverAnnouncementClose = receiverPage.getByTestId("button-whats-new-close");
      if (await receiverAnnouncementClose.isVisible()) await receiverAnnouncementClose.click();
      await expect(receiverPage.getByTestId("text-challenge-banner-title")).toBeVisible();
      await expect(receiverPage.getByTestId("badge-constraint")).toHaveText(senderConstraint!);

      const completionResponsePromise = receiverPage.waitForResponse(response =>
        response.url().endsWith(`/api/challenges/${challenge.id}/complete`) &&
        response.request().method() === "POST",
      );
      await receiverPage.getByTestId("input-word").fill(answer);
      await receiverPage.getByTestId("button-submit").click();
      const completionResponse = await completionResponsePromise;
      expect(completionResponse.status()).toBe(200);

      const persistedChallengeResponse = await receiverPage.request.get(
        `/api/challenges/${challenge.id}`,
      );
      expect(persistedChallengeResponse.status()).toBe(200);
      const persistedChallenge = await persistedChallengeResponse.json();
      expect(persistedChallenge.status).toBe("completed");
      expect(JSON.parse(persistedChallenge.gameConfig)).toEqual(expectedConfig);
    }
  } finally {
    await receiverContext.close().catch(() => undefined);
  }
});
