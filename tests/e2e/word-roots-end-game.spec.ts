import { test, expect, type Page } from "@playwright/test";

/**
 * E2E regression tests for Word Roots end-game messaging and result-screen stats.
 *
 * End-game message matrix:
 *   gameStatus === "won"                   → "Well Done!"
 *   gameStatus === "lost" && timedOut      → "Time's Up!"
 *   gameStatus === "lost" && !timedOut     → "Game Over"
 *
 * Stat-accuracy test verifies that roundResults accumulation, canonical counting,
 * and score addition are all correct after completing 2 rounds (one canonical,
 * one non-canonical valid word) before ending the game early.
 *
 * Relevant component: client/src/components/games/word-roots.tsx
 *   Scoring constants: BASE_POINTS = 100, BONUS_POINTS = 50
 *   Result-screen stat testids: stat-rounds-won, stat-exact-matches, stat-total-score
 */

const ROUTE = "/game/word-roots";

const KNOWN_PUZZLES = [
  {
    canonicalWord: "FANTASTIC",
    derivatives: ["FIST", "CAST", "FACT", "STAIN", "ANTICS"],
  },
  {
    canonicalWord: "CHALLENGE",
    derivatives: ["LANE", "HALL", "HANG", "ANGEL", "ANGLE"],
  },
  {
    canonicalWord: "BIRTHDAY",
    derivatives: ["TIDY", "DART", "DIRTY", "TARDY", "HABIT"],
  },
  {
    canonicalWord: "CONFIDENT",
    derivatives: ["NICE", "DIET", "EDIT", "FIND", "COIN"],
  },
  {
    canonicalWord: "BEAUTIFUL",
    derivatives: ["TAIL", "TABLE", "BUILT", "FABLE", "FLUTE"],
  },
];

/**
 * Puzzles for the stat-accuracy test.
 *
 * Round 1 — canonical word "FANTASTIC":
 *   FANTASTIC (F,A,N,T,A,S,T,I,C) covers FIST, CAST, FACT, STAIN, ANTICS → 150 pts
 *
 * Round 2 — canonical word "TRANSPORT", non-canonical answer "SEAPORT":
 *   SEAPORT (S,E,A,P,O,R,T) covers TRAP, STAR, PART, PORT but ≠ "TRANSPORT" → 100 pts
 *
 * Rounds 3-5 are padding (never reached; we End Game after round 2 completes).
 */
const STAT_TEST_PUZZLES = [
  {
    canonicalWord: "FANTASTIC",
    derivatives: ["FIST", "CAST", "FACT", "STAIN", "ANTICS"],
  },
  {
    canonicalWord: "TRANSPORT",
    derivatives: ["TRAP", "STAR", "PART", "PORT"],
  },
  { canonicalWord: "COMPUTER",  derivatives: ["CORE", "COPE", "ROPE", "MOPE"] },
  { canonicalWord: "BIRTHDAY",  derivatives: ["TIDY", "DART", "HABIT", "TARDY"] },
  { canonicalWord: "CHAMPION",  derivatives: ["PAIN", "MAIN", "ICON", "INCH"] },
];

async function startGame(page: Page) {
  await page.goto(ROUTE);
  await page.waitForLoadState("networkidle");
  const playBtn = page.getByTestId("button-play");
  if (await playBtn.isVisible()) {
    await playBtn.click();
  }
  await expect(page.getByTestId("input-word")).toBeVisible({ timeout: 8000 });
}

test.describe("Word Roots end-game messages", () => {
  test.describe.configure({ mode: "serial" });

  test('"Game Over" appears when End Game button is clicked mid-game', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    await startGame(page);

    await page.getByTestId("button-end-game").click();

    await expect(
      page.getByText("Game Over", { exact: true })
    ).toBeVisible({ timeout: 4000 });

    await expect(page.getByText("Time's Up!")).not.toBeVisible();
    await expect(page.getByText("Well Done!")).not.toBeVisible();
    await expect(page.getByTestId("button-play-again")).toBeVisible();
  });

  test('"Well Done!" appears after completing all 5 rounds', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.route("**/api/games/word-roots/puzzles**", async (route) => {
      await route.fulfill({ json: KNOWN_PUZZLES });
    });

    await startGame(page);

    for (const puzzle of KNOWN_PUZZLES) {
      await expect(page.getByTestId("input-word")).toBeVisible({
        timeout: 6000,
      });
      await page.getByTestId("input-word").fill(puzzle.canonicalWord);
      await page.getByTestId("button-submit").click();
      await page.waitForTimeout(2000);
    }

    await expect(
      page.getByText("Well Done!", { exact: true })
    ).toBeVisible({ timeout: 6000 });

    await expect(page.getByText("Time's Up!")).not.toBeVisible();
    await expect(page.getByText("Game Over")).not.toBeVisible();
    await expect(page.getByTestId("button-play-again")).toBeVisible();
  });

  test('"Time\'s Up!" appears when the timer expires', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.route("**/api/games/word-roots", async (route) => {
      if (route.request().url().includes("/api/games/word-roots/")) {
        return route.continue();
      }
      const response = await route.fetch();
      const game = await response.json();
      await route.fulfill({ json: { ...game, timeLimitSeconds: 4 } });
    });

    await startGame(page);

    await expect(page.getByTestId("badge-timer")).toBeVisible();

    await page.waitForTimeout(6000);

    await expect(
      page.getByText("Time's Up!", { exact: true })
    ).toBeVisible({ timeout: 4000 });

    await expect(page.getByText("Well Done!")).not.toBeVisible();
    await expect(page.getByText("Game Over")).not.toBeVisible();
    await expect(page.getByTestId("button-play-again")).toBeVisible();
  });
});

test.describe("Word Roots result-screen stat accuracy", () => {
  /**
   * Completes 2 rounds then ends game early:
   *   Round 1: "FANTASTIC" (canonical) → 150 pts, isCanonical = true
   *   Round 2: "SEAPORT"  (valid, non-canonical) → 100 pts, isCanonical = false
   *
   * Expected stats on result screen:
   *   Rounds won    = 2   (roundResults.length)
   *   Exact matches = 1   (roundResults.filter(r => r.canonical).length)
   *   Total score   = 250 (150 + 100)
   */
  test("2 rounds (1 canonical + 1 non-canonical) show correct counts and score", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.route("**/api/games/word-roots/puzzles**", async (route) => {
      await route.fulfill({ json: STAT_TEST_PUZZLES });
    });

    // Accept any submitted word as dictionary-valid so SEAPORT is not rejected
    await page.route("**/api/games/validate-word**", async (route) => {
      await route.fulfill({ json: { valid: true } });
    });

    await startGame(page);

    // ── Round 1: submit canonical word ──
    // "FANTASTIC" (F,A,N,T,A,S,T,I,C) covers FIST, CAST, FACT, STAIN, ANTICS
    await expect(page.getByTestId("input-word")).toBeVisible({ timeout: 6000 });
    await page.getByTestId("input-word").fill("FANTASTIC");
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("feedback-message")).toBeVisible({ timeout: 4000 });
    await expect(page.getByTestId("feedback-message")).toContainText("Exact match");
    await page.waitForTimeout(2000); // wait for auto-advance to round 2

    // ── Round 2: submit non-canonical valid word ──
    // "SEAPORT" (S,E,A,P,O,R,T) covers TRAP, STAR, PART, PORT — but ≠ "TRANSPORT"
    await expect(page.getByTestId("input-word")).toBeVisible({ timeout: 6000 });
    await page.getByTestId("input-word").fill("SEAPORT");
    await page.getByTestId("button-submit").click();
    await expect(page.getByTestId("feedback-message")).toBeVisible({ timeout: 4000 });
    await expect(page.getByTestId("feedback-message")).toContainText("Valid word");
    await page.waitForTimeout(2000); // wait for auto-advance to round 3

    // ── End the game after 2 completed rounds ──
    await expect(page.getByTestId("button-end-game")).toBeVisible({ timeout: 4000 });
    await page.getByTestId("button-end-game").click();

    // ── Verify result screen ──
    await expect(page.getByText("Game Over", { exact: true })).toBeVisible({ timeout: 4000 });

    await expect(page.getByTestId("stat-rounds-won")).toHaveText("2");
    await expect(page.getByTestId("stat-exact-matches")).toHaveText("1");
    await expect(page.getByTestId("stat-total-score")).toHaveText("250");

    // Score in the main summary header should also read 250 pts
    await expect(page.getByText("250 pts")).toBeVisible();
  });
});
