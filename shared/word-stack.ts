export const WORD_STACK_VARIANTS = [
  {
    challenge: "build-up",
    label: "Build Up",
    slug: "word-stack-build-up",
  },
  {
    challenge: "break-down",
    label: "Break Down",
    slug: "word-stack-break-down",
  },
] as const;

export type WordStackChallenge =
  (typeof WORD_STACK_VARIANTS)[number]["challenge"];

export const WORD_STACK_GAME_MODES = WORD_STACK_VARIANTS.map(
  ({ label, slug }) => ({ label, slug }),
);

export function getWordStackLeaderboardSlug(
  challenge: WordStackChallenge,
): string {
  const mode = WORD_STACK_VARIANTS.find(
    (candidate) => candidate.challenge === challenge,
  );
  if (!mode) {
    throw new RangeError(`Unsupported Word Stack challenge: ${challenge}`);
  }
  return mode.slug;
}
