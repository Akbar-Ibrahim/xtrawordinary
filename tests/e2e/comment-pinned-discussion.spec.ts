import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "PinnedDiscussionTest123!";
const PINNED_COMMENT = "Pinned note stays at the top";

async function createAccount(request: APIRequestContext, label: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const username = `pin${label}${suffix}`.slice(0, 20);
  const email = `${username}@example.com`;

  const registration = await request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const login = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(200);
  return { username };
}

async function postComment(request: APIRequestContext, roundId: number, content: string) {
  const response = await request.post("/api/comments", {
    data: { targetType: "group_round", targetId: String(roundId), content },
  });
  expect(response.status(), await response.text()).toBe(201);
  return await response.json() as { id: number };
}

async function dismissWhatsNew(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

async function expectPinnedAboveComments(page: Page) {
  const pinnedComment = page.getByTestId("pinned-comment");
  await expect(pinnedComment).toBeVisible();
  await expect(pinnedComment).toContainText(PINNED_COMMENT);
  const isAboveCommentList = await page.locator("#comments").evaluate((root) => {
    const pinned = root.querySelector('[data-testid="pinned-comment"]');
    const list = root.querySelector('[data-testid="comments-list"]');
    return !!pinned && (!list || !!(pinned.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(isAboveCommentList).toBe(true);
}

test("round creators can pin and unpin comments while pinned placement survives discussion changes", async ({
  page,
  browser,
}) => {
  const visitorPage = await browser.newPage();
  const contributorPage = await browser.newPage();

  try {
    const owner = await createAccount(page.request, "owner");
    await createAccount(visitorPage.request, "visitor");
    await createAccount(contributorPage.request, "writer");

    const groupResponse = await page.request.post("/api/groups", {
      data: {
        name: `Pinned discussion ${Date.now()}`,
        description: "Public round used for pinned-comment browser coverage",
        isPublic: true,
      },
    });
    expect(groupResponse.status(), await groupResponse.text()).toBe(201);
    const group = await groupResponse.json() as { id: number };

    const visitorJoinResponse = await visitorPage.request.post(
      `/api/groups/join-public/${group.id}`,
    );
    expect(visitorJoinResponse.status(), await visitorJoinResponse.text()).toBe(200);

    const roundResponse = await page.request.post(`/api/groups/${group.id}/rounds`, {
      data: { gameSlug: "word-scramble" },
    });
    expect(roundResponse.status(), await roundResponse.text()).toBe(201);
    const round = await roundResponse.json() as { id: number };
    const discussionUrl = `/groups/${group.id}/rounds/${round.id}/play`;

    const commentRequests = [page.request, visitorPage.request, contributorPage.request];
    for (let index = 1; index <= 21; index += 1) {
      await postComment(
        commentRequests[(index - 1) % commentRequests.length],
        round.id,
        `Discussion note ${String(index).padStart(2, "0")}`,
      );
    }
    const pinnedComment = await postComment(visitorPage.request, round.id, PINNED_COMMENT);

    await page.goto(discussionUrl);
    await dismissWhatsNew(page);
    const pinButton = page.getByTestId(`button-pin-comment-${pinnedComment.id}`);
    await expect(pinButton).toBeVisible();

    await visitorPage.goto(discussionUrl);
    await dismissWhatsNew(visitorPage);
    await expect(visitorPage.getByTestId("comments-list")).toBeVisible();
    await expect(visitorPage.locator(
      '[data-testid^="button-pin-comment-"], [data-testid^="button-unpin-comment-"]',
    )).toHaveCount(0);

    await pinButton.click();
    await expect(page.getByTestId(`button-unpin-comment-${pinnedComment.id}`)).toBeVisible();
    await expectPinnedAboveComments(page);

    await page.getByTestId("button-sort-comments-oldest").click();
    await expectPinnedAboveComments(page);

    await page.getByTestId("input-search-comments").fill("no comment contains this phrase");
    await expect(page.getByTestId("comments-list")).toHaveCount(0);
    await expectPinnedAboveComments(page);

    await page.getByTestId("button-clear-comment-search").click();
    await expect(page.getByTestId("comments-list")).toBeVisible();
    await page.getByTestId("button-load-more-comments").click();
    await expect(page.getByTestId("comments-list").locator('[data-testid^="comment-content-"]'))
      .toHaveCount(21);
    await expectPinnedAboveComments(page);

    const commenterFilter = page.getByTestId("select-commenter-filter");
    await commenterFilter.click();
    await page.getByRole("option").filter({ hasText: `@${owner.username}` }).click();
    await expectPinnedAboveComments(page);
    await expect(page.getByTestId("comments-list").getByTestId(`comment-${pinnedComment.id}`))
      .toHaveCount(0);
    await expect(page.getByTestId("pinned-comment").getByTestId(`comment-${pinnedComment.id}`))
      .toHaveCount(1);

    await commenterFilter.click();
    await page.getByRole("option", { name: "All commenters", exact: true }).click();
    await expect(page.getByTestId("comments-list").locator('[data-testid^="comment-content-"]'))
      .toHaveCount(21);
    await expect(page.getByTestId("comments-list").getByTestId(`comment-${pinnedComment.id}`))
      .toHaveCount(0);
    await expect(page.getByTestId("pinned-comment").getByTestId(`comment-${pinnedComment.id}`))
      .toHaveCount(1);
    await expectPinnedAboveComments(page);

    await page.reload();
    await dismissWhatsNew(page);
    await expectPinnedAboveComments(page);
    await expect(page.getByTestId(`button-unpin-comment-${pinnedComment.id}`)).toBeVisible();

    await visitorPage.reload();
    await dismissWhatsNew(visitorPage);
    await expectPinnedAboveComments(visitorPage);
    await expect(visitorPage.locator(
      '[data-testid^="button-pin-comment-"], [data-testid^="button-unpin-comment-"]',
    )).toHaveCount(0);

    await page.getByTestId("input-search-comments").fill(PINNED_COMMENT);
    await expectPinnedAboveComments(page);
    await page.getByTestId(`button-unpin-comment-${pinnedComment.id}`).click();
    await expect(page.getByTestId("pinned-comment")).toHaveCount(0);
    await expect(page.getByTestId(`button-pin-comment-${pinnedComment.id}`)).toBeVisible();
  } finally {
    await Promise.all([visitorPage.close(), contributorPage.close()]);
  }
});
