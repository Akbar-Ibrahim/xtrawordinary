export const WORD_SPLIT_DIFFICULTIES = {
  short: {
    label: "Short Words",
    modeLabel: "Short (5–6 letters)",
    description: "5-6 letter target words",
    minLength: 5,
    maxLength: 6,
    slug: "word-split-short",
  },
  medium: {
    label: "Medium Words",
    modeLabel: "Medium (7–8 letters)",
    description: "7-8 letter target words",
    minLength: 7,
    maxLength: 8,
    slug: "word-split-medium",
  },
  long: {
    label: "Long Words",
    modeLabel: "Long (9+ letters)",
    description: "9+ letter target words",
    minLength: 9,
    maxLength: 99,
    slug: "word-split-long",
  },
} as const;

export type WordSplitDifficulty = keyof typeof WORD_SPLIT_DIFFICULTIES;

export const WORD_SPLIT_GAME_MODES = Object.values(WORD_SPLIT_DIFFICULTIES).map(
  ({ modeLabel, slug }) => ({ label: modeLabel, slug }),
);

export function getWordSplitLeaderboardSlug(
  difficulty: WordSplitDifficulty,
): string {
  const variant = WORD_SPLIT_DIFFICULTIES[difficulty];
  if (!variant) {
    throw new RangeError(`Unsupported Word Split difficulty: ${String(difficulty)}`);
  }
  return variant.slug;
}
