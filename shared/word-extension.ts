export const WORD_EXTENSION_VARIANTS = [
  {
    lettersToAdd: 1,
    difficulty: "Easy",
    label: "Easy (+1)",
    slug: "word-extension-1",
  },
  {
    lettersToAdd: 2,
    difficulty: "Medium",
    label: "Medium (+2)",
    slug: "word-extension-2",
  },
  {
    lettersToAdd: 3,
    difficulty: "Hard",
    label: "Hard (+3)",
    slug: "word-extension-3",
  },
  {
    lettersToAdd: 4,
    difficulty: "Expert",
    label: "Expert (+4)",
    slug: "word-extension-4",
  },
] as const;

export type WordExtensionLettersToAdd =
  (typeof WORD_EXTENSION_VARIANTS)[number]["lettersToAdd"];

export const WORD_EXTENSION_GAME_MODES = WORD_EXTENSION_VARIANTS.map(
  ({ label, slug }) => ({ label, slug }),
);

export function getWordExtensionLeaderboardSlug(
  lettersToAdd: WordExtensionLettersToAdd,
): string {
  const variant = WORD_EXTENSION_VARIANTS.find(
    (candidate) => candidate.lettersToAdd === lettersToAdd,
  );
  if (!variant) {
    throw new RangeError(
      `Unsupported Word Extension difficulty: +${lettersToAdd} letters`,
    );
  }
  return variant.slug;
}
