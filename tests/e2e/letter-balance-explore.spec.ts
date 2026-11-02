import { test, expect, type Route } from "@playwright/test";
import { fulfillExploreFallback } from "./explore-api-fixture";

const game = {
  id: 11,
  slug: "letter-balance",
  name: "Vowel & Consonant",
  description: "Find words matching vowel and consonant patterns.",
  longDescription: "Explore word structure.",
  rules: ["Use the selected vowel and consonant rule."],
  difficulty: "medium",
  estimatedTime: "8-12 min",
  icon: "Type",
  color: "#8b5cf6",
  playCount: 0,
  modes: [],
};

function getCounts(word: string) {
  const vowelCount = [...word].filter((letter) => "AEIOU".includes(letter)).length;
  return { length: word.length, vowelCount, consonantCount: word.length - vowelCount };
}

function matches(word: string, request: Record<string, unknown>) {
  const stats = getCounts(word);
  if (request.length !== undefined && stats.length !== request.length) return false;
  switch (request.category) {
    case "vowel_count": return stats.vowelCount === request.count;
    case "consonant_count": return stats.consonantCount === request.count;
    case "start_end_vowel": return "AEIOU".includes(word[0]) && "AEIOU".includes(word.at(-1)!);
    case "start_end_consonant": return !"AEIOU".includes(word[0]) && !"AEIOU".includes(word.at(-1)!);
    case "start_vowel_end_consonant": return "AEIOU".includes(word[0]) && !"AEIOU".includes(word.at(-1)!);
    case "start_consonant_end_vowel": return !"AEIOU".includes(word[0]) && "AEIOU".includes(word.at(-1)!);
    case "locked_balance":
      return stats.length === request.length && stats.consonantCount === request.consonantCount;
    default: return false;
  }
}

test("Vowel & Consonant Explore opens from game details and keeps browse and checks aligned", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("xw_changelog_seen_v2.5", "1"));

  await page.route("**/api/**", fulfillExploreFallback);
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: null } }));
  await page.route("**/api/games", (route) => route.fulfill({ json: [game] }));
  await page.route("**/api/games/letter-balance", (route) => route.fulfill({ json: game }));
  await page.route("**/api/likes**", (route) => route.fulfill({ json: { counts: {}, likedByMe: {} } }));

  const searches: URLSearchParams[] = [];
  const checks: Record<string, unknown>[] = [];
  const previewWords = ["A", "AN", "AT", "ACE", "AGE", "ATE", "BOOK", "CAT", "SKY", "TREE"];

  await page.route("**/api/explore/letter-balance/words**", async (route: Route) => {
    const params = new URL(route.request().url()).searchParams;
    searches.push(params);
    const request: Record<string, unknown> = Object.fromEntries(params.entries());
    for (const key of ["count", "length", "consonantCount"]) {
      if (request[key] !== undefined) request[key] = Number(request[key]);
    }
    const words = previewWords.filter((word) => matches(word, request));
    await route.fulfill({
      json: {
        items: words.map((word) => ({ word })),
        page: { limit: 100, hasMore: false, nextCursor: null },
        source: "preview",
      },
    });
  });

  await page.route("**/api/explore/letter-balance/check", async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    checks.push(body);
    const word = String(body.word).toUpperCase();
    const dictionaryMatch = previewWords.includes(word);
    await route.fulfill({
      json: {
        word,
        dictionaryMatch,
        constraintMatch: dictionaryMatch && matches(word, body),
        source: "preview",
      },
    });
  });

  await page.goto("/game/letter-balance");
  await page.getByTestId("button-explore-letter-balance").click();
  await expect(page).toHaveURL("/explore/letter-balance");

  await page.getByLabel("Exact count").fill("1");
  await page.getByRole("button", { name: "Browse words" }).click();
  await expect(page.getByText("A", { exact: true })).toBeVisible();
  await expect(page.getByText("AT", { exact: true })).toBeVisible();
  expect(searches[0].get("category")).toBe("vowel_count");
  expect(searches[0].get("count")).toBe("1");
  expect(searches[0].has("length")).toBe(false);

  const answer = page.getByRole("textbox", { name: "Word to check" });
  await answer.fill("cat");
  await expect(answer).toHaveValue("CAT");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText("This dictionary word matches the selected rule.")).toBeVisible();
  expect(checks[0]).toMatchObject({ word: "CAT", category: "vowel_count", count: 1 });

  await page.getByLabel("Word pattern").selectOption("start_end_vowel");
  await page.getByLabel("Word length").fill("3");
  await page.getByRole("button", { name: "Browse words" }).click();
  await expect(page.getByText("ACE", { exact: true })).toBeVisible();
  await expect(page.getByText("ATE", { exact: true })).toBeVisible();
  expect(searches[1].get("category")).toBe("start_end_vowel");
  expect(searches[1].get("length")).toBe("3");

  await answer.fill("ate");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText("This dictionary word matches the selected rule.")).toBeVisible();
  expect(checks[1]).toMatchObject({ word: "ATE", category: "start_end_vowel", length: 3 });

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});
