import { useEffect } from "react";
import { refreshNotificationQueries } from "@/lib/queryClient";

const INITIAL_RETRY_DELAY_MS = 10_000;
const MAX_RETRY_DELAY_MS = 60_000;
const RETRY_JITTER_RATIO = 0.2;
const STREAM_LOCK_NAME = "notifications-event-stream";
const LOCK_RETRY_DELAY_MS = 1_000;
const CHANNEL_NAME = "notifications-event-stream";

type NotificationStreamEvent =
  | { type: "new_notification" }
  | { type: "group_discussion_access_revoked"; groupId: number };

function parseNotificationEvent(data: string): NotificationStreamEvent | null {
  let event: { type?: unknown; groupId?: unknown };
  try {
    event = JSON.parse(data);
  } catch {
    return null;
  }

  if (event.type === "new_notification") return { type: "new_notification" };
  if (
    event.type === "group_discussion_access_revoked"
    && Number.isSafeInteger(event.groupId)
  ) {
    return {
      type: "group_discussion_access_revoked",
      groupId: event.groupId as number,
    };
  }
  return null;
}

export function useNotificationStream(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    let source: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let lockRetryTimeout: ReturnType<typeof setTimeout> | null = null;
    let hasConnected = false;
    let retryDelay = INITIAL_RETRY_DELAY_MS;
    let isDisposed = false;
    let coordinationActive = false;
    let lockRequestPending = false;
    let releaseLock: (() => void) | null = null;
    let channel: BroadcastChannel | null = null;

    const connect = () => {
      if (isDisposed || source) return;
      const currentSource = new EventSource("/api/notifications/stream");
      source = currentSource;
      currentSource.onopen = () => {
        if (isDisposed || source !== currentSource) return;
        if (hasConnected) {
          const resyncEvent: NotificationStreamEvent = { type: "new_notification" };
          handleNotificationEvent(resyncEvent);
          broadcastNotificationEvent(resyncEvent);
        }
        hasConnected = true;
        retryDelay = INITIAL_RETRY_DELAY_MS;
      };
      currentSource.onmessage = (message) => {
        const event = parseNotificationEvent(message.data);
        if (!event) return;
        handleNotificationEvent(event);
        broadcastNotificationEvent(event);
      };
      currentSource.onerror = () => {
        if (isDisposed || source !== currentSource) return;
        currentSource.close();
        source = null;
        const jitteredRetryDelay = Math.floor(
          retryDelay * (1 - RETRY_JITTER_RATIO + Math.random() * RETRY_JITTER_RATIO * 2),
        );
        retryTimeout = setTimeout(() => {
          retryTimeout = null;
          connect();
        }, Math.min(jitteredRetryDelay, MAX_RETRY_DELAY_MS));
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      };
    };

    const handleNotificationEvent = (event: NotificationStreamEvent) => {
      if (event.type === "new_notification") {
        refreshNotificationQueries();
      } else if (event.type === "group_discussion_access_revoked") {
        window.dispatchEvent(new window.CustomEvent("group-discussion-access-revoked", {
          detail: { groupId: event.groupId },
        }));
      }
    };

    const broadcastNotificationEvent = (event: NotificationStreamEvent) => {
      if (!coordinationActive || !channel) return;
      try {
        channel.postMessage({ type: "notification-stream-event", event });
      } catch {
        disableCoordination();
      }
    };

    const disableCoordination = () => {
      coordinationActive = false;
      channel?.close();
      channel = null;
      if (!source) connect();
    };

    const stopConnection = () => {
      source?.close();
      source = null;
      if (retryTimeout !== null) clearTimeout(retryTimeout);
      retryTimeout = null;
    };

    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    if (
      typeof BroadcastChannel === "undefined"
      || !locks
    ) {
      connect();
    } else {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        coordinationActive = true;
        channel.onmessage = (message: MessageEvent) => {
          const data = message.data as {
            type?: unknown;
            event?: unknown;
          } | null;
          if (
            data?.type === "notification-stream-event"
            && data.event
            && typeof data.event === "object"
            && "type" in data.event
          ) {
            const event = data.event as NotificationStreamEvent;
            if (
              event.type === "new_notification"
              || (
                event.type === "group_discussion_access_revoked"
                && Number.isSafeInteger(event.groupId)
              )
            ) {
              handleNotificationEvent(event);
            }
          }
        };
        channel.onmessageerror = disableCoordination;

        const acquireStreamLock = async () => {
          if (isDisposed || !coordinationActive || lockRequestPending) return;
          lockRequestPending = true;
          try {
            await locks.request(
              STREAM_LOCK_NAME,
              { mode: "exclusive", ifAvailable: true },
              async (lock) => {
                lockRequestPending = false;
                if (!lock || isDisposed || !coordinationActive) {
                  if (!isDisposed && coordinationActive) {
                    lockRetryTimeout = setTimeout(() => {
                      lockRetryTimeout = null;
                      void acquireStreamLock();
                    }, LOCK_RETRY_DELAY_MS);
                  }
                  return;
                }

                connect();
                await new Promise<void>((resolve) => {
                  releaseLock = resolve;
                });
                releaseLock = null;
                stopConnection();
              },
            );
          } catch {
            lockRequestPending = false;
            disableCoordination();
          }
        };

        void acquireStreamLock();
      } catch {
        disableCoordination();
      }
    }

    return () => {
      isDisposed = true;
      coordinationActive = false;
      releaseLock?.();
      channel?.close();
      if (lockRetryTimeout !== null) clearTimeout(lockRetryTimeout);
      lockRetryTimeout = null;
      stopConnection();
    };
  }, [isAuthenticated]);
}
