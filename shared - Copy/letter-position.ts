export const LETTER_POSITION_VARIANTS = [
  { challenge: 1, label: "Challenge 1", slug: "letter-position-1" },
  { challenge: 2, label: "Challenge 2", slug: "letter-position-2" },
] as const;

export type LetterPositionChallenge =
  (typeof LETTER_POSITION_VARIANTS)[number]["challenge"];

export const LETTER_POSITION_GAME_MODES = LETTER_POSITION_VARIANTS.map(
  ({ label, slug }) => ({ label, slug }),
);

export function getLetterPositionLeaderboardSlug(
  challenge: LetterPositionChallenge,
  survival = false,
): string {
  const mode = LETTER_POSITION_VARIANTS.find(
    (candidate) => candidate.challenge === challenge,
  );
  if (!mode) {
    throw new RangeError(`Unsupported Letter Position challenge: ${challenge}`);
  }
  return survival ? `${mode.slug}-survival` : mode.slug;
}
