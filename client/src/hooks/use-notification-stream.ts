import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export function useNotificationStream(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    let source: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource("/api/notifications/stream");
      source.onmessage = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      };
      source.onerror = () => {
        source?.close();
        retryTimeout = setTimeout(connect, 10000);
      };
    };
    connect();

    return () => {
      source?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [isAuthenticated]);
}
