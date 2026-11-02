import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "FriendAlertTest123!";

async function createAccount(page: Page, username: string) {
  const email = `${username}@example.com`;
  const registration = await page.request.post("/api/auth/register", {
    data: { email, username, password: PASSWORD },
  });
  expect(registration.status()).toBe(201);

  const login = await page.request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(200);

  return (await registration.json()).user as { id: number; username: string };
}

async function dismissWhatsNew(page: Page) {
  const closeButton = page.getByTestId("button-whats-new-close");
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

test("refreshes missed notifications after network recovery and cancels retries on sign-out", async ({ page, browser }) => {
  const suffix = Date.now().toString(36);
  await createAccount(page, `rcsend${suffix}`);
  const recipientPage = await browser.newPage();

  try {
    const recipient = await createAccount(recipientPage, `rcrecv${suffix}`);
    await recipientPage.clock.install();
    await recipientPage.addInitScript(() => {
      const sources: Array<{
        onopen: ((event: Event) => void) | null;
        onerror: ((event: Event) => void) | null;
        onmessage: ((event: MessageEvent) => void) | null;
        closed: boolean;
        close: () => void;
      }> = [];

      if (sessionStorage.getItem("notification-stream-test-mode") === "real") {
        const NativeEventSource = window.EventSource;
        const realSources: EventSource[] = [];
        class TrackedEventSource extends NativeEventSource {
          constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
            const sourceUrl = new URL(url, window.location.href);
            if (realSources.length < 2) {
              sourceUrl.searchParams.set("testDisconnectAfterMs", "1000");
            }
            super(sourceUrl, eventSourceInitDict);
            realSources.push(this);
            this.addEventListener("open", () => {
              const target = window as Window & { __realNotificationStreamOpens?: number };
              target.__realNotificationStreamOpens = (target.__realNotificationStreamOpens ?? 0) + 1;
            });
            this.addEventListener("error", () => {
              const target = window as Window & { __realNotificationStreamErrors?: number };
              target.__realNotificationStreamErrors = (target.__realNotificationStreamErrors ?? 0) + 1;
            });
          }
        }

        Object.defineProperty(window, "EventSource", {
          configurable: true,
          value: TrackedEventSource,
        });
        Object.defineProperty(window, "__realNotificationSources", { value: realSources });
        return;
      }

      class ControlledEventSource {
        onopen: ((event: Event) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        closed = false;

        constructor(_url: string) {
          sources.push(this);
          queueMicrotask(() => {
            if (!this.closed) this.onopen?.(new Event("open"));
          });
        }

        close() {
          this.closed = true;
        }
      }

      Object.defineProperty(window, "EventSource", {
        configurable: true,
        value: ControlledEventSource,
      });
      Object.defineProperty(window, "__notificationTestSources", { value: sources });
    });

    const initialQueriesLoaded = Promise.all([
      recipientPage.waitForResponse((response) =>
        new URL(response.url()).pathname === "/api/notifications",
      ),
      recipientPage.waitForResponse((response) =>
        new URL(response.url()).pathname === "/api/notifications/unread-count",
      ),
    ]);
    await recipientPage.goto("/");
    await dismissWhatsNew(recipientPage);
    await initialQueriesLoaded;
    await expect.poll(() =>
      recipientPage.evaluate(() =>
        (window as Window & { __notificationTestSources?: unknown[] })
          .__notificationTestSources?.length ?? 0,
      ),
    ).toBe(1);

    const initialUnreadResponse = await recipientPage.request.get("/api/notifications/unread-count");
    expect(initialUnreadResponse.ok()).toBeTruthy();
    const initialUnreadCount = (await initialUnreadResponse.json()).count as number;

    await recipientPage.evaluate(() => {
      const sources = (window as Window & {
        __notificationTestSources: Array<{
          onerror: ((event: Event) => void) | null;
        }>;
      }).__notificationTestSources;
      sources[0].onerror?.(new Event("error"));
    });

    const requestResponse = await page.request.post("/api/friends/request", {
      data: { userId: recipient.id },
    });
    expect(requestResponse.status()).toBe(200);

    const refreshedNotifications = recipientPage.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/notifications",
    );
    const refreshedUnreadCount = recipientPage.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/notifications/unread-count",
    );
    await recipientPage.clock.fastForward(10_000);

    const [notificationsResponse, unreadCountResponse] = await Promise.all([
      refreshedNotifications,
      refreshedUnreadCount,
    ]);
    expect(notificationsResponse.ok()).toBeTruthy();
    expect(unreadCountResponse.ok()).toBeTruthy();
    const notifications = await notificationsResponse.json() as Array<{
      id: number;
      title: string;
    }>;
    const notification = notifications.find((item) => item.title === "New friend request");
    expect(notification).toBeDefined();
    expect((await unreadCountResponse.json()).count).toBe(initialUnreadCount + 1);

    await expect(recipientPage.getByTestId("badge-notification-count"))
      .toHaveText(String(initialUnreadCount + 1));
    await recipientPage.getByTestId("button-notifications-bell").click();
    await expect(recipientPage.getByTestId(`notification-db-${notification!.id}`)).toBeVisible();

    const sourcesCount = await recipientPage.evaluate(() =>
      (window as Window & { __notificationTestSources?: unknown[] })
        .__notificationTestSources?.length ?? 0,
    );
    expect(sourcesCount).toBe(2);

    const firstFriendship = await requestResponse.json() as { id: number };
    const markAllReadResponse = await recipientPage.request.post("/api/notifications/read-all");
    expect(markAllReadResponse.ok()).toBeTruthy();
    const acceptResponse = await recipientPage.request.post(`/api/friends/${firstFriendship.id}/accept`);
    expect(acceptResponse.ok()).toBeTruthy();
    const removeFriendResponse = await page.request.delete(`/api/friends/${firstFriendship.id}`);
    expect(removeFriendResponse.ok()).toBeTruthy();

    await recipientPage.evaluate(() => {
      sessionStorage.setItem("notification-stream-test-mode", "real");
    });
    const initialRealStream = recipientPage.waitForResponse((response) =>
      response.url().includes("/api/notifications/stream") && response.status() === 200,
    );
    await recipientPage.reload();
    await dismissWhatsNew(recipientPage);
    await initialRealStream;
    await expect.poll(() =>
      recipientPage.evaluate(() =>
        (window as Window & { __realNotificationSources?: EventSource[] })
          .__realNotificationSources?.length ?? 0,
      ),
    ).toBe(1);
    await expect.poll(() =>
      recipientPage.evaluate(() =>
        (window as Window & { __realNotificationStreamOpens?: number })
          .__realNotificationStreamOpens ?? 0,
      ),
    ).toBe(1);

    const initialRealUnreadResponse = await recipientPage.request.get("/api/notifications/unread-count");
    expect(initialRealUnreadResponse.ok()).toBeTruthy();
    const initialRealUnreadCount = (await initialRealUnreadResponse.json()).count as number;
    expect(initialRealUnreadCount).toBe(0);

    await recipientPage.context().setOffline(true);
    expect(await recipientPage.evaluate(() => navigator.onLine)).toBe(false);
    await expect.poll(() =>
      recipientPage.evaluate(() =>
        (window as Window & { __realNotificationStreamErrors?: number })
          .__realNotificationStreamErrors ?? 0,
      ),
    ).toBe(1);

    const missedRequestResponse = await page.request.post("/api/friends/request", {
      data: { userId: recipient.id },
    });
    expect(missedRequestResponse.status()).toBe(200);
    // Friend-request notifications are created asynchronously after the request response.
    await recipientPage.waitForTimeout(500);
    const badge = recipientPage.getByTestId("badge-notification-count");
    await expect(badge).toHaveCount(0);

    const reconnectedStream = recipientPage.waitForResponse((response) =>
      response.url().includes("/api/notifications/stream") && response.status() === 200,
    );
    const reconnectedNotifications = recipientPage.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/notifications",
    );
    const reconnectedUnreadCount = recipientPage.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/notifications/unread-count",
    );
    await recipientPage.context().setOffline(false);
    expect(await recipientPage.evaluate(() => navigator.onLine)).toBe(true);
    await recipientPage.clock.fastForward(12_000);
    const [reconnectedStreamResponse, refreshedNotificationsResponse, refreshedUnreadCountResponse] = await Promise.all([
      reconnectedStream,
      reconnectedNotifications,
      reconnectedUnreadCount,
    ]);
    expect(reconnectedStreamResponse.ok()).toBeTruthy();
    expect(refreshedNotificationsResponse.ok()).toBeTruthy();
    expect(refreshedUnreadCountResponse.ok()).toBeTruthy();

    await expect(badge).toHaveText(String(initialRealUnreadCount + 1));
    await expect.poll(() =>
      recipientPage.evaluate(() =>
        (window as Window & { __realNotificationStreamOpens?: number })
          .__realNotificationStreamOpens ?? 0,
      ),
    ).toBe(2);
    const latestNotificationsResponse = await recipientPage.request.get("/api/notifications");
    expect(latestNotificationsResponse.ok()).toBeTruthy();
    const latestNotifications = await latestNotificationsResponse.json() as Array<{
      id: number;
      title: string;
      readAt: string | null;
    }>;
    const missedNotification = latestNotifications.find((item) =>
      item.title === "New friend request" && item.readAt === null,
    );
    expect(missedNotification).toBeDefined();

    await recipientPage.getByTestId("button-notifications-bell").click();
    await expect(recipientPage.getByTestId(`notification-db-${missedNotification!.id}`)).toBeVisible();

    await expect.poll(() =>
      recipientPage.evaluate(() =>
        (window as Window & { __realNotificationStreamErrors?: number })
          .__realNotificationStreamErrors ?? 0,
      ),
    ).toBe(2);
    await recipientPage.getByTestId("button-user-menu").click();
    await recipientPage.getByTestId("button-signout").click();
    await expect(recipientPage.getByTestId("button-signin")).toBeVisible();

    // The second native stream has failed and scheduled a retry; signing out must cancel it.
    await recipientPage.clock.fastForward(13_000);
    expect(await recipientPage.evaluate(() =>
      (window as Window & { __realNotificationSources?: EventSource[] })
        .__realNotificationSources?.length ?? 0,
    )).toBe(2);
  } finally {
    await recipientPage.close();
  }
});

test("marking all notifications read explains failure and can be retried", async ({ page, browser }) => {
  const suffix = Date.now().toString(36);
  await createAccount(page, `allreadsend${suffix}`);
  const recipientPage = await browser.newPage();

  try {
    const recipient = await createAccount(recipientPage, `allreadrecv${suffix}`);
    await recipientPage.goto("/");
    await dismissWhatsNew(recipientPage);

    const requestResponse = await page.request.post("/api/friends/request", {
      data: { userId: recipient.id },
    });
    expect(requestResponse.status()).toBe(200);

    await expect(recipientPage.getByTestId("badge-notification-count")).toBeVisible();
    await recipientPage.getByTestId("button-notifications-bell").click();
    const alert = recipientPage.getByTestId(/^notification-db-/).first();
    await expect(alert).toBeVisible();

    let failedReadAllOnce = false;
    await recipientPage.route("**/api/notifications/read-all", async (route) => {
      if (!failedReadAllOnce) {
        failedReadAllOnce = true;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporary failure" }),
        });
        return;
      }

      await route.continue();
    });

    await recipientPage.getByTestId("button-mark-all-read").click();
    await expect(recipientPage.getByText("Couldn't mark all notifications as read")).toBeVisible();
    await expect(recipientPage.getByText("Your notifications are still unread. Please try again.")).toBeVisible();
    await expect(recipientPage.getByTestId("button-mark-all-read")).toBeEnabled();
    await expect(alert).toBeVisible();
    await expect(recipientPage.getByTestId("badge-notification-count")).toBeVisible();

    const unreadCountResponse = await recipientPage.request.get("/api/notifications/unread-count");
    expect(unreadCountResponse.ok()).toBeTruthy();
    expect((await unreadCountResponse.json()).count).toBeGreaterThan(0);

    const notificationsResponse = await recipientPage.request.get("/api/notifications");
    expect(notificationsResponse.ok()).toBeTruthy();
    const notifications = await notificationsResponse.json() as Array<{ id: number; readAt: string | null }>;
    const unreadNotification = notifications.find((notification) => notification.readAt === null);
    expect(unreadNotification).toBeDefined();

    await recipientPage.getByTestId("button-mark-all-read").click();
    await expect(recipientPage.getByTestId("badge-notification-count")).toHaveCount(0);
    await expect(alert).toBeVisible();

    await expect.poll(async () => {
      const response = await recipientPage.request.get("/api/notifications");
      expect(response.ok()).toBeTruthy();
      const updatedNotifications = await response.json() as Array<{ id: number; readAt: string | null }>;
      return updatedNotifications.find((notification) => notification.id === unreadNotification!.id)?.readAt ?? null;
    }).not.toBeNull();
  } finally {
    await recipientPage.close();
  }
});

for (const requestNote of ["A note with the request", undefined]) {
  test(`friend-request notification opens pending requests${requestNote ? " with a note" : " without a note"}`, async ({
    page,
    browser,
  }) => {
    const suffix = Date.now().toString(36);
    const sender = await createAccount(page, `alertsend${suffix}`);
    const recipientPage = await browser.newPage();

    try {
      const recipient = await createAccount(recipientPage, `alertrecv${suffix}`);
      const streamConnected = recipientPage.waitForResponse((response) =>
        response.url().includes("/api/notifications/stream") && response.status() === 200,
      );
      await recipientPage.goto("/");
      await dismissWhatsNew(recipientPage);
      await streamConnected;

      const unreadCountResponse = await recipientPage.request.get("/api/notifications/unread-count");
      expect(unreadCountResponse.ok()).toBeTruthy();
      const initialUnreadCount = (await unreadCountResponse.json()).count as number;

      const requestResponse = await page.request.post("/api/friends/request", {
        data: {
          userId: recipient.id,
          ...(requestNote ? { note: requestNote } : {}),
        },
      });
      expect(requestResponse.status()).toBe(200);

      await expect(recipientPage.getByTestId("badge-notification-count"))
        .toHaveText(String(initialUnreadCount + 1));
      await expect(recipientPage).toHaveURL(/\/$/);

      const notificationResponse = await recipientPage.request.get("/api/notifications");
      expect(notificationResponse.ok()).toBeTruthy();
      const notifications = await notificationResponse.json() as Array<{
        id: number;
        title: string;
        body: string;
        linkUrl: string | null;
        readAt: string | null;
      }>;
      const notification = notifications.find((item) => item.title === "New friend request");
      expect(notification).toBeDefined();
      expect(notification?.body).toBe(
        `@${sender.username} wants to be your friend${requestNote ? `: ${requestNote}` : ""}`,
      );
      expect(notification?.linkUrl).toBe("/friends?tab=requests");
      expect(notification?.readAt).toBeNull();

      await recipientPage.getByTestId("button-notifications-bell").click();
      const alert = recipientPage.getByTestId(`notification-db-${notification!.id}`);
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(notification!.body);

      let failedReadOnce = false;
      await recipientPage.route(`**/api/notifications/${notification!.id}/read`, async (route) => {
        if (!failedReadOnce) {
          failedReadOnce = true;
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Temporary failure" }),
          });
          return;
        }

        await route.continue();
      });

      await alert.click();
      await expect(recipientPage.getByText("Couldn't mark notification as read")).toBeVisible();
      await expect(recipientPage.getByTestId("panel-notifications")).toBeVisible();
      await expect(alert).toBeVisible();
      await expect(recipientPage).toHaveURL(/\/$/);
      await expect(recipientPage.getByTestId("badge-notification-count"))
        .toHaveText(String(initialUnreadCount + 1));

      await alert.click();

      await expect(recipientPage).toHaveURL(/\/friends\?tab=requests$/);
      await expect(recipientPage.getByTestId("tab-requests")).toHaveAttribute("data-state", "active");
      await expect(recipientPage.getByTestId(`row-request-${(await requestResponse.json()).id}`)).toBeVisible();
      await expect(recipientPage.getByTestId("badge-notification-count")).toHaveCount(0);

      await expect.poll(async () => {
        const response = await recipientPage.request.get("/api/notifications");
        expect(response.ok()).toBeTruthy();
        const updatedNotifications = await response.json() as Array<{ id: number; readAt: string | null }>;
        return updatedNotifications.find((item) => item.id === notification!.id)?.readAt ?? null;
      }).not.toBeNull();

      const updatedUnreadCountResponse = await recipientPage.request.get("/api/notifications/unread-count");
      expect(updatedUnreadCountResponse.ok()).toBeTruthy();
      expect((await updatedUnreadCountResponse.json()).count).toBe(initialUnreadCount);
    } finally {
      await recipientPage.close();
    }
  });
}

test("disabled friend-request notifications do not hide incoming requests", async ({ page, browser }) => {
  const suffix = Date.now().toString(36);
  await createAccount(page, `mutsend${suffix}`);
  const recipientPage = await browser.newPage();
  const recipientEmail = `mutrecv${suffix}@example.com`;

  try {
    const recipient = await createAccount(recipientPage, `mutrecv${suffix}`);
    await recipientPage.goto("/settings/notifications");
    await dismissWhatsNew(recipientPage);
    await expect(recipientPage.getByTestId("heading-notification-settings")).toBeVisible();

    const friendRequestPreference = recipientPage.getByTestId("switch-notif-pref-friend_request_received");
    await expect(friendRequestPreference).toHaveAttribute("aria-checked", "true");
    await friendRequestPreference.click();
    await expect(friendRequestPreference).toHaveAttribute("aria-checked", "false");

    const preferencesResponse = await recipientPage.request.get("/api/notification-preferences");
    expect(preferencesResponse.ok()).toBeTruthy();
    expect((await preferencesResponse.json()).friend_request_received).toBe(false);

    const logoutResponse = await recipientPage.request.post("/api/auth/logout");
    expect(logoutResponse.ok()).toBeTruthy();
    const signedOutResponse = await recipientPage.request.get("/api/auth/me");
    expect(signedOutResponse.ok()).toBeTruthy();
    expect((await signedOutResponse.json()).user).toBeNull();

    const loginResponse = await recipientPage.request.post("/api/auth/login", {
      data: { email: recipientEmail, password: PASSWORD },
    });
    expect(loginResponse.status()).toBe(200);
    expect((await loginResponse.json()).user.id).toBe(recipient.id);

    await recipientPage.goto("/settings/notifications");
    await expect(recipientPage.getByTestId("heading-notification-settings")).toBeVisible();
    const persistedPreference = recipientPage.getByTestId("switch-notif-pref-friend_request_received");
    await expect(persistedPreference).toHaveAttribute("aria-checked", "false");
    const persistedPreferencesResponse = await recipientPage.request.get("/api/notification-preferences");
    expect(persistedPreferencesResponse.ok()).toBeTruthy();
    expect((await persistedPreferencesResponse.json()).friend_request_received).toBe(false);

    const streamConnected = recipientPage.waitForResponse((response) =>
      response.url().includes("/api/notifications/stream") && response.status() === 200,
    );
    await recipientPage.goto("/");
    await dismissWhatsNew(recipientPage);
    await streamConnected;

    const initialUnreadResponse = await recipientPage.request.get("/api/notifications/unread-count");
    expect(initialUnreadResponse.ok()).toBeTruthy();
    const initialUnreadCount = (await initialUnreadResponse.json()).count as number;

    const requestResponse = await page.request.post("/api/friends/request", {
      data: { userId: recipient.id },
    });
    expect(requestResponse.status()).toBe(200);
    const request = await requestResponse.json() as { id: number };

    await expect.poll(async () => {
      const response = await recipientPage.request.get("/api/friends/requests");
      expect(response.ok()).toBeTruthy();
      const requests = await response.json() as Array<{ id: number }>;
      return requests.some((item) => item.id === request.id);
    }).toBe(true);

    // The server starts preference-checked notification creation asynchronously with the request response.
    await recipientPage.waitForTimeout(500);

    const [notificationsResponse, unreadCountResponse] = await Promise.all([
      recipientPage.request.get("/api/notifications"),
      recipientPage.request.get("/api/notifications/unread-count"),
    ]);
    expect(notificationsResponse.ok()).toBeTruthy();
    expect(unreadCountResponse.ok()).toBeTruthy();
    const notifications = await notificationsResponse.json() as Array<{ type: string; title: string }>;
    expect(notifications.some((item) => item.type === "friend_request_received")).toBe(false);
    expect((await unreadCountResponse.json()).count).toBe(initialUnreadCount);
    await expect(recipientPage).toHaveURL(/\/$/);
    await expect(recipientPage.getByTestId("badge-notification-count")).toHaveCount(0);

    await recipientPage.getByTestId("button-notifications-bell").click();
    await expect(recipientPage.getByTestId("panel-notifications")).toBeVisible();
    await expect(recipientPage.getByText("New friend request")).toHaveCount(0);

    await recipientPage.goto(`/friends?tab=requests`);
    await expect(recipientPage.getByTestId("tab-requests")).toHaveAttribute("data-state", "active");
    await expect(recipientPage.getByTestId(`row-request-${request.id}`)).toBeVisible();
  } finally {
    await recipientPage.close();
  }
});
