import { useState, useEffect } from "react";

export function useCountdown(isoDeadline: string, enabled = true): number {
  const [remaining, setRemaining] = useState(() => new Date(isoDeadline).getTime() - Date.now());
  useEffect(() => {
    if (!enabled) return;
    setRemaining(new Date(isoDeadline).getTime() - Date.now());
    const id = setInterval(() => {
      setRemaining(new Date(isoDeadline).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [isoDeadline, enabled]);
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
