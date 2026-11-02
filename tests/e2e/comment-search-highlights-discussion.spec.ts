import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { Comment, CommentPage } from "@shared/schema";

const PASSWORD = "CommentSearchTest123!";
const REPLY_ONLY_TERM = "matching-reply-token";
const ROOT_ONLY_TERM = "matching-root-token";
const NESTED_REPLY_ONLY_TERM = "nested-comment-token";
const BOLD_ONLY_TERM = "bold-match-token";
const LINK_ONLY_TERM = "linked-match-token";
const CODE_ONLY_TERM = "code-match-token";
const EDIT_SEARCH_TERM = "editable-search-token";
const EDIT_REPLY_SEARCH_TERM = "editable-reply-token";
const AUTHOR_ID = 83001;

async function createAccount(request: APIRequestContext) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const username = `commentsearch${suffix}`.slice(0, 20);
  const email = `${username}@example.com`;
  const registration = await request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status(), await registration.text()).toBe(201);

  const login = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status(), await login.text()).toBe(200);

  const currentUserResponse = await request.get("/api/auth/me");
  expect(currentUserResponse.status(), await currentUserResponse.text()).toBe(200);
  const currentUser = await currentUserResponse.json() as { user: { id: number } | null };
  expect(currentUser.user?.id).toBeTruthy();
  return currentUser.user!.id;
}

async function dismissWhatsNew(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

function makeComment(
  id: number,
  content: string,
  targetId: string,
  parentId: number | null = null,
  replies: Comment[] = [],
  userId = AUTHOR_ID,
): Comment {
  return {
    id,
    targetType: "group_round",
    targetId,
    userId,
    parentId,
    content,
    isDeleted: false,
    createdAt: new Date(Date.UTC(2026, 0, 1) + id * 1000).toISOString(),
    user: { id: userId, name: "Search Author", avatarUrl: null },
    replies,
  };
}

function createCommentPage(comments: Comment[], search: string | null): CommentPage {
  const normalizedSearch = search?.toLowerCase();
  const matches = (comment: Comment) =>
    !normalizedSearch || comment.content.toLowerCase().includes(normalizedSearch);
  const filtered = normalizedSearch
    ? comments.filter(comment => matches(comment) || comment.replies?.some(matches))
    : comments;

  return {
    comments: filtered,
    commenters: [{ id: AUTHOR_ID, name: "Search Author", username: "searchauthor", avatarUrl: null }],
    mentionedUsers: [],
    pinnedComment: null,
    canManagePins: false,
    page: 1,
    pageSize: 20,
    totalCount: normalizedSearch
      ? comments.reduce((count, comment) =>
        count + (matches(comment) ? 1 : 0) + (comment.replies ?? []).filter(matches).length, 0)
      : comments.reduce((count, comment) => count + 1 + (comment.replies?.length ?? 0), 0),
    hasMore: false,
  };
}

test("discussion search highlights only matching roots and replies", async ({ page }) => {
  const authorId = await createAccount(page.request);
  const groupResponse = await page.request.post("/api/groups", {
    data: {
      name: `Comment search ${Date.now()}`,
      description: "Public group used for discussion search browser coverage",
      isPublic: true,
    },
  });
  expect(groupResponse.status(), await groupResponse.text()).toBe(201);
  const group = await groupResponse.json() as { id: number };

  const roundResponse = await page.request.post(`/api/groups/${group.id}/rounds`, {
    data: { gameSlug: "word-scramble" },
  });
  expect(roundResponse.status(), await roundResponse.text()).toBe(201);
  const round = await roundResponse.json() as { id: number };
  const targetId = String(round.id);

  const replyOnlyThread = makeComment(
    4000,
    "Parent shown only as context",
    targetId,
    null,
    [
      makeComment(4001, `This reply contains ${REPLY_ONLY_TERM}`, targetId, 4000),
      makeComment(4002, "Sibling reply remains plain", targetId, 4000),
    ],
  );
  const rootAndReplyThread = makeComment(
    4003,
    `Matching root contains ${ROOT_ONLY_TERM}`,
    targetId,
    null,
    [
      makeComment(4004, `Matching reply contains ${NESTED_REPLY_ONLY_TERM}`, targetId, 4003),
      makeComment(4005, "Nonmatching reply remains plain", targetId, 4003),
    ],
  );
  const formattedComment = makeComment(
    4006,
    `**${BOLD_ONLY_TERM}** and **bold-neighbor-token** plus [${LINK_ONLY_TERM}](https://example.com) and [linked-neighbor-token](https://example.org) then \`${CODE_ONLY_TERM}\` and \`code-neighbor-token\` with plain-neighbor-token`,
    targetId,
  );
  const editedOutRoot = makeComment(
    4007,
    `This comment initially contains ${EDIT_SEARCH_TERM}`,
    targetId,
    null,
    [],
    authorId,
  );
  const editedInThread = makeComment(
    4008,
    "Parent remains visible as context",
    targetId,
    null,
    [
      makeComment(4009, `This reply contains ${EDIT_SEARCH_TERM}`, targetId, 4008, [], authorId),
      makeComment(4010, "Sibling reply remains unrelated context", targetId, 4008, [], authorId),
    ],
    authorId,
  );
  const editedOutReplyThread = makeComment(
    4011,
    "Reply edit-out parent remains plain",
    targetId,
    null,
    [
      makeComment(4012, `This reply initially contains ${EDIT_REPLY_SEARCH_TERM}`, targetId, 4011, [], authorId),
    ],
    authorId,
  );
  const editedInReplyThread = makeComment(
    4013,
    "Reply edit-in parent remains plain",
    targetId,
    null,
    [
      makeComment(4014, `Existing matching reply contains ${EDIT_REPLY_SEARCH_TERM}`, targetId, 4013, [], authorId),
      makeComment(4015, "This visible reply will start matching", targetId, 4013, [], authorId),
      makeComment(4016, "This sibling remains unrelated context", targetId, 4013, [], authorId),
    ],
    authorId,
  );
  const comments = [
    rootAndReplyThread,
    replyOnlyThread,
    formattedComment,
    editedOutRoot,
    editedInThread,
    editedOutReplyThread,
    editedInReplyThread,
  ];
  let pauseNextSearchResponse = false;
  let signalPausedSearchResponse: (() => void) | undefined;
  let releasePausedSearchResponse: (() => void) | undefined;

  await page.route("**/api/comments?*", async route => {
    const url = new URL(route.request().url());
    if (pauseNextSearchResponse && url.searchParams.has("search")) {
      pauseNextSearchResponse = false;
      await new Promise<void>(resolve => {
        releasePausedSearchResponse = resolve;
        signalPausedSearchResponse?.();
      });
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createCommentPage(comments, url.searchParams.get("search"))),
    });
  });
  await page.route("**/api/comments/*", async route => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    const commentId = Number(new URL(route.request().url()).pathname.split("/").at(-1));
    const { content } = await route.request().postDataJSON() as { content: string };
    const updateComment = (comment: Comment): Comment => {
      if (comment.id === commentId) return { ...comment, content, updatedAt: new Date().toISOString() };
      return { ...comment, replies: comment.replies?.map(updateComment) };
    };
    const index = comments.findIndex(comment =>
      comment.id === commentId || comment.replies?.some(reply => reply.id === commentId));
    if (index < 0) {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: "Comment not found" }) });
      return;
    }
    const updatedThread = updateComment(comments[index]);
    comments[index] = updatedThread;
    const updated = updatedThread.id === commentId
      ? updatedThread
      : updatedThread.replies?.find(reply => reply.id === commentId);
    await route.fulfill({
      status: updated ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(updated ?? { error: "Comment not found" }),
    });
  });

  await page.goto(`/groups/${group.id}/rounds/${round.id}/play`);
  await dismissWhatsNew(page);
  const discussion = page.locator("#comments");
  const searchInput = discussion.getByTestId("input-search-comments");

  await searchInput.fill(REPLY_ONLY_TERM);
  const contextParent = discussion.getByTestId(`comment-${replyOnlyThread.id}`);
  const matchingReply = discussion.getByTestId(`comment-content-${replyOnlyThread.replies![0].id}`);
  const siblingReply = discussion.getByTestId(`comment-content-${replyOnlyThread.replies![1].id}`);
  await expect(contextParent).toBeVisible();
  await expect(matchingReply.locator("mark")).toHaveText(REPLY_ONLY_TERM);
  await expect(contextParent.getByTestId(`comment-content-${replyOnlyThread.id}`).locator("mark")).toHaveCount(0);
  await expect(siblingReply.locator("mark")).toHaveCount(0);
  await expect(discussion.getByTestId(`comment-${rootAndReplyThread.id}`)).toHaveCount(0);

  await searchInput.fill(ROOT_ONLY_TERM);
  const matchingRoot = discussion.getByTestId(`comment-content-${rootAndReplyThread.id}`);
  const matchingRootReply = discussion.getByTestId(`comment-content-${rootAndReplyThread.replies![0].id}`);
  const nonmatchingRootReply = discussion.getByTestId(`comment-content-${rootAndReplyThread.replies![1].id}`);
  await expect(matchingRoot.locator("mark")).toHaveText(ROOT_ONLY_TERM);
  await expect(matchingRootReply.locator("mark")).toHaveCount(0);
  await expect(nonmatchingRootReply.locator("mark")).toHaveCount(0);
  await expect(discussion.getByTestId(`comment-${replyOnlyThread.id}`)).toHaveCount(0);

  await searchInput.fill(NESTED_REPLY_ONLY_TERM);
  await expect(matchingRoot.locator("mark")).toHaveCount(0);
  await expect(matchingRootReply.locator("mark")).toHaveText(NESTED_REPLY_ONLY_TERM);
  await expect(nonmatchingRootReply.locator("mark")).toHaveCount(0);

  const formattedContent = discussion.getByTestId(`comment-content-${formattedComment.id}`);
  const formattedCases = [
    { term: BOLD_ONLY_TERM, searchTerm: BOLD_ONLY_TERM.toUpperCase(), selector: "strong" },
    { term: LINK_ONLY_TERM, searchTerm: LINK_ONLY_TERM.toUpperCase(), selector: "a" },
    { term: CODE_ONLY_TERM, searchTerm: CODE_ONLY_TERM.toUpperCase(), selector: "code" },
  ];

  for (const { term, searchTerm, selector } of formattedCases) {
    await searchInput.fill(searchTerm);
    await expect(formattedContent).toBeVisible();
    await expect(formattedContent.locator("mark")).toHaveCount(1);
    await expect(formattedContent.locator("mark")).toHaveText(term);
    await expect(formattedContent.locator(selector).filter({ hasText: term }).locator("mark")).toHaveText(term);
    await expect(formattedContent.locator("strong").filter({ hasText: "bold-neighbor-token" }).locator("mark"))
      .toHaveCount(0);
    await expect(formattedContent.locator("a").filter({ hasText: "linked-neighbor-token" }).locator("mark"))
      .toHaveCount(0);
    await expect(formattedContent.locator("code").filter({ hasText: "code-neighbor-token" }).locator("mark"))
      .toHaveCount(0);
    await expect(formattedContent).toContainText("plain-neighbor-token");
  }

  await searchInput.fill(EDIT_REPLY_SEARCH_TERM);
  const editedOutReplyContent = discussion.getByTestId("comment-content-4012");
  await expect(editedOutReplyContent.locator("mark")).toHaveText(EDIT_REPLY_SEARCH_TERM);

  pauseNextSearchResponse = true;
  let notifySearchResponsePaused!: () => void;
  const replyOutSearchResponsePaused = new Promise<void>(resolve => {
    notifySearchResponsePaused = resolve;
  });
  signalPausedSearchResponse = notifySearchResponsePaused;
  await discussion.getByTestId("button-edit-comment-4012").click();
  await discussion.getByTestId("input-edit-comment-4012").fill("This reply no longer matches");
  await discussion.getByTestId("button-save-edit-4012").click();
  await replyOutSearchResponsePaused;
  await expect(discussion.getByTestId("comment-4011")).toHaveCount(0);
  signalPausedSearchResponse = undefined;
  const replyOutRefresh = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/comments" && url.searchParams.get("search") === EDIT_REPLY_SEARCH_TERM;
  });
  releasePausedSearchResponse?.();
  releasePausedSearchResponse = undefined;
  await replyOutRefresh;

  const editedInReplyContent = discussion.getByTestId("comment-content-4015");
  const replyEditInParentContent = discussion.getByTestId("comment-content-4013");
  const unrelatedEditedInReplyContent = discussion.getByTestId("comment-content-4016");
  await expect(discussion.getByTestId("comment-4013")).toBeVisible();
  await expect(editedInReplyContent.locator("mark")).toHaveCount(0);
  await expect(replyEditInParentContent.locator("mark")).toHaveCount(0);
  await expect(unrelatedEditedInReplyContent.locator("mark")).toHaveCount(0);

  pauseNextSearchResponse = true;
  const replyInSearchResponsePaused = new Promise<void>(resolve => {
    notifySearchResponsePaused = resolve;
  });
  signalPausedSearchResponse = notifySearchResponsePaused;
  await discussion.getByTestId("button-edit-comment-4015").click();
  await discussion.getByTestId("input-edit-comment-4015").fill(`This reply now contains ${EDIT_REPLY_SEARCH_TERM}`);
  await discussion.getByTestId("button-save-edit-4015").click();
  await replyInSearchResponsePaused;
  await expect(editedInReplyContent.locator("mark")).toHaveText(EDIT_REPLY_SEARCH_TERM);
  await expect(replyEditInParentContent.locator("mark")).toHaveCount(0);
  await expect(unrelatedEditedInReplyContent.locator("mark")).toHaveCount(0);
  signalPausedSearchResponse = undefined;
  const replyInRefresh = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/comments" && url.searchParams.get("search") === EDIT_REPLY_SEARCH_TERM;
  });
  releasePausedSearchResponse?.();
  releasePausedSearchResponse = undefined;
  await replyInRefresh;

  await searchInput.fill(EDIT_SEARCH_TERM);
  const editedOutContent = discussion.getByTestId(`comment-content-${editedOutRoot.id}`);
  const editedInContent = discussion.getByTestId(`comment-content-${editedInThread.id}`);
  const unrelatedRootThreadReplyContent = discussion.getByTestId(`comment-content-${editedInThread.replies![1].id}`);
  await expect(editedOutContent.locator("mark")).toHaveText(EDIT_SEARCH_TERM);
  await expect(editedInContent.locator("mark")).toHaveCount(0);
  await expect(unrelatedRootThreadReplyContent.locator("mark")).toHaveCount(0);

  pauseNextSearchResponse = true;
  const searchResponsePaused = new Promise<void>(resolve => {
    notifySearchResponsePaused = resolve;
  });
  signalPausedSearchResponse = notifySearchResponsePaused;
  await discussion.getByTestId(`button-edit-comment-${editedOutRoot.id}`).click();
  await discussion.getByTestId(`input-edit-comment-${editedOutRoot.id}`).fill("This comment no longer matches");
  await discussion.getByTestId(`button-save-edit-${editedOutRoot.id}`).click();
  await searchResponsePaused;
  await expect(editedOutContent).toHaveCount(0);
  signalPausedSearchResponse = undefined;
  const firstRefresh = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/comments" && url.searchParams.get("search") === EDIT_SEARCH_TERM;
  });
  releasePausedSearchResponse?.();
  releasePausedSearchResponse = undefined;
  await firstRefresh;

  pauseNextSearchResponse = true;
  const nextSearchResponsePaused = new Promise<void>(resolve => {
    notifySearchResponsePaused = resolve;
  });
  signalPausedSearchResponse = notifySearchResponsePaused;
  await discussion.getByTestId(`button-edit-comment-${editedInThread.id}`).click();
  await discussion.getByTestId(`input-edit-comment-${editedInThread.id}`).fill(`Parent now matches ${EDIT_SEARCH_TERM}`);
  await discussion.getByTestId(`button-save-edit-${editedInThread.id}`).click();
  await nextSearchResponsePaused;
  await expect(editedInContent.locator("mark")).toHaveText(EDIT_SEARCH_TERM);
  await expect(unrelatedRootThreadReplyContent.locator("mark")).toHaveCount(0);
  await expect(discussion.getByTestId(`comment-content-${editedInThread.replies![0].id}`).locator("mark"))
    .toHaveText(EDIT_SEARCH_TERM);
  signalPausedSearchResponse = undefined;
  const secondRefresh = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/comments" && url.searchParams.get("search") === EDIT_SEARCH_TERM;
  });
  releasePausedSearchResponse?.();
  releasePausedSearchResponse = undefined;
  await secondRefresh;
});

test("editing a later-page search result preserves count and pagination", async ({ page }) => {
  const authorId = await createAccount(page.request);
  const groupResponse = await page.request.post("/api/groups", {
    data: {
      name: `Paged comment search ${Date.now()}`,
      description: "Public group used for paginated comment search coverage",
      isPublic: true,
    },
  });
  expect(groupResponse.status(), await groupResponse.text()).toBe(201);
  const group = await groupResponse.json() as { id: number };

  const roundResponse = await page.request.post(`/api/groups/${group.id}/rounds`, {
    data: { gameSlug: "word-scramble" },
  });
  expect(roundResponse.status(), await roundResponse.text()).toBe(201);
  const round = await roundResponse.json() as { id: number };
  const targetId = String(round.id);
  const comments = Array.from({ length: 45 }, (_, index) =>
    makeComment(5000 + index, `Paged result ${index + 1}: later-page-search-token`, targetId, null, [], authorId));

  await page.route("**/api/comments?*", async route => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") ?? "1");
    const search = url.searchParams.get("search")?.toLowerCase();
    const matchingComments = search
      ? comments.filter(comment => comment.content.toLowerCase().includes(search))
      : comments;
    const pageSize = 20;
    const commentPage: CommentPage = {
      comments: matchingComments.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
      commenters: [{ id: authorId, name: "Search Author", username: "searchauthor", avatarUrl: null }],
      mentionedUsers: [],
      pinnedComment: null,
      canManagePins: false,
      page: pageNumber,
      pageSize,
      totalCount: matchingComments.length,
      hasMore: matchingComments.length > pageNumber * pageSize,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(commentPage),
    });
  });
  await page.route("**/api/comments/*", async route => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    const commentId = Number(new URL(route.request().url()).pathname.split("/").at(-1));
    const { content } = await route.request().postDataJSON() as { content: string };
    const comment = comments.find(item => item.id === commentId);
    if (!comment) {
      await route.fulfill({ status: 404, body: JSON.stringify({ error: "Comment not found" }) });
      return;
    }
    comment.content = content;
    comment.updatedAt = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(comment),
    });
  });

  await page.goto(`/groups/${group.id}/rounds/${round.id}/play`);
  await dismissWhatsNew(page);
  const discussion = page.locator("#comments");
  const searchInput = discussion.getByTestId("input-search-comments");
  const firstSearchPageLoaded = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/comments"
      && url.searchParams.get("search") === "later-page-search-token"
      && url.searchParams.get("page") === "1";
  });
  await searchInput.fill("later-page-search-token");
  await firstSearchPageLoaded;

  await expect(discussion.getByTestId(`comment-content-${comments[0].id}`)).toBeVisible();
  await expect(discussion.getByTestId(`comment-content-${comments[19].id}`)).toBeVisible();
  await expect(discussion.getByTestId("button-toggle-comments")).toContainText("(45)");

  const secondSearchPageLoaded = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/comments"
      && url.searchParams.get("search") === "later-page-search-token"
      && url.searchParams.get("page") === "2";
  });
  await discussion.getByTestId("button-load-more-comments").click();
  await secondSearchPageLoaded;
  const editedLaterResult = comments[20];
  await expect(discussion.locator("[data-testid^='comment-content-']")).toHaveCount(40);
  await expect(discussion.getByTestId(`comment-content-${editedLaterResult.id}`)).toBeVisible();
  const retainedLaterResult = comments[21];
  await expect(discussion.getByTestId(`comment-content-${retainedLaterResult.id}`)).toBeVisible();

  await discussion.getByTestId(`comment-content-${editedLaterResult.id}`).scrollIntoViewIfNeeded();
  await discussion.getByTestId(`button-edit-comment-${editedLaterResult.id}`).click();
  await discussion.getByTestId(`input-edit-comment-${editedLaterResult.id}`).fill("This later-page result no longer matches");
  const laterPageRefresh = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/comments"
      && url.searchParams.get("search") === "later-page-search-token"
      && url.searchParams.get("page") === "2";
  });
  await discussion.getByTestId(`button-save-edit-${editedLaterResult.id}`).click();
  await laterPageRefresh;

  await expect(discussion.getByTestId("button-toggle-comments")).toContainText("(44)");
  await expect(discussion.getByTestId(`comment-${editedLaterResult.id}`)).toHaveCount(0);
  await expect(discussion.getByTestId(`comment-content-${retainedLaterResult.id}`)).toBeVisible();
  await expect(discussion.getByTestId("button-load-more-comments")).toBeVisible();

  const thirdSearchPageLoaded = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/comments"
      && url.searchParams.get("search") === "later-page-search-token"
      && url.searchParams.get("page") === "3";
  });
  await discussion.getByTestId("button-load-more-comments").click();
  await thirdSearchPageLoaded;
  await expect(discussion.getByTestId(`comment-content-${comments[40].id}`)).toBeVisible();
  await expect(discussion.getByTestId("button-load-more-comments")).toHaveCount(0);
  await expect(discussion.getByTestId("button-toggle-comments")).toContainText("(44)");
});
