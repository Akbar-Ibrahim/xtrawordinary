import { test, expect, type Page } from "@playwright/test";

type Behavior = "success" | "missing" | "reject" | "pending" | "abort";
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const captured: string[] = [];
  errors.set(page, captured);
  page.on("pageerror", error => captured.push(error.message));
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: null } }));
  await page.route("**/api/analytics/events", route => route.fulfill({ status: 202, json: { ok: true } }));
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function setBrowserApi(page: Page, clipboard: Behavior, native: Behavior = "missing") {
  await page.addInitScript(({ clipboard, native }) => {
    const state = window as any;
    state.resultCopies = [];
    state.resultShares = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: clipboard === "missing" ? undefined : {
        writeText(text: string) {
          state.resultCopies.push(text);
          if (clipboard === "reject") return Promise.reject(new DOMException("Denied", "NotAllowedError"));
          if (clipboard === "pending") return new Promise<void>((resolve, reject) => {
            state.finishCopy = resolve;
            state.failCopy = () => reject(new DOMException("Denied", "NotAllowedError"));
          });
          return Promise.resolve();
        },
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: native === "missing" ? undefined : (data: ShareData) => {
        state.resultShares.push(data);
        if (native === "abort") return Promise.reject(new DOMException("Cancelled", "AbortError"));
        if (native === "reject") return Promise.reject(new DOMException("Denied", "NotAllowedError"));
        if (native === "pending") return new Promise<void>(resolve => { state.finishShare = resolve; });
        return Promise.resolve();
      },
    });
  }, { clipboard, native });
}

async function dismissAnnouncement(page: Page) {
  const close = page.getByTestId("button-whats-new-close");
  if (await close.isVisible()) await close.click();
}

async function openDaily(page: Page) {
  const response = await page.request.get("/api/daily-challenge");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  await page.addInitScript(data => {
    localStorage.setItem("wordplay_daily_challenge", JSON.stringify([{
      date: data.date, slug: data.game.slug, score: 1234, completedAt: Date.now(),
    }]));
  }, data);
  await page.route("**/api/daily-challenge/attempt?*", route => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/daily-challenge/leaderboard?*", route => route.fulfill({ json: { entries: [], myRank: 4 } }));
  await page.goto("/daily");
  await expect(page.getByTestId("button-share-daily")).toBeVisible();
  await dismissAnnouncement(page);
  // Wait for the rank so the expected summary includes the stable leaderboard result.
  await expect(page.getByTestId("text-my-rank")).toBeVisible();
  return page.evaluate(data => {
    const date = new Date(data.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `🏆🔥✨ xtraWordinary Daily Challenge\n${data.game.name} · ${date} · Rank #4\nScore: ${(1234).toLocaleString()}\nCan you beat it? ${location.origin}/daily`;
  }, data);
}

async function openRegularResult(page: Page) {
  await page.goto("/game/definition-match");
  await expect(page.getByRole("button", { name: "Play Now", includeHidden: true })).toBeVisible();
  await dismissAnnouncement(page);
  await page.getByRole("button", { name: "Play Now" }).click();
  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("button-copy-results")).toBeVisible();
  return page.evaluate(() =>
    `I just played Definition Match on xtraWordinary!\n\nScore: 0 points\nWords: 0\n\nCan you beat my score? Try it here:\n${location.origin}/game/definition-match`);
}

test("Daily copy waits for success and ignores duplicate attempts while pending", async ({ page }) => {
  await setBrowserApi(page, "pending");
  const expectedText = await openDaily(page);
  const button = page.getByTestId("button-share-daily");
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.getByText("Result copied!", { exact: true })).not.toBeVisible();
  await button.dispatchEvent("click");
  expect(await page.evaluate(() => (window as any).resultCopies)).toEqual([expectedText]);
  await page.evaluate(() => (window as any).finishCopy());
  await expect(page.getByText("Result copied!", { exact: true })).toBeVisible();
  await expect(button).toBeEnabled();
});

for (const clipboard of ["missing", "reject"] as const) {
  test(`Daily ${clipboard} clipboard opens selectable manual recovery without a success toast`, async ({ page }) => {
    await setBrowserApi(page, clipboard);
    const expectedText = await openDaily(page);
    await page.getByTestId("button-share-daily").click();
    const field = page.getByTestId("manual-copy-result-text");
    await expect(page.getByRole("dialog", { name: "Copy your result" })).toBeVisible();
    await expect(field).toHaveValue(expectedText);
    await expect(field).toHaveAttribute("readonly", "");
    await expect(field).toBeFocused();
    await expect(page.getByText("Result copied!", { exact: true })).not.toBeVisible();
    await page.getByTestId("button-select-result-text").click();
    expect(await field.evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBe(expectedText.length);
    await page.getByTestId("button-close-manual-copy").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByTestId("button-share-daily")).toBeFocused();
  });
}

test("regular Copy preserves result formatting and social destinations", async ({ page }) => {
  await setBrowserApi(page, "success");
  const expectedText = await openRegularResult(page);
  await page.getByTestId("button-copy-results").click();
  await expect(page.getByText("Copied!", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).resultCopies)).toEqual([expectedText]);
  await expect(page.getByTestId("button-share-native")).not.toBeVisible();
  await page.evaluate(() => {
    (window as any).socialUrls = [];
    window.open = (url) => { (window as any).socialUrls.push(String(url)); return null; };
  });
  for (const platform of ["twitter", "facebook", "linkedin", "whatsapp", "reddit"]) {
    await page.getByTestId(`button-share-${platform}`).click();
  }
  const urls: string[] = await page.evaluate(() => (window as any).socialUrls);
  expect(urls.map(url => new URL(url).hostname)).toEqual([
    "twitter.com", "www.facebook.com", "www.linkedin.com", "wa.me", "www.reddit.com",
  ]);
  expect(new URL(urls[0]).searchParams.get("text")).toBe(expectedText);
  expect(new URL(urls[3]).searchParams.get("text")).toBe(expectedText);
});

test("regular missing clipboard provides manual recovery with the complete result", async ({ page }) => {
  await setBrowserApi(page, "missing");
  const expectedText = await openRegularResult(page);
  await page.getByTestId("button-copy-results").click();
  await expect(page.getByTestId("manual-copy-result-text")).toHaveValue(expectedText);
  await expect(page.getByText("Copied!", { exact: true })).not.toBeVisible();
});

test("native share success keeps the payload and prevents duplicate sharing", async ({ page }) => {
  await setBrowserApi(page, "success", "pending");
  const expectedText = await openRegularResult(page);
  const button = page.getByTestId("button-share-native");
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.getByTestId("button-copy-results")).toBeDisabled();
  await button.dispatchEvent("click");
  const payloads = await page.evaluate(() => (window as any).resultShares);
  expect(payloads).toHaveLength(1);
  expect(payloads[0].title).toBe("xtraWordinary - Definition Match");
  expect(`${payloads[0].text}\n${payloads[0].url}`).toBe(expectedText);
  await page.evaluate(() => (window as any).finishShare());
  await expect(button).toBeEnabled();
  expect(await page.evaluate(() => (window as any).resultCopies)).toEqual([]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("native cancellation is silent and never copies", async ({ page }) => {
  await setBrowserApi(page, "success", "abort");
  await openRegularResult(page);
  await page.getByTestId("button-share-native").click();
  await expect(page.getByTestId("button-share-native")).toBeEnabled();
  expect(await page.evaluate(() => (window as any).resultShares)).toHaveLength(1);
  expect(await page.evaluate(() => (window as any).resultCopies)).toEqual([]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Copied!", { exact: true })).not.toBeVisible();
});

test("native denial falls back to copying the full result", async ({ page }) => {
  await setBrowserApi(page, "success", "reject");
  const expectedText = await openRegularResult(page);
  await page.getByTestId("button-share-native").click();
  await expect(page.getByText("Copied!", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).resultCopies)).toEqual([expectedText]);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("native and clipboard denial open manual recovery without false success", async ({ page }) => {
  await setBrowserApi(page, "reject", "reject");
  const expectedText = await openRegularResult(page);
  await page.getByTestId("button-share-native").click();
  await expect(page.getByTestId("manual-copy-result-text")).toHaveValue(expectedText);
  await expect(page.getByText("Copied!", { exact: true })).not.toBeVisible();
});

const linkUser = {
  id: 571, username: "linktester", name: "Link Tester",
  avatarUrl: null, createdAt: "2026-01-01T00:00:00Z", isPremium: true,
};
const linkQuiz = {
  id: 71, creatorId: linkUser.id, shareCode: "Exact-Quiz-Code", title: "Copy test quiz",
  gameSlug: "definition-match", createdAt: "2026-01-01T00:00:00Z",
  closesAt: null, description: null, params: null, playerCount: 0,
};
const linkGroup = {
  id: 72, ownerId: linkUser.id, name: "Copy test group", description: null,
  inviteCode: "EXACT-CODE", isPublic: false, tags: [], memberCount: 1,
  createdAt: "2026-01-01T00:00:00Z",
};
type LinkFlow = "quiz results" | "quiz creation" | "profile quiz" | "group list" | "group detail" | "friend invitation";

async function openLinkFlow(page: Page, flow: LinkFlow) {
  // Test fixtures only: normal signed-in UI and permission branches stay in place.
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: linkUser } }));
  await page.route("**/api/quiz-sessions/*/results", route =>
    route.fulfill({ json: { session: { ...linkQuiz, isClosed: false }, scores: [] } }));
  await page.route("**/api/quiz-sessions", route => route.fulfill({ status: 201, json: linkQuiz }));
  await page.route("**/api/quiz-sessions/my", route => route.fulfill({ json: [linkQuiz] }));
  await page.route("**/api/users/571/profile", route => route.fulfill({
    json: { user: linkUser, stats: [], achievements: [], leaderboardRankings: [] },
  }));
  await page.route("**/api/groups", route =>
    route.fulfill({ json: { myGroups: [linkGroup], discover: [], featured: [] } }));
  await page.route("**/api/groups/72", route => route.fulfill({
    json: { group: linkGroup, membership: { userId: linkUser.id, groupId: 72, role: "owner" } },
  }));
  for (const path of ["rounds", "leaderboard", "members", "seasons", "huddles", "team-races", "activity"]) {
    await page.route(`**/api/groups/72/${path}`, route => route.fulfill({ json: [] }));
  }
  await page.route("**/api/friends", route => route.fulfill({ json: [] }));
  await page.route("**/api/friends/requests", route => route.fulfill({ json: [] }));
  await page.route("**/api/challenges", route => route.fulfill({ json: [{
    id: 73, senderId: linkUser.id, receiverId: 572, receiverName: "Friend",
    gameSlug: "definition-match", status: "pending", senderScore: 10,
    createdAt: "2026-01-01T00:00:00Z", receiverViewed: false,
  }] }));
  const routes = {
    "quiz results": [`/quiz/${linkQuiz.shareCode}/results`, "button-copy-link"],
    "quiz creation": ["/game/definition-match?create-quiz=1", "button-copy-quiz-link"],
    "profile quiz": ["/profile/571?tab=quizzes", "button-copy-quiz-71"],
    "group list": ["/groups", "button-copy-invite-72"],
    "group detail": ["/groups/72", "button-copy-invite"],
    "friend invitation": ["/friends?tab=challenges", "button-share-challenge-73"],
  };
  if (flow === "quiz creation") {
    // Dismiss onboarding before the deep link automatically opens a second modal.
    await page.goto("/game/definition-match");
    await dismissAnnouncement(page);
  }
  await page.goto(routes[flow][0]);
  await dismissAnnouncement(page);
  if (flow === "quiz creation") {
    await page.getByTestId("input-quiz-title").fill(linkQuiz.title);
    await page.getByTestId("input-dm-word").fill("APPLE");
    for (let i = 0; i < 3; i++) {
      await page.getByTestId(`input-dm-def-${i}`).fill(`Fruit clue ${i + 1}`);
    }
    await page.getByTestId("button-dm-add-entry").click();
    await page.getByTestId("button-create-quiz-submit").click();
    await page.getByTestId("button-dm-confirm-create").click();
  }
  const button = page.getByTestId(routes[flow][1]);
  await expect(button).toBeVisible();
  const isQuiz = flow.startsWith("quiz") || flow === "profile quiz";
  const path = isQuiz ? `/quiz/${linkQuiz.shareCode}`
    : flow === "friend invitation" ? "/share/challenge/73" : `/groups?code=${linkGroup.inviteCode}`;
  const expectedLink = await page.evaluate(path => `${location.origin}${path}`, path);
  return { button, expectedLink, isQuiz };
}

for (const flow of ["quiz results", "quiz creation", "profile quiz", "group list", "group detail", "friend invitation"] as const) {
  test(`${flow}: waits for successful copy and blocks duplicate attempts`, async ({ page }) => {
    await setBrowserApi(page, "pending");
    const { button, expectedLink, isQuiz } = await openLinkFlow(page, flow);
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button.locator(".lucide-check-check")).toHaveCount(0);
    await expect(page.getByText("Invite link copied!", { exact: true })).not.toBeVisible();
    await button.dispatchEvent("click");
    expect(await page.evaluate(() => (window as any).resultCopies)).toEqual([expectedLink]);
    await page.evaluate(() => (window as any).finishCopy());
    await expect(button).toBeEnabled();
    if (isQuiz) await expect(button.locator(".lucide-check-check")).toHaveCount(1);
    else await expect(page.getByText("Invite link copied!", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Copy (quiz|invitation) link/ })).not.toBeVisible();
  });

  for (const clipboard of ["missing", "reject"] as const) {
    test(`${flow}: ${clipboard} clipboard recovers the exact link and restores focus`, async ({ page }) => {
      await setBrowserApi(page, clipboard);
      const { button, expectedLink, isQuiz } = await openLinkFlow(page, flow);
      await button.click();
      const dialog = page.getByRole("dialog", { name: isQuiz ? "Copy quiz link" : "Copy invitation link", exact: true });
      await expect(dialog).toBeVisible();
      const field = dialog.getByLabel(isQuiz ? "Quiz link" : "Invitation link", { exact: true });
      await expect(field).toHaveValue(expectedLink);
      await expect(field).toHaveAttribute("readonly", "");
      await expect(field).toBeFocused();
      await expect(dialog.getByText(/Ctrl\+C \/ Command\+C/)).toBeVisible();
      await expect(page.getByText("Invite link copied!", { exact: true })).not.toBeVisible();
      await expect(button.locator(".lucide-check-check")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Select link" }).click();
      expect(await field.evaluate((element: HTMLTextAreaElement) =>
        element.selectionEnd - element.selectionStart)).toBe(expectedLink.length);
      await dialog.getByRole("button", { name: "Done", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(button).toBeFocused();
    });
  }
}

for (const flow of ["quiz results", "friend invitation"] as const) {
  for (const outcome of ["success", "rejection"] as const) {
  test(`${flow}: copy ${outcome} after unmount emits no feedback`, async ({ page }) => {
    await setBrowserApi(page, "pending");
    const { button } = await openLinkFlow(page, flow);
    await button.click();
    await page.evaluate(() => {
      history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(button).not.toBeVisible();
    await page.evaluate(outcome => {
      if (outcome === "success") (window as any).finishCopy();
      else (window as any).failCopy();
    }, outcome);
    // Allow the resolved operation to render if it incorrectly survived unmount.
    await page.waitForTimeout(100);
    await expect(page.getByText("Invite link copied!", { exact: true })).not.toBeVisible();
    await expect(page.getByRole("dialog", { name: /Copy (quiz|invitation) link/ })).not.toBeVisible();
  });
  }
}