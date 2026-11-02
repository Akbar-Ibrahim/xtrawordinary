import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "CommentProfileLinkTest123!";

type Account = { id: number; username: string };

async function createAccount(request: APIRequestContext, label: string): Promise<Account> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
  const username = `c${label.slice(0, 2)}${suffix}`;
  const email = `${username}@example.com`;

  const registration = await request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const login = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(200);

  const response = await request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  const { user } = await response.json();
  return { id: user.id, username: user.username };
}

async function dismissWhatsNew(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

test("comment mentions open the intended profile without linking unknown or email-like text", async ({
  page,
  browser,
}) => {
  const targetPage = await browser.newPage();

  try {
    const target = await createAccount(targetPage.request, "target");
    await createAccount(page.request, "author");

    const missingUsername = `missing${Date.now().toString(36)}`;
    const rawHtml = "<img src=x onerror=alert(1)>";
    const content = `**Bold text** and *italic text*: **@${target.username}** @${missingUsername} person@${target.username}.example.com ${rawHtml}`;
    const commentResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "game",
        targetId: "word-scramble",
        content,
      },
    });
    expect(commentResponse.status(), await commentResponse.text()).toBe(201);
    const comment = await commentResponse.json() as { id: number };

    await page.goto("/game/word-scramble#comments");
    await dismissWhatsNew(page);

    const discussion = page.locator("#comments");
    const commentContent = discussion.getByTestId(`comment-content-${comment.id}`);
    await expect(commentContent).toBeVisible();
    await expect(commentContent.locator("strong").first()).toHaveText("Bold text");
    await expect(commentContent.locator("em")).toHaveText("italic text");

    const mentionLink = commentContent.getByTestId(`link-comment-mention-${target.id}`);
    await expect(mentionLink).toHaveCount(1);
    await expect(mentionLink).toHaveAttribute("href", `/u/${encodeURIComponent(target.username)}`);
    await expect(commentContent.locator("a")).toHaveCount(1);
    await expect(commentContent).toContainText(`@${missingUsername}`);
    await expect(commentContent).toContainText(`person@${target.username}.example.com`);
    await expect(commentContent).toContainText(rawHtml);
    await expect(commentContent.locator("img, script")).toHaveCount(0);
    expect(await mentionLink.evaluate(link => Boolean(link.closest("strong")))).toBe(true);

    await mentionLink.click();
    await expect(page).toHaveURL(new RegExp(`/u/${target.username}$`));
    await expect(page.getByTestId("text-profile-username")).toHaveText(`@${target.username}`);
  } finally {
    await targetPage.close();
  }
});
