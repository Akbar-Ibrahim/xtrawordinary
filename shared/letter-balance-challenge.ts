export type LetterBalanceChallengeCategory =
  | "consonant_count"
  | "vowel_count"
  | "start_end_vowel"
  | "start_end_consonant"
  | "start_vowel_end_consonant"
  | "start_consonant_end_vowel"
  | "locked_balance";

export interface LetterBalanceChallengeConfig {
  category: LetterBalanceChallengeCategory;
  level: number | "advanced";
  consonantCount?: number;
}

const LETTER_BALANCE_CHALLENGE_LEVEL_RANGES: Record<
  LetterBalanceChallengeCategory,
  { min: number; max: number; supportsAdvanced: boolean }
> = {
  consonant_count: { min: 2, max: 7, supportsAdvanced: true },
  vowel_count: { min: 2, max: 7, supportsAdvanced: true },
  start_end_vowel: { min: 4, max: 12, supportsAdvanced: true },
  start_end_consonant: { min: 4, max: 12, supportsAdvanced: true },
  start_vowel_end_consonant: { min: 4, max: 12, supportsAdvanced: true },
  start_consonant_end_vowel: { min: 4, max: 12, supportsAdvanced: true },
  locked_balance: { min: 4, max: 10, supportsAdvanced: false },
};

export function validateLetterBalanceChallengeConfig(gameConfig: unknown): string | undefined {
  if (typeof gameConfig !== "object" || gameConfig === null || Array.isArray(gameConfig)) {
    return "Valid Letter Balance configuration is required";
  }

  const config = gameConfig as Record<string, unknown>;
  const levelRange =
    typeof config.category === "string" &&
    Object.hasOwn(LETTER_BALANCE_CHALLENGE_LEVEL_RANGES, config.category)
      ? LETTER_BALANCE_CHALLENGE_LEVEL_RANGES[config.category as LetterBalanceChallengeCategory]
      : undefined;
  const validLevel = config.level === "advanced"
    ? levelRange?.supportsAdvanced === true
    : typeof config.level === "number" &&
      Number.isInteger(config.level) &&
      !!levelRange &&
      config.level >= levelRange.min &&
      config.level <= levelRange.max;

  if (!levelRange || !validLevel) {
    return "Valid Letter Balance category and level are required";
  }

  if (config.category === "locked_balance") {
    if (
      typeof config.consonantCount !== "number" ||
      !Number.isInteger(config.consonantCount) ||
      config.consonantCount < 1 ||
      config.consonantCount >= (config.level as number)
    ) {
      return "Locked Balance requires a valid consonant count between 1 and the word length minus 1";
    }
  } else if (config.consonantCount !== undefined) {
    return "Consonant count is only valid for Locked Balance";
  }

  return undefined;
}

export type SavedLetterBalanceChallengeConfig =
  | { kind: "random" }
  | { kind: "configured"; config: LetterBalanceChallengeConfig }
  | { kind: "invalid" };

/**
 * Parse saved challenge JSON without trusting records created before validation
 * was added. A null database value represents a legacy random challenge.
 */
export function parseSavedLetterBalanceChallengeConfig(
  savedConfig: string | null | undefined,
): SavedLetterBalanceChallengeConfig {
  if (savedConfig == null) return { kind: "random" };

  let config: unknown;
  try {
    config = JSON.parse(savedConfig);
  } catch {
    return { kind: "invalid" };
  }

  if (validateLetterBalanceChallengeConfig(config)) {
    return { kind: "invalid" };
  }

  return {
    kind: "configured",
    config: config as LetterBalanceChallengeConfig,
  };
}
