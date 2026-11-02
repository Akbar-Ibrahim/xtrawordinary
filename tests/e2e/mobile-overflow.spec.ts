import { test, expect, type Locator, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 375, height: 812 };

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(
    dimensions.documentScrollWidth,
    `document is wider than the viewport: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.documentClientWidth);
  expect(
    dimensions.bodyScrollWidth,
    `body is wider than the viewport: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.bodyClientWidth);
}

async function expectHorizontallyScrollable(locator: Locator) {
  await expect(locator).toBeVisible();

  const dimensions = await locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));

  expect(dimensions.overflowX).toMatch(/auto|scroll/);
  expect(
    dimensions.scrollWidth,
    `scroll region does not have overflow: ${JSON.stringify(dimensions)}`,
  ).toBeGreaterThan(dimensions.clientWidth);
}

async function dismissWhatsNew(page: Page) {
  const dismissButton = page.getByRole("button", { name: "Got it, let's play!" });
  if (await dismissButton.isVisible()) {
    await dismissButton.click();
  }
}

test.describe("Mobile page overflow", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("home keeps shortcut overflow inside its scroll region", async ({ page }) => {
    await page.goto("/");
    await dismissWhatsNew(page);
    await expect(page.getByRole("heading", { name: "Word games worth obsessing over." })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectHorizontallyScrollable(page.getByTestId("home-shortcut-strip"));
  });

  test("game detail keeps related games overflow inside its carousel", async ({ page }) => {
    await page.goto("/game/word-scramble");
    await dismissWhatsNew(page);
    await expect(page.getByRole("heading", { name: "Word Scramble" })).toBeVisible();
    await expectNoPageOverflow(page);
    await expectHorizontallyScrollable(page.getByTestId("related-games-carousel"));
  });
});