import { expect, test, type Route } from "@playwright/test";

const emptyPage = {
  limit: 100,
  nextCursor: null,
  hasMore: false,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("xw_changelog_seen_v2.5", "1"));
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
});

test("Unscramble results remain visible when the input is cleared, then update on a new search", async ({ page }) => {
  await page.route("**/api/explore/unscramble/examples**", (route) =>
    route.fulfill({ json: { items: [], source: "preview" } }),
  );
  await page.route("**/api/explore/unscramble/solve", async (route: Route) => {
    const request = route.request().postDataJSON() as { letters: string };
    const result = request.letters === "LISTEN"
      ? ["LISTEN", "SILENT"]
      : ["EAST", "EATS", "SEAT", "TEAS"];

    await route.fulfill({
      json: {
        input: request.letters,
        items: result,
        hasMore: false,
        nextCursor: null,
        source: "preview",
      },
    });
  });

  await page.goto("/explore/word-scramble");
  const input = page.getByRole("textbox", { name: "Scrambled letters" });
  await input.fill("listen");
  await page.getByRole("button", { name: "Find matching words" }).click();
  await expect(page.getByText("SILENT", { exact: true })).toBeVisible();

  await input.fill("");
  await expect(page.getByText("SILENT", { exact: true })).toBeVisible();

  await input.fill("east");
  await page.getByRole("button", { name: "Find matching words" }).click();
  await expect(page.getByText("SEAT", { exact: true })).toBeVisible();
  await expect(page.getByText("SILENT", { exact: true })).toHaveCount(0);
});

test("Anagram results remain visible while the next base-word search is being edited", async ({ page }) => {
  await page.route("**/api/explore/anagrams/base-words**", async (route: Route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    await route.fulfill({
      json: {
        items: query?.toUpperCase() === "HEART" ? [{ baseWord: "HEART" }] : [],
        page: { limit: 20, nextCursor: null, hasMore: false },
        source: "preview",
      },
    });
  });
  await page.route("**/api/explore/anagrams/words**", async (route: Route) => {
    const baseWord = new URL(route.request().url()).searchParams.get("baseWord") ?? "";
    await route.fulfill({
      json: {
        baseWord,
        items: [{ word: "EARTH" }, { word: "HATER" }],
        page: emptyPage,
        source: "preview",
      },
    });
  });

  await page.goto("/explore/anagram-solver");
  const input = page.getByRole("combobox", { name: "Base word" });
  await input.fill("HEART");
  await page.getByRole("option", { name: /HEART/i }).click();
  await expect(page.getByText("EARTH", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Host a game night" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Reveal all matching words/ })).toHaveCount(0);

  await input.fill("");
  await expect(page.getByText("EARTH", { exact: true })).toBeVisible();
});

test("Word Maker results remain visible while the next base-word search is being edited", async ({ page }) => {
  await page.route("**/api/explore/word-maker/base-words**", async (route: Route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    await route.fulfill({
      json: {
        items: query ? [{ baseWord: "PAINTING" }] : [],
        page: { limit: 20, nextCursor: null, hasMore: false },
      },
    });
  });
  await page.route("**/api/explore/word-maker/words**", async (route: Route) => {
    const baseWord = new URL(route.request().url()).searchParams.get("baseWord") ?? "";
    await route.fulfill({
      json: {
        baseWord,
        items: [{ word: "NAG", playableInGame: true, gameplayExclusion: null }],
        page: emptyPage,
        source: "preview",
      },
    });
  });

  await page.goto("/explore/word-maker");
  const input = page.getByRole("combobox", { name: "Base word" });
  await input.fill("PAINT");
  await page.getByRole("option", { name: /PAINTING/i }).click();
  await expect(page.getByText("NAG", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Host a game night" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Reveal all possible words/ })).toHaveCount(0);

  await input.fill("");
  await expect(page.getByText("NAG", { exact: true })).toBeVisible();
});
