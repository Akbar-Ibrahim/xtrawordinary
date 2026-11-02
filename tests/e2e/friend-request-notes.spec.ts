import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "FriendNotesTest123!";

async function createAccount(page: Page, username: string) {
  const email = `${username}@example.com`;
  const registration = await page.request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status()).toBe(201);
  const { user } = await registration.json();

  const login = await page.request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);
  return user as { id: number; username: string; name: string };
}

async function dismissWhatsNew(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

test("profile and Friends discovery requests deliver their notes to recipients", async ({ page, browser }) => {
  const uniqueSuffix = Date.now().toString(36);
  const sender = await createAccount(page, `notesen${uniqueSuffix}`);
  const profileRecipientPage = await browser.newPage();
  const discoveryRecipientPage = await browser.newPage();

  try {
    const profileRecipient = await createAccount(profileRecipientPage, `notepro${uniqueSuffix}`);
    const discoveryRecipient = await createAccount(discoveryRecipientPage, `notedis${uniqueSuffix}`);

    const profileNote = "Hi! We both enjoy the daily word games.";
    await page.goto(`/u/${profileRecipient.username}`);
    await dismissWhatsNew(page);
    await page.getByTestId("button-add-friend").click();
    const profileNoteInput = page.getByTestId("input-friend-request-note");
    await expect(profileNoteInput).toHaveAttribute("maxlength", "200");
    await profileNoteInput.fill(profileNote);
    await page.getByTestId("button-send-friend-request").click();
    await expect(page.getByText("Friend request sent!")).toBeVisible();

    await profileRecipientPage.goto("/friends?tab=requests");
    await dismissWhatsNew(profileRecipientPage);
    const profileRequestNote = profileRecipientPage.locator('[data-testid^="text-request-note-"]')
      .filter({ hasText: profileNote });
    await expect(profileRequestNote).toBeVisible();

    const discoveryNote = "Hello from the Friends page!";
    await page.goto("/friends");
    await page.getByTestId("input-discovery-friend-request-note").fill(discoveryNote);
    await page.getByTestId("input-search-friends").fill(discoveryRecipient.username);
    const discoveryRow = page.getByTestId(`row-search-result-${discoveryRecipient.id}`);
    await expect(discoveryRow).toBeVisible();
    await page.getByTestId(`button-add-${discoveryRecipient.id}`).click();
    await expect(page.getByText("Friend request sent!")).toBeVisible();

    await discoveryRecipientPage.goto("/friends?tab=requests");
    await dismissWhatsNew(discoveryRecipientPage);
    const discoveryRequestNote = discoveryRecipientPage.locator('[data-testid^="text-request-note-"]')
      .filter({ hasText: discoveryNote });
    await expect(discoveryRequestNote).toBeVisible();
    expect(sender.id).toBeGreaterThan(0);
  } finally {
    await Promise.all([
      profileRecipientPage.close(),
      discoveryRecipientPage.close(),
    ]);
  }
});
