import { test, expect, type Route } from "@playwright/test";
import { fulfillExploreFallback } from "./explore-api-fixture";

const game = {
  id: 1,
  slug: "letter-position",
  name: "Letter Position",
  description: "Find words with a letter in its correct position.",
  longDescription: "Choose a letter and position.",
  rules: ["Place the letter at the selected position."],
  difficulty: "medium",
  estimatedTime: "5 minutes",
  icon: "MapPin",
  color: "#eab308",
  playCount: 0,
  modes: [],
};

test("Letter Position Explore opens from game details and keeps browse and checks aligned", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => localStorage.setItem("xw_changelog_seen_v2.5", "1"));

  await page.route("**/api/**", fulfillExploreFallback);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/api/games", (route) => route.fulfill({ json: [game] }));
  await page.route("**/api/games/letter-position", (route) => route.fulfill({ json: game }));
  await page.route("**/api/likes**", (route) => route.fulfill({ json: { counts: {}, likedByMe: {} } }));

  const searches: URL[] = [];
  const checks: Record<string, unknown>[] = [];
  await page.route("**/api/explore/letter-position/words**", async (route: Route) => {
    const url = new URL(route.request().url());
    searches.push(url);
    const word = url.searchParams.get("letter") === "C" ? "ACE" : "CABLE";
    await route.fulfill({
      json: {
        items: [{ word, playableInGame: true, gameplayExclusion: null }],
        page: { limit: 100, hasMore: false, nextCursor: null },
        source: "preview",
      },
    });
  });
  await page.route("**/api/explore/letter-position/check", async (route: Route) => {
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

  await page.goto("/game/letter-position");
  await page.getByTestId("button-explore-letter-position").click();
  await expect(page).toHaveURL("/explore/letter-position");

  const letterInput = page.getByLabel("Required letter");
  const positionSelect = page.getByLabel("Position");
  await letterInput.fill("a");
  await expect(letterInput).toHaveValue("A");
  await positionSelect.selectOption("2");
  await page.getByRole("button", { name: "Find words" }).click();
  await expect(page.getByText("CABLE", { exact: true })).toBeVisible();

  await page.getByRole("textbox", { name: "Word to check" }).fill("cable");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText("This dictionary word meets the selected Letter Position rule.")).toBeVisible();
  expect(searches[0].searchParams.get("letter")).toBe("A");
  expect(searches[0].searchParams.get("position")).toBe("2");
  expect(checks[0]).toMatchObject({ word: "CABLE", letter: "A", position: 2 });

  await letterInput.fill("C");
  await page.getByRole("button", { name: "Find words" }).click();
  await expect(page.getByText("ACE", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Word to check" }).fill("ace");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText("This dictionary word meets the selected Letter Position rule.")).toBeVisible();
  expect(checks[1]).toMatchObject({ word: "ACE", letter: "C", position: 2 });

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});
