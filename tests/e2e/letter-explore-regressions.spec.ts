import { test, expect, type Page, type Route } from "@playwright/test";
import { fulfillExploreFallback } from "./explore-api-fixture";

const GAME_BY_SLUG = {
  "letter-hunt": {
    id: 1,
    slug: "letter-hunt",
    name: "Letter Hunt",
    description: "Find words containing required letters.",
    longDescription: "Find words containing required letters.",
    rules: ["Find words containing the required letters."],
    difficulty: "medium",
    estimatedTime: "5 minutes",
    icon: "Search",
    color: "#2563eb",
    playCount: 0,
    modes: [],
  },
  "letter-dodge": {
    id: 2,
    slug: "letter-dodge",
    name: "Letter Dodge",
    description: "Avoid forbidden letters.",
    longDescription: "Avoid forbidden letters.",
    rules: ["Use words that avoid the forbidden letters."],
    difficulty: "medium",
    estimatedTime: "5 minutes",
    icon: "Ban",
    color: "#ef4444",
    playCount: 0,
    modes: [],
  },
} as const;

type ExploreWord = {
  word: string;
  playableInGame: boolean;
  gameplayExclusion: string | null;
};

function response(
  items: ExploreWord[],
  hasMore = false,
  nextCursor: string | null = null,
) {
  return {
    items,
    page: { limit: 100, hasMore, nextCursor },
    source: "preview",
  };
}

const playableWord = (word: string): ExploreWord => ({
  word,
  playableInGame: true,
  gameplayExclusion: null,
});

async function openExploreFromGameDetail(page: Page, slug: keyof typeof GAME_BY_SLUG) {
  await page.addInitScript(() => {
    localStorage.setItem("xw_changelog_seen_v2.5", "1");
  });
  await page.route("**/api/**", fulfillExploreFallback);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: null } }),
  );
  await page.route("**/api/games", (route) =>
    route.fulfill({ json: Object.values(GAME_BY_SLUG) }),
  );
  await page.route(`**/api/games/${slug}`, (route) =>
    route.fulfill({ json: GAME_BY_SLUG[slug] }),
  );
  await page.route("**/api/likes**", (route) =>
    route.fulfill({ json: { counts: {}, likedByMe: {} } }),
  );

  await page.goto(`/game/${slug}`);
  await expect(page.getByRole("heading", { name: GAME_BY_SLUG[slug].name, exact: true })).toBeVisible();
  await page.getByTestId(`button-explore-${slug}`).click();
  await expect(page).toHaveURL(`/explore/${slug}`);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, `document overflowed: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body, `body overflowed: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
}

async function tabTo(page: Page, locator: ReturnType<Page["getByRole"]>) {
  for (let i = 0; i < 120; i += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Could not reach the expected control using Tab.");
}

async function expectVisibleKeyboardFocus(locator: ReturnType<Page["getByRole"]>) {
  await expect(locator).toBeFocused();
  await expect.poll(() =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return element.matches(":focus-visible") && style.boxShadow !== "none";
    }),
  ).toBe(true);
}

test.describe("Letter Hunt Explore browser regressions", () => {
  test("preset patterns can be selected and searched with the keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const searches: URL[] = [];
    await openExploreFromGameDetail(page, "letter-hunt");
    await page.route("**/api/explore/letter-hunt/words**", async (route: Route) => {
      searches.push(new URL(route.request().url()));
      await route.fulfill({ json: response([playableWord("TEA")]) });
    });

    const anyOrderPreset = page.getByRole("button", { name: "TEA · any order" });
    await tabTo(page, anyOrderPreset);
    await expectVisibleKeyboardFocus(anyOrderPreset);
    await page.keyboard.press("Space");
    await expectVisibleKeyboardFocus(anyOrderPreset);
    await expect(page.getByLabel("Letters to find")).toHaveValue("TEA");
    await expect(page.getByRole("button", { name: "Any order", exact: true })).toHaveAttribute("aria-pressed", "true");

    const orderedPreset = page.getByRole("button", { name: "T → E → A" });
    await page.keyboard.press("Tab");
    await expectVisibleKeyboardFocus(orderedPreset);
    await page.keyboard.press("Enter");
    await expectVisibleKeyboardFocus(orderedPreset);
    await expect(page.getByLabel("Letters to find")).toHaveValue("TEA");
    await expect(page.getByRole("button", { name: "In this order", exact: true })).toHaveAttribute("aria-pressed", "true");

    const repeatedLetterPreset = page.getByRole("button", { name: "LL · two Ls" });
    await page.keyboard.press("Tab");
    await expectVisibleKeyboardFocus(repeatedLetterPreset);
    await page.keyboard.press("Space");
    await expectVisibleKeyboardFocus(repeatedLetterPreset);
    await expect(page.getByLabel("Letters to find")).toHaveValue("LL");
    await expect(page.getByRole("button", { name: "Any order", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("TEA", { exact: true })).toBeVisible();
    expect(searches.map((url) => [
      url.searchParams.get("letters"),
      url.searchParams.get("ordered"),
    ])).toEqual([
      ["TEA", "false"],
      ["TEA", "true"],
      ["LL", "false"],
    ]);
  });

  test("pattern and order controls work with keyboard navigation", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const searches: URL[] = [];
    await openExploreFromGameDetail(page, "letter-hunt");
    await page.route("**/api/explore/letter-hunt/words**", async (route: Route) => {
      searches.push(new URL(route.request().url()));
      await route.fulfill({ json: response([playableWord("TACO")]) });
    });

    const lettersInput = page.getByLabel("Letters to find");
    await tabTo(page, lettersInput);
    await expectVisibleKeyboardFocus(lettersInput);
    await page.keyboard.type("ta");
    await expect(lettersInput).toHaveValue("TA");

    const orderGroup = page.getByRole("group", { name: "Letter order" });
    const anyOrder = orderGroup.getByRole("button", { name: "Any order" });
    await page.keyboard.press("Tab");
    await expectVisibleKeyboardFocus(anyOrder);
    await page.keyboard.press("Space");
    await expect(anyOrder).toHaveAttribute("aria-pressed", "true");

    const inThisOrder = orderGroup.getByRole("button", { name: "In this order" });
    await page.keyboard.press("Tab");
    await expectVisibleKeyboardFocus(inThisOrder);
    await page.keyboard.press("Enter");
    await expect(inThisOrder).toHaveAttribute("aria-pressed", "true");
    await expect(anyOrder).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Tab");
    const searchButton = page.getByRole("button", { name: "Find matching words" });
    await expectVisibleKeyboardFocus(searchButton);
    await page.keyboard.press("Enter");
    await expect(page.getByText("TACO", { exact: true })).toBeVisible();
    expect(searches[0].searchParams.get("letters")).toBe("TA");
    expect(searches[0].searchParams.get("ordered")).toBe("true");
  });

  test("Game Detail entry, uppercase repeated and ordered searches, and word-check agreement", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const searches: URL[] = [];
    const checks: Record<string, unknown>[] = [];
    await openExploreFromGameDetail(page, "letter-hunt");

    await page.route("**/api/explore/letter-hunt/words**", async (route: Route) => {
      const url = new URL(route.request().url());
      searches.push(url);
      if (url.searchParams.get("letters") === "LL") {
        await route.fulfill({ json: response([playableWord("TELL")]) });
      } else {
        await route.fulfill({ json: response([playableWord("TACO"), playableWord("TAXI")]) });
      }
    });
    await page.route("**/api/explore/letter-hunt/check", async (route: Route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      checks.push(body);
      await route.fulfill({
        json: {
          word: body.word,
          dictionaryMatch: true,
          constraintMatch: true,
          playableInGame: true,
          gameplayExclusion: null,
          source: "preview",
        },
      });
    });

    const lettersInput = page.getByLabel("Letters to find");
    await lettersInput.fill("lL");
    await expect(lettersInput).toHaveValue("LL");
    await page.getByRole("button", { name: "Find matching words" }).click();
    await expect(page.getByText("TELL", { exact: true })).toBeVisible();
    expect(searches[0].searchParams.get("letters")).toBe("LL");
    expect(searches[0].searchParams.get("ordered")).toBe("false");

    await page.getByRole("button", { name: "In this order" }).click();
    await lettersInput.fill("ta");
    await expect(lettersInput).toHaveValue("TA");
    await page.getByRole("button", { name: "Find matching words" }).click();
    await expect(page.getByText("TACO", { exact: true })).toBeVisible();
    expect(searches[1].searchParams.get("letters")).toBe("TA");
    expect(searches[1].searchParams.get("ordered")).toBe("true");

    const answerInput = page.locator("#hunt-word-check");
    await answerInput.fill("taco");
    await expect(answerInput).toHaveValue("TACO");
    await page.getByRole("button", { name: "Check word" }).click();
    const checkResult = page.getByRole("status").filter({ hasText: "TACO" });
    await expect(checkResult).toContainText("Matches selected pattern: ✅");
    await expect(checkResult).toContainText("Exists in dictionary: ✅");
    await expect(page.getByText("For the host")).toHaveCount(0);
    expect(checks).toEqual([{ word: "TACO", letters: "TA", ordered: true }]);
    await expectNoHorizontalOverflow(page);
  });

  test("Word check keeps the entry and pattern after a failure and can retry", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const checks: Record<string, unknown>[] = [];
    await openExploreFromGameDetail(page, "letter-hunt");
    let requestCount = 0;
    await page.route("**/api/explore/letter-hunt/check", async (route: Route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      checks.push(body);
      requestCount += 1;
      if (requestCount === 1) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        json: {
          word: body.word,
          dictionaryMatch: true,
          constraintMatch: true,
          playableInGame: true,
          gameplayExclusion: null,
          source: "preview",
        },
      });
    });

    const lettersInput = page.getByLabel("Letters to find");
    await lettersInput.fill("ta");
    await page.getByRole("button", { name: "In this order" }).click();
    const answerInput = page.locator("#hunt-word-check");
    await answerInput.fill("taco");
    const checkButton = page.getByRole("button", { name: "Check word" });
    await checkButton.click();

    await expect(page.getByRole("alert")).toHaveText(
      "We couldn't reach the server. This check wasn't completed. Reconnect and try again.",
    );
    await expect(answerInput).toHaveValue("TACO");
    await expect(lettersInput).toHaveValue("TA");
    await expect(page.getByRole("button", { name: "In this order" })).toHaveAttribute("aria-pressed", "true");
    await checkButton.click();

    const checkResult = page.getByRole("status").filter({ hasText: "TACO" });
    await expect(checkResult).toContainText("Matches selected pattern: ✅");
    await expect(checkResult).toContainText("Exists in dictionary: ✅");
    expect(checks).toEqual([
      { word: "TACO", letters: "TA", ordered: true },
      { word: "TACO", letters: "TA", ordered: true },
    ]);
    await expectNoHorizontalOverflow(page);
  });

  test("Word check reports an incomplete response without showing a result", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-hunt");
    let requestCount = 0;
    await page.route("**/api/explore/letter-hunt/check", async (route: Route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          json: {
            word: "TACO",
            dictionaryMatch: true,
            constraintMatch: true,
            playableInGame: true,
            gameplayExclusion: null,
            source: "preview",
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          word: "TAXI",
          dictionaryMatch: true,
          playableInGame: true,
          gameplayExclusion: null,
          source: "preview",
        },
      });
    });

    await page.getByLabel("Letters to find").fill("TA");
    const answerInput = page.locator("#hunt-word-check");
    await answerInput.fill("taco");
    const checkButton = page.getByRole("button", { name: "Check word" });
    await checkButton.click();
    const checkResult = page.getByRole("status").filter({ hasText: "TACO" });
    await expect(checkResult).toContainText("Matches selected pattern: ✅");
    await expect(checkResult).toContainText("Exists in dictionary: ✅");

    await answerInput.fill("taxi");
    await checkButton.click();

    await expect(page.getByRole("alert")).toHaveText(
      "The checker returned an incomplete or invalid response. No ruling was shown. Please try again.",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(answerInput).toHaveValue("TAXI");
    await expectNoHorizontalOverflow(page);
  });

  test("Word check reports unreadable data without a result and allows retry", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const checks: Record<string, unknown>[] = [];
    await openExploreFromGameDetail(page, "letter-hunt");
    let requestCount = 0;
    await page.route("**/api/explore/letter-hunt/check", async (route: Route) => {
      checks.push(route.request().postDataJSON() as Record<string, unknown>);
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "not valid json",
        });
        return;
      }
      await route.fulfill({
        json: {
          word: "TACO",
          dictionaryMatch: true,
          constraintMatch: true,
          playableInGame: true,
          gameplayExclusion: null,
          source: "preview",
        },
      });
    });

    const lettersInput = page.getByLabel("Letters to find");
    await lettersInput.fill("TA");
    await page.getByRole("button", { name: "In this order" }).click();
    const answerInput = page.locator("#hunt-word-check");
    await answerInput.fill("taco");
    const checkButton = page.getByRole("button", { name: "Check word" });
    await checkButton.click();

    await expect(page.getByRole("alert")).toHaveText(
      "The checker returned an incomplete or invalid response. No ruling was shown. Please try again.",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(answerInput).toHaveValue("TACO");
    await expect(lettersInput).toHaveValue("TA");
    await expect(page.getByRole("button", { name: "In this order" })).toHaveAttribute("aria-pressed", "true");
    await checkButton.click();

    const checkResult = page.getByRole("status").filter({ hasText: "TACO" });
    await expect(checkResult).toContainText("Matches selected pattern: ✅");
    await expect(checkResult).toContainText("Exists in dictionary: ✅");
    expect(checks).toEqual([
      { word: "TACO", letters: "TA", ordered: true },
      { word: "TACO", letters: "TA", ordered: true },
    ]);
    await expectNoHorizontalOverflow(page);
  });

  test("failed search can be retried and the next results page can be loaded", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    let requestCount = 0;
    await openExploreFromGameDetail(page, "letter-hunt");
    await page.route("**/api/explore/letter-hunt/words**", async (route: Route) => {
      requestCount += 1;
      const url = new URL(route.request().url());
      if (url.searchParams.get("letters") === "TE") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporary dictionary outage" }),
        });
      } else if (requestCount <= 2 || (requestCount <= 5 && url.searchParams.has("cursor"))) {
        await route.abort("failed");
      } else if (url.searchParams.has("cursor")) {
        await route.fulfill({ json: response([playableWord("LATE")]) });
      } else {
        await route.fulfill({ json: response([playableWord("ATE")], true, "hunt-next") });
      }
    });

    await page.getByLabel("Letters to find").fill("a");
    await page.getByRole("button", { name: "Find matching words" }).click();
    await expect(page.getByRole("alert").getByText(
      "We couldn't reach the server. This search wasn't completed. Reconnect and try again.",
      { exact: true },
    )).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("ATE", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load more matching words" })).toBeVisible();
    await page.getByRole("button", { name: "Load more matching words" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "We couldn't reach the server. This search wasn't completed. Reconnect and try again.",
    );
    await expect(page.getByText("ATE", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry loading more matching words" }).click();
    await expect(page.getByText("LATE", { exact: true })).toBeVisible();
    await expect(page.getByText("2 shown", { exact: true })).toBeVisible();
    await page.getByLabel("Letters to find").fill("te");
    await page.getByRole("button", { name: "Find matching words" }).click();
    await expect(page.getByRole("alert").getByText("Temporary dictionary outage", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("Letter Hunt unreadable later page keeps existing words and can be retried", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-hunt");
    const requestedCursors: string[] = [];
    let laterPageAttempts = 0;
    await page.route("**/api/explore/letter-hunt/words**", async (route: Route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");
      if (!cursor) {
        await route.fulfill({ json: response([playableWord("ATE")], true, "hunt-next") });
        return;
      }

      requestedCursors.push(cursor);
      laterPageAttempts += 1;
      if (laterPageAttempts <= 2) {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>Temporary error</title><p>LATE</p>",
        });
        return;
      }

      await route.fulfill({ json: response([playableWord("LATE")]) });
    });

    await page.getByLabel("Letters to find").fill("a");
    await page.getByRole("button", { name: "Find matching words" }).click();
    await expect(page.getByText("ATE", { exact: true })).toBeVisible();
    await expect(page.getByText("1+ shown", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Load more matching words" }).click();
    const results = page.locator('section[aria-labelledby="hunt-results-heading"]');
    await expect(results.getByRole("alert")).toHaveText(
      "The next search page returned an incomplete or invalid response. Your existing results are still available. Retry loading more.",
    );
    await expect(page.getByText("ATE", { exact: true })).toBeVisible();
    await expect(page.getByText("LATE", { exact: true })).toHaveCount(0);
    await expect(page.getByText("1+ shown", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Retry loading more matching words" }).click();
    await expect(page.getByText("ATE", { exact: true })).toBeVisible();
    await expect(page.getByText("LATE", { exact: true })).toBeVisible();
    await expect(page.getByText("2 shown", { exact: true })).toBeVisible();
    await expect(results.getByRole("alert")).toHaveCount(0);
    expect(requestedCursors.length).toBeGreaterThan(1);
    expect(requestedCursors.every((cursor) => cursor === "hunt-next")).toBe(true);
  });

  test("incomplete search response shows an error without rendering results", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-hunt");
    let attempts = 0;
    await page.route("**/api/explore/letter-hunt/words**", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          json: {
            items: [playableWord("TACO")],
            page: { limit: 100, hasMore: false },
            source: "preview",
          },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"items":',
      });
    });

    await page.getByLabel("Letters to find").fill("TA");
    await page.getByRole("button", { name: "Find matching words" }).click();

    await expect(page.getByRole("alert")).toContainText(
      "The search returned an incomplete or invalid response. No results were shown. Please try again.",
    );
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "The search returned an incomplete or invalid response. No results were shown. Please try again.",
    );
    await expect(page.getByText("TACO", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/shown$/)).toHaveCount(0);
  });

  test("non-JSON search response shows a clear error and can be retried", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-hunt");
    let allowRetry = false;
    await page.route("**/api/explore/letter-hunt/words**", async (route) => {
      if (!allowRetry) {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>Temporary error</title><p>TACO</p>",
        });
        return;
      }

      await route.fulfill({ json: response([playableWord("TACO")]) });
    });

    await page.getByLabel("Letters to find").fill("TA");
    await page.getByRole("button", { name: "Find matching words" }).click();

    const searchError = "The search returned an incomplete or invalid response. No results were shown. Please try again.";
    await expect(page.getByRole("alert")).toContainText(searchError);
    await expect(page.getByText("TACO", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/shown$/)).toHaveCount(0);

    allowRetry = true;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("TACO", { exact: true })).toBeVisible();
    await expect(page.getByText("1 shown", { exact: true })).toBeVisible();
  });
});

test.describe("Letter Dodge Explore browser regressions", () => {
  async function fillForbiddenLetters(page: Page, letters: string, submit = false) {
    const input = page.getByTestId("input-forbidden-letters");
    await input.fill(letters);
    await expect(input).toHaveValue(letters.toUpperCase().replace(/[^A-Z]/g, ""));
    if (submit) await page.getByTestId("button-find-letter-dodge-words").click();
  }

  test("text input normalizes letters and searches on Enter", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const searches: URL[] = [];
    await openExploreFromGameDetail(page, "letter-dodge");
    await page.route("**/api/explore/letter-dodge/words**", async (route: Route) => {
      searches.push(new URL(route.request().url()));
      await route.fulfill({ json: response([playableWord("BARK")]) });
    });

    const input = page.getByTestId("input-forbidden-letters");
    await input.fill("q-x");
    await expect(input).toHaveValue("QX");
    await input.press("Enter");
    await expect(page.getByText("BARK", { exact: true })).toBeVisible();
    expect(searches.map((url) => url.searchParams.get("forbidden"))).toEqual(["QX"]);
    await expectNoHorizontalOverflow(page);
  });

  test("example letter sets fill the input and immediately run a search", async ({ page }) => {
    const searches: URL[] = [];
    await openExploreFromGameDetail(page, "letter-dodge");
    await page.route("**/api/explore/letter-dodge/words**", async (route: Route) => {
      searches.push(new URL(route.request().url()));
      await route.fulfill({ json: response([playableWord("BARK")]) });
    });

    await page.getByRole("button", { name: "Avoid A + E" }).click();
    await expect(page.getByTestId("input-forbidden-letters")).toHaveValue("AE");
    await expect(page.getByText("BARK", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Avoid Q + X + Z" }).click();
    await expect(page.getByTestId("input-forbidden-letters")).toHaveValue("QXZ");
    expect(searches.map((url) => url.searchParams.get("forbidden"))).toEqual(["AE", "QXZ"]);
  });

  test("text input is keyboard-focusable and supports normal text editing", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");
    const input = page.getByTestId("input-forbidden-letters");
    await tabTo(page, input);
    await expectVisibleKeyboardFocus(input);
    await page.keyboard.type("ae");
    await expect(input).toHaveValue("AE");
    await page.keyboard.press("Control+A");
    await page.keyboard.type("qx");
    await expect(input).toHaveValue("QX");
    await expectNoHorizontalOverflow(page);
  });

  test("preset letter sets can be selected and searched with the keyboard", async ({ page }) => {
    test.skip(true, "This test asserts the retired letter-grid interface.");
    await page.setViewportSize({ width: 375, height: 812 });
    const searches: URL[] = [];
    await openExploreFromGameDetail(page, "letter-dodge");
    await page.route("**/api/explore/letter-dodge/words**", async (route: Route) => {
      searches.push(new URL(route.request().url()));
      await route.fulfill({ json: response([playableWord("BARK")]) });
    });

    const letterGroup = page.getByRole("group", { name: "Select forbidden letters" });
    const presets = [
      { name: "Avoid A + E", letters: ["A", "E"], key: "Space" },
      { name: "Avoid Q + X + Z", letters: ["Q", "X", "Z"], key: "Enter" },
    ];
    const firstPreset = page.getByRole("button", { name: presets[0].name });
    await tabTo(page, firstPreset);
    for (const [index, definition] of presets.entries()) {
      const preset = page.getByRole("button", { name: definition.name });
      if (index > 0) await page.keyboard.press("Tab");
      await expectVisibleKeyboardFocus(preset);
      await page.keyboard.press(definition.key);
      await expectVisibleKeyboardFocus(preset);
      for (const letter of definition.letters) {
        await expect(letterGroup.getByRole("button", { name: `${letter}, forbidden` })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await expect(page.getByText(definition.letters.join(" · "), { exact: true })).toBeVisible();
    }
    await expect(page.getByText("BARK", { exact: true })).toBeVisible();
    expect(searches.map((url) => url.searchParams.get("forbidden"))).toEqual(["AE", "QXZ"]);
  });

  test("forbidden letters can be toggled with Space and Enter", async ({ page }) => {
    test.skip(true, "This test asserts the retired letter-grid interface.");
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");

    const letterGroup = page.getByRole("group", { name: "Select forbidden letters" });
    const letterA = letterGroup.getByRole("button", { name: "A", exact: true });
    await tabTo(page, letterA);
    await expectVisibleKeyboardFocus(letterA);
    await page.keyboard.press("Space");
    const selectedA = letterGroup.getByRole("button", { name: "A, forbidden" });
    await expect(selectedA).toHaveAttribute("aria-pressed", "true");
    await expectVisibleKeyboardFocus(selectedA);

    await page.keyboard.press("Space");
    await expect(letterA).toHaveAttribute("aria-pressed", "false");

    const letterB = letterGroup.getByRole("button", { name: "B", exact: true });
    await page.keyboard.press("ArrowRight");
    await expectVisibleKeyboardFocus(letterB);
    await page.keyboard.press("Enter");
    await expect(letterGroup.getByRole("button", { name: "B, forbidden" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("arrow keys move within the letter group while Tab enters and leaves it", async ({ page }) => {
    test.skip(true, "This test asserts the retired letter-grid interface.");
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");

    const letterGroup = page.getByRole("group", { name: "Select forbidden letters" });
    const letterA = letterGroup.getByRole("button", { name: "A", exact: true });
    await tabTo(page, letterA);
    await expect(letterA).toHaveAttribute("tabindex", "0");

    const letterB = letterGroup.getByRole("button", { name: "B", exact: true });
    await page.keyboard.press("ArrowRight");
    await expectVisibleKeyboardFocus(letterB);
    await expect(letterB).toHaveAttribute("tabindex", "0");
    await expect(letterA).toHaveAttribute("tabindex", "-1");

    const letterI = letterGroup.getByRole("button", { name: "I", exact: true });
    await page.keyboard.press("ArrowDown");
    await expectVisibleKeyboardFocus(letterI);
    await page.keyboard.press("Space");
    const selectedI = letterGroup.getByRole("button", { name: "I, forbidden" });
    await expect(selectedI).toHaveAttribute("aria-pressed", "true");
    await expectVisibleKeyboardFocus(selectedI);

    await page.keyboard.press("Tab");
    await expectVisibleKeyboardFocus(page.getByRole("button", { name: "Avoid A + E" }));
    await page.keyboard.press("Shift+Tab");
    await expectVisibleKeyboardFocus(selectedI);
  });

  test("arrow keys stay within rows and letter choices at grid edges", async ({ page }) => {
    test.skip(true, "This test asserts the retired letter-grid interface.");
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");

    const letterGroup = page.getByRole("group", { name: "Select forbidden letters" });
    const columnCount = await letterGroup.evaluate(
      (group) => getComputedStyle(group).gridTemplateColumns.split(" ").length,
    );
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const focusLetter = async (letter: string) => {
      const button = letterGroup.getByRole("button", { name: letter, exact: true });
      await button.focus();
      await expect(button).toBeFocused();
      return button;
    };

    expect(columnCount).toBe(7);

    const endOfFirstRow = await focusLetter(letters[columnCount - 1]);
    await page.keyboard.press("ArrowRight");
    await expect(endOfFirstRow).toBeFocused();

    const startOfSecondRow = await focusLetter(letters[columnCount]);
    await page.keyboard.press("ArrowLeft");
    await expect(startOfSecondRow).toBeFocused();

    const firstLetter = await focusLetter(letters[0]);
    await page.keyboard.press("ArrowUp");
    await expect(firstLetter).toBeFocused();

    const lastFullRowLetter = await focusLetter(letters[26 - (26 % columnCount) - 1]);
    await page.keyboard.press("ArrowDown");
    await expect(lastFullRowLetter).toBeFocused();

    const finalLetter = await focusLetter(letters[25]);
    await page.keyboard.press("ArrowDown");
    await expect(finalLetter).toBeFocused();
  });

  for (const { name, width, expectedColumns } of [
    { name: "tablet", width: 700, expectedColumns: 9 },
    { name: "desktop", width: 1280, expectedColumns: 13 },
  ]) {
    test(`arrow keys follow the displayed letter-grid columns at ${name} width`, async ({ page }) => {
      test.skip(true, "This test asserts the retired letter-grid interface.");
      await page.setViewportSize({ width, height: 900 });
      await openExploreFromGameDetail(page, "letter-dodge");

      const letterGroup = page.getByRole("group", { name: "Select forbidden letters" });
      const columnCount = await letterGroup.evaluate(
        (group) => getComputedStyle(group).gridTemplateColumns.split(" ").length,
      );
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const letterAt = (index: number) => letterGroup.getByRole("button", {
        name: letters[index],
        exact: true,
      });

      expect(columnCount).toBe(expectedColumns);

      await letterAt(0).focus();
      await page.keyboard.press("ArrowRight");
      await expect(letterAt(1)).toBeFocused();

      await page.keyboard.press("ArrowDown");
      await expect(letterAt(columnCount + 1)).toBeFocused();

      await page.keyboard.press("ArrowLeft");
      await expect(letterAt(columnCount)).toBeFocused();

      await page.keyboard.press("ArrowUp");
      await expect(letterAt(0)).toBeFocused();
    });
  }

  test("arrow keys follow the letter grid after resizing while it is open", async ({ page }) => {
    test.skip(true, "This test asserts the retired letter-grid interface.");
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");

    const letterGroup = page.getByRole("group", { name: "Select forbidden letters" });
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letterAt = (index: number) => letterGroup.getByRole("button", {
      name: letters[index],
      exact: true,
    });
    const expectColumnCount = async (expected: number) => {
      await expect.poll(() => letterGroup.evaluate(
        (group) => getComputedStyle(group).gridTemplateColumns.trim().split(/\s+/).length,
      )).toBe(expected);
    };

    await expectColumnCount(7);
    await letterAt(1).focus();
    await page.keyboard.press("ArrowDown");
    await expect(letterAt(8)).toBeFocused();

    // I becomes the last item in the first row at tablet width, so right must not move.
    await page.setViewportSize({ width: 700, height: 900 });
    await expectColumnCount(9);
    await page.keyboard.press("ArrowRight");
    await expect(letterAt(8)).toBeFocused();
    await letterAt(1).focus();
    await page.keyboard.press("ArrowDown");
    await expect(letterAt(10)).toBeFocused();

    // J moves to the second row at desktop width, and left should now reach I.
    await letterAt(9).focus();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expectColumnCount(13);
    await page.keyboard.press("ArrowLeft");
    await expect(letterAt(8)).toBeFocused();
    await letterAt(1).focus();
    await page.keyboard.press("ArrowDown");
    await expect(letterAt(14)).toBeFocused();
  });

  test("Game Detail entry, forbidden-letter input, short-word label, and word-check agreement", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const searches: URL[] = [];
    const checks: Record<string, unknown>[] = [];
    await openExploreFromGameDetail(page, "letter-dodge");
    await page.route("**/api/explore/letter-dodge/words**", async (route: Route) => {
      searches.push(new URL(route.request().url()));
      await route.fulfill({
        json: response([
          {
            word: "BY",
            playableInGame: false,
            gameplayExclusion: "Letter Dodge gameplay requires at least 4 letters.",
          },
          playableWord("BARK"),
        ]),
      });
    });
    await page.route("**/api/explore/letter-dodge/check", async (route: Route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      checks.push(body);
      await route.fulfill({
        json: {
          word: body.word,
          dictionaryMatch: true,
          constraintMatch: true,
          playableInGame: false,
          gameplayExclusion: "Letter Dodge gameplay requires at least 4 letters.",
          source: "preview",
        },
      });
    });

    const forbiddenInput = page.getByLabel("Letters to omit");
    await forbiddenInput.fill("qx");
    await expect(forbiddenInput).toHaveValue("QX");
    await page.getByRole("button", { name: "Find words" }).click();

    await expect(page.getByText("BY", { exact: true })).toBeVisible();
    await expect(page.getByText(/Explore match; Letter Dodge gameplay requires at least 4 letters\./)).toBeVisible();
    expect(searches[0].searchParams.get("forbidden")).toBe("QX");

    const answerInput = page.locator("#dodge-word-check");
    await answerInput.fill("by");
    await expect(answerInput).toHaveValue("BY");
    await page.getByRole("button", { name: "Check word" }).click();
    const checkResult = page.getByRole("status").filter({ hasText: "BY" });
    await expect(checkResult).toContainText("Avoids selected letters: ✅");
    await expect(checkResult).toContainText("Exists in dictionary: ✅");
    expect(checks).toEqual([{ word: "BY", forbidden: "QX" }]);
    await expectNoHorizontalOverflow(page);
  });

  test("Word check keeps the entry and forbidden letters after a failure and can retry", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const checks: Record<string, unknown>[] = [];
    await openExploreFromGameDetail(page, "letter-dodge");
    let requestCount = 0;
    await page.route("**/api/explore/letter-dodge/check", async (route: Route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      checks.push(body);
      requestCount += 1;
      if (requestCount === 1) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        json: {
          word: body.word,
          dictionaryMatch: true,
          constraintMatch: true,
          playableInGame: true,
          gameplayExclusion: null,
          source: "preview",
        },
      });
    });

    const forbiddenInput = page.getByLabel("Letters to omit");
    await forbiddenInput.fill("qx");
    await expect(forbiddenInput).toHaveValue("QX");
    const answerInput = page.locator("#dodge-word-check");
    await answerInput.fill("bark");
    const checkButton = page.getByRole("button", { name: "Check word" });
    await checkButton.click();

    await expect(page.getByRole("alert")).toHaveText(
      "We couldn't reach the server. This check wasn't completed. Reconnect and try again.",
    );
    await expect(answerInput).toHaveValue("BARK");
    await expect(forbiddenInput).toHaveValue("QX");
    await checkButton.click();

    const checkResult = page.getByRole("status").filter({ hasText: "BARK" });
    await expect(checkResult).toContainText("Avoids selected letters: ✅");
    await expect(checkResult).toContainText("Exists in dictionary: ✅");
    expect(checks).toEqual([
      { word: "BARK", forbidden: "QX" },
      { word: "BARK", forbidden: "QX" },
    ]);
    await expectNoHorizontalOverflow(page);
  });

  test("Word check reports an incomplete response without showing a result", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");
    let requestCount = 0;
    await page.route("**/api/explore/letter-dodge/check", async (route: Route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          json: {
            word: "BARK",
            dictionaryMatch: true,
            constraintMatch: true,
            playableInGame: true,
            gameplayExclusion: null,
            source: "preview",
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          word: "BARS",
          dictionaryMatch: true,
          constraintMatch: true,
          playableInGame: true,
          gameplayExclusion: null,
        },
      });
    });

    const forbiddenInput = page.getByLabel("Letters to omit");
    await forbiddenInput.fill("q");
    await expect(forbiddenInput).toHaveValue("Q");
    const answerInput = page.locator("#dodge-word-check");
    await answerInput.fill("bark");
    const checkButton = page.getByRole("button", { name: "Check word" });
    await checkButton.click();
    const checkResult = page.getByRole("status").filter({ hasText: "BARK" });
    await expect(checkResult).toContainText("Avoids selected letters: ✅");
    await expect(checkResult).toContainText("Exists in dictionary: ✅");

    await answerInput.fill("bars");
    await checkButton.click();

    await expect(page.getByRole("alert")).toHaveText(
      "The checker returned an incomplete or invalid response. No ruling was shown. Please try again.",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(answerInput).toHaveValue("BARS");
    await expectNoHorizontalOverflow(page);
  });

  test("Word check reports unreadable data without a result and allows retry", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const checks: Record<string, unknown>[] = [];
    await openExploreFromGameDetail(page, "letter-dodge");
    let requestCount = 0;
    await page.route("**/api/explore/letter-dodge/check", async (route: Route) => {
      checks.push(route.request().postDataJSON() as Record<string, unknown>);
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "not valid json",
        });
        return;
      }
      await route.fulfill({
        json: {
          word: "BARK",
          dictionaryMatch: true,
          constraintMatch: true,
          playableInGame: true,
          gameplayExclusion: null,
          source: "preview",
        },
      });
    });

    const forbiddenInput = page.getByLabel("Letters to omit");
    await forbiddenInput.fill("q");
    await expect(forbiddenInput).toHaveValue("Q");
    const answerInput = page.locator("#dodge-word-check");
    await answerInput.fill("bark");
    const checkButton = page.getByRole("button", { name: "Check word" });
    await checkButton.click();

    await expect(page.getByRole("alert")).toHaveText(
      "The checker returned an incomplete or invalid response. No ruling was shown. Please try again.",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(answerInput).toHaveValue("BARK");
    await expect(forbiddenInput).toHaveValue("Q");
    await checkButton.click();

    const checkResult = page.getByRole("status").filter({ hasText: "BARK" });
    await expect(checkResult).toContainText("Avoids selected letters: ✅");
    await expect(checkResult).toContainText("Exists in dictionary: ✅");
    expect(checks).toEqual([
      { word: "BARK", forbidden: "Q" },
      { word: "BARK", forbidden: "Q" },
    ]);
    await expectNoHorizontalOverflow(page);
  });

  test("failed search can be retried and additional matching words can be loaded", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    let requestCount = 0;
    await openExploreFromGameDetail(page, "letter-dodge");
    await page.route("**/api/explore/letter-dodge/words**", async (route: Route) => {
      requestCount += 1;
      const url = new URL(route.request().url());
      if (url.searchParams.get("forbidden") === "AE") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporary dictionary outage" }),
        });
      } else if (requestCount <= 2 || (requestCount <= 5 && url.searchParams.has("cursor"))) {
        await route.abort("failed");
      } else if (url.searchParams.has("cursor")) {
        await route.fulfill({ json: response([playableWord("BARK")]) });
      } else {
        await route.fulfill({ json: response([playableWord("BY")], true, "dodge-next") });
      }
    });

    await page.getByRole("button", { name: "Avoid Q + X + Z" }).click();
    await expect(page.getByRole("alert").getByText(
      "We couldn't reach the server. This search wasn't completed. Reconnect and try again.",
      { exact: true },
    )).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("BY", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load more matching words" })).toBeVisible();
    await page.getByRole("button", { name: "Load more matching words" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "We couldn't reach the server. This search wasn't completed. Reconnect and try again.",
    );
    await expect(page.getByText("BY", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retry loading more matching words" }).click();
    await expect(page.getByText("BARK", { exact: true })).toBeVisible();
    await expect(page.getByText("2 shown", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Avoid A + E" }).click();
    await expect(page.getByRole("alert").getByText("Temporary dictionary outage", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("unreadable later page keeps existing words and can be retried", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");
    const requestedCursors: string[] = [];
    let laterPageAttempts = 0;
    await page.route("**/api/explore/letter-dodge/words**", async (route: Route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");
      if (!cursor) {
        await route.fulfill({ json: response([playableWord("BY")], true, "dodge-next") });
        return;
      }

      requestedCursors.push(cursor);
      laterPageAttempts += 1;
      if (laterPageAttempts <= 3) {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>Temporary error</title>",
        });
        return;
      }

      await route.fulfill({ json: response([playableWord("BARK")]) });
    });

    await page.getByRole("button", { name: "Avoid Q + X + Z" }).click();
    await expect(page.getByText("BY", { exact: true })).toBeVisible();
    await expect(page.getByText("1+ shown", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Load more matching words" }).click();
    const results = page.locator('section[aria-labelledby="dodge-results-heading"]');
    await expect(results.getByRole("alert")).toHaveText(
      "The next search page returned an incomplete or invalid response. Your existing results are still available. Retry loading more.",
    );
    await expect(page.getByText("BY", { exact: true })).toBeVisible();
    await expect(page.getByText("BARK", { exact: true })).toHaveCount(0);
    await expect(page.getByText("1+ shown", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Retry loading more matching words" }).click();
    await expect(page.getByText("BARK", { exact: true })).toBeVisible();
    await expect(page.getByText("BY", { exact: true })).toBeVisible();
    await expect(page.getByText("2 shown", { exact: true })).toBeVisible();
    await expect(results.getByRole("alert")).toHaveCount(0);
    expect(requestedCursors.length).toBeGreaterThan(1);
    expect(requestedCursors.every((cursor) => cursor === "dodge-next")).toBe(true);
  });

  test("invalid search field types show an error without rendering results", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");
    await page.route("**/api/explore/letter-dodge/words**", (route) =>
      route.fulfill({
        json: {
          items: [playableWord("BARK")],
          page: { limit: 100, hasMore: "false", nextCursor: null },
          source: "preview",
        },
      }),
    );

    await page.getByRole("button", { name: "Avoid Q + X + Z" }).click();

    await expect(page.getByRole("alert")).toContainText(
      "The search returned an incomplete or invalid response. No results were shown. Please try again.",
    );
    await expect(page.getByText("BARK", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/shown$/)).toHaveCount(0);
  });

  test("unreadable search response shows a clear error and can be retried", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExploreFromGameDetail(page, "letter-dodge");
    let allowRetry = false;
    await page.route("**/api/explore/letter-dodge/words**", async (route) => {
      if (!allowRetry) {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>Temporary error</title>",
        });
        return;
      }

      await route.fulfill({ json: response([playableWord("BARK")]) });
    });

    await page.getByRole("button", { name: "Avoid Q + X + Z" }).click();

    const searchError = "The search returned an incomplete or invalid response. No results were shown. Please try again.";
    await expect(page.getByRole("alert")).toContainText(searchError);
    await expect(page.getByText("BARK", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/shown$/)).toHaveCount(0);
    allowRetry = true;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("BARK", { exact: true })).toBeVisible();
  });
});
