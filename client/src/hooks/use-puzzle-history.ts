import { useCallback } from "react";

const MAX_ENTRIES = 200;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface HistoryEntry {
  key: string;
  ts: number;
}

function storageKey(slug: string) {
  return `puzzle-history:${slug}`;
}

function readSeen(slug: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return new Set();
    const entries: HistoryEntry[] = JSON.parse(raw);
    const cutoff = Date.now() - TTL_MS;
    return new Set(entries.filter((e) => e.ts > cutoff).map((e) => e.key));
  } catch {
    return new Set();
  }
}

function writeSeen(slug: string, key: string) {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    const entries: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - TTL_MS;
    const fresh = entries.filter((e) => e.ts > cutoff && e.key !== key);
    fresh.push({ key, ts: Date.now() });
    if (fresh.length > MAX_ENTRIES) fresh.splice(0, fresh.length - MAX_ENTRIES);
    localStorage.setItem(storageKey(slug), JSON.stringify(fresh));
  } catch {
    // localStorage unavailable — silent no-op
  }
}

/**
 * Tracks which puzzles a user has already played (persisted across sessions
 * in localStorage, per game slug). Only affects free-play mode — seeded/group
 * sessions should skip this entirely.
 *
 * filterUnseen — returns the unseen subset of `items`; falls back to the full
 *   list if everything has been seen so the game never gets stuck.
 * markSeen — records a puzzle key as played.
 */
export function usePuzzleHistory(gameSlug: string) {
  const markSeen = useCallback(
    (key: string) => {
      writeSeen(gameSlug, key);
    },
    [gameSlug],
  );

  const filterUnseen = useCallback(
    <T>(items: T[], getKey: (item: T) => string): T[] => {
      const seen = readSeen(gameSlug);
      const unseen = items.filter((item) => !seen.has(getKey(item)));
      if (unseen.length > 0) return unseen;
      if (import.meta.env.DEV) {
        console.warn(
          `[puzzle-history] All ${items.length} items already seen for "${gameSlug}". Falling back to full pool.`,
        );
      }
      return items;
    },
    [gameSlug],
  );

  return { markSeen, filterUnseen };
}
