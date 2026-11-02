import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Comment, CommentPage } from "@shared/schema";

const PASSWORD = "CommentFilterTest123!";
const FILTER_REPLY = "commenter-filter-reply-needle";
const DISCUSSION_SWITCH = "discussion-switch-token";
const TARGET_AUTHOR_ID = 82001;
const OTHER_AUTHOR_ID = 82002;

type CommentRequest = {
  targetId: string;
  page: number;
  commenterId?: string;
  search?: string;
};

async function createAccount(request: APIRequestContext) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const username = `commentfilter${suffix}`.slice(0, 20);
  const email = `${username}@example.com`;
  const registration = await request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const login = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(200);
}

async function dismissWhatsNew(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

const targetAuthor = {
  id: TARGET_AUTHOR_ID,
  name: "Target Author",
  username: "targetauthor",
  avatarUrl: null,
};
const otherAuthor = {
  id: OTHER_AUTHOR_ID,
  name: "Other Author",
  username: "otherauthor",
  avatarUrl: null,
};

function makeComment(
  id: number,
  userId: number,
  content: string,
  targetId: string,
  parentId: number | null = null,
  replies: Comment[] = [],
): Comment {
  const author = userId === TARGET_AUTHOR_ID ? targetAuthor : otherAuthor;
  return {
    id,
    targetType: "group_round",
    targetId,
    userId,
    parentId,
    content,
    isDeleted: false,
    createdAt: new Date(Date.UTC(2026, 0, 1) + id * 1000).toISOString(),
    user: { id: author.id, name: author.name, avatarUrl: author.avatarUrl },
    replies,
  };
}

function buildDiscussions(firstRoundId: string, secondRoundId: string) {
  const selectedRoots: Comment[] = Array.from({ length: 20 }, (_, index) =>
    makeComment(1000 + index, TARGET_AUTHOR_ID, `Selected author thread ${String(index + 1).padStart(2, "0")}`, firstRoundId));
  selectedRoots.push(makeComment(
    1020,
    TARGET_AUTHOR_ID,
    `Selected author ${DISCUSSION_SWITCH}`,
    firstRoundId,
  ));

  const contextParent = makeComment(
    2000,
    OTHER_AUTHOR_ID,
    "Parent by another commenter stays with a matching reply",
    firstRoundId,
    null,
    [
      makeComment(2001, TARGET_AUTHOR_ID, `Reply with ${FILTER_REPLY}`, firstRoundId, 2000),
      makeComment(2002, OTHER_AUTHOR_ID, "Sibling reply by another commenter remains visible", firstRoundId, 2000),
    ],
  );
  const unrelatedRoot = makeComment(
    2003,
    OTHER_AUTHOR_ID,
    "A root thread from another commenter",
    firstRoundId,
  );
  const firstRound = [...selectedRoots, contextParent, unrelatedRoot]
    .sort((a, b) => b.id - a.id);
  const secondRound = [
    makeComment(3000, OTHER_AUTHOR_ID, `Another author's ${DISCUSSION_SWITCH}`, secondRoundId),
  ];

  return {
    firstRound,
    secondRound,
    selectedRoots,
    contextParent,
    matchingReply: contextParent.replies![0],
    siblingReply: contextParent.replies![1],
    unrelatedRoot,
    secondDiscussionComment: secondRound[0],
  };
}

function createCommentPage(
  comments: Comment[],
  request: CommentRequest,
  commenters: CommentPage["commenters"],
): CommentPage {
  const pageSize = 20;
  const normalizedSearch = request.search?.toLowerCase();
  const matches = (comment: Comment) =>
    (!request.commenterId || comment.userId === Number(request.commenterId))
    && (!normalizedSearch || comment.content.toLowerCase().includes(normalizedSearch));
  const filtered = request.commenterId || normalizedSearch
    ? comments.filter(comment => matches(comment) || comment.replies?.some(matches))
    : comments;
  const start = (request.page - 1) * pageSize;
  const visibleComments = filtered.slice(start, start + pageSize);
  const totalCount = request.commenterId || normalizedSearch
    ? comments.reduce((count, comment) =>
      count
      + (matches(comment) ? 1 : 0)
      + (comment.replies ?? []).filter(matches).length, 0)
    : comments.reduce((count, comment) => count + 1 + (comment.replies?.length ?? 0), 0);

  return {
    comments: visibleComments,
    commenters: request.page === 1 ? commenters : undefined,
    mentionedUsers: [],
    pinnedComment: null,
    canManagePins: false,
    page: request.page,
    pageSize,
    totalCount,
    hasMore: filtered.length > start + pageSize,
  };
}

test("commenter filtering paginates threads, preserves reply context, and resets across discussions", async ({
  page,
}) => {
  await createAccount(page.request);
  const groupResponse = await page.request.post("/api/groups", {
    data: {
      name: `Comment filters ${Date.now()}`,
      description: "Public group used for commenter-filter browser coverage",
      isPublic: true,
    },
  });
  expect(groupResponse.status(), await groupResponse.text()).toBe(201);
  const group = await groupResponse.json() as { id: number };

  const firstRoundResponse = await page.request.post(`/api/groups/${group.id}/rounds`, {
    data: { gameSlug: "word-scramble" },
  });
  expect(firstRoundResponse.status(), await firstRoundResponse.text()).toBe(201);
  const firstRound = await firstRoundResponse.json() as { id: number };

  const secondRoundResponse = await page.request.post(`/api/groups/${group.id}/rounds`, {
    data: { gameSlug: "word-scramble" },
  });
  expect(secondRoundResponse.status(), await secondRoundResponse.text()).toBe(201);
  const secondRound = await secondRoundResponse.json() as { id: number };
  const discussions = buildDiscussions(String(firstRound.id), String(secondRound.id));
  const commentRequests: CommentRequest[] = [];
  const commenters = [targetAuthor, otherAuthor];
  let failedCommentRequestsRemaining = 0;

  // The API and storage suites cover server filtering. Keep this browser test
  // focused on the real selection, search, pagination, and route-change UI;
  // seeding 21 authored threads through POST would hit the intentional spam cap.
  await page.route("**/api/comments?*", async route => {
    const url = new URL(route.request().url());
    const request: CommentRequest = {
      targetId: url.searchParams.get("targetId") ?? "",
      page: Number(url.searchParams.get("page") ?? "1"),
      commenterId: url.searchParams.get("commenterId") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    };
    commentRequests.push(request);
    if (failedCommentRequestsRemaining > 0) {
      failedCommentRequestsRemaining -= 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Temporary comments failure" }),
      });
      return;
    }
    const comments = request.targetId === String(firstRound.id)
      ? discussions.firstRound
      : discussions.secondRound;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createCommentPage(comments, request, commenters)),
    });
  });

  await page.goto(`/groups/${group.id}/rounds/${firstRound.id}/play`);
  await dismissWhatsNew(page);
  const discussion = page.locator("#comments");
  const commenterFilter = discussion.getByTestId("select-commenter-filter");
  const commentsList = discussion.getByTestId("comments-list");
  const topLevelComments = commentsList.locator(':scope > [data-testid^="comment-"]');

  await expect(commenterFilter).toBeVisible();
  await commenterFilter.click();
  await page.getByRole("option").filter({ hasText: `@${targetAuthor.username}` }).click();
  await expect(topLevelComments).toHaveCount(20);
  await expect(discussion.getByTestId("button-load-more-comments")).toBeVisible();
  await expect(discussion.getByTestId(`comment-${discussions.unrelatedRoot.id}`)).toHaveCount(0);
  await expect.poll(() => commentRequests.some(request =>
    request.targetId === String(firstRound.id)
    && request.page === 1
    && request.commenterId === String(TARGET_AUTHOR_ID),
  )).toBe(true);

  failedCommentRequestsRemaining = 2;
  await discussion.getByTestId("button-load-more-comments").click();
  await expect(discussion.getByTestId("comments-next-page-error")).toContainText(
    "Your existing comments are still available.",
  );
  await expect(topLevelComments).toHaveCount(20);
  await expect(discussion.getByTestId(`comment-${discussions.selectedRoots[20].id}`)).toBeVisible();
  await expect.poll(() => commentRequests.filter(request =>
    request.targetId === String(firstRound.id)
    && request.page === 2
    && request.commenterId === String(TARGET_AUTHOR_ID),
  ).length).toBe(2);

  await discussion.getByTestId("button-retry-next-comments").click();
  await expect(topLevelComments).toHaveCount(22);
  await expect.poll(() => commentRequests.some(request =>
    request.targetId === String(firstRound.id)
    && request.page === 2
    && request.commenterId === String(TARGET_AUTHOR_ID),
  )).toBe(true);
  await expect.poll(() => commentRequests.filter(request =>
    request.targetId === String(firstRound.id)
    && request.page === 2
    && request.commenterId === String(TARGET_AUTHOR_ID),
  ).length).toBe(3);
  for (const root of discussions.selectedRoots) {
    await expect(discussion.getByTestId(`comment-${root.id}`)).toBeVisible();
  }

  const parentThread = discussion.getByTestId(`comment-${discussions.contextParent.id}`);
  await expect(parentThread).toContainText("Parent by another commenter");
  await expect(discussion.getByTestId(`comment-content-${discussions.matchingReply.id}`))
    .toContainText(FILTER_REPLY);
  await expect(discussion.getByTestId(`comment-content-${discussions.siblingReply.id}`))
    .toContainText("Sibling reply by another commenter");
  await expect(discussion.getByTestId(`comment-${discussions.unrelatedRoot.id}`)).toHaveCount(0);

  failedCommentRequestsRemaining = 2;
  await discussion.getByTestId("input-search-comments").fill(FILTER_REPLY);
  await expect(discussion.getByTestId("comments-load-error")).toBeVisible();
  await expect(discussion.getByTestId("input-search-comments")).toHaveValue(FILTER_REPLY);
  await expect(commenterFilter).toContainText(`@${targetAuthor.username}`);
  await expect(discussion.getByTestId("text-no-comments")).toHaveCount(0);
  await discussion.getByTestId("button-retry-comments").click();
  await expect(topLevelComments).toHaveCount(1);
  await expect.poll(() => commentRequests.some(request =>
    request.targetId === String(firstRound.id)
    && request.commenterId === String(TARGET_AUTHOR_ID)
    && request.search === FILTER_REPLY
    && commentRequests.filter(candidate =>
      candidate.targetId === String(firstRound.id)
      && candidate.commenterId === String(TARGET_AUTHOR_ID)
      && candidate.search === FILTER_REPLY,
    ).length >= 3,
  )).toBe(true);
  await expect(parentThread).toBeVisible();
  await expect(discussion.getByTestId(`comment-content-${discussions.matchingReply.id}`)).toBeVisible();
  await expect(discussion.getByTestId(`comment-content-${discussions.siblingReply.id}`)).toBeVisible();
  await expect(discussion.getByTestId(`comment-${discussions.selectedRoots[0].id}`)).toHaveCount(0);
  await expect.poll(() => commentRequests.some(request =>
    request.targetId === String(firstRound.id)
    && request.commenterId === String(TARGET_AUTHOR_ID)
    && request.search === FILTER_REPLY,
  )).toBe(true);

  await discussion.getByTestId("button-clear-comment-search").click();
  await commenterFilter.click();
  await page.getByRole("option", { name: "All commenters", exact: true }).click();
  await expect(topLevelComments).toHaveCount(20);
  failedCommentRequestsRemaining = 2;
  await discussion.getByTestId("button-sort-comments-oldest").click();
  await expect(discussion.getByTestId("comments-load-error")).toBeVisible();
  await expect(discussion.getByTestId("input-search-comments")).toHaveValue("");
  await discussion.getByTestId("button-retry-comments").click();
  await expect(topLevelComments).toHaveCount(20);
  await expect.poll(() => commentRequests.filter(request =>
    request.targetId === String(firstRound.id)
    && request.page === 1
    && !request.commenterId
    && !request.search,
  ).length).toBeGreaterThanOrEqual(3);
  await discussion.getByTestId("button-load-more-comments").click();
  await expect(topLevelComments).toHaveCount(23);
  await expect(discussion.getByTestId(`comment-${discussions.unrelatedRoot.id}`)).toBeVisible();

  // Change the route inside the running app while a commenter filter and
  // search are active. The new discussion must not reuse the previous result.
  await commenterFilter.click();
  await page.getByRole("option").filter({ hasText: `@${targetAuthor.username}` }).click();
  await discussion.getByTestId("input-search-comments").fill(DISCUSSION_SWITCH);
  await expect(discussion.getByTestId(`comment-${discussions.selectedRoots[20].id}`)).toBeVisible();

  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, `/groups/${group.id}/rounds/${secondRound.id}/play`);

  const nextDiscussion = page.locator("#comments");
  await expect(nextDiscussion.getByTestId(`comment-${discussions.secondDiscussionComment.id}`)).toBeVisible();
  await expect(nextDiscussion.getByTestId(`comment-${discussions.selectedRoots[20].id}`)).toHaveCount(0);
  await expect(nextDiscussion.getByTestId("select-commenter-filter")).toContainText("All commenters");
  await expect(nextDiscussion.getByTestId("input-search-comments")).toHaveValue("");
  await expect.poll(() => commentRequests.some(request =>
    request.targetId === String(secondRound.id)
    && request.search === undefined
    && request.commenterId === undefined,
  )).toBe(true);
});
