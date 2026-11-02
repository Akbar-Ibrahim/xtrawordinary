import { test, expect, type Route } from "@playwright/test";
import { fulfillExploreFallback } from "./explore-api-fixture";

const game = {
  id: 14,
  slug: "no-repeats",
  name: "No Repeats: Isogram",
  description: "Find isogram words with no repeated letters.",
  longDescription: "Every word must have unique letters.",
  rules: ["No letter may appear more than once."],
  difficulty: "medium",
  estimatedTime: "5-8 min",
  icon: "Fingerprint",
  color: "#14b8a6",
  playCount: 0,
  modes: [],
};

test("No Repeats Explore browses isograms and checks words with the same filters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("xw_changelog_seen_v2.5", "1"));

  await page.route("**/api/**", fulfillExploreFallback);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/api/games", (route) => route.fulfill({ json: [game] }));
  await page.route("**/api/games/no-repeats", (route) => route.fulfill({ json: game }));
  await page.route("**/api/likes**", (route) => route.fulfill({ json: { counts: {}, likedByMe: {} } }));

  const searches: Array<{ length: string | null; requiredLetters: string | null }> = [];
  const checks: Record<string, unknown>[] = [];
  await page.route("**/api/explore/no-repeats/words**", async (route: Route) => {
    const url = new URL(route.request().url());
    const request = {
      length: url.searchParams.get("length"),
      requiredLetters: url.searchParams.get("requiredLetters"),
    };
    searches.push(request);
    const words = request.length === "3" && request.requiredLetters === "CT"
      ? ["ACT", "CAT"]
      : ["A", "ACE", "ACT", "CAT"];
    await route.fulfill({
      json: {
        items: words.map((word) => ({ word })),
        page: { limit: 100, hasMore: false, nextCursor: null },
        source: "preview",
      },
    });
  });
  await page.route("**/api/explore/no-repeats/check", async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    checks.push(body);
    const word = String(body.word);
    const filtersMatch =
      (body.length === undefined || word.length === body.length)
      && [...String(body.requiredLetters ?? "")].every((letter) => word.includes(letter));
    await route.fulfill({
      json: {
        word,
        dictionaryMatch: true,
        constraintMatch: new Set(word).size === word.length && filtersMatch,
        source: "preview",
      },
    });
  });

  await page.goto("/game/no-repeats");
  await page.getByTestId("button-explore-no-repeats").click();
  await expect(page).toHaveURL("/explore/no-repeats");
  await page.getByRole("button", { name: "Find words" }).click();
  await expect(page.getByText("A", { exact: true })).toBeVisible();
  await expect(page.getByText("CAT", { exact: true })).toBeVisible();
  await expect(page.getByText("LETTER", { exact: true })).toHaveCount(0);

  const answer = page.getByRole("textbox", { name: "Word to check" });
  await answer.fill("cat");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText("This dictionary word is an isogram and matches the selected filters.")).toBeVisible();
  expect(checks[0]).toMatchObject({ word: "CAT", requiredLetters: "" });

  await answer.fill("letter");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText("This dictionary word repeats a letter or does not match the selected filters.")).toBeVisible();

  await page.getByLabel("Word length", { exact: true }).selectOption("3");
  const requiredLetters = page.getByLabel("Required letters", { exact: true });
  await requiredLetters.fill("tc");
  await expect(requiredLetters).toHaveValue("TC");
  await expect(answer).toHaveValue("LETTER");
  await page.getByRole("button", { name: "Find words" }).click();
  await expect(page.getByText("ACT", { exact: true })).toBeVisible();
  await expect(page.getByText("CAT", { exact: true })).toBeVisible();
  expect(searches[1]).toEqual({ length: "3", requiredLetters: "TC" });

  await answer.fill("cat");
  await page.getByRole("button", { name: "Check word" }).click();
  expect(checks[2]).toMatchObject({ word: "CAT", length: 3, requiredLetters: "TC" });

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});
