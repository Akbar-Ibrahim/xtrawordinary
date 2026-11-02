import type { VariationCategory } from "@/components/games/letter-balance";

const DAILY_LETTER_BALANCE_CATEGORIES = [
  "consonant_count",
  "vowel_count",
  "start_end_vowel",
  "start_end_consonant",
  "start_vowel_end_consonant",
  "start_consonant_end_vowel",
] as const satisfies readonly VariationCategory[];

const LEVELS_BY_CATEGORY: Record<(typeof DAILY_LETTER_BALANCE_CATEGORIES)[number], readonly number[]> = {
  consonant_count: [2, 3, 4, 5, 6, 7],
  vowel_count: [2, 3, 4, 5, 6, 7],
  start_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_vowel_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_consonant_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12],
};

export function getDailyLetterBalanceChallenge(seed: number): {
  category: (typeof DAILY_LETTER_BALANCE_CATEGORIES)[number];
  level: number;
} {
  const category = DAILY_LETTER_BALANCE_CATEGORIES[seed % DAILY_LETTER_BALANCE_CATEGORIES.length];
  const levels = LEVELS_BY_CATEGORY[category];
  const level = levels[(seed >> 4) % levels.length];

  return { category, level };
}
