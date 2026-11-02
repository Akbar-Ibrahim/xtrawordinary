import { test, expect } from "@playwright/test";
import { openResultGame, expectRecordedWin, holdGameIntervals, expireGameIntervals } from "./game-result-helpers";

const definitions = [{
  word: "CAT",
  definitions: ["A small pet", "A feline", "An animal that meows"],
  partOfSpeech: "noun",
}];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/games/definition-match/words**", route => route.fulfill({ json: definitions }));
  await page.route("**/api/games/word-scramble/words**", route => route.fulfill({
    json: [{ word: "CAT", category: "animals" }],
  }));
  await page.route("**/api/games/word-stack/puzzles**", route => route.fulfill({
    json: [{ targetWord: "CAT", startWord: "AT" }],
  }));
  await page.route("**/api/games/validate-word", route => route.fulfill({ json: { valid: true } }));
});

test("Definition Match does not count a revealed final answer as a win", async ({ page }) => {
  await openResultGame(page, "definition-match");
  await page.getByTestId("button-reveal-hint").click();
  await page.getByTestId("button-reveal-hint").click();
  await page.getByTestId("button-show-answer").click();
  await expect(page.getByRole("heading", { name: "Game Over", exact: true })).toBeVisible();
  await expect(page.getByText("0 of 1 definitions matched.", { exact: true })).toBeVisible();
  await expect(page.getByText("Words matched (1):", { exact: true })).toHaveCount(0);
  await expectRecordedWin(page, "definition-match", false);
});

test("Definition Match still wins when the final answer is solved", async ({ page }) => {
  await openResultGame(page, "definition-match");
  await page.getByTestId("input-answer").fill("CAT");
  await page.getByTestId("button-submit").click();
  await expect(page.getByRole("heading", { name: "Vocabulary Master!" })).toBeVisible();
  await expect(page.getByText("You matched all 1 definitions!", { exact: true })).toBeVisible();
  await expectRecordedWin(page, "definition-match", true);
});

test("Definition Match timeout records partial answers, not a win", async ({ page }) => {
  await holdGameIntervals(page);
  await openResultGame(page, "definition-match");
  await expect(page.getByTestId("input-answer")).toBeVisible();
  await expireGameIntervals(page, 181);
  await expect(page.getByTestId("banner-times-up")).toBeVisible();
  await expectRecordedWin(page, "definition-match", false);
});

test("Word Scramble does not win after skipping the last word with lives left", async ({ page }) => {
  await openResultGame(page, "word-scramble");
  await page.getByTestId("button-skip").click();
  await expect(page.getByRole("heading", { name: "Game Over", exact: true })).toBeVisible();
  await expect(page.getByText(/You solved 0 of 1 words/)).toBeVisible();
  await expectRecordedWin(page, "word-scramble", false);
});

test("Word Scramble still wins after solving every word", async ({ page }) => {
  await openResultGame(page, "word-scramble");
  await page.getByTestId("input-answer").fill("CAT");
  await page.getByTestId("button-submit").click();
  await expect(page.getByRole("heading", { name: "Champion!", exact: true })).toBeVisible();
  await expectRecordedWin(page, "word-scramble", true);
});

test("Word Stack ending early does not claim all puzzles were completed", async ({ page }) => {
  await openResultGame(page, "word-stack");
  await page.getByTestId("button-challenge-build-up").click();
  await page.getByTestId("button-end-game").click();
  await expect(page.getByRole("heading", { name: "Session Ended" })).toBeVisible();
  await expect(page.getByText("Puzzles Completed: 0 of 1", { exact: true })).toBeVisible();
  await expectRecordedWin(page, "word-stack", false);
});

test("Word Stack still celebrates a genuinely completed puzzle set", async ({ page }) => {
  await openResultGame(page, "word-stack");
  await page.getByTestId("button-challenge-build-up").click();
  const input = page.getByTestId("input-word");
  await input.fill("AT");
  await page.getByTestId("button-submit").click();
  await expect(input).toHaveValue("");
  await input.fill("CAT");
  await page.getByTestId("button-submit").click();
  await expect(page.getByRole("heading", { name: "All Puzzles Complete!" })).toBeVisible();
  await expectRecordedWin(page, "word-stack", true);
});
