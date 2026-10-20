export const NO_REPEATS_CHALLENGES = [3, 4, 5, 6, 7, 8, 9] as const;

export type NoRepeatsChallenge = (typeof NO_REPEATS_CHALLENGES)[number];
export type NoRepeatsPlayMode = "restricted" | "free";

interface PlayModeDefinition {
  playMode: NoRepeatsPlayMode;
  label: string;
  slugSuffix: string;
}

interface NoRepeatsVariant {
  challenge: NoRepeatsChallenge;
  playMode: NoRepeatsPlayMode;
  label: string;
  slug: string;
}

const PLAY_MODES: readonly PlayModeDefinition[] = [
  { playMode: "free", label: "Free Form", slugSuffix: "free" },
  { playMode: "restricted", label: "Required Letters", slugSuffix: "required" },
];

export const NO_REPEATS_VARIANTS = NO_REPEATS_CHALLENGES.flatMap(
  (challenge): NoRepeatsVariant[] =>
    PLAY_MODES.map(({ playMode, label, slugSuffix }) => ({
      challenge,
      playMode,
      label: `Challenge ${challenge} - ${label}`,
      slug: `no-repeats-${challenge}-${slugSuffix}`,
    })),
);

export const NO_REPEATS_GAME_MODES = NO_REPEATS_VARIANTS.map(
  ({ label, slug }) => ({ label, slug }),
);

export function getNoRepeatsLeaderboardSlug(
  challenge: NoRepeatsChallenge,
  playMode: NoRepeatsPlayMode,
  survival = false,
): string {
  const mode = NO_REPEATS_VARIANTS.find(
    (candidate) =>
      candidate.challenge === challenge && candidate.playMode === playMode,
  );
  if (!mode) {
    throw new RangeError(
      `Unsupported No Repeats variant: challenge ${challenge} (${playMode})`,
    );
  }
  return survival ? `${mode.slug}-survival` : mode.slug;
}
