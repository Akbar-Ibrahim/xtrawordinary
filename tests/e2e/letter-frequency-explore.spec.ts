import { test, expect, type Route } from "@playwright/test";
import { fulfillExploreFallback } from "./explore-api-fixture";

const game = {
  id: 12,
  slug: "letter-frequency",
  name: "Letter Frequency",
  description: "Find words with a chosen letter count.",
  longDescription: "Find words where letters occur a specific number of times.",
  rules: ["Match the selected letter counts."],
  difficulty: "hard",
  estimatedTime: "6-10 min",
  icon: "Hash",
  color: "#ec4899",
  playCount: 0,
  modes: [],
};

test("Letter Frequency Explore supports single and Multi-Letter browse and word checks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("xw_changelog_seen_v2.5", "1"));

  await page.route("**/api/**", fulfillExploreFallback);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/api/games", (route) => route.fulfill({ json: [game] }));
  await page.route("**/api/games/letter-frequency", (route) => route.fulfill({ json: game }));
  await page.route("**/api/likes**", (route) => route.fulfill({ json: { counts: {}, likedByMe: {} } }));

  const searches: Array<{ constraints: Array<{ letter: string; count: number }>; match: string }> = [];
  const checks: Record<string, unknown>[] = [];
  await page.route("**/api/explore/letter-frequency/words**", async (route: Route) => {
    const url = new URL(route.request().url());
    const request = {
      constraints: JSON.parse(url.searchParams.get("constraints") ?? "[]"),
      match: url.searchParams.get("match") ?? "",
    };
    searches.push(request);
    const word = request.constraints.length > 1
      ? "ABBREVIATION"
      : request.match === "minimum"
        ? "MISSISSIPPI"
        : "LETTER";
    await route.fulfill({
      json: {
        items: [{ word }],
        page: { limit: 100, hasMore: false, nextCursor: null },
        source: "preview",
      },
    });
  });
  await page.route("**/api/explore/letter-frequency/check", async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    checks.push(body);
    await route.fulfill({
      json: {
        word: body.word,
        dictionaryMatch: true,
        constraintMatch: true,
        source: "preview",
      },
    });
  });

  await page.goto("/game/letter-frequency");
  await page.getByTestId("button-explore-letter-frequency").click();
  await expect(page).toHaveURL("/explore/letter-frequency");
  await expect(page.getByRole("heading", { name: "Find words by letter count." })).toBeVisible();

  await page.getByRole("button", { name: "Find words" }).first().click();
  await expect(page.getByText("LETTER", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Word to check" }).fill("letter");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText("This dictionary word matches the selected frequency rule.")).toBeVisible();
  expect(searches[0]).toMatchObject({ constraints: [{ letter: "E", count: 2 }], match: "exact" });
  expect(checks[0]).toMatchObject({ word: "LETTER", constraints: [{ letter: "E", count: 2 }] });

  await page.getByRole("button", { name: "Multi-Letter" }).click();
  await expect(page.getByRole("textbox", { name: "Word to check" })).toHaveValue("LETTER");
  await page.getByRole("button", { name: "Find words" }).last().click();
  await expect(page.getByText("ABBREVIATION", { exact: true })).toBeVisible();
  expect(searches[1]).toMatchObject({
    constraints: [{ letter: "A", count: 2 }, { letter: "E", count: 1 }],
    match: "exact",
  });
  await page.getByRole("textbox", { name: "Word to check" }).fill("abbreviation");
  await page.getByRole("button", { name: "Check word" }).click();
  expect(checks[1]).toMatchObject({ word: "ABBREVIATION", match: "exact" });

  await page.getByRole("button", { name: "Single letter" }).click();
  await page.getByLabel("Letter", { exact: true }).selectOption("S");
  await page.getByLabel("Count", { exact: true }).selectOption("4");
  await page.getByLabel("Match type", { exact: true }).selectOption("minimum");
  await page.getByRole("button", { name: "Find words" }).first().click();
  await expect(page.getByText("MISSISSIPPI", { exact: true })).toBeVisible();
  expect(searches[2]).toMatchObject({ constraints: [{ letter: "S", count: 4 }], match: "minimum" });

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});
