export const LETTER_FREQUENCY_VARIANTS = [
  { challenge: 1, label: "Challenge 1", slug: "letter-frequency-1" },
  { challenge: 2, label: "Challenge 2", slug: "letter-frequency-2" },
  { challenge: 3, label: "Challenge 3", slug: "letter-frequency-3" },
  { challenge: 4, label: "Challenge 4", slug: "letter-frequency-4" },
  { challenge: "random", label: "Challenge Random", slug: "letter-frequency-random" },
  { challenge: "multi", label: "Multi-Letter", slug: "letter-frequency-multi" },
] as const;

export type LetterFrequencyChallenge =
  (typeof LETTER_FREQUENCY_VARIANTS)[number]["challenge"];

export const LETTER_FREQUENCY_GAME_MODES = LETTER_FREQUENCY_VARIANTS.map(
  ({ label, slug }) => ({ label, slug }),
);

export function getLetterFrequencyLeaderboardSlug(
  challenge: LetterFrequencyChallenge,
  survival = false,
): string {
  const mode = LETTER_FREQUENCY_VARIANTS.find(
    (candidate) => candidate.challenge === challenge,
  );
  if (!mode) {
    throw new RangeError(`Unsupported Letter Frequency challenge: ${challenge}`);
  }
  return survival ? `${mode.slug}-survival` : mode.slug;
}
