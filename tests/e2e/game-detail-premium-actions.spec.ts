import { expect, test } from "@playwright/test";

const PASSWORD = "PremiumPrompt123!";

async function createFreeAccount(page: import("@playwright/test").Page) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const registration = await page.request.post("/api/auth/register", {
    data: {
      email: `premium_prompt_${suffix}@example.com`,
      username: `pp${suffix}`,
      password: PASSWORD,
    },
  });
  expect(registration.status()).toBe(201);

  const login = await page.request.post("/api/auth/login", {
    data: { email: `premium_prompt_${suffix}@example.com`, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  const response = await page.request.get("/api/auth/me");
  expect((await response.json()).user.isPremium).toBe(false);
}

async function dismissWhatsNew(page: import("@playwright/test").Page) {
  const dismissButton = page.getByRole("button", { name: "Got it, let's play!" });
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

test("signed-in free players see Premium actions and get an upgrade prompt", async ({ page }) => {
  await createFreeAccount(page);
  await page.goto("/");
  await dismissWhatsNew(page);

  await page.goto("/game/letter-hunt");
  await expect(page.getByTestId("button-custom-play")).toBeVisible();
  await page.getByTestId("button-custom-play").click();
  await expect(page.getByTestId("dialog-premium-feature")).toContainText("Custom Play is available to Premium members");
  await expect(page.getByRole("link", { name: "Explore Premium" })).toHaveAttribute("href", "/pricing");
  await page.getByTestId("button-dismiss-premium-prompt").click();

  await expect(page.getByTestId("button-untimed-mode")).toBeVisible();
  await page.getByTestId("button-untimed-mode").click();
  await expect(page.getByTestId("dialog-premium-feature")).toContainText("Untimed Mode is available to Premium members");
  await page.getByTestId("button-dismiss-premium-prompt").click();

  await expect(page.getByTestId("button-create-quiz")).toBeVisible();
  await page.getByTestId("button-create-quiz").click();
  await expect(page.getByTestId("dialog-premium-feature")).toContainText("Create Quiz is available to Premium members");
});
