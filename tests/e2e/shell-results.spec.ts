import { test, expect, type Page } from "@playwright/test";
import { openResultGame, expectRecordedWin } from "./game-result-helpers";

async function startCrack(page: Page, slug: string) {
  await page.route(`**/api/games/${slug}/crack?**`, route => {
    const seed = Number(new URL(route.request().url()).searchParams.get("seed"));
    const first = String.fromCharCode(65 + seed % 26);
    return route.fulfill({ json: { first, last: "S" } });
  });
  await page.route(`**/api/games/${slug}/validate?**`, route => route.fulfill({
    json: { valid: true, innerWord: "CAT" },
  }));
  await openResultGame(page, slug);
  await page.getByTestId("button-variation-crack").click();
  await page.getByTestId("button-start-game").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
}

for (const slug of ["shell-words", "deep-shell-words"]) {
  test(`${slug}: skipping every Classic Crack round is not a win`, async ({ page }) => {
    await startCrack(page, slug);
    for (let round = 1; round <= 10; round++) {
      await expect(page.getByTestId("text-round-progress")).toHaveText(`${round} / 10`);
      await page.getByTestId("button-skip").click();
    }
    await expect(page.getByRole("heading", { name: "Game Over!", exact: true })).toBeVisible();
    await expect(page.getByText("Run ended. You found 0 words.", { exact: true })).toBeVisible();
    await expectRecordedWin(page, `${slug}-crack`, false);
  });

  test(`${slug}: solving all Classic Crack rounds is a win`, async ({ page }) => {
    await startCrack(page, slug);
    for (let round = 1; round <= 10; round++) {
      await expect(page.getByTestId("text-round-progress")).toHaveText(`${round} / 10`);
      await page.getByTestId("input-word").fill("CAT");
      await page.getByTestId("button-submit").click();
    }
    await expect(page.getByRole("heading", { name: "All Rounds Solved!" })).toBeVisible();
    await expectRecordedWin(page, `${slug}-crack`, true);
  });
}
