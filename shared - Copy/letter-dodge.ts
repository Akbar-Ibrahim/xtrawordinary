export const LETTER_DODGE_VARIANTS = [
  { difficulty: 1, label: "Easy (1 letter)", slug: "letter-dodge-easy" },
  { difficulty: 2, label: "Medium (2 letters)", slug: "letter-dodge-medium" },
  { difficulty: 3, label: "Hard (3 letters)", slug: "letter-dodge-hard" },
  { difficulty: 4, label: "Expert (4 letters)", slug: "letter-dodge-expert" },
  { difficulty: 5, label: "Master (5 letters)", slug: "letter-dodge-master" },
  { difficulty: "savant", label: "Savant (6–12 letters)", slug: "letter-dodge-savant" },
  { difficulty: "advanced", label: "Advanced (random 1–5)", slug: "letter-dodge-advanced" },
] as const;

export type LetterDodgeDifficulty =
  (typeof LETTER_DODGE_VARIANTS)[number]["difficulty"];

export type LetterDodgeChallengeConfig = {
  difficulty: LetterDodgeDifficulty;
  survival?: boolean;
};

export function parseLetterDodgeDifficulty(
  value: unknown,
): LetterDodgeDifficulty | undefined {
  const normalizedValue =
    typeof value === "string" && /^[1-5]$/.test(value)
      ? Number(value)
      : value;
  return LETTER_DODGE_VARIANTS.find(
    ({ difficulty }) => difficulty === normalizedValue,
  )?.difficulty;
}

export function getLetterDodgeChallengeDifficulty(
  gameConfig: string | null | undefined,
): LetterDodgeDifficulty {
  if (!gameConfig) return "advanced";

  try {
    const config: unknown = JSON.parse(gameConfig);
    if (typeof config !== "object" || config === null || !("difficulty" in config)) {
      return "advanced";
    }
    return parseLetterDodgeDifficulty(config.difficulty) ?? "advanced";
  } catch {
    return "advanced";
  }
}

export function getLetterDodgeChallengeSurvival(
  gameConfig: string | null | undefined,
): boolean {
  if (!gameConfig) return false;

  try {
    const config: unknown = JSON.parse(gameConfig);
    return typeof config === "object" && config !== null &&
      "survival" in config && config.survival === true;
  } catch {
    return false;
  }
}

export function getLetterDodgeChallengeModeLabel(
  gameConfig: string | null | undefined,
): "Standard" | "Survival" {
  return getLetterDodgeChallengeSurvival(gameConfig) ? "Survival" : "Standard";
}

export const LETTER_DODGE_GAME_MODES = LETTER_DODGE_VARIANTS.map(
  ({ label, slug }) => ({ label, slug }),
);

export function getLetterDodgeLeaderboardSlug(
  difficulty: LetterDodgeDifficulty,
  survival = false,
): string {
  const mode = LETTER_DODGE_VARIANTS.find(
    (candidate) => candidate.difficulty === difficulty,
  );
  if (!mode) {
    throw new RangeError(`Unsupported Letter Dodge difficulty: ${difficulty}`);
  }
  return survival ? `${mode.slug}-survival` : mode.slug;
}
