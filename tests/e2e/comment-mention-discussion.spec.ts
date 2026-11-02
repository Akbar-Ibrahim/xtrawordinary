import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const PASSWORD = "CommentMentionTest123!";

type Account = { id: number; username: string };
type Notification = {
  id: number;
  type: string;
  linkUrl: string | null;
};

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

test("a removed member cannot access or submit private round data from an old link", async ({
  page,
  browser,
}) => {
  await createAccount(page.request, "sender");
  const memberPage = await browser.newPage();
  const outsiderPage = await browser.newPage();

  try {
    const member = await createAccount(memberPage.request, "member");
    const outsider = await createAccount(outsiderPage.request, "outsider");

    const groupResponse = await page.request.post("/api/groups", {
      data: {
        name: `Private mention ${Date.now()}`,
        description: "Private group for comment mention browser coverage",
        isPublic: false,
      },
    });
    expect(groupResponse.status(), await groupResponse.text()).toBe(201);
    const group = await groupResponse.json() as { id: number; inviteCode: string };

    const joinResponse = await memberPage.request.post("/api/groups/join", {
      data: { inviteCode: group.inviteCode },
    });
    expect(joinResponse.status(), await joinResponse.text()).toBe(200);

    const roundResponse = await page.request.post(`/api/groups/${group.id}/rounds`, {
      data: { gameSlug: "word-scramble" },
    });
    expect(roundResponse.status(), await roundResponse.text()).toBe(201);
    const round = await roundResponse.json() as { id: number };

    const memberAttempt = await memberPage.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/attempt`,
    );
    expect(memberAttempt.status(), await memberAttempt.text()).toBe(200);
    const memberAttemptState = await memberAttempt.json();
    const memberScoreResponse = await memberPage.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/score`,
      { data: { score: 80, durationMs: 12000 } },
    );
    expect(memberScoreResponse.status(), await memberScoreResponse.text()).toBe(200);
    const memberScore = await memberScoreResponse.json() as { id: number };

    const ownerAttempt = await page.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/attempt`,
    );
    expect(ownerAttempt.status(), await ownerAttempt.text()).toBe(200);
    const ownerScoreResponse = await page.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/score`,
      { data: { score: 100 } },
    );
    expect(ownerScoreResponse.status(), await ownerScoreResponse.text()).toBe(200);
    const ownerScore = await ownerScoreResponse.json() as { id: number };
    const scoresBeforeRemovalResponse = await page.request.get(
      `/api/groups/${group.id}/rounds/${round.id}/scores`,
    );
    expect(scoresBeforeRemovalResponse.status()).toBe(200);
    const scoresBeforeRemoval = await scoresBeforeRemovalResponse.json();
    expect(scoresBeforeRemoval).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: memberScore.id, userId: member.id, score: 80 }),
    ]));

    const memberReaction = await memberPage.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/scores/${ownerScore.id}/reactions`,
      { data: { emoji: "🔥" } },
    );
    expect(memberReaction.status(), await memberReaction.text()).toBe(200);

    const discussionLink = `/groups/${group.id}/rounds/${round.id}/play#comments`;
    const cachedPrivateComment = "Private discussion cached before removal";
    const cachedCommentResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "group_round",
        targetId: String(round.id),
        content: cachedPrivateComment,
      },
    });
    expect(cachedCommentResponse.status(), await cachedCommentResponse.text()).toBe(201);

    const streamConnected = memberPage.waitForResponse(response =>
      response.url().includes("/api/notifications/stream") && response.status() === 200,
    );
    await memberPage.goto("/");
    await dismissWhatsNew(memberPage);
    await streamConnected;

    await memberPage.goto(discussionLink);
    await expect(memberPage.locator("#comments").getByText(cachedPrivateComment)).toBeVisible();
    await memberPage.goto("/");

    const commentInput = page.getByTestId("input-comment");
    await page.goto(`/groups/${group.id}/rounds/${round.id}/play`);
    await dismissWhatsNew(page);
    await expect(commentInput).toBeVisible();

    await commentInput.click();
    await commentInput.pressSequentially(`Thanks for the round, @${member.username}`);
    const memberSuggestion = page.getByRole("option").filter({ hasText: `@${member.username}` });
    await expect(memberSuggestion).toBeVisible();
    await memberSuggestion.click();

    await commentInput.pressSequentially(`and @${outsider.username}`);
    const outsiderSuggestion = page.getByRole("option").filter({ hasText: `@${outsider.username}` });
    await expect(outsiderSuggestion).toBeVisible();
    await outsiderSuggestion.click();
    await page.getByTestId("button-submit-comment").click();

    const memberMentionNotifications = async () => {
      const response = await memberPage.request.get("/api/notifications");
      expect(response.ok()).toBeTruthy();
      const notifications = await response.json() as Notification[];
      return notifications.filter(notification => notification.type === "comment_mention");
    };
    await expect.poll(async () => (await memberMentionNotifications()).length).toBe(1);

    const notifications = await memberMentionNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].linkUrl).toBe(discussionLink);

    const removalResponse = await page.request.delete(
      `/api/groups/${group.id}/members/${member.id}`,
    );
    expect(removalResponse.status(), await removalResponse.text()).toBe(200);

    const removedMemberRound = await memberPage.request.get(
      `/api/groups/${group.id}/rounds/${round.id}`,
    );
    expect(removedMemberRound.status()).toBe(403);
    const inaccessibleAttempt = await memberPage.request.get(
      `/api/groups/${group.id}/rounds/${round.id}/attempt`,
    );
    expect(inaccessibleAttempt.status()).toBe(403);
    const inaccessibleScores = await memberPage.request.get(
      `/api/groups/${group.id}/rounds/${round.id}/scores`,
    );
    expect(inaccessibleScores.status()).toBe(403);
    const inaccessibleReactions = await memberPage.request.get(
      `/api/groups/${group.id}/rounds/${round.id}/reactions`,
    );
    expect(inaccessibleReactions.status()).toBe(403);
    const addReactionAfterRemoval = await memberPage.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/scores/${ownerScore.id}/reactions`,
      { data: { emoji: "❤️" } },
    );
    expect(addReactionAfterRemoval.status()).toBe(403);
    const deleteReactionAfterRemoval = await memberPage.request.delete(
      `/api/groups/${group.id}/rounds/${round.id}/scores/${ownerScore.id}/reactions/${encodeURIComponent("🔥")}`,
    );
    expect(deleteReactionAfterRemoval.status()).toBe(403);
    const submitAttemptAfterRemoval = await memberPage.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/attempt`,
    );
    expect(submitAttemptAfterRemoval.status(), await submitAttemptAfterRemoval.text()).toBe(403);
    const submitScoreAfterRemoval = await memberPage.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/score`,
      { data: { score: 999, durationMs: 1 } },
    );
    expect(submitScoreAfterRemoval.status(), await submitScoreAfterRemoval.text()).toBe(403);

    const ownerReactions = await page.request.get(
      `/api/groups/${group.id}/rounds/${round.id}/reactions`,
    );
    expect(ownerReactions.status()).toBe(200);
    expect(await ownerReactions.json()).toEqual([
      expect.objectContaining({ scoreId: ownerScore.id, userId: member.id, emoji: "🔥" }),
    ]);
    const scoresAfterDeniedSubmissions = await page.request.get(
      `/api/groups/${group.id}/rounds/${round.id}/scores`,
    );
    expect(scoresAfterDeniedSubmissions.status()).toBe(200);
    expect(await scoresAfterDeniedSubmissions.json()).toEqual(scoresBeforeRemoval);

    const inaccessibleDiscussion = await memberPage.request.get(
      `/api/comments?targetType=group_round&targetId=${round.id}&page=1&pageSize=20`,
    );
    expect(inaccessibleDiscussion.status()).toBe(403);

    await memberPage.getByTestId("button-notifications-bell").click();
    const mentionNotification = memberPage.getByTestId(`notification-db-${notifications[0].id}`);
    await expect(mentionNotification).toBeVisible();
    let releaseRoundResponse!: () => void;
    let resolveRoundRequestFetched!: () => void;
    const holdRoundResponse = new Promise<void>(resolve => {
      releaseRoundResponse = resolve;
    });
    const roundRequestFetched = new Promise<void>(resolve => {
      resolveRoundRequestFetched = resolve;
    });
    await memberPage.route(`**/api/groups/${group.id}/rounds/${round.id}`, async route => {
      const response = await route.fetch();
      resolveRoundRequestFetched();
      await holdRoundResponse;
      await route.fulfill({ response });
    }, { times: 1 });
    const roundAccessResponse = memberPage.waitForResponse(response =>
      response.url().endsWith(`/api/groups/${group.id}/rounds/${round.id}`),
    );
    await mentionNotification.click();
    await expect(memberPage).toHaveURL(new RegExp(`${discussionLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await roundRequestFetched;
    await expect(memberPage.locator("#comments")).toHaveCount(0);
    await expect(memberPage.getByText(cachedPrivateComment)).toHaveCount(0);
    await expect(memberPage.getByText(`Thanks for the round, @${member.username} and @${outsider.username}`)).toHaveCount(0);
    releaseRoundResponse();
    expect((await roundAccessResponse).status()).toBe(403);

    const outsiderNotificationsResponse = await outsiderPage.request.get("/api/notifications");
    expect(outsiderNotificationsResponse.ok()).toBeTruthy();
    const outsiderNotifications = await outsiderNotificationsResponse.json() as Notification[];
    expect(outsiderNotifications.some(notification => notification.type === "comment_mention")).toBe(false);
    expect(outsiderNotifications.some(notification => notification.linkUrl === discussionLink)).toBe(false);

    const outsiderDiscussion = await outsiderPage.request.get(
      `/api/comments?targetType=group_round&targetId=${round.id}&page=1&pageSize=20`,
    );
    expect(outsiderDiscussion.status()).toBe(403);

    const rejoinResponse = await memberPage.request.post("/api/groups/join", {
      data: { inviteCode: group.inviteCode },
    });
    expect(rejoinResponse.status(), await rejoinResponse.text()).toBe(200);
    const restoredAttempt = await memberPage.request.get(
      `/api/groups/${group.id}/rounds/${round.id}/attempt`,
    );
    expect(restoredAttempt.status()).toBe(200);
    expect(await restoredAttempt.json()).toEqual({ attempt: memberAttemptState });
  } finally {
    await memberPage.close();
    await outsiderPage.close();
  }
});

test("comment mentions on public game pages open the same game discussion", async ({
  page,
  browser,
}) => {
  await createAccount(page.request, "sender");
  const recipientPage = await browser.newPage();

  try {
    const recipient = await createAccount(recipientPage.request, "recipient");
    const discussionLink = "/game/word-scramble#comments";

    const streamConnected = recipientPage.waitForResponse(response =>
      response.url().includes("/api/notifications/stream") && response.status() === 200,
    );
    await recipientPage.goto("/");
    await dismissWhatsNew(recipientPage);
    await streamConnected;

    await page.goto("/game/word-scramble");
    await dismissWhatsNew(page);
    const commentInput = page.getByTestId("input-comment");
    await expect(commentInput).toBeVisible();

    await commentInput.click();
    await commentInput.pressSequentially(`A great round, @${recipient.username}`);
    const recipientSuggestion = page.getByRole("option").filter({
      hasText: `@${recipient.username}`,
    });
    await expect(recipientSuggestion).toBeVisible();
    await recipientSuggestion.click();
    await page.getByTestId("button-submit-comment").click();

    const recipientMentionNotifications = async () => {
      const response = await recipientPage.request.get("/api/notifications");
      expect(response.ok()).toBeTruthy();
      const notifications = await response.json() as Notification[];
      return notifications.filter(notification => notification.type === "comment_mention");
    };
    await expect.poll(async () => (await recipientMentionNotifications()).length).toBe(1);

    const notifications = await recipientMentionNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].linkUrl).toBe(discussionLink);

    await recipientPage.getByTestId("button-notifications-bell").click();
    const mentionNotification = recipientPage.getByTestId(`notification-db-${notifications[0].id}`);
    await expect(mentionNotification).toBeVisible();
    await mentionNotification.click();
    await expect(recipientPage).toHaveURL(
      new RegExp(`${discussionLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    );

    const discussion = recipientPage.locator("#comments");
    await expect(discussion).toBeVisible();
    await expect(discussion).toBeInViewport();
    await expect(
      discussion.getByText(`A great round, @${recipient.username}`),
    ).toBeVisible();
  } finally {
    await recipientPage.close();
  }
});

test("reply mentions on public game pages link known profiles and leave unknown usernames as plain text", async ({
  page,
  browser,
}) => {
  const targetPage = await browser.newPage();

  try {
    const target = await createAccount(targetPage.request, "gamereplytarget");
    await createAccount(page.request, "gamereplyauthor");
    const missingUsername = `missing${Date.now().toString(36)}`;

    const rootResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "game",
        targetId: "word-scramble",
        content: "A public game comment to reply to",
      },
    });
    expect(rootResponse.status(), await rootResponse.text()).toBe(201);
    const rootComment = await rootResponse.json() as { id: number };

    await page.goto("/game/word-scramble#comments");
    await dismissWhatsNew(page);

    const root = page.getByTestId(`comment-${rootComment.id}`);
    await expect(root).toBeVisible();
    await root.getByTestId(`button-reply-${rootComment.id}`).click();

    const replyInput = root.getByTestId("input-comment");
    await replyInput.pressSequentially(`@${target.username}`);
    const targetSuggestion = page.getByRole("option").filter({
      hasText: `@${target.username}`,
    });
    await expect(targetSuggestion).toBeVisible();
    await targetSuggestion.click();
    await replyInput.pressSequentially(` and @${missingUsername}`);
    await root.getByTestId("button-submit-comment").click();

    const replyContent = root.locator('[data-testid^="comment-content-"]').last();
    await expect(replyContent).toBeVisible();
    await expect(replyContent).toContainText(`@${target.username} and @${missingUsername}`);

    const mentionLink = replyContent.getByTestId(`link-comment-mention-${target.id}`);
    await expect(mentionLink).toHaveCount(1);
    await expect(mentionLink).toHaveAttribute("href", `/u/${encodeURIComponent(target.username)}`);
    await expect(replyContent.locator("a")).toHaveCount(1);

    await mentionLink.click();
    await expect(page).toHaveURL(new RegExp(`/u/${target.username}$`));
    await expect(page.getByTestId("text-profile-username")).toHaveText(`@${target.username}`);
  } finally {
    await targetPage.close();
  }
});

test("reply mentions link known profiles and leave unknown usernames as plain text", async ({
  page,
  browser,
}) => {
  const targetPage = await browser.newPage();

  try {
    const target = await createAccount(targetPage.request, "replytarget");
    await createAccount(page.request, "replyauthor");

    const groupResponse = await page.request.post("/api/groups", {
      data: {
        name: `Reply mentions ${Date.now()}`,
        description: "Group round for reply mention browser coverage",
        isPublic: false,
      },
    });
    expect(groupResponse.status(), await groupResponse.text()).toBe(201);
    const group = await groupResponse.json() as { id: number };

    const roundResponse = await page.request.post(`/api/groups/${group.id}/rounds`, {
      data: { gameSlug: "word-scramble" },
    });
    expect(roundResponse.status(), await roundResponse.text()).toBe(201);
    const round = await roundResponse.json() as { id: number };

    const attemptResponse = await page.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/attempt`,
    );
    expect(attemptResponse.status(), await attemptResponse.text()).toBe(200);
    const scoreResponse = await page.request.post(
      `/api/groups/${group.id}/rounds/${round.id}/score`,
      { data: { score: 100 } },
    );
    expect(scoreResponse.status(), await scoreResponse.text()).toBe(200);

    const rootResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "group_round",
        targetId: String(round.id),
        content: "A comment to reply to",
      },
    });
    expect(rootResponse.status(), await rootResponse.text()).toBe(201);
    const rootComment = await rootResponse.json() as { id: number };

    await page.goto(`/groups/${group.id}/rounds/${round.id}/play#comments`);
    await dismissWhatsNew(page);

    const root = page.getByTestId(`comment-${rootComment.id}`);
    await expect(root).toBeVisible();
    await root.getByTestId(`button-reply-${rootComment.id}`).click();

    const replyInput = root.getByTestId("input-comment");
    const missingUsername = `missing${Date.now().toString(36)}`;
    await replyInput.pressSequentially(`@${target.username}`);
    const targetSuggestion = page.getByRole("option").filter({
      hasText: `@${target.username}`,
    });
    await expect(targetSuggestion).toBeVisible();
    await targetSuggestion.click();
    await replyInput.pressSequentially(`and @${missingUsername}`);
    await root.getByTestId("button-submit-comment").click();

    const replyContent = root.locator('[data-testid^="comment-content-"]').last();
    await expect(replyContent).toBeVisible();
    await expect(replyContent).toContainText(`@${target.username} and @${missingUsername}`);

    const mentionLink = replyContent.getByTestId(`link-comment-mention-${target.id}`);
    await expect(mentionLink).toHaveCount(1);
    await expect(mentionLink).toHaveAttribute("href", `/u/${encodeURIComponent(target.username)}`);
    await expect(replyContent.locator("a")).toHaveCount(1);

    await mentionLink.click();
    await expect(page).toHaveURL(new RegExp(`/u/${target.username}$`));
    await expect(page.getByTestId("text-profile-username")).toHaveText(`@${target.username}`);
  } finally {
    await targetPage.close();
  }
});

test("reply mentions in private group rounds notify members and open the discussion", async ({
  page,
  browser,
}) => {
  const memberPage = await browser.newPage();
  const outsiderPage = await browser.newPage();

  try {
    await createAccount(page.request, "replyauthor");
    const member = await createAccount(memberPage.request, "replymember");
    await createAccount(outsiderPage.request, "replyoutsider");

    const groupResponse = await page.request.post("/api/groups", {
      data: {
        name: `Private reply mentions ${Date.now()}`,
        description: "Private group round for reply mention notifications",
        isPublic: false,
      },
    });
    expect(groupResponse.status(), await groupResponse.text()).toBe(201);
    const group = await groupResponse.json() as { id: number; inviteCode: string };

    const joinResponse = await memberPage.request.post("/api/groups/join", {
      data: { inviteCode: group.inviteCode },
    });
    expect(joinResponse.status(), await joinResponse.text()).toBe(200);

    const roundResponse = await page.request.post(`/api/groups/${group.id}/rounds`, {
      data: { gameSlug: "word-scramble" },
    });
    expect(roundResponse.status(), await roundResponse.text()).toBe(201);
    const round = await roundResponse.json() as { id: number };
    const discussionLink = `/groups/${group.id}/rounds/${round.id}/play#comments`;

    const rootResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "group_round",
        targetId: String(round.id),
        content: "A private group-round comment to reply to",
      },
    });
    expect(rootResponse.status(), await rootResponse.text()).toBe(201);
    const rootComment = await rootResponse.json() as { id: number };

    const streamConnected = memberPage.waitForResponse(response =>
      response.url().includes("/api/notifications/stream") && response.status() === 200,
    );
    await memberPage.goto("/");
    await dismissWhatsNew(memberPage);
    await streamConnected;

    await page.goto(discussionLink);
    await dismissWhatsNew(page);
    const root = page.getByTestId(`comment-${rootComment.id}`);
    await expect(root).toBeVisible();
    await root.getByTestId(`button-reply-${rootComment.id}`).click();

    const replyInput = root.getByTestId("input-comment");
    await replyInput.pressSequentially(`Thanks, @${member.username}`);
    const memberSuggestion = page.getByRole("option").filter({
      hasText: `@${member.username}`,
    });
    await expect(memberSuggestion).toBeVisible();
    await memberSuggestion.click();
    await root.getByTestId("button-submit-comment").click();

    const memberMentionNotifications = async () => {
      const response = await memberPage.request.get("/api/notifications");
      expect(response.ok()).toBeTruthy();
      const notifications = await response.json() as Notification[];
      return notifications.filter(notification => notification.type === "comment_mention");
    };
    await expect.poll(async () => (await memberMentionNotifications()).length).toBe(1);

    const notifications = await memberMentionNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].linkUrl).toBe(discussionLink);

    await memberPage.getByTestId("button-notifications-bell").click();
    const mentionNotification = memberPage.getByTestId(`notification-db-${notifications[0].id}`);
    await expect(mentionNotification).toBeVisible();
    await mentionNotification.click();
    await expect(memberPage).toHaveURL(
      new RegExp(`${discussionLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    );
    const discussion = memberPage.locator("#comments");
    await expect(discussion).toBeVisible();
    await expect(
      discussion.getByText(`Thanks, @${member.username}`),
    ).toBeVisible();

    const outsiderNotificationsResponse = await outsiderPage.request.get("/api/notifications");
    expect(outsiderNotificationsResponse.ok()).toBeTruthy();
    const outsiderNotifications = await outsiderNotificationsResponse.json() as Notification[];
    expect(outsiderNotifications.some(notification => notification.type === "comment_mention")).toBe(false);
    expect(outsiderNotifications.some(notification => notification.linkUrl === discussionLink)).toBe(false);
  } finally {
    await memberPage.close();
    await outsiderPage.close();
  }
});
