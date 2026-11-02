import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  location: { configurable: true, value: dom.window.location },
  addEventListener: {
    configurable: true,
    value: dom.window.addEventListener.bind(dom.window),
  },
  removeEventListener: {
    configurable: true,
    value: dom.window.removeEventListener.bind(dom.window),
  },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
});

const originalFetch = globalThis.fetch;
let container: HTMLDivElement | undefined;
let root: Root | undefined;
let savedAchievementSharing = false;
let failAchievementSharingPatch = false;
let savedGroupJoin = false;
let failGroupJoinPatch = false;
let delayGroupJoinPatches = false;
let pendingGroupJoinPatches: Array<{
  enabled: boolean;
  resolve: (response: Response) => void;
}> = [];
let delayCommentReplyPatches = false;
let pendingCommentReplyPatches: Array<{
  enabled: boolean;
  resolve: (response: Response) => void;
}> = [];
let failBulkPreferencePatch = false;
let delayBulkPreferencePatch = false;
let pendingBulkPreferencePatches: Array<{
  enabled: boolean;
  resolve: (response: Response) => void;
}> = [];
let savedCommentReply = false;
let preferenceUpdates: Array<{ method: string; path: string; body: unknown }> = [];
let bulkPreferenceUpdates: Array<{ method: string; path: string; body: unknown }> = [];
let preferenceReads = 0;

function ToastMessageCapture() {
  const { toasts } = useToast();
  return (
    <div data-testid="toast-messages">
      {toasts.map(({ id, title }) => (
        <p key={id}>{title}</p>
      ))}
    </div>
  );
}

async function flushUpdates() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderNotificationSettings() {
  const { createRoot } = await import("react-dom/client");
  const { AuthProvider } = await import("@/lib/auth-context");
  const NotificationSettings = (await import("./notification-settings")).default;

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <>
            <NotificationSettings />
            <ToastMessageCapture />
          </>
        </AuthProvider>
      </QueryClientProvider>,
    );
  });
  await flushUpdates();
}

function achievementSharingSwitch() {
  const control = container?.querySelector<HTMLButtonElement>(
    '[data-testid="switch-share-achievement-updates"]',
  );
  assert.ok(control, "Expected the achievement-sharing switch to be visible");
  return control;
}

function groupJoinSwitch() {
  const control = container?.querySelector<HTMLButtonElement>(
    '[data-testid="switch-notif-pref-group_join"]',
  );
  assert.ok(control, "Expected the group-join notification switch to be visible");
  return control;
}

function allNotificationsSwitch() {
  const control = container?.querySelector<HTMLButtonElement>(
    '[data-testid="switch-all-notifications"]',
  );
  assert.ok(control, "Expected the all-notifications switch to be visible");
  return control;
}

test.beforeEach(() => {
  savedAchievementSharing = false;
  failAchievementSharingPatch = false;
  savedGroupJoin = false;
  failGroupJoinPatch = false;
  delayGroupJoinPatches = false;
  pendingGroupJoinPatches = [];
  delayCommentReplyPatches = false;
  pendingCommentReplyPatches = [];
  failBulkPreferencePatch = false;
  delayBulkPreferencePatch = false;
  pendingBulkPreferencePatches = [];
  savedCommentReply = false;
  preferenceUpdates = [];
  bulkPreferenceUpdates = [];
  preferenceReads = 0;
  queryClient.clear();

  globalThis.fetch = (async (input, init) => {
    const path = String(input);
    if (path === "/api/auth/me") {
      return {
        ok: true,
        json: async () => ({ user: { id: 42, username: "word_player" } }),
      } as Response;
    }
    if (path === "/api/notification-preferences" && (!init?.method || init.method === "GET")) {
      preferenceReads += 1;
      return {
        ok: true,
        json: async () => ({
          share_achievement_unlocked: savedAchievementSharing,
          group_join: savedGroupJoin,
          comment_reply: savedCommentReply,
          friend_challenge_received: true,
          friend_challenge_result: true,
          friend_challenge_declined: true,
          friend_challenge_cancelled: true,
        }),
      } as Response;
    }
    if (path === "/api/notification-preferences" && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      bulkPreferenceUpdates.push({ method: init.method, path, body });
      if (failBulkPreferencePatch) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "Could not save preferences",
        } as Response;
      }
      if (delayBulkPreferencePatch) {
        return new Promise<Response>((resolve) => {
          pendingBulkPreferencePatches.push({ enabled: body.enabled, resolve });
        });
      }
      savedGroupJoin = body.enabled;
      savedCommentReply = body.enabled;
      return { ok: true } as Response;
    }
    if (path === "/api/notification-preferences/share_achievement_unlocked") {
      const body = JSON.parse(String(init?.body));
      preferenceUpdates.push({ method: init?.method ?? "", path, body });
      if (failAchievementSharingPatch) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "Could not save preference",
        } as Response;
      }
      savedAchievementSharing = body.enabled;
      return { ok: true } as Response;
    }
    if (path === "/api/notification-preferences/group_join") {
      const body = JSON.parse(String(init?.body));
      preferenceUpdates.push({ method: init?.method ?? "", path, body });
      if (delayGroupJoinPatches) {
        return new Promise<Response>((resolve) => {
          pendingGroupJoinPatches.push({ enabled: body.enabled, resolve });
        });
      }
      if (failGroupJoinPatch) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => "Could not save preference",
        } as Response;
      }
      savedGroupJoin = body.enabled;
      return { ok: true } as Response;
    }
    if (path.startsWith("/api/notification-preferences/") && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      preferenceUpdates.push({ method: init.method, path, body });
      const type = path.split("/").at(-1);
      if (type === "comment_reply") {
        if (delayCommentReplyPatches) {
          return new Promise<Response>((resolve) => {
            pendingCommentReplyPatches.push({ enabled: body.enabled, resolve });
          });
        }
        savedCommentReply = body.enabled;
      }
      return { ok: true } as Response;
    }
    throw new Error(`Unexpected request: ${path}`);
  }) as typeof fetch;
});

test.afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
  }
  container?.remove();
  document.body.replaceChildren();
  root = undefined;
  container = undefined;
  queryClient.clear();
  globalThis.fetch = originalFetch;
});

test("achievement sharing reflects the saved preference and refreshes after toggling", async () => {
  await renderNotificationSettings();

  const sharingSwitch = achievementSharingSwitch();
  assert.equal(sharingSwitch.getAttribute("role"), "switch");
  assert.equal(sharingSwitch.getAttribute("aria-checked"), "false");
  assert.equal(sharingSwitch.getAttribute("data-state"), "unchecked");
  assert.equal(preferenceReads, 1);

  await act(async () => {
    sharingSwitch.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.deepEqual(preferenceUpdates, [
    {
      method: "PATCH",
      path: "/api/notification-preferences/share_achievement_unlocked",
      body: { enabled: true },
    },
  ]);
  assert.equal(savedAchievementSharing, true);
  assert.ok(preferenceReads >= 2, "Expected preferences to be refetched after saving");
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");
  assert.equal(achievementSharingSwitch().getAttribute("data-state"), "checked");
});

test("individual notification toggle leaves saved achievement sharing unchanged", async () => {
  savedAchievementSharing = true;
  await renderNotificationSettings();

  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "false");
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");

  await act(async () => {
    groupJoinSwitch().dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.deepEqual(
    preferenceUpdates.map(({ path, body }) => ({ path, body })),
    [
      {
        path: "/api/notification-preferences/group_join",
        body: { enabled: true },
      },
    ],
    "Changing one notification should only update that notification preference",
  );
  assert.equal(savedGroupJoin, true);
  assert.equal(savedAchievementSharing, true);
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");
  assert.equal(achievementSharingSwitch().getAttribute("data-state"), "checked");
});

test("separate notification changes both save while their requests overlap", async () => {
  savedAchievementSharing = true;
  delayGroupJoinPatches = true;
  delayCommentReplyPatches = true;
  await renderNotificationSettings();

  const commentReplySwitch = container?.querySelector<HTMLButtonElement>(
    '[data-testid="switch-notif-pref-comment_reply"]',
  );
  assert.ok(commentReplySwitch, "Expected the comment-reply switch to be visible");

  await act(async () => {
    groupJoinSwitch().dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    commentReplySwitch.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.equal(pendingGroupJoinPatches.length, 1, "Expected the group-join save to remain pending");
  assert.equal(pendingCommentReplyPatches.length, 1, "Expected the comment-reply save to remain pending");
  assert.deepEqual(
    preferenceUpdates.map(({ path, body }) => ({ path, body })),
    [
      {
        path: "/api/notification-preferences/group_join",
        body: { enabled: true },
      },
      {
        path: "/api/notification-preferences/comment_reply",
        body: { enabled: true },
      },
    ],
    "Each switch should patch only its own preference",
  );

  await act(async () => {
    savedCommentReply = pendingCommentReplyPatches[0].enabled;
    pendingCommentReplyPatches[0].resolve({ ok: true } as Response);
  });
  await flushUpdates();

  await act(async () => {
    savedGroupJoin = pendingGroupJoinPatches[0].enabled;
    pendingGroupJoinPatches[0].resolve({ ok: true } as Response);
  });
  await flushUpdates();

  assert.equal(savedGroupJoin, true, "The group-join preference should remain saved");
  assert.equal(savedCommentReply, true, "The comment-reply preference should remain saved");
  assert.ok(preferenceReads >= 2, "Expected preferences to be refreshed after the saves");
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "true");
  assert.equal(groupJoinSwitch().getAttribute("data-state"), "checked");
  assert.equal(commentReplySwitch.getAttribute("aria-checked"), "true");
  assert.equal(commentReplySwitch.getAttribute("data-state"), "checked");
  assert.equal(savedAchievementSharing, true);
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");
  assert.equal(achievementSharingSwitch().getAttribute("data-state"), "checked");
  assert.ok(
    preferenceUpdates.every(
      ({ path }) => path !== "/api/notification-preferences/share_achievement_unlocked",
    ),
    "Separate notification changes must not patch achievement sharing",
  );
});

test("all-notifications toggle leaves the saved achievement-sharing preference unchanged", async () => {
  savedAchievementSharing = true;
  await renderNotificationSettings();

  const sharingSwitch = achievementSharingSwitch();
  assert.equal(sharingSwitch.getAttribute("aria-checked"), "true");

  await act(async () => {
    allNotificationsSwitch().dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.deepEqual(bulkPreferenceUpdates, [
    {
      method: "PATCH",
      path: "/api/notification-preferences",
      body: { enabled: true },
    },
  ]);
  assert.deepEqual(preferenceUpdates, [], "The bulk update must not patch achievement sharing individually");
  assert.equal(savedAchievementSharing, true);
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");
  assert.equal(achievementSharingSwitch().getAttribute("data-state"), "checked");
});

test("an individual choice made during an all-notifications save is saved last", async () => {
  delayBulkPreferencePatch = true;
  await renderNotificationSettings();

  await act(async () => {
    allNotificationsSwitch().dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.equal(pendingBulkPreferencePatches.length, 1, "Expected the bulk save to remain pending");
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "true");

  await act(async () => {
    groupJoinSwitch().dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "false");
  assert.deepEqual(preferenceUpdates, [], "The individual save should wait for the bulk save");

  await act(async () => {
    savedGroupJoin = pendingBulkPreferencePatches[0].enabled;
    savedCommentReply = pendingBulkPreferencePatches[0].enabled;
    pendingBulkPreferencePatches[0].resolve({ ok: true } as Response);
  });
  await flushUpdates();

  assert.deepEqual(
    preferenceUpdates.map(({ path, body }) => ({ path, body })),
    [{ path: "/api/notification-preferences/group_join", body: { enabled: false } }],
    "The individual choice should be sent after the bulk update",
  );
  assert.equal(savedGroupJoin, false, "The saved value should match the latest individual choice");
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "false");
  assert.equal(groupJoinSwitch().getAttribute("data-state"), "unchecked");
});

test("category toggle leaves the saved achievement-sharing preference unchanged", async () => {
  savedAchievementSharing = true;
  await renderNotificationSettings();

  await act(async () => {
    container
      ?.querySelector<HTMLButtonElement>('[data-testid="button-category-toggle-social"]')
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.ok(
    preferenceUpdates.some((update) => update.path === "/api/notification-preferences/achievement_unlocked"),
    "Expected the Social category toggle to update its achievement notification type",
  );
  assert.ok(
    preferenceUpdates.every(
      (update) => update.path !== "/api/notification-preferences/share_achievement_unlocked",
    ),
    "The category toggle must not patch the separate achievement-sharing preference",
  );
  assert.equal(savedAchievementSharing, true);
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");
  assert.equal(achievementSharingSwitch().getAttribute("data-state"), "checked");
});

test("muting Friend Challenges leaves saved achievement sharing unchanged", async () => {
  savedAchievementSharing = true;
  await renderNotificationSettings();

  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");

  await act(async () => {
    container
      ?.querySelector<HTMLButtonElement>(
        '[data-testid="button-subcategory-toggle-friend-challenges"]',
      )
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.deepEqual(
    preferenceUpdates.map(({ path, body }) => ({ path, body })),
    [
      {
        path: "/api/notification-preferences/friend_challenge_received",
        body: { enabled: false },
      },
      {
        path: "/api/notification-preferences/friend_challenge_result",
        body: { enabled: false },
      },
      {
        path: "/api/notification-preferences/friend_challenge_declined",
        body: { enabled: false },
      },
      {
        path: "/api/notification-preferences/friend_challenge_cancelled",
        body: { enabled: false },
      },
    ],
    "Muting Friend Challenges should update only its notification preferences",
  );
  assert.equal(savedAchievementSharing, true);
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");
  assert.equal(achievementSharingSwitch().getAttribute("data-state"), "checked");
});

test("failed all-notifications update restores saved preferences and shows an error", async () => {
  savedAchievementSharing = true;
  savedGroupJoin = false;
  failBulkPreferencePatch = true;
  await renderNotificationSettings();

  assert.equal(allNotificationsSwitch().getAttribute("aria-checked"), "false");
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "false");

  await act(async () => {
    allNotificationsSwitch().dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.deepEqual(bulkPreferenceUpdates, [
    {
      method: "PATCH",
      path: "/api/notification-preferences",
      body: { enabled: true },
    },
  ]);
  assert.equal(allNotificationsSwitch().getAttribute("aria-checked"), "false");
  assert.equal(allNotificationsSwitch().getAttribute("data-state"), "unchecked");
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "true");
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "false");
  assert.equal(groupJoinSwitch().getAttribute("data-state"), "unchecked");
  assert.ok(
    container?.querySelector('[data-testid="toast-messages"]')?.textContent?.includes(
      "Failed to update preferences",
    ),
    "Expected the existing bulk preference save error to be shown",
  );
});

test("failed achievement-sharing update restores the saved value and shows an error", async () => {
  failAchievementSharingPatch = true;
  await renderNotificationSettings();

  const sharingSwitch = achievementSharingSwitch();
  assert.equal(sharingSwitch.getAttribute("aria-checked"), "false");

  await act(async () => {
    sharingSwitch.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.equal(savedAchievementSharing, false);
  assert.equal(achievementSharingSwitch().getAttribute("aria-checked"), "false");
  assert.equal(achievementSharingSwitch().getAttribute("data-state"), "unchecked");
  assert.ok(
    container?.querySelector('[data-testid="toast-messages"]')?.textContent?.includes(
      "Failed to update preference",
    ),
    "Expected the existing preference save error to be shown",
  );
});

test("failed category notification update restores the saved value and shows an error", async () => {
  failGroupJoinPatch = true;
  await renderNotificationSettings();

  const switchControl = groupJoinSwitch();
  assert.equal(switchControl.getAttribute("aria-checked"), "false");

  await act(async () => {
    switchControl.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.deepEqual(preferenceUpdates, [
    {
      method: "PATCH",
      path: "/api/notification-preferences/group_join",
      body: { enabled: true },
    },
  ]);
  assert.equal(savedGroupJoin, false);
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "false");
  assert.equal(groupJoinSwitch().getAttribute("data-state"), "unchecked");
  assert.ok(
    container?.querySelector('[data-testid="toast-messages"]')?.textContent?.includes(
      "Failed to update preference",
    ),
    "Expected the existing preference save error to be shown",
  );
});

test("an earlier failed save cannot undo a newer rapid notification choice", async () => {
  delayGroupJoinPatches = true;
  await renderNotificationSettings();

  const changeGroupJoin = async () => {
    await act(async () => {
      groupJoinSwitch().dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    await flushUpdates();
  };

  await changeGroupJoin();
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "true");
  await changeGroupJoin();
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "false");
  await changeGroupJoin();
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "true");
  assert.equal(pendingGroupJoinPatches.length, 3);

  await act(async () => {
    savedGroupJoin = pendingGroupJoinPatches[1].enabled;
    pendingGroupJoinPatches[1].resolve({ ok: true } as Response);
  });
  await flushUpdates();

  await act(async () => {
    savedGroupJoin = pendingGroupJoinPatches[2].enabled;
    pendingGroupJoinPatches[2].resolve({ ok: true } as Response);
  });
  await flushUpdates();

  const toastMessagesBeforeStaleFailure = container
    ?.querySelector('[data-testid="toast-messages"]')
    ?.textContent;
  await act(async () => {
    pendingGroupJoinPatches[0].resolve({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Could not save preference",
    } as Response);
  });
  await flushUpdates();

  assert.equal(savedGroupJoin, true, "The latest successful choice should remain saved");
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "true");
  assert.equal(groupJoinSwitch().getAttribute("data-state"), "checked");
  assert.equal(
    container?.querySelector('[data-testid="toast-messages"]')?.textContent,
    toastMessagesBeforeStaleFailure,
    "A stale failure should not report the latest successful choice as failed",
  );
});

test("category toggle keeps successful saves when another preference save fails", async () => {
  savedGroupJoin = false;
  savedCommentReply = false;
  failGroupJoinPatch = true;
  await renderNotificationSettings();

  await act(async () => {
    container
      ?.querySelector<HTMLButtonElement>('[data-testid="button-category-toggle-social"]')
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushUpdates();

  assert.equal(savedGroupJoin, false, "The failed preference should keep its saved value");
  assert.equal(savedCommentReply, true, "The successful preference should remain saved");
  assert.equal(groupJoinSwitch().getAttribute("aria-checked"), "false");
  const commentReplySwitch = container?.querySelector<HTMLButtonElement>(
    '[data-testid="switch-notif-pref-comment_reply"]',
  );
  assert.ok(commentReplySwitch, "Expected the comment-reply switch to be visible");
  assert.equal(commentReplySwitch.getAttribute("aria-checked"), "true");
  assert.ok(
    container?.querySelector('[data-testid="toast-messages"]')?.textContent?.includes(
      "Failed to update preference",
    ),
    "Expected the existing preference save error to be shown",
  );
});
