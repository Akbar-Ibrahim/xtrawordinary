import { useEffect, useState } from "react";
import type { GroupRound } from "@shared/schema";
import { GAME_NAMES } from "./constants";

export function useCountdown(endsAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
}

const ACTIVITY_LABELS: Record<string, (m: Record<string, any>) => string> = {
  joined: (m) => `${m.name || "Someone"} joined the group`,
  left: (m) => `${m.name || "Someone"} left the group`,
  round_started: (m) => `${m.name || "An admin"} started a ${GAME_NAMES[m.gameSlug] || m.gameSlug || ""} round`,
  score_submitted: (m) => `${m.name || "Someone"} scored ${m.score?.toLocaleString() || "?"} in ${GAME_NAMES[m.gameSlug] || m.gameSlug || ""}`,
  reaction: (m) => `${m.name || "Someone"} reacted ${m.emoji || ""} to a score`,
  round_closed: (m) => `${m.name || "An admin"} closed a ${GAME_NAMES[m.gameSlug] || m.gameSlug || ""} round`,
};

export function activityLabel(type: string, metadata: Record<string, any>): string {
  const fn = ACTIVITY_LABELS[type];
  return fn ? fn(metadata) : type;
}

export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function getLfLettersSummary(round: GroupRound): string | null {
  if (round.gameSlug !== "letter-frequency" || !round.gameConfig) return null;
  try {
    const cfg = JSON.parse(round.gameConfig);
    const letters: string[] = cfg.initialLetters ?? cfg.letters ?? [];
    if (!Array.isArray(letters) || letters.length === 0) return null;
    const pinned = letters.filter((l: string) => l !== "any");
    if (pinned.length === 0) return null;
    const anyCount = letters.filter((l: string) => l === "any").length;
    const base = pinned.join(", ");
    return anyCount > 0 ? `${base} + ${anyCount} random` : base;
  } catch {
    return null;
  }
}
