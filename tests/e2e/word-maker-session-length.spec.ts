import { test, expect } from "@playwright/test";
import { openResultGame } from "./game-result-helpers";

const wordSets = [
  "CATONE",
  "CATPEN",
  "CATFISH",
  "CATNIP",
  "CATWALK",
  "CATBIRD",
  "CATNAP",
].map((baseWord) => ({ baseWord, derivatives: ["CAT"], maxWords: 1 }));

test("Word Maker ends after five completed base-word rounds", async ({ page }) => {
  await page.route("**/api/games/word-maker/words", route => route.fulfill({ json: wordSets }));
  await openResultGame(page, "word-maker");

  const rounds = page.getByTestId("badge-rounds");
  const input = page.getByTestId("input-word");
  await expect(rounds).toContainText("0 / 5 rounds");

  for (let completed = 1; completed <= 5; completed++) {
    await input.fill("CAT");
    await page.getByTestId("button-submit").click();
    await expect(rounds).toContainText(`${completed} / 5 rounds`);
    if (completed < 5) {
      await expect(page.getByText("0 / 1 words", { exact: true })).toBeVisible();
    }
  }

  await expect(page.getByRole("heading", { name: "Word Maker Champion!" })).toBeVisible();
});
