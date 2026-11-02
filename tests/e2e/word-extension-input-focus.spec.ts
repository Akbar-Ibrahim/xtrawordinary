import { test, expect, type Page } from "@playwright/test";

const ROUTE = "/game/word-extension";
const PUZZLES = [
  { shownWord: "TRAIN", validAnswers: ["STRAIN", "TRAINS"] },
  { shownWord: "REACH", validAnswers: ["BREACH", "PREACH"] },
];

async function startGame(page: Page) {
  await page.goto(ROUTE);
  await page.waitForLoadState("networkidle");
  const announcementClose = page.getByTestId("button-whats-new-close");
  if (await announcementClose.isVisible()) await announcementClose.click();

  const playButton = page.getByTestId("button-play");
  if (await playButton.isVisible()) await playButton.click();

  const easyVariation = page.getByTestId("btn-variation-1");
  await expect(easyVariation).toBeVisible({ timeout: 10000 });
  await easyVariation.click();
  const input = page.getByTestId("word-input");
  await expect(input).toBeVisible();
  return input;
}

async function mockPuzzles(page: Page) {
  await page.route("**/api/games/word-extension/puzzles**", route => route.fulfill({ json: PUZZLES }));
}

test("Word Extension focuses its first answer and the next answer after a correct word", async ({ page }) => {
  await mockPuzzles(page);
  await page.route("**/api/games/word-extension/validate", route => route.fulfill({ json: { valid: true } }));
  const input = await startGame(page);
  await expect(input).toBeFocused();
  await expect(page.getByTestId("shown-word")).toHaveText("TRAIN");

  await input.fill("STRAIN");
  await input.press("Enter");

  await expect(page.getByTestId("shown-word")).toHaveText("REACH", { timeout: 5000 });
  await expect(input).toHaveValue("");
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
});

test("Word Extension returns focus after rejecting an invalid word", async ({ page }) => {
  await mockPuzzles(page);
  await page.route("**/api/games/word-extension/validate", route => route.fulfill({ json: { valid: false } }));
  const input = await startGame(page);

  await input.fill("STRAIT");
  await input.press("Enter");

  await expect(page.getByTestId("feedback-message")).toContainText("Not a valid extension");
  await expect(input).toBeEnabled();
  await expect(input).toBeFocused();
});
