export const CUSTOM_FRESH_ANSWER_GAMES = [
  "letter-hunt",
  "letter-dodge",
  "letter-balance",
  "word-length",
  "letter-position",
  "no-repeats",
  "letter-frequency",
] as const;

export type CustomFreshAnswerGame = (typeof CUSTOM_FRESH_ANSWER_GAMES)[number];

export interface FreshAnswerRunContext {
  customPlay: boolean;
  locked?: boolean;
  groupSeed?: number;
  quizMode?: boolean;
  isUntimed?: boolean;
}

export interface CustomFreshAnswerSnapshot {
  words: string[];
  enabled: boolean;
}

export function isFreshAnswerRunEligible({
  customPlay,
  locked = false,
  groupSeed,
  quizMode = false,
  isUntimed = false,
}: FreshAnswerRunContext): boolean {
  if (customPlay) return true;
  return !locked && groupSeed === undefined && !quizMode && !isUntimed;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_PREFIX = "xtrawordinary:custom-fresh-answers:v1";

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storageKey(userId: number | string, game: CustomFreshAnswerGame): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(String(userId))}:${game}`;
}

export function normalizeFreshAnswerWords(words: Iterable<string>): string[] {
  return [...new Set(
    Array.from(words, (word) => word.trim().toUpperCase().replace(/[^A-Z]/g, ""))
      .filter(Boolean),
  )];
}

export function readCustomFreshAnswerSnapshot(
  userId: number | string,
  game: CustomFreshAnswerGame,
  storage?: StorageLike,
): CustomFreshAnswerSnapshot | null {
  const target = getStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(storageKey(userId, game));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const snapshot = parsed as { version?: unknown; words?: unknown; enabled?: unknown };
    if (snapshot.version !== 1 || !Array.isArray(snapshot.words)) return null;

    const words = normalizeFreshAnswerWords(
      snapshot.words.filter((word): word is string => typeof word === "string"),
    );
    if (words.length === 0) return null;

    return { words, enabled: snapshot.enabled !== false };
  } catch {
    return null;
  }
}

export function saveCustomFreshAnswerSnapshot(
  userId: number | string,
  game: CustomFreshAnswerGame,
  words: Iterable<string>,
  storage?: StorageLike,
): CustomFreshAnswerSnapshot | null {
  const target = getStorage(storage);
  const existing = readCustomFreshAnswerSnapshot(userId, game, target ?? undefined);
  const normalizedWords = normalizeFreshAnswerWords([...(existing?.words ?? []), ...words]);
  if (!target || normalizedWords.length === 0) return null;

  const snapshot = { version: 1, words: normalizedWords, enabled: true };
  try {
    target.setItem(storageKey(userId, game), JSON.stringify(snapshot));
    return { words: normalizedWords, enabled: true };
  } catch {
    return null;
  }
}

export function appendCustomFreshAnswerSnapshot(
  userId: number | string,
  game: CustomFreshAnswerGame,
  words: Iterable<string>,
  storage?: StorageLike,
): CustomFreshAnswerSnapshot | null {
  const target = getStorage(storage);
  if (!target) return null;

  const current = readCustomFreshAnswerSnapshot(userId, game, target);
  if (!current?.enabled) return null;

  const updated = {
    enabled: true,
    words: normalizeFreshAnswerWords([...current.words, ...words]),
  };
  try {
    if (updated.words.length !== current.words.length) {
      target.setItem(storageKey(userId, game), JSON.stringify({ version: 1, ...updated }));
    }
    return updated;
  } catch {
    return null;
  }
}

export function enableCustomFreshAnswerSnapshot(
  userId: number | string,
  game: CustomFreshAnswerGame,
  storage?: StorageLike,
): CustomFreshAnswerSnapshot | null {
  const target = getStorage(storage);
  if (!target) return null;

  const current = readCustomFreshAnswerSnapshot(userId, game, target);
  if (!current) return null;

  try {
    target.setItem(storageKey(userId, game), JSON.stringify({ version: 1, ...current, enabled: true }));
    return { ...current, enabled: true };
  } catch {
    return null;
  }
}

export function clearCustomFreshAnswerSnapshot(
  userId: number | string,
  game: CustomFreshAnswerGame,
  storage?: StorageLike,
): boolean {
  const target = getStorage(storage);
  if (!target) return false;

  try {
    target.removeItem(storageKey(userId, game));
    return true;
  } catch {
    return false;
  }
}
