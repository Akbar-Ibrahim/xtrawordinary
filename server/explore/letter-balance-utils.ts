import type { LetterBalanceExploreFilters } from "./letter-balance-types";

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export interface LetterBalanceWordStats {
  length: number;
  vowelCount: number;
  consonantCount: number;
}

export function normalizeLetterBalanceWord(word: string): string {
  return word.trim().toUpperCase();
}

export function isLetterBalanceDictionaryWord(word: string): boolean {
  return /^[A-Z]+$/.test(normalizeLetterBalanceWord(word));
}

export function getLetterBalanceWordStats(word: string): LetterBalanceWordStats {
  const normalized = normalizeLetterBalanceWord(word);
  const vowelCount = [...normalized].filter((letter) => VOWELS.has(letter)).length;
  return {
    length: normalized.length,
    vowelCount,
    consonantCount: normalized.length - vowelCount,
  };
}

export function matchesLetterBalanceFilters(
  word: string,
  filters: LetterBalanceExploreFilters,
  stats = getLetterBalanceWordStats(word),
): boolean {
  const normalized = normalizeLetterBalanceWord(word);
  if (!isLetterBalanceDictionaryWord(normalized)) return false;
  if (filters.length !== undefined && stats.length !== filters.length) return false;

  switch (filters.category) {
    case "vowel_count":
      return stats.vowelCount === filters.count;
    case "consonant_count":
      return stats.consonantCount === filters.count;
    case "start_end_vowel":
      return VOWELS.has(normalized[0]) && VOWELS.has(normalized.at(-1)!);
    case "start_end_consonant":
      return !VOWELS.has(normalized[0]) && !VOWELS.has(normalized.at(-1)!);
    case "start_vowel_end_consonant":
      return VOWELS.has(normalized[0]) && !VOWELS.has(normalized.at(-1)!);
    case "start_consonant_end_vowel":
      return !VOWELS.has(normalized[0]) && VOWELS.has(normalized.at(-1)!);
    case "locked_balance":
      return stats.length === filters.length
        && stats.consonantCount === filters.consonantCount;
  }
}
