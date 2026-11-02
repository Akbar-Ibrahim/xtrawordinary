import { test, expect, type Page } from "@playwright/test";

const TEST_USER = {
  id: 709,
  username: "dodge-tester",
  name: "Dodge Tester",
  avatarUrl: null,
  bio: null,
  isPremium: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "dodge-tester@example.com",
  emailVerified: true,
  isAdmin: false,
};

const SECOND_TEST_USER = {
  ...TEST_USER,
  id: 710,
  username: "another-dodge-tester",
  name: "Another Dodge Tester",
  email: "another-dodge-tester@example.com",
};

const GAME = {
  id: 1,
  slug: "letter-dodge",
  name: "Letter Dodge",
  description: "Avoid forbidden letters.",
  longDescription: "Type words without using the forbidden letters.",
  rules: ["Avoid the forbidden letters."],
  difficulty: "medium",
  estimatedTime: "10 minutes",
  icon: "Ban",
  color: "#ef4444",
  playCount: 0,
  hasSurvival: true,
  modes: [
    { label: "Easy (1 letter)", slug: "letter-dodge-easy" },
    { label: "Medium (2 letters)", slug: "letter-dodge-medium" },
    { label: "Hard (3 letters)", slug: "letter-dodge-hard" },
    { label: "Expert (4 letters)", slug: "letter-dodge-expert" },
    { label: "Master (5 letters)", slug: "letter-dodge-master" },
    { label: "Savant (6–12 letters)", slug: "letter-dodge-savant" },
    { label: "Advanced (random 1–5)", slug: "letter-dodge-advanced" },
  ],
};

const HUNT_GAME = {
  ...GAME,
  id: 2,
  slug: "letter-hunt",
  name: "Letter Hunt",
  description: "Find words containing the required letters.",
  longDescription: "Type valid words containing the required letters.",
  icon: "Search",
  color: "#22c55e",
  modes: [{ label: "Challenge 1", slug: "letter-hunt-1-unordered" }],
};

const LENGTH_GAME = {
  ...GAME,
  id: 3,
  slug: "word-length",
  name: "Length Challenge",
  description: "Find words that match the length.",
  longDescription: "Find valid words that meet the selected length constraint.",
  icon: "Type",
  color: "#6366f1",
  modes: [{ label: "4-letter words", slug: "word-length-4" }],
};

const OTHER_FRESH_ANSWER_GAMES = [
  {
    ...GAME,
    id: 4,
    slug: "letter-position",
    name: "Letter Position",
    description: "Find a word with a letter in the chosen position.",
  },
  {
    ...GAME,
    id: 5,
    slug: "letter-frequency",
    name: "Letter Frequency",
    description: "Find words with a target letter count.",
  },
  {
    ...GAME,
    id: 6,
    slug: "letter-balance",
    name: "Vowels & Consonants",
    description: "Find words with the required vowel and consonant balance.",
  },
  {
    ...GAME,
    id: 7,
    slug: "no-repeats",
    name: "No Repeats",
    description: "Find words with no repeated letters.",
  },
];

const DAILY_DATE = "2026-10-15";
const QUIZ_CODE = "DODGEXPERT";
const captures = new WeakMap<Page, { leaderboardWrites: Record<string, unknown>[] }>();

async function mockSharedApis(page: Page) {
  captures.set(page, { leaderboardWrites: [] });
  await page.route("**/api/**", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/auth/me", route =>
    route.fulfill({ json: { user: TEST_USER } }),
  );
  await page.route("**/api/analytics/events", route =>
    route.fulfill({ status: 202, json: { ok: true } }),
  );
  await page.route(/\/api\/comments\?/, route =>
    route.fulfill({
      json: {
        comments: [],
        page: 1,
        hasMore: false,
        totalCount: 0,
        pinnedComment: null,
        commenters: [],
        mentionedUsers: [],
        canManagePins: false,
      },
    }),
  );
  await page.route("**/api/games/letter-dodge", route =>
    route.fulfill({ json: GAME }),
  );
  await page.route("**/api/games/letter-hunt", route =>
    route.fulfill({ json: HUNT_GAME }),
  );
  await page.route("**/api/games/word-length/validate?*", route =>
    route.fulfill({ json: { ok: true, count: 100 } }),
  );
  await page.route("**/api/games/letter-position/validate?*", route =>
    route.fulfill({ json: { count: 100 } }),
  );
  await page.route("**/api/games/word-length", route =>
    route.fulfill({ json: LENGTH_GAME }),
  );
  for (const game of OTHER_FRESH_ANSWER_GAMES) {
    await page.route(`**/api/games/${game.slug}`, route =>
      route.fulfill({ json: game }),
    );
  }
  await page.route("**/api/games", route =>
    route.fulfill({ json: [GAME] }),
  );
  await page.route("**/api/likes**", route =>
    route.fulfill({ json: { counts: {}, likedByMe: {} } }),
  );
  await page.route("**/api/user/stats", async route => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: { ok: true } });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  await page.route("**/api/user/streak", route =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.route("**/api/leaderboard", async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      captures.get(page)!.leaderboardWrites.push(body);
      await route.fulfill({ json: { ok: true } });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  await page.route("**/api/leaderboard/**", route =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/games/validate-word", route =>
    route.fulfill({ json: { valid: true } }),
  );
}

async function installAppClock(page: Page) {
  await page.clock.install({ time: new Date(`${DAILY_DATE}T12:00:00.000Z`) });
  await page.addInitScript(() => {
    localStorage.removeItem("wordplay_stats");
    localStorage.removeItem("wordplay_streak");
    localStorage.removeItem("wordplay_achievements");
    localStorage.removeItem("wordplay_daily_challenge");
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const gameTimerCallbacks = new Map<number, TimerHandler>();
    window.setInterval = ((handler: TimerHandler, delay?: number, ...args: any[]) => {
      if (delay !== 1000) return nativeSetInterval(handler, delay, ...args);
      const intervalId = nativeSetInterval(handler, 3_600_000, ...args) as unknown as number;
      gameTimerCallbacks.set(intervalId, handler);
      return intervalId as unknown as ReturnType<typeof window.setInterval>;
    }) as typeof window.setInterval;
    window.clearInterval = ((intervalId: number | undefined) => {
      if (intervalId !== undefined) gameTimerCallbacks.delete(intervalId);
      nativeClearInterval(intervalId);
    }) as typeof window.clearInterval;
    (window as any).__advanceDodgeTimer = (ticks: number) => {
      const activeTimer = Array.from(gameTimerCallbacks.entries()).at(-1);
      if (!activeTimer) throw new Error("Letter Dodge timer was not registered");
      const [intervalId, handler] = activeTimer;
      for (let tick = 0; tick < ticks; tick++) {
        if (!gameTimerCallbacks.has(intervalId)) break;
        if (typeof handler === "function") handler();
      }
    };
    (window as any).__holdDodgeTimer = () => {
      const activeTimer = Array.from(gameTimerCallbacks.entries()).at(-1);
      if (!activeTimer) throw new Error("Letter Dodge timer was not registered");
      (window as any).__heldDodgeTimer = activeTimer[1];
    };
    (window as any).__invokeHeldDodgeTimer = () => {
      const handler = (window as any).__heldDodgeTimer;
      if (typeof handler !== "function") throw new Error("No held Letter Dodge timer callback");
      handler();
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as any).__copiedResult = text;
          return Promise.resolve();
        },
      },
    });
  });
}

async function dismissAnnouncement(page: Page) {
  const close = page.getByTestId("button-whats-new-close");
  if (await close.isVisible()) await close.click();
}

async function submitSafeWord(page: Page, wordNumber = 0) {
  const forbidden = await page.locator('[data-testid^="badge-forbidden-"]').allTextContents();
  const word = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    .filter(letter => !forbidden.includes(letter))
    .slice(wordNumber * 4, wordNumber * 4 + 4)
    .join("");
  expect(word).toHaveLength(4);
  await page.getByTestId("input-word").fill(word);
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText(String(wordNumber + 1));
  return word;
}

async function visibleForbiddenLetters(page: Page) {
  const badges = page.locator('[data-testid^="badge-forbidden-"]');
  await expect(badges.first()).toBeVisible();
  return badges.evaluateAll(elements =>
    elements
      .map(element => element.getAttribute("data-testid")?.replace("badge-forbidden-", ""))
      .filter((letter): letter is string => Boolean(letter))
      .sort(),
  );
}

async function finishTimedGame(page: Page, timerTicks: number) {
  await page.evaluate(ticks => (window as any).__advanceDodgeTimer(ticks), timerTicks);
}

async function configureCustomFreshAnswerGame(page: Page, slug: string) {
  await page.getByTestId("button-custom-play").click();

  if (slug === "letter-dodge") {
    await page.getByTestId("select-custom-dodge-difficulty").click();
    await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
    for (const [index, letter] of ["A", "I"].entries()) {
      await page.getByTestId(`select-custom-dodge-letter-${index}`).click();
      await page.getByRole("option", { name: letter, exact: true }).click();
    }
    await page.getByTestId("button-custom-dodge-time-60").click();
    await page.getByTestId("button-custom-mode-classic").click();
  } else if (slug === "letter-hunt") {
    await page.getByTestId("select-custom-challenge").click();
    await page.getByRole("option", { name: "2 letters" }).click();
    for (const [index, letter] of ["A", "B"].entries()) {
      await page.getByTestId(`select-custom-hunt-letter-${index}`).click();
      await page.getByRole("option", { name: letter, exact: true }).click();
    }
    await page.getByTestId("input-custom-hunt-word-count").fill("1");
  } else if (slug === "letter-position") {
    await page.getByTestId("select-custom-lp-letter").click();
    await page.getByRole("option", { name: "E", exact: true }).click();
    await page.getByTestId("button-custom-lp-pos-2").click();
    await page.getByTestId("input-custom-lp-word-count").fill("1");
    await page.getByTestId("button-custom-lp-time-60").click();
  } else if (slug === "letter-frequency") {
    await page.getByTestId("select-custom-challenge").click();
    await page.getByRole("option", { name: "Challenge 1 (exactly 2×)" }).click();
    await page.getByTestId("select-custom-lh-letter").click();
    await page.getByRole("option", { name: "E", exact: true }).click();
    await page.getByTestId("input-custom-freq-word-count").fill("1");
    await page.getByTestId("button-custom-freq-time-60").click();
  } else if (slug === "letter-balance") {
    await page.getByTestId("button-custom-lb-mode-count").click();
    await page.getByTestId("input-custom-lb-vowels").fill("2");
    await page.getByTestId("input-custom-lb-consonants").fill("2");
    await page.getByTestId("input-custom-lb-word-count").fill("1");
    await page.getByTestId("button-custom-lb-time-60").click();
  } else if (slug === "no-repeats") {
    await page.getByTestId("select-custom-nr-challenge").click();
    await page.getByRole("option", { name: "4-letter isograms" }).click();
    await page.getByTestId("select-custom-nr-req-0").click();
    await page.getByRole("option", { name: "W", exact: true }).click();
    await page.getByTestId("select-custom-nr-req-1").click();
    await page.getByRole("option", { name: "O", exact: true }).click();
    await page.getByTestId("button-custom-nr-time-60").click();
  } else if (slug === "word-length") {
    await page.getByTestId("button-custom-wl-length-4").click();
    await page.getByTestId("input-custom-wl-word-count").fill("1");
    await page.getByTestId("button-custom-wl-time-60").click();
  }

  await page.getByTestId("button-start-custom-play").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
}

async function expectFreshAnswersControlsNamed(page: Page, game: string, isCustomPlay = true) {
  const scope = isCustomPlay ? "Custom " : "";
  await page.getByRole("button", { name: /^View \d+ saved answers?$/ }).click();
  await expect(
    page.getByRole("list", { name: `Saved Fresh Answers for ${scope}${game}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: `Fresh Answers for ${scope}${game}`, exact: true }),
  ).toBeVisible();
}

async function expectCanonicalStats(page: Page, variantSlug: string) {
  const stats = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wordplay_stats") ?? "{}"),
  );
  expect(stats.perGame["letter-dodge"]?.gamesPlayed).toBe(1);
  expect(stats.perGame["letter-dodge"]?.bestScore).toBeGreaterThan(0);
  expect(stats.perGame[variantSlug]).toBeUndefined();
  expect(stats.history.at(-1)?.slug).toBe("letter-dodge");
  expect(stats.variantBestScores?.[variantSlug]).toBeGreaterThan(0);
}

async function leaderboardWrites(page: Page) {
  return captures.get(page)?.leaderboardWrites ?? [];
}

test("daily seeded play saves its Advanced score under the variant and shares the canonical daily game", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.route("**/api/daily-challenge", route =>
    route.fulfill({
      json: { date: DAILY_DATE, slug: "letter-dodge", game: GAME, seed: 173 },
    }),
  );
  await page.route("**/api/daily-challenge/attempt?*", route =>
    route.fulfill({ json: { attempt: null } }),
  );
  await page.route("**/api/daily-challenge/attempt", route =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.route("**/api/daily-challenge/leaderboard?*", route =>
    route.fulfill({ json: { entries: [], myRank: 4 } }),
  );
  const dailyWrites: Array<{ date: string; score: number }> = [];
  await page.route("**/api/daily-challenge/score", async route => {
    dailyWrites.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true, streak: 1, longest: 1 } });
  });

  await page.goto("/daily");
  await dismissAnnouncement(page);
  await page.getByTestId("button-play-daily").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await submitSafeWord(page);
  await finishTimedGame(page, 600);
  await expect(page.getByText("Challenge Complete", { exact: true })).toBeVisible();

  await expect.poll(async () => (await leaderboardWrites(page)).length).toBe(1);
  expect(await leaderboardWrites(page)).toEqual([
    expect.objectContaining({ gameSlug: "letter-dodge-advanced" }),
  ]);
  expect(dailyWrites).toHaveLength(1);
  expect(dailyWrites[0]).toEqual(expect.objectContaining({ date: DAILY_DATE }));
  await expectCanonicalStats(page, "letter-dodge-advanced");
  await page.getByTestId("button-share-daily").click();
  await expect.poll(() => page.evaluate(() => (window as any).__copiedResult)).toContain(
    `${await page.evaluate(() => location.origin)}/daily`,
  );
  expect(await page.evaluate(() => (window as any).__copiedResult)).toContain("Letter Dodge");
});

test("starting a seeded friend challenge saves its Advanced score and submits canonical Letter Dodge", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  const challengeWrites: Record<string, unknown>[] = [];
  await page.route("**/api/challenges", async route => {
    if (route.request().method() === "POST") {
      challengeWrites.push(route.request().postDataJSON());
      await route.fulfill({ json: { id: 88, status: "pending" } });
    } else {
      await route.fulfill({ json: [] });
    }
  });

  await page.goto("/game/letter-dodge?challenge-new=808&seed=173");
  await dismissAnnouncement(page);
  await expect(page.getByTestId("text-challenge-mode-title")).toBeVisible();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await submitSafeWord(page);
  await finishTimedGame(page, 600);

  await expect.poll(async () => (await leaderboardWrites(page)).length).toBe(1);
  expect(await leaderboardWrites(page)).toEqual([
    expect.objectContaining({ gameSlug: "letter-dodge-advanced" }),
  ]);
  await expect.poll(() => challengeWrites.length).toBe(1);
  expect(challengeWrites[0]).toEqual(
    expect.objectContaining({
      friendId: 808,
      gameSlug: "letter-dodge",
      seed: 173,
      score: expect.any(Number),
    }),
  );
  expect(challengeWrites[0].score).toBeGreaterThan(0);
  await expectCanonicalStats(page, "letter-dodge-advanced");
});

test("opening a received seeded friend challenge saves its Advanced score to that Letter Dodge challenge", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  const challengeId = 89;
  const receivedChallenge = {
    id: challengeId,
    senderId: 808,
    receiverId: TEST_USER.id,
    senderName: "Challenge Friend",
    senderAvatarUrl: null,
    gameSlug: "letter-dodge",
    seed: 173,
    senderScore: 120,
    receiverScore: null,
    status: "pending",
    message: "Your turn!",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  await page.route(`**/api/challenges/${challengeId}`, route =>
    route.fulfill({ json: receivedChallenge }),
  );
  const completionWrites: Array<{ url: string; body: { score: number } }> = [];
  await page.route(`**/api/challenges/${challengeId}/complete`, async route => {
    completionWrites.push({
      url: route.request().url(),
      body: route.request().postDataJSON(),
    });
    await route.fulfill({ json: { receiverScore: route.request().postDataJSON().score, senderScore: 120 } });
  });

  await page.goto(`/game/letter-dodge?challenge=${challengeId}`);
  await dismissAnnouncement(page);
  await expect(page.getByTestId("text-challenge-banner-title")).toBeVisible();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await submitSafeWord(page);
  await finishTimedGame(page, 600);

  await expect.poll(async () => (await leaderboardWrites(page)).length).toBe(1);
  expect(await leaderboardWrites(page)).toEqual([
    expect.objectContaining({ gameSlug: "letter-dodge-advanced" }),
  ]);
  await expect.poll(() => completionWrites.length).toBe(1);
  expect(receivedChallenge.gameSlug).toBe("letter-dodge");
  expect(completionWrites[0].url).toContain(`/api/challenges/${challengeId}/complete`);
  expect(completionWrites[0].body.score).toBeGreaterThan(0);
  await expectCanonicalStats(page, "letter-dodge-advanced");
});

test("sender, receiver, and reopened receiver see the same forbidden letters for a seeded Letter Dodge challenge", async ({ page, browser }) => {
  const receiverPage = await browser.newPage();
  const challengeId = 89;
  const seed = 173;
  const senderPath = `/game/letter-dodge?challenge-new=808&seed=${seed}`;
  const receiverPath = `/game/letter-dodge?challenge=${challengeId}`;

  try {
    await Promise.all([
      mockSharedApis(page),
      mockSharedApis(receiverPage),
      installAppClock(page),
      installAppClock(receiverPage),
    ]);

    await receiverPage.route(`**/api/challenges/${challengeId}`, route =>
      route.fulfill({
        json: {
          id: challengeId,
          senderId: 808,
          receiverId: TEST_USER.id,
          senderName: "Challenge Friend",
          senderAvatarUrl: null,
          gameSlug: "letter-dodge",
          seed,
          senderScore: 120,
          receiverScore: null,
          status: "pending",
          message: "Your turn!",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );

    await page.goto(senderPath);
    await dismissAnnouncement(page);
    await expect(page.getByTestId("text-challenge-mode-title")).toBeVisible();
    const senderLetters = await visibleForbiddenLetters(page);

    await receiverPage.goto(receiverPath);
    await dismissAnnouncement(receiverPage);
    await expect(receiverPage.getByTestId("text-challenge-banner-title")).toBeVisible();
    const receiverLetters = await visibleForbiddenLetters(receiverPage);

    expect(
      receiverLetters,
      `Forbidden letters differ for seed ${seed}: sender path ${senderPath} showed [${senderLetters.join(", ")}], receiver path ${receiverPath} showed [${receiverLetters.join(", ")}]`,
    ).toEqual(senderLetters);

    const initialChallengePath = receiverPath;
    await receiverPage.goto(receiverPath);
    await dismissAnnouncement(receiverPage);
    await expect(receiverPage.getByTestId("text-challenge-banner-title")).toBeVisible();
    const reopenedReceiverLetters = await visibleForbiddenLetters(receiverPage);
    const reopenedChallengePath = receiverPath;

    expect(
      reopenedReceiverLetters,
      `Forbidden letters changed after reopening the seeded Letter Dodge challenge: initial challenge path ${initialChallengePath} showed [${receiverLetters.join(", ")}]; reopened challenge path ${reopenedChallengePath} showed [${reopenedReceiverLetters.join(", ")}]`,
    ).toEqual(receiverLetters);
  } finally {
    await receiverPage.close();
  }
});

test("seeded group round preserves its Hard leaderboard variant and canonical round score", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.route("**/api/groups/22/rounds/43", route =>
    route.fulfill({
      json: {
        round: {
          id: 43,
          groupId: 22,
          gameSlug: "letter-dodge",
          seed: 2,
          status: "active",
          createdById: TEST_USER.id,
          closesAt: null,
          gameConfig: null,
          seasonId: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        myScore: null,
      },
    }),
  );
  await page.route("**/api/groups/22/rounds/43/attempt", async route => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: { attempt: { id: 1, roundId: 43, userId: TEST_USER.id, startedAt: new Date().toISOString() } } });
    } else {
      await route.fulfill({ json: { attempt: null } });
    }
  });
  await page.route("**/api/groups/22/rounds/43/scores", route =>
    route.fulfill({ json: [] }),
  );
  const groupScoreWrites: Array<{ score: number }> = [];
  await page.route("**/api/groups/22/rounds/43/score", async route => {
    groupScoreWrites.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });

  await page.goto("/groups/22/rounds/43/play");
  await dismissAnnouncement(page);
  await page.getByTestId("button-play-group-round").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await submitSafeWord(page);
  await finishTimedGame(page, 600);
  await expect(page.getByText("Score Submitted!", { exact: true })).toBeVisible();

  await expect.poll(async () => (await leaderboardWrites(page)).length).toBe(1);
  expect(await leaderboardWrites(page)).toEqual([
    expect.objectContaining({ gameSlug: "letter-dodge-hard" }),
  ]);
  expect(groupScoreWrites).toHaveLength(1);
  expect(groupScoreWrites[0].score).toBeGreaterThan(0);
  await expectCanonicalStats(page, "letter-dodge-hard");
});

test("quiz Survival play records its Expert variant and submits once to the quiz session", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.route(`**/api/quiz-sessions/${QUIZ_CODE}`, route =>
    route.fulfill({
      json: {
        id: 71,
        creatorId: 600,
        shareCode: QUIZ_CODE,
        title: "Expert Dodge Quiz",
        gameSlug: "letter-dodge",
        createdAt: "2026-01-01T00:00:00.000Z",
        closesAt: null,
        description: null,
        params: { difficulty: 4, survival: true, letters: ["A", "B", "C", "D"] },
        playerCount: 0,
      },
    }),
  );
  await page.route(`**/api/quiz-sessions/${QUIZ_CODE}/scores`, async route => {
    if (route.request().method() === "POST") {
      const score = route.request().postDataJSON().score;
      quizScoreWrites.push(score);
      await route.fulfill({ json: { score } });
    } else {
      await route.fulfill({ json: { scores: [], myScore: null } });
    }
  });
  const quizScoreWrites: number[] = [];

  await page.goto(`/quiz/${QUIZ_CODE}`);
  await dismissAnnouncement(page);
  await page.getByTestId("button-play-quiz").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await submitSafeWord(page);
  await finishTimedGame(page, 8);
  await expect(page.getByText("Score saved!", { exact: true })).toBeVisible();

  expect(quizScoreWrites).toHaveLength(1);
  expect(await leaderboardWrites(page)).toEqual([]);
  await expectCanonicalStats(page, "letter-dodge-expert-survival");
  await expect(page.getByTestId("button-copy-results")).toBeVisible();
  await page.getByTestId("button-copy-results").click();
  await expect.poll(() => page.evaluate(() => (window as any).__copiedResult)).toContain(
    `${await page.evaluate(() => location.origin)}/game/letter-dodge-survival`,
  );
});

test("a queued tick from the previous Survival word cannot shorten the reset countdown", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-play").click();
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-difficulty-4").click();
  await expect(page.getByTestId("badge-timer")).toHaveText("8s");

  await page.evaluate(() => (window as any).__holdDodgeTimer());
  await submitSafeWord(page);
  await expect(page.getByTestId("badge-timer")).toHaveText("8s");

  await page.evaluate(() => (window as any).__invokeHeldDodgeTimer());
  await expect(page.getByTestId("badge-timer")).toHaveText("8s");

  await submitSafeWord(page, 1);
  await expect(page.getByTestId("badge-timer")).toHaveText("8s");
});

test("custom Survival Play Again keeps its Savant difficulty and mode", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: /Savant — 6–12 forbidden letters/ }).click();
  await page.getByTestId("button-custom-mode-survival").click();
  await page.getByTestId("button-start-custom-play").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  const forbiddenLetters = page.locator('[data-testid^="badge-forbidden-"]');
  const initialForbiddenCount = await forbiddenLetters.count();
  expect(initialForbiddenCount).toBeGreaterThanOrEqual(6);
  expect(initialForbiddenCount).toBeLessThanOrEqual(12);
  await submitSafeWord(page);
  await finishTimedGame(page, 8);
  await expect(page.getByTestId("button-play-again")).toBeVisible();

  expect(await leaderboardWrites(page)).toEqual([]);
  await expectCanonicalStats(page, "letter-dodge-savant-survival");
  await expect(page.getByTestId("button-copy-results")).toHaveCount(0);

  await page.getByTestId("button-play-again").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await expect(page.getByTestId("input-word")).toBeVisible();
  const replayedForbiddenCount = await forbiddenLetters.count();
  expect(replayedForbiddenCount).toBeGreaterThanOrEqual(6);
  expect(replayedForbiddenCount).toBeLessThanOrEqual(12);
});

test("custom Play Again keeps pinned forbidden letters, difficulty, and mode", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
  await page.getByTestId("select-custom-dodge-letter-0").click();
  await page.getByRole("option", { name: "A", exact: true }).click();
  await expect(page.getByTestId("select-custom-dodge-letter-1")).toHaveText("Any");
  await page.getByTestId("button-custom-mode-survival").click();
  await page.getByTestId("button-start-custom-play").click();

  const forbiddenLetters = page.locator('[data-testid^="badge-forbidden-"]');
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await expect(page.getByTestId("badge-forbidden-A")).toBeVisible();
  await expect(forbiddenLetters).toHaveCount(2);
  await submitSafeWord(page);
  await finishTimedGame(page, 8);
  await expect(page.getByTestId("button-play-again")).toBeVisible();

  await page.getByTestId("button-play-again").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await expect(page.getByTestId("badge-forbidden-A")).toBeVisible();
  await expect(forbiddenLetters).toHaveCount(2);
});

test("custom Classic Play Again keeps pinned forbidden letters and difficulty", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
  await page.getByTestId("select-custom-dodge-letter-0").click();
  await page.getByRole("option", { name: "A", exact: true }).click();
  await expect(page.getByTestId("select-custom-dodge-letter-1")).toHaveText("Any");
  await page.getByTestId("button-custom-dodge-time-60").click();
  await page.getByTestId("button-custom-mode-classic").click();
  await page.getByTestId("button-start-custom-play").click();

  const forbiddenLetters = page.locator('[data-testid^="badge-forbidden-"]');
  await expect(page.getByTestId("badge-survival")).toHaveCount(0);
  await expect(page.getByTestId("badge-forbidden-A")).toBeVisible();
  await expect(forbiddenLetters).toHaveCount(2);
  await submitSafeWord(page);
  await finishTimedGame(page, 60);
  await expect(page.getByTestId("button-play-again")).toBeVisible();

  await expectCanonicalStats(page, "letter-dodge-medium");
  await expect(page.getByTestId("badge-survival")).toHaveCount(0);
  await page.getByTestId("button-play-again").click();

  await expect(page.getByTestId("input-word")).toBeVisible();
  await expect(page.getByTestId("badge-survival")).toHaveCount(0);
  await expect(page.getByTestId("badge-forbidden-A")).toBeVisible();
  await expect(forbiddenLetters).toHaveCount(2);
});

test("mobile Expert Survival replay keeps its difficulty, mode, and answer usable", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-play").click();
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-difficulty-4").click();

  const input = page.getByTestId("input-word");
  const forbiddenLetters = page.locator('[data-testid^="badge-forbidden-"]');
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await expect(forbiddenLetters).toHaveCount(4);
  await expect(input).toBeVisible();

  await submitSafeWord(page);
  await finishTimedGame(page, 8);
  await expect(page.getByTestId("button-replay")).toBeVisible();
  await expect.poll(async () => (await leaderboardWrites(page)).length).toBe(1);
  await expectCanonicalStats(page, "letter-dodge-expert-survival");

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await expect(forbiddenLetters).toHaveCount(4);
  await expect(input).toBeVisible();
  await expect.poll(() => input.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);

  await submitSafeWord(page);
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(input).toHaveValue("");
});

test("standard Survival replay and Play Again keep the selected difficulty and mode", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-play").click();
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-difficulty-4").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await submitSafeWord(page);
  await finishTimedGame(page, 8);
  await expect(page.getByTestId("button-copy-results")).toBeVisible();

  await expect.poll(async () => (await leaderboardWrites(page)).length).toBe(1);
  expect(await leaderboardWrites(page)).toEqual([
    expect.objectContaining({ gameSlug: "letter-dodge-expert-survival" }),
  ]);
  await expectCanonicalStats(page, "letter-dodge-expert-survival");

  const forbiddenLetters = page.locator('[data-testid^="badge-forbidden-"]');
  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await expect(forbiddenLetters).toHaveCount(4);
  await submitSafeWord(page);
  await finishTimedGame(page, 8);
  await expect(page.getByTestId("button-replay")).toBeVisible();

  await page.getByTestId("button-play-again").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await expect(forbiddenLetters).toHaveCount(4);
  await submitSafeWord(page);
  await finishTimedGame(page, 8);

  await expect.poll(async () => (await leaderboardWrites(page)).length).toBe(3);
  expect(await leaderboardWrites(page)).toEqual([
    expect.objectContaining({ gameSlug: "letter-dodge-expert-survival" }),
    expect.objectContaining({ gameSlug: "letter-dodge-expert-survival" }),
    expect.objectContaining({ gameSlug: "letter-dodge-expert-survival" }),
  ]);
});

test("standard Survival completion shares the base game URL", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-play").click();
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-difficulty-4").click();
  await expect(page.getByTestId("badge-survival")).toBeVisible();
  await submitSafeWord(page);
  await finishTimedGame(page, 8);
  await expect(page.getByTestId("button-copy-results")).toBeVisible();

  await page.getByTestId("button-copy-results").click();
  await expect.poll(() => page.evaluate(() => (window as any).__copiedResult)).toContain(
    `${await page.evaluate(() => location.origin)}/game/letter-dodge-survival`,
  );
  expect(await page.evaluate(() => (window as any).__copiedResult)).toContain(
    "I just completed Letter Dodge",
  );
});

test("standard Classic replay keeps the selected difficulty and mode", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-play").click();
  await page.getByTestId("button-difficulty-4").click();
  await expect(page.getByTestId("badge-survival")).toHaveCount(0);
  const forbiddenLetters = page.locator('[data-testid^="badge-forbidden-"]');
  await expect(forbiddenLetters).toHaveCount(4);
  await submitSafeWord(page);
  await finishTimedGame(page, 600);
  await expect(page.getByTestId("button-replay")).toBeVisible();

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("badge-survival")).toHaveCount(0);
  await expect(forbiddenLetters).toHaveCount(4);
  await submitSafeWord(page);
  await finishTimedGame(page, 600);

  await expect.poll(async () => (await leaderboardWrites(page)).length).toBe(2);
  expect(await leaderboardWrites(page)).toEqual([
    expect.objectContaining({ gameSlug: "letter-dodge-expert" }),
    expect.objectContaining({ gameSlug: "letter-dodge-expert" }),
  ]);
});

test("Custom Letter Dodge accumulates answers until opt-out clears them", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "xtrawordinary:custom-fresh-answers:v1:709:letter-hunt",
      JSON.stringify({ version: 1, words: ["HUNT"], enabled: true }),
    );
  });
  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);

  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
  for (const [index, letter] of ["A", "I"].entries()) {
    await page.getByTestId(`select-custom-dodge-letter-${index}`).click();
    await page.getByRole("option", { name: letter, exact: true }).click();
  }
  await page.getByTestId("button-custom-dodge-time-60").click();
  await page.getByTestId("button-custom-mode-classic").click();
  await page.getByTestId("button-start-custom-play").click();

  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await finishTimedGame(page, 60);
  await expect(page.getByTestId("button-save-fresh-answers-letter-dodge")).toBeVisible();
  await page.getByTestId("button-save-fresh-answers-letter-dodge").click();
  const freshAnswersSwitch = page.getByTestId("switch-fresh-answers-letter-dodge");
  await expect(freshAnswersSwitch).toHaveAttribute("data-state", "checked");
  await expectFreshAnswersControlsNamed(page, "Letter Dodge");

  await page.getByTestId("button-play-again").click();
  await expect(freshAnswersSwitch).toHaveAttribute("data-state", "checked");

  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();
  await page.getByTestId("input-word").fill("TEST");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await finishTimedGame(page, 60);
  await expect(page.getByText(/Avoiding 2 saved answers/)).toBeVisible();
  expect(await leaderboardWrites(page)).toHaveLength(0);

  await page.getByTestId("button-play-again").click();
  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();
  await page.getByTestId("input-word").fill("TEST");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();

  await page.getByTestId("switch-fresh-answers-letter-dodge").click();
  await expect(page.getByTestId("custom-fresh-answers-letter-dodge")).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Saved Fresh Answers for Custom Letter Dodge" }),
  ).toHaveCount(0);
  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  expect(await page.evaluate(() => ({
    dodge: localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge"),
    hunt: localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-hunt"),
  }))).toEqual({
    dodge: null,
    hunt: JSON.stringify({ version: 1, words: ["HUNT"], enabled: true }),
  });
});

test("Custom Fresh Answers stay private when another account signs in", async ({ page }) => {
  let activeUser = TEST_USER;
  await mockSharedApis(page);
  await page.route("**/api/auth/me", route =>
    route.fulfill({ json: { user: activeUser } }),
  );
  await installAppClock(page);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await configureCustomFreshAnswerGame(page, "letter-dodge");
  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await finishTimedGame(page, 60);
  await page.getByTestId("button-save-fresh-answers-letter-dodge").click();
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge"),
  )).toBe(JSON.stringify({ version: 1, words: ["WORD"], enabled: true }));

  activeUser = SECOND_TEST_USER;
  await page.reload();
  await dismissAnnouncement(page);
  await configureCustomFreshAnswerGame(page, "letter-dodge");
  await expect(page.getByTestId("custom-fresh-answers-letter-dodge")).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Saved Fresh Answers for Custom Letter Dodge" }),
  ).toHaveCount(0);
  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(page.getByTestId("badge-word-WORD")).toBeVisible();
  expect(await page.evaluate(() =>
    localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:710:letter-dodge"),
  )).toBeNull();

  activeUser = TEST_USER;
  await page.reload();
  await dismissAnnouncement(page);
  await configureCustomFreshAnswerGame(page, "letter-dodge");
  await expect(page.getByTestId("custom-fresh-answers-letter-dodge")).toBeVisible();
  await expectFreshAnswersControlsNamed(page, "Letter Dodge");
  await expect(
    page.getByRole("list", { name: "Saved Fresh Answers for Custom Letter Dodge" }).getByText("WORD"),
  ).toBeVisible();
});

test("Custom Letter Hunt accumulates answers until opt-out clears them", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "xtrawordinary:custom-fresh-answers:v1:709:letter-dodge",
      JSON.stringify({ version: 1, words: ["DODGE"], enabled: true }),
    );
  });
  await page.goto("/game/letter-hunt");
  await dismissAnnouncement(page);

  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-challenge").click();
  await page.getByRole("option", { name: "2 letters" }).click();
  for (const [index, letter] of ["A", "B"].entries()) {
    await page.getByTestId(`select-custom-hunt-letter-${index}`).click();
    await page.getByRole("option", { name: letter, exact: true }).click();
  }
  await page.getByTestId("input-custom-hunt-word-count").fill("1");
  await page.getByTestId("button-start-custom-play").click();

  await page.getByTestId("input-word").fill("AB");
  await page.getByTestId("button-submit").click();
  await page.getByTestId("button-save-fresh-answers-letter-hunt").click();
  const freshAnswersSwitch = page.getByTestId("switch-fresh-answers-letter-hunt");
  await expect(freshAnswersSwitch).toHaveAttribute("data-state", "checked");
  await expectFreshAnswersControlsNamed(page, "Letter Hunt");

  await page.getByTestId("button-play-again").click();
  await expect(freshAnswersSwitch).toHaveAttribute("data-state", "checked");
  await page.getByTestId("input-word").fill("AB");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();
  await page.getByTestId("input-word").fill("ABCD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("badge-word-ABCD")).toBeVisible();
  await expect(page.getByText(/Avoiding 2 saved answers/)).toBeVisible();

  await page.getByTestId("button-play-again").click();
  await page.getByTestId("input-word").fill("AB");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();
  await page.getByTestId("input-word").fill("ABCD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();

  await page.getByTestId("switch-fresh-answers-letter-hunt").click();
  await expect(page.getByTestId("custom-fresh-answers-letter-hunt")).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Saved Fresh Answers for Custom Letter Hunt" }),
  ).toHaveCount(0);
  await page.getByTestId("input-word").fill("AB");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("badge-word-AB")).toBeVisible();
  expect(await leaderboardWrites(page)).toHaveLength(0);
  expect(await page.evaluate(() => ({
    dodge: localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge"),
    hunt: localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-hunt"),
  }))).toEqual({
    dodge: JSON.stringify({ version: 1, words: ["DODGE"], enabled: true }),
    hunt: null,
  });
});

test("Custom Length Challenge saves this run and appends answers from later runs", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.goto("/game/word-length");
  await dismissAnnouncement(page);

  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("button-custom-wl-length-4").click();
  await page.getByTestId("input-custom-wl-word-count").fill("1");
  await page.getByTestId("button-custom-wl-time-60").click();
  await page.getByTestId("button-start-custom-play").click();

  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("button-save-fresh-answers-word-length")).toBeVisible();
  await page.getByTestId("button-save-fresh-answers-word-length").click();
  await expectFreshAnswersControlsNamed(page, "Length Challenge");

  await page.getByTestId("button-play-again").click();
  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();

  await page.getByTestId("input-word").fill("TEST");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/Avoiding 2 saved answers/)).toBeVisible();
  expect(await leaderboardWrites(page)).toHaveLength(0);
});

test("Standard Fresh Answers carries Survival answers into Classic after refresh", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);

  await page.getByTestId("button-play").click();
  await page.getByTestId("button-mode-survival").click();
  await page.getByTestId("button-difficulty-1").click();
  const savedAnswer = await submitSafeWord(page);
  await finishTimedGame(page, 8);
  await expect(page.getByTestId("button-save-fresh-answers-letter-dodge")).toBeVisible();

  await page.getByTestId("button-save-fresh-answers-letter-dodge").click();
  await expectFreshAnswersControlsNamed(page, "Letter Dodge", false);
  await expect(
    page.getByRole("list", { name: "Saved Fresh Answers for Letter Dodge" }),
  ).toHaveText(savedAnswer);

  await page.reload();
  await dismissAnnouncement(page);
  await page.getByTestId("button-play").click();
  await page.getByTestId("button-mode-classic").click();
  await page.getByTestId("button-difficulty-1").click();
  await page.getByTestId("input-word").fill(savedAnswer);
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();
});

test("Custom Fresh Answers stay separate when navigating between games", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
  for (const [index, letter] of ["A", "I"].entries()) {
    await page.getByTestId(`select-custom-dodge-letter-${index}`).click();
    await page.getByRole("option", { name: letter, exact: true }).click();
  }
  await page.getByTestId("button-custom-dodge-time-60").click();
  await page.getByTestId("button-custom-mode-classic").click();
  await page.getByTestId("button-start-custom-play").click();

  await page.getByTestId("input-word").fill("TEST");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await finishTimedGame(page, 60);
  await page.getByTestId("button-save-fresh-answers-letter-dodge").click();
  await expectFreshAnswersControlsNamed(page, "Letter Dodge");
  await expect(
    page.getByRole("list", { name: "Saved Fresh Answers for Custom Letter Dodge" }),
  ).toHaveText("TEST");

  await page.goto("/game/word-length");
  await dismissAnnouncement(page);
  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("button-custom-wl-length-4").click();
  await page.getByTestId("input-custom-wl-word-count").fill("2");
  await page.getByTestId("button-custom-wl-time-60").click();
  await page.getByTestId("button-start-custom-play").click();
  await expect(page.getByTestId("custom-fresh-answers-word-length")).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Saved Fresh Answers for Custom Length Challenge" }),
  ).toHaveCount(0);

  await page.getByTestId("input-word").fill("TEST");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText("TEST", { exact: true })).toBeVisible();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await expect(page.getByText(/saved Fresh Answers list/)).toHaveCount(0);
  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  const saveLengthAnswers = page.getByTestId("button-save-fresh-answers-word-length");
  await expect(saveLengthAnswers).toBeVisible();
  await saveLengthAnswers.click();
  await expectFreshAnswersControlsNamed(page, "Length Challenge");
  const lengthAnswerItems = page
    .getByRole("list", { name: "Saved Fresh Answers for Custom Length Challenge" })
    .locator("li");
  await expect(lengthAnswerItems).toHaveText(["TEST", "WORD"]);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
  for (const [index, letter] of ["A", "I"].entries()) {
    await page.getByTestId(`select-custom-dodge-letter-${index}`).click();
    await page.getByRole("option", { name: letter, exact: true }).click();
  }
  await page.getByTestId("button-custom-dodge-time-60").click();
  await page.getByTestId("button-custom-mode-classic").click();
  await page.getByTestId("button-start-custom-play").click();
  await expect(page.getByTestId("custom-fresh-answers-letter-dodge")).toBeVisible();
  await expectFreshAnswersControlsNamed(page, "Letter Dodge");
  await expect(
    page.getByRole("list", { name: "Saved Fresh Answers for Custom Letter Dodge" }),
  ).toHaveText("TEST");
  await page.getByTestId("input-word").fill("TEST");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();

  await page.goto("/game/word-length");
  await dismissAnnouncement(page);
  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("button-custom-wl-length-4").click();
  await page.getByTestId("input-custom-wl-word-count").fill("2");
  await page.getByTestId("button-custom-wl-time-60").click();
  await page.getByTestId("button-start-custom-play").click();
  await expect(page.getByTestId("custom-fresh-answers-word-length")).toBeVisible();
  await expectFreshAnswersControlsNamed(page, "Length Challenge");
  const retainedLengthAnswerItems = page
    .getByRole("list", { name: "Saved Fresh Answers for Custom Length Challenge" })
    .locator("li");
  await expect(retainedLengthAnswerItems).toHaveText(["TEST", "WORD"]);
  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();
  expect(await leaderboardWrites(page)).toHaveLength(0);
});

test("Fresh Answers blocks saved words and appends new answers in the other Custom games", async ({ page }) => {
  test.setTimeout(120_000);
  const customGames = [
    { slug: "letter-balance", name: "Vowels & Consonants" },
    { slug: "word-length", name: "Length Challenge" },
    { slug: "letter-position", name: "Letter Position" },
    { slug: "no-repeats", name: "No Repeats" },
    { slug: "letter-frequency", name: "Letter Frequency" },
  ];
  await mockSharedApis(page);
  await installAppClock(page);
  await page.addInitScript((slugs) => {
    for (const slug of slugs) {
      localStorage.setItem(
        `xtrawordinary:custom-fresh-answers:v1:709:${slug}`,
        JSON.stringify({ version: 1, words: ["NEED"], enabled: true }),
      );
    }
  }, customGames.map(({ slug }) => slug));

  for (const { slug, name } of customGames) {
    await page.goto(`/game/${slug}`);
    await dismissAnnouncement(page);
    await configureCustomFreshAnswerGame(page, slug);
    await expect(page.getByTestId(`custom-fresh-answers-${slug}`)).toBeVisible();
    await expectFreshAnswersControlsNamed(page, name);

    await page.getByTestId("input-word").fill("NEED");
    await page.getByTestId("button-submit").click();
    await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();

    await page.getByTestId("input-word").fill(slug === "no-repeats" ? "WORD" : "DEED");
    await page.getByTestId("button-submit").click();
    if (slug === "no-repeats") {
      await expect(page.getByText("+40 points!")).toBeVisible();
      await finishTimedGame(page, 60);
    }
    await expect(page.getByText(/Avoiding 2 saved answers/)).toBeVisible();

    const freshAnswersSwitch = page.getByRole("switch", {
      name: `Fresh Answers for Custom ${name}`,
    });
    await freshAnswersSwitch.click();
    await expect(page.getByTestId(`custom-fresh-answers-${slug}`)).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: `Saved Fresh Answers for Custom ${name}` }),
    ).toHaveCount(0);
    const storage = await page.evaluate(() => Object.fromEntries(
      Object.keys(localStorage)
        .filter(key => key.startsWith("xtrawordinary:custom-fresh-answers:v1:709:"))
        .map(key => [key, localStorage.getItem(key)]),
    ));
    expect(storage[`xtrawordinary:custom-fresh-answers:v1:709:${slug}`]).toBeUndefined();
    for (const otherGame of customGames.filter(game => game.slug !== slug)) {
      expect(storage[`xtrawordinary:custom-fresh-answers:v1:709:${otherGame.slug}`]).toBe(
        JSON.stringify({ version: 1, words: ["NEED"], enabled: true }),
      );
    }
  }
  expect(await leaderboardWrites(page)).toHaveLength(0);
});

test("every Custom game can save a completed run and block its answer next run", async ({ page }) => {
  test.setTimeout(120_000);
  const customGames = [
    { slug: "letter-dodge", name: "Letter Dodge", word: "WORD", timed: true },
    { slug: "letter-hunt", name: "Letter Hunt", word: "AB" },
    { slug: "letter-balance", name: "Vowels & Consonants", word: "ABLE" },
    { slug: "word-length", name: "Length Challenge", word: "WORD" },
    { slug: "letter-position", name: "Letter Position", word: "TEST" },
    { slug: "no-repeats", name: "No Repeats", word: "WORD", timed: true },
    { slug: "letter-frequency", name: "Letter Frequency", word: "DEED" },
  ];
  await mockSharedApis(page);
  await installAppClock(page);

  for (const { slug, name, word, timed } of customGames) {
    await page.goto(`/game/${slug}`);
    await dismissAnnouncement(page);
    await configureCustomFreshAnswerGame(page, slug);

    await page.getByTestId("input-word").fill(word);
    await page.getByTestId("button-submit").click();
    if (timed) await finishTimedGame(page, 60);

    const saveButton = page.getByTestId(`button-save-fresh-answers-${slug}`);
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    await expect(
      page.getByRole("switch", { name: `Fresh Answers for Custom ${name}` }),
    ).toHaveAttribute("data-state", "checked");
    await expectFreshAnswersControlsNamed(page, name);
    await expect(
      page.getByRole("list", { name: `Saved Fresh Answers for Custom ${name}`, exact: true }),
    ).toHaveText(word);

    await page.goto(`/game/${slug}`);
    await dismissAnnouncement(page);
    await configureCustomFreshAnswerGame(page, slug);
    await expect(page.getByTestId(`custom-fresh-answers-${slug}`)).toBeVisible();
    await page.getByTestId("input-word").fill(word);
    await page.getByTestId("button-submit").click();
    await expect(page.getByText(/saved Fresh Answers list/)).toBeVisible();
  }

  expect(await leaderboardWrites(page)).toHaveLength(0);
});

test("Custom Fresh Answers restore after a full refresh and opt out per game", async ({ page }) => {
  test.setTimeout(120_000);
  const customGames = [
    { slug: "letter-dodge", name: "Letter Dodge" },
    { slug: "letter-hunt", name: "Letter Hunt" },
    { slug: "letter-balance", name: "Vowels & Consonants" },
    { slug: "word-length", name: "Length Challenge" },
    { slug: "letter-position", name: "Letter Position" },
    { slug: "no-repeats", name: "No Repeats" },
    { slug: "letter-frequency", name: "Letter Frequency" },
  ];
  const storagePrefix = "xtrawordinary:custom-fresh-answers:v1:709:";
  const savedSnapshot = JSON.stringify({ version: 1, words: ["NEED"], enabled: true });
  await mockSharedApis(page);
  await installAppClock(page);
  await page.addInitScript(({ games, prefix, snapshot }) => {
    const seedMarker = "e2e:fresh-answers-refresh-seeded";
    if (sessionStorage.getItem(seedMarker)) return;
    for (const { slug } of games) {
      localStorage.setItem(`${prefix}${slug}`, snapshot);
    }
    sessionStorage.setItem(seedMarker, "true");
  }, { games: customGames, prefix: storagePrefix, snapshot: savedSnapshot });

  const optedOutGames = new Set<string>();
  for (const { slug, name } of customGames) {
    await page.goto(`/game/${slug}`);
    await dismissAnnouncement(page);
    await configureCustomFreshAnswerGame(page, slug);

    const savedList = page.getByRole("list", {
      name: `Saved Fresh Answers for Custom ${name}`,
      exact: true,
    });
    const freshAnswersSwitch = page.getByRole("switch", {
      name: `Fresh Answers for Custom ${name}`,
      exact: true,
    });
    await expect(page.getByTestId(`custom-fresh-answers-${slug}`)).toBeVisible();
    await expectFreshAnswersControlsNamed(page, name);
    await expect(savedList).toHaveText("NEED");
    await expect(freshAnswersSwitch).toHaveAttribute("data-state", "checked");

    await page.reload();
    await dismissAnnouncement(page);
    await configureCustomFreshAnswerGame(page, slug);
    await expect(page.getByTestId(`custom-fresh-answers-${slug}`)).toBeVisible();
    await expectFreshAnswersControlsNamed(page, name);
    await expect(savedList).toHaveText("NEED");
    await expect(freshAnswersSwitch).toHaveAttribute("data-state", "checked");

    await freshAnswersSwitch.click();
    await expect(page.getByTestId(`custom-fresh-answers-${slug}`)).toHaveCount(0);
    await expect(savedList).toHaveCount(0);
    optedOutGames.add(slug);
    const expectedEntries = Object.fromEntries(
      customGames
        .filter(game => !optedOutGames.has(game.slug))
        .map(game => [`${storagePrefix}${game.slug}`, savedSnapshot]),
    );
    const actualEntries = await page.evaluate(prefix => Object.fromEntries(
      Object.keys(localStorage)
        .filter(key => key.startsWith(prefix))
        .map(key => [key, localStorage.getItem(key)]),
    ), storagePrefix);
    expect(actualEntries).toEqual(expectedEntries);
  }
  expect(await leaderboardWrites(page)).toHaveLength(0);
});

test("Fresh Answers lists and switches fit varied Custom layouts with 200% text on narrow screens", async ({ page }) => {
  test.setTimeout(120_000);
  const customGames = [
    { slug: "letter-hunt", name: "Letter Hunt" },
    { slug: "letter-balance", name: "Vowels & Consonants" },
    { slug: "word-length", name: "Length Challenge" },
    { slug: "letter-position", name: "Letter Position" },
    { slug: "no-repeats", name: "No Repeats" },
    { slug: "letter-frequency", name: "Letter Frequency" },
  ];
  const savedWords = Array.from({ length: 80 }, (_, index) => {
    const suffix = String(index).padStart(3, "0").replace(/\d/g, digit =>
      String.fromCharCode(65 + Number(digit)),
    );
    return `SAVEDANSWER${suffix}`;
  });
  await mockSharedApis(page);
  await installAppClock(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(({ games, words }) => {
    for (const { slug } of games) {
      localStorage.setItem(
        `xtrawordinary:custom-fresh-answers:v1:709:${slug}`,
        JSON.stringify({ version: 1, words, enabled: true }),
      );
    }
  }, { games: customGames, words: savedWords });

  for (const { slug, name } of customGames) {
    await page.goto(`/game/${slug}`);
    await dismissAnnouncement(page);
    await configureCustomFreshAnswerGame(page, slug);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    const panel = page.getByTestId(`custom-fresh-answers-${slug}`);
    await expect(panel).toBeVisible();
    const disclosure = page.getByRole("button", { name: "View 80 saved answers", expanded: false });
    await disclosure.click();
    const list = page.getByRole("list", { name: `Saved Fresh Answers for Custom ${name}` });
    await expect(list).toBeVisible();
    const beforeScroll = await page.evaluate(() => window.scrollY);
    const scrollMetrics = await list.evaluate(element => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    expect(scrollMetrics.overflowY).toBe("auto");
    await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const lastAnswerVisible = await list.evaluate(element => {
      const lastAnswer = element.querySelector("li:last-child");
      if (!lastAnswer) throw new Error("The saved-answer list should contain answers");
      const listRect = element.getBoundingClientRect();
      const answerRect = lastAnswer.getBoundingClientRect();
      return element.scrollTop > 0
        && answerRect.bottom > listRect.top
        && answerRect.top < listRect.bottom;
    });
    expect(lastAnswerVisible).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(beforeScroll);

    const freshAnswersSwitch = page.getByRole("switch", { name: `Fresh Answers for Custom ${name}` });
    await freshAnswersSwitch.scrollIntoViewIfNeeded();
    await expect(freshAnswersSwitch).toBeVisible();
    await expect(freshAnswersSwitch).toBeInViewport();
    const switchBounds = await freshAnswersSwitch.boundingBox();
    expect(switchBounds).not.toBeNull();
    expect(switchBounds!.x).toBeGreaterThanOrEqual(0);
    expect(switchBounds!.x + switchBounds!.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await freshAnswersSwitch.click();
    await expect(panel).toHaveCount(0);
    const storage = await page.evaluate(() => Object.fromEntries(
      Object.keys(localStorage)
        .filter(key => key.startsWith("xtrawordinary:custom-fresh-answers:v1:709:"))
        .map(key => [key, localStorage.getItem(key)]),
    ));
    expect(storage[`xtrawordinary:custom-fresh-answers:v1:709:${slug}`]).toBeUndefined();
    for (const otherGame of customGames.filter(game => game.slug !== slug)) {
      expect(storage[`xtrawordinary:custom-fresh-answers:v1:709:${otherGame.slug}`]).toBe(
        JSON.stringify({ version: 1, words: savedWords, enabled: true }),
      );
    }
  }
  expect(await leaderboardWrites(page)).toHaveLength(0);
});

test("Fresh Answers stays keyboard and mobile accessible with enlarged text in Custom Play", async ({ page }) => {
  const savedWords = Array.from({ length: 80 }, (_, index) => {
    const suffix = String(index).padStart(3, "0").replace(/\d/g, digit =>
      String.fromCharCode(65 + Number(digit)),
    );
    return `SAVEDANSWER${suffix}`;
  });
  await mockSharedApis(page);
  await installAppClock(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(words => {
    localStorage.setItem(
      "xtrawordinary:custom-fresh-answers:v1:709:letter-dodge",
      JSON.stringify({ version: 1, words, enabled: true }),
    );
  }, savedWords);

  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);
  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
  await page.getByTestId("button-custom-dodge-time-60").click();
  await page.getByTestId("button-start-custom-play").click();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  const details = page.locator('[data-testid="custom-fresh-answers-letter-dodge"] details');
  const summary = details.locator("summary");
  const disclosureButton = (expanded: boolean) =>
    page.getByRole("button", { name: "View 80 saved answers", expanded });
  const answerList = page.getByRole("list", {
    name: "Saved Fresh Answers for Custom Letter Dodge",
  });
  await expect(summary).toHaveText("View 80 saved answers");
  await expect(disclosureButton(false)).toBeVisible();

  let summaryFocused = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    await page.keyboard.press("Tab");
    summaryFocused = await summary.evaluate(element => element === document.activeElement);
    if (summaryFocused) break;
  }
  expect(summaryFocused, "the saved-answer disclosure should be reachable by keyboard").toBe(true);
  await expect(summary).toBeFocused();
  const focusStyle = await summary.evaluate(element => ({
    visible: element.matches(":focus-visible"),
    boxShadow: getComputedStyle(element).boxShadow,
  }));
  expect(focusStyle.visible).toBe(true);
  expect(focusStyle.boxShadow).not.toBe("none");

  await page.keyboard.press("Space");
  await expect(details).toHaveJSProperty("open", true);
  await expect(disclosureButton(true)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(details).toHaveJSProperty("open", false);
  await expect(disclosureButton(false)).toBeVisible();
  await page.keyboard.press("Space");
  await expect(details).toHaveJSProperty("open", true);
  await expect(disclosureButton(true)).toBeVisible();

  await expect(answerList).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(answerList).toBeFocused();
  const scrollInfo = await answerList.evaluate(element => {
    const list = element as HTMLUListElement;
    return {
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
      overflowY: getComputedStyle(list).overflowY,
    };
  });
  expect(scrollInfo.scrollHeight).toBeGreaterThan(scrollInfo.clientHeight);
  expect(scrollInfo.overflowY).toBe("auto");

  await answerList.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  const listAndLastAnswer = await answerList.evaluate(list => {
    const last = list.querySelector("li:last-child");
    if (!last) throw new Error("The saved-answer list should contain answers");
    const listRect = list.getBoundingClientRect();
    const answerRect = last.getBoundingClientRect();
    return {
      scrollTop: list.scrollTop,
      lastAnswerVisible: answerRect.bottom > listRect.top && answerRect.top < listRect.bottom,
    };
  });
  expect(listAndLastAnswer.scrollTop).toBeGreaterThan(0);
  expect(listAndLastAnswer.lastAnswerVisible).toBe(true);

  const freshAnswersSwitch = page.getByRole("switch", {
    name: "Fresh Answers for Custom Letter Dodge",
  });
  await expect(freshAnswersSwitch).toBeVisible();
  const switchPosition = await freshAnswersSwitch.evaluate(element => {
    const control = element.getBoundingClientRect();
    const panel = element.closest("[data-testid='custom-fresh-answers-letter-dodge']");
    if (!panel) throw new Error("The Fresh Answers switch should be inside its panel");
    return control.top - panel.getBoundingClientRect().top;
  });
  expect(switchPosition).toBeLessThan(40);
  await freshAnswersSwitch.scrollIntoViewIfNeeded();
  await expect(freshAnswersSwitch).toBeInViewport();
  const switchBox = await freshAnswersSwitch.boundingBox();
  expect(switchBox?.width).toBeGreaterThan(0);

  await freshAnswersSwitch.click();
  await expect(page.getByTestId("custom-fresh-answers-letter-dodge")).toHaveCount(0);
  expect(await page.evaluate(() =>
    localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge"),
  )).toBeNull();
});

test("Fresh Answers opt-in remains usable with enlarged text on a narrow screen", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);

  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
  for (const [index, letter] of ["A", "I"].entries()) {
    await page.getByTestId(`select-custom-dodge-letter-${index}`).click();
    await page.getByRole("option", { name: letter, exact: true }).click();
  }
  await page.getByTestId("button-custom-dodge-time-60").click();
  await page.getByTestId("button-start-custom-play").click();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await expect(page.getByTestId("text-live-word-count")).toHaveText("1");
  await finishTimedGame(page, 60);

  const saveButton = page.getByTestId("button-save-fresh-answers-letter-dodge");
  const firstExplanation = page.getByText(
    "Save this accepted answer for future runs. Answers from later runs will be added automatically until you turn this off.",
  );
  const secondExplanation = page.getByText(
    "Saved in this browser only. You can turn this off during the next run.",
  );
  await expect(firstExplanation).toBeVisible();
  await expect(secondExplanation).toBeVisible();

  const explanationFontSize = await firstExplanation.evaluate(element =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(explanationFontSize).toBeGreaterThanOrEqual(20);

  await saveButton.scrollIntoViewIfNeeded();
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeInViewport();
  const buttonBounds = await saveButton.boundingBox();
  expect(buttonBounds).not.toBeNull();
  expect(buttonBounds!.x).toBeGreaterThanOrEqual(0);
  expect(buttonBounds!.x + buttonBounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await saveButton.click();
  await expect(page.getByTestId("switch-fresh-answers-letter-dodge")).toHaveAttribute(
    "data-state",
    "checked",
  );
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge") || "null"),
  )).toEqual({ version: 1, words: ["WORD"], enabled: true });
});

test("Fresh Answers opt-in fits other Custom result screens with enlarged text", async ({ page }) => {
  test.setTimeout(120_000);
  const cases = [
    { slug: "letter-hunt", word: "ABCD" },
    { slug: "word-length", word: "WORD" },
  ];
  await mockSharedApis(page);
  await installAppClock(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(slugs => {
    for (const slug of slugs) {
      localStorage.removeItem(`xtrawordinary:custom-fresh-answers:v1:709:${slug}`);
    }
  }, cases.map(({ slug }) => slug));

  for (const { slug, word } of cases) {
    const storageKey = `xtrawordinary:custom-fresh-answers:v1:709:${slug}`;
    await page.goto(`/game/${slug}`);
    await dismissAnnouncement(page);
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();

    await configureCustomFreshAnswerGame(page, slug);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await page.getByTestId("input-word").fill(word);
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("button-play-again")).toBeVisible();

    const saveButton = page.getByTestId(`button-save-fresh-answers-${slug}`);
    const firstExplanation = page.getByText(
      "Save this accepted answer for future runs. Answers from later runs will be added automatically until you turn this off.",
    );
    const secondExplanation = page.getByText(
      "Saved in this browser only. You can turn this off during the next run.",
    );
    await expect(firstExplanation).toBeVisible();
    await expect(secondExplanation).toBeVisible();
    expect(await firstExplanation.evaluate(element =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    )).toBeGreaterThanOrEqual(20);

    await firstExplanation.scrollIntoViewIfNeeded();
    await expect(firstExplanation).toBeInViewport();
    await expect(secondExplanation).toBeInViewport();
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeInViewport();
    const buttonBounds = await saveButton.boundingBox();
    expect(buttonBounds).not.toBeNull();
    expect(buttonBounds!.x).toBeGreaterThanOrEqual(0);
    expect(buttonBounds!.x + buttonBounds!.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth,
    )).toBe(true);

    await saveButton.click();
    await expect(page.getByTestId(`switch-fresh-answers-${slug}`)).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(await page.evaluate(
      key => JSON.parse(localStorage.getItem(key) || "null"),
      storageKey,
    )).toEqual({ version: 1, words: [word], enabled: true });
  }
  expect(await leaderboardWrites(page)).toHaveLength(0);
});

test("Fresh Answers reports failed browser saves and deletions and can be retried", async ({ page }) => {
  await mockSharedApis(page);
  await installAppClock(page);
  await page.goto("/game/letter-dodge");
  await dismissAnnouncement(page);

  await page.getByTestId("button-custom-play").click();
  await page.getByTestId("select-custom-dodge-difficulty").click();
  await page.getByRole("option", { name: "Medium — 2 forbidden letters" }).click();
  for (const [index, letter] of ["A", "I"].entries()) {
    await page.getByTestId(`select-custom-dodge-letter-${index}`).click();
    await page.getByRole("option", { name: letter, exact: true }).click();
  }
  await page.getByTestId("button-custom-dodge-time-60").click();
  await page.getByTestId("button-start-custom-play").click();

  await page.getByTestId("input-word").fill("WORD");
  await page.getByTestId("button-submit").click();
  await finishTimedGame(page, 60);

  await page.evaluate(() => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Storage.prototype, "setItem")!;
    Reflect.set(window, "__freshAnswersOriginalSetItem", originalDescriptor);
    Object.defineProperty(Storage.prototype, "setItem", {
      ...originalDescriptor,
      value: () => {
        throw new DOMException("Storage is unavailable", "QuotaExceededError");
      },
    });
  });
  const saveButton = page.getByTestId("button-save-fresh-answers-letter-dodge");
  await saveButton.click();
  await expect(page.getByRole("alert")).toHaveText(
    "Couldn’t save the answers in this browser. Check its storage settings and try again.",
  );
  await expect(saveButton).toBeVisible();
  await expect(page.getByTestId("switch-fresh-answers-letter-dodge")).toHaveCount(0);
  expect(await page.evaluate(() =>
    localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge"),
  )).toBeNull();

  await page.evaluate(() => {
    Object.defineProperty(
      Storage.prototype,
      "setItem",
      Reflect.get(window, "__freshAnswersOriginalSetItem") as PropertyDescriptor,
    );
    Reflect.deleteProperty(window, "__freshAnswersOriginalSetItem");
  });
  await saveButton.click();
  await expect(page.getByTestId("switch-fresh-answers-letter-dodge")).toHaveAttribute("data-state", "checked");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge") || "null"),
  )).toEqual({ version: 1, words: ["WORD"], enabled: true });

  await page.evaluate(() => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Storage.prototype, "removeItem")!;
    Reflect.set(window, "__freshAnswersOriginalRemoveItem", originalDescriptor);
    Object.defineProperty(Storage.prototype, "removeItem", {
      ...originalDescriptor,
      value: () => {
        throw new DOMException("Storage is unavailable", "SecurityError");
      },
    });
  });
  const freshAnswersSwitch = page.getByTestId("switch-fresh-answers-letter-dodge");
  await freshAnswersSwitch.click();
  await expect(freshAnswersSwitch).toHaveAttribute("data-state", "checked");
  await expect(page.getByRole("alert")).toHaveText(
    "Couldn’t update the saved answers in this browser.",
  );
  await page.getByRole("button", { name: "View 1 saved answer" }).click();
  await expect(page.getByRole("list", { name: "Saved Fresh Answers for Custom Letter Dodge" }))
    .toContainText("WORD");
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge") || "null"),
  )).toEqual({ version: 1, words: ["WORD"], enabled: true });

  await page.evaluate(() => {
    Object.defineProperty(
      Storage.prototype,
      "removeItem",
      Reflect.get(window, "__freshAnswersOriginalRemoveItem") as PropertyDescriptor,
    );
    Reflect.deleteProperty(window, "__freshAnswersOriginalRemoveItem");
  });
  await freshAnswersSwitch.click();
  await expect(page.getByTestId("custom-fresh-answers-letter-dodge")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Saved Fresh Answers for Custom Letter Dodge" }))
    .toHaveCount(0);
  expect(await page.evaluate(() =>
    localStorage.getItem("xtrawordinary:custom-fresh-answers:v1:709:letter-dodge"),
  )).toBeNull();
});
