import { useState, useEffect } from "react";

/** Accepts an ISO string, an epoch-ms number, or null (disabled).
 *  Returns remaining milliseconds, updated every `intervalMs` (default 1000).
 *  Returns 0 when deadline is null or in the past. */
export function useCountdown(
  deadline: string | number | null,
  enabled = true,
  intervalMs = 1000,
): number {
  const toMs = (d: string | number) =>
    typeof d === "number" ? d : new Date(d).getTime();

  const [remaining, setRemaining] = useState(() =>
    deadline !== null ? Math.max(0, toMs(deadline) - Date.now()) : 0,
  );

  useEffect(() => {
    if (!enabled || deadline === null) {
      setRemaining(0);
      return;
    }
    setRemaining(Math.max(0, toMs(deadline) - Date.now()));
    const id = setInterval(() => {
      setRemaining(Math.max(0, toMs(deadline) - Date.now()));
    }, intervalMs);
    return () => clearInterval(id);
  }, [deadline, enabled, intervalMs]);

  return remaining;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Drawing bracket…";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}
