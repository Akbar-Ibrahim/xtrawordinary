export const WORD_LENGTH_VARIANTS = [
  {
    variation: 1,
    label: "Length Only",
    description: "Form words of a specific length",
    slug: "word-length-1",
  },
  {
    variation: 2,
    label: "Starts With",
    description: "Same length + must start with a specific letter",
    slug: "word-length-2",
  },
  {
    variation: 3,
    label: "Ends With",
    description: "Same length + must end with a specific letter",
    slug: "word-length-3",
  },
  {
    variation: 4,
    label: "Starts & Contains",
    description: "Same length + starts with letter + contains letter",
    slug: "word-length-4",
  },
  {
    variation: 5,
    label: "Ends & Contains",
    description: "Same length + ends with letter + contains letter",
    slug: "word-length-5",
  },
] as const;

export type WordLengthVariation = (typeof WORD_LENGTH_VARIANTS)[number]["variation"];

export const WORD_LENGTH_GAME_MODES = WORD_LENGTH_VARIANTS.map(({ label, slug }) => ({
  label,
  slug,
}));

export function getWordLengthLeaderboardSlug(variation: number, survival = false): string {
  const mode = WORD_LENGTH_VARIANTS.find((candidate) => candidate.variation === variation);
  if (!mode) {
    throw new RangeError(`Unsupported Length Challenge variation: ${variation}`);
  }
  return survival ? `${mode.slug}-survival` : mode.slug;
}
