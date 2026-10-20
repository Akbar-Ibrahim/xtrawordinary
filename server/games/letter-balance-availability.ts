const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export interface LockedBalancePair {
  length: number;
  consonantCount: number;
}

export type LockedBalanceConfigAvailability = "not_locked_balance" | "available" | "unavailable";

export function checkLockedBalanceConfigAvailability(
  dictionary: readonly string[],
  config: unknown,
): LockedBalanceConfigAvailability {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return "not_locked_balance";
  }

  const settings = config as Record<string, unknown>;
  if (settings.category !== "locked_balance") return "not_locked_balance";

  const length = settings.level;
  const consonantCount = settings.consonantCount;
  if (
    typeof length !== "number" || !Number.isInteger(length) || length < 4 || length > 10 ||
    typeof consonantCount !== "number" || !Number.isInteger(consonantCount) ||
    consonantCount < 1 || consonantCount >= length
  ) {
    return "unavailable";
  }

  return isLockedBalancePairAvailable(dictionary, length, consonantCount)
    ? "available"
    : "unavailable";
}

export function getLockedBalancePairKey(length: number, consonantCount: number): string {
  return `${length}:${consonantCount}`;
}

export function getLockedBalanceAvailability(
  dictionary: readonly string[],
): Record<string, boolean> {
  const availability: Record<string, boolean> = {};
  for (let length = 4; length <= 10; length++) {
    for (let consonantCount = 1; consonantCount < length; consonantCount++) {
      availability[getLockedBalancePairKey(length, consonantCount)] = false;
    }
  }

  for (const word of dictionary) {
    const upper = word.toUpperCase();
    if (upper.length < 4 || upper.length > 10) continue;

    let consonantCount = 0;
    for (const character of upper) {
      if (/[A-Z]/.test(character) && !VOWELS.has(character)) consonantCount++;
    }

    const key = getLockedBalancePairKey(upper.length, consonantCount);
    if (Object.hasOwn(availability, key)) availability[key] = true;
  }

  return availability;
}

export function isLockedBalancePairAvailable(
  dictionary: readonly string[],
  length: number,
  consonantCount: number,
): boolean {
  return getLockedBalanceAvailability(dictionary)[getLockedBalancePairKey(length, consonantCount)] === true;
}
