import { expect, test } from "@playwright/test";
import { EXPLORE_GAMES } from "../../client/src/lib/explore-games";

const expectedExplorePages: Record<string, RegExp> = {
  "word-maker": /Find the words/,
  "anagram-solver": /Find every/,
  "word-scramble": /Make sense of/,
  "letter-hunt": /Find words that meet your pattern/,
  "letter-dodge": /Which letters should words avoid/,
  "letter-position": /Find words with a letter in place/,
  "letter-frequency": /Find words by letter count/,
  "no-repeats": /Find words with no repeated letters/,
  "letter-balance": /Explore the shape of words/,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("xw_changelog_seen_v2.5", "1"));
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
});

test("main navigation links to the Explore directory", async ({ page }) => {
  await page.goto("/");

  const exploreLink = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Explore" });
  await expect(exploreLink).toHaveAttribute("href", "/explore");

  await exploreLink.click();
  await expect(page).toHaveURL("/explore");
  await expect(page.getByRole("heading", { name: /Explore the shape of a word/ })).toBeVisible();
});

test("players can reach Explore from the main navigation on a small screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const exploreLink = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Explore" });
  await expect(exploreLink).toBeInViewport();
  await exploreLink.click();

  await expect(page).toHaveURL("/explore");
  await expect(page.getByRole("heading", { name: /Explore the shape of a word/ })).toBeVisible();
});

test("the /explore route renders the directory", async ({ page }) => {
  await page.goto("/explore");

  await expect(page.getByRole("heading", { name: /Explore the shape of a word/ })).toBeVisible();
  await expect(page.getByText("ways to look at letters")).toBeVisible();
});

for (const game of EXPLORE_GAMES) {
  test(`the ${game.title} directory card opens its tool page`, async ({ page }) => {
    const expectedPath = `/explore/${game.gameSlug}`;
    const expectedHeading = expectedExplorePages[game.gameSlug];

    expect(expectedHeading, `Missing expected page heading for ${game.gameSlug}`).toBeDefined();

    await page.goto("/explore");

    const toolCard = page.getByRole("link", {
      name: `Explore ${game.title}:`,
      exact: false,
    });
    await expect(toolCard).toHaveAttribute("href", expectedPath);
    await toolCard.click();

    await expect(page).toHaveURL(expectedPath);
    await expect(page.getByRole("heading", { level: 1, name: expectedHeading })).toBeVisible();
  });
}
