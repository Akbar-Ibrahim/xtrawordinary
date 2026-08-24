import { useCallback } from "react";

const MAX_ENTRIES = 50;
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface HistoryEntry {
  key: string;
  ts: number;
}

function storageKey(slug: string, scope?: string) {
  return `puzzle-history:${slug}${scope ? `:${scope}` : ""}`;
}

function readSeen(slug: string, scope?: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(slug, scope));
    if (!raw) return new Set();
    const entries: HistoryEntry[] = JSON.parse(raw);
    const cutoff = Date.now() - TTL_MS;
    return new Set(entries.filter((e) => e.ts > cutoff).map((e) => e.key));
  } catch {
    return new Set();
  }
}

function writeSeen(slug: string, key: string, scope?: string) {
  try {
    const raw = localStorage.getItem(storageKey(slug, scope));
    const entries: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - TTL_MS;
    const fresh = entries.filter((e) => e.ts > cutoff && e.key !== key);
    fresh.push({ key, ts: Date.now() });
    if (fresh.length > MAX_ENTRIES) fresh.splice(0, fresh.length - MAX_ENTRIES);
    localStorage.setItem(storageKey(slug, scope), JSON.stringify(fresh));
  } catch {
    // localStorage unavailable — silent no-op
  }
}

/**
 * Tracks which puzzles a user has already played (persisted across sessions
 * in localStorage, per game and variation). Only affects free-play mode — seeded/group
 * sessions should skip this entirely.
 *
 * filterUnseen — returns the unseen subset of `items`; falls back to the full
 *   list if everything has been seen so the game never gets stuck.
 * markSeen — records a puzzle key as played.
 * hasSeen — checks whether a puzzle key is in recent history.
 */
export function usePuzzleHistory(gameSlug: string) {
  const markSeen = useCallback(
    (key: string, scope?: string) => {
      writeSeen(gameSlug, key, scope);
    },
    [gameSlug],
  );

  const hasSeen = useCallback(
    (key: string, scope?: string) => readSeen(gameSlug, scope).has(key),
    [gameSlug],
  );

  const filterUnseen = useCallback(
    <T>(items: T[], getKey: (item: T) => string, scope?: string): T[] => {
      const seen = readSeen(gameSlug, scope);
      const unseen = items.filter((item) => !seen.has(getKey(item)));
      if (unseen.length > 0) return unseen;
      if (import.meta.env.DEV) {
        console.warn(
          `[puzzle-history] All ${items.length} items already seen for "${gameSlug}${scope ? `:${scope}` : ""}". Falling back to full pool.`,
        );
      }
      return items;
    },
    [gameSlug],
  );

  return { markSeen, hasSeen, filterUnseen };
}
