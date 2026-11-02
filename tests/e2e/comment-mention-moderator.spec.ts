import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const PASSWORD = "ModeratorCommentMentionTest123!";
const ADMIN_EMAIL = "creator-pin-admin@example.com";

type Account = { id: number; username: string };

async function registerAccount(request: APIRequestContext, label: string): Promise<Account> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const username = `m${label.slice(0, 3)}${suffix}`;
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

async function loginOrRegisterAdmin(context: BrowserContext): Promise<void> {
  const login = await context.request.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: PASSWORD },
  });

  if (login.status() !== 200) {
    const registration = await context.request.post("/api/auth/register", {
      data: { email: ADMIN_EMAIL, username: "commentmoderator", password: PASSWORD },
    });
    expect([201, 409], await registration.text()).toContain(registration.status());

    const retryLogin = await context.request.post("/api/auth/login", {
      data: { email: ADMIN_EMAIL, password: PASSWORD },
    });
    expect(retryLogin.status(), await retryLogin.text()).toBe(200);
  }

  const response = await context.request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  const { user } = await response.json();
  expect(user.isAdmin).toBe(true);
}

async function dismissWhatsNew(page: Page): Promise<void> {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

test("reported comment mentions link to profiles while unresolved text and raw HTML stay inert", async ({
  browser,
  page,
}) => {
  const targetContext = await browser.newContext();
  const authorContext = await browser.newContext();
  const reporterContext = await browser.newContext();

  try {
    const target = await registerAccount(targetContext.request, "target");
    const author = await registerAccount(authorContext.request, "author");
    await registerAccount(reporterContext.request, "reporter");
    await loginOrRegisterAdmin(page.context());

    const unknownUsername = `missing${Date.now().toString(36)}`;
    const emailLikeText = `person@${target.username}.example.com`;
    const rawHtml = "<img src=x onerror=alert(1)>";
    const content = `Hello @${target.username}, @${unknownUsername}, ${emailLikeText} ${rawHtml}`;

    const commentResponse = await authorContext.request.post("/api/comments", {
      data: { targetType: "game", targetId: "word-scramble", content },
    });
    expect(commentResponse.status(), await commentResponse.text()).toBe(201);
    const comment = await commentResponse.json() as { id: number };

    const reportResponse = await reporterContext.request.post(`/api/comments/${comment.id}/report`, {
      data: { reason: "Review mention rendering" },
    });
    expect(reportResponse.status(), await reportResponse.text()).toBe(201);

    await page.goto("/admin");
    await dismissWhatsNew(page);
    await expect(page.getByTestId("text-admin-title")).toBeVisible();
    await page.getByTestId("tab-comments").click();

    const reportRow = page.locator(`[data-testid^="report-row-"]`).filter({ hasText: "Review mention rendering" });
    await expect(reportRow).toBeVisible();

    const mentionLink = reportRow.getByTestId(`link-comment-mention-${target.id}`);
    await expect(mentionLink).toHaveCount(1);
    await expect(mentionLink).toHaveText(`@${target.username}`);
    await expect(mentionLink).toHaveAttribute("href", `/u/${encodeURIComponent(target.username)}`);
    await expect(reportRow.locator("a")).toHaveCount(1);
    await expect(reportRow).toContainText(`@${unknownUsername}`);
    await expect(reportRow).toContainText(emailLikeText);
    await expect(reportRow).toContainText(rawHtml);
    await expect(reportRow.locator("img, script")).toHaveCount(0);

    await mentionLink.click();
    await expect(page).toHaveURL(new RegExp(`/u/${target.username}$`));
    await expect(page.getByTestId("text-profile-username")).toHaveText(`@${target.username}`);

    await page.goto("/admin");
    await dismissWhatsNew(page);
    await expect(page.getByTestId("text-admin-title")).toBeVisible();
    await page.getByTestId("tab-comments").click();

    const refreshedReportRow = page.locator(`[data-testid^="report-row-"]`).filter({ hasText: "Review mention rendering" });
    await expect(refreshedReportRow).toBeVisible();
    await refreshedReportRow.getByTestId(`button-delete-reported-${comment.id}`).click();
    await expect(refreshedReportRow).toContainText("[Already deleted]");
    await expect(refreshedReportRow).not.toContainText(content);
    await expect(refreshedReportRow.getByTestId(`link-comment-mention-${target.id}`)).toHaveCount(0);
    await expect(refreshedReportRow.locator("a")).toHaveCount(0);

    const reportsResponse = await page.context().request.get("/api/admin/comments/reported");
    expect(reportsResponse.status(), await reportsResponse.text()).toBe(200);
    const reports = await reportsResponse.json() as Array<{
      reason: string;
      comment?: { content: string; isDeleted: boolean; mentionedUsers?: unknown[] };
    }>;
    const deletedReport = reports.find((report) => report.reason === "Review mention rendering");
    expect(deletedReport?.comment).toMatchObject({ content: "", isDeleted: true, mentionedUsers: [] });
  } finally {
    await targetContext.close();
    await authorContext.close();
    await reporterContext.close();
  }
});
