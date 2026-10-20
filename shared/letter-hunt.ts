export type LetterHuntChallenge = 1 | 2 | 3 | 4 | 5 | "advanced";

const CHALLENGES = [
  { challenge: 1 as const, label: "Challenge 1 (2 letters)", slug: "1" },
  { challenge: 2 as const, label: "Challenge 2 (3 letters)", slug: "2" },
  { challenge: 3 as const, label: "Challenge 3 (4 letters)", slug: "3" },
  { challenge: 4 as const, label: "Challenge 4 (5 letters)", slug: "4" },
  { challenge: 5 as const, label: "Challenge 5 (6 letters)", slug: "5" },
  { challenge: "advanced" as const, label: "Challenge Advanced (random 2-6 letters)", slug: "advanced" },
];

const ORDER_TYPES = [
  { ordered: false, label: "Unordered", slug: "unordered" },
  { ordered: true, label: "Ordered", slug: "ordered" },
] as const;

export const LETTER_HUNT_VARIANTS = CHALLENGES.flatMap((challenge) =>
  ORDER_TYPES.map((order) => ({
    challenge: challenge.challenge,
    ordered: order.ordered,
    label: `${challenge.label} - ${order.label}`,
    slug: `letter-hunt-${challenge.slug}-${order.slug}`,
  })),
);

export const LETTER_HUNT_GAME_MODES = LETTER_HUNT_VARIANTS.map(({ label, slug }) => ({
  label,
  slug,
}));

export function getLetterHuntLeaderboardSlug(
  challenge: LetterHuntChallenge,
  ordered: boolean,
  survival = false,
): string {
  const variant = LETTER_HUNT_VARIANTS.find(
    (candidate) => candidate.challenge === challenge && candidate.ordered === ordered,
  );
  if (!variant) {
    throw new RangeError(`Unsupported Letter Hunt variant: ${challenge} (${ordered ? "ordered" : "unordered"})`);
  }
  return survival ? `${variant.slug}-survival` : variant.slug;
}
