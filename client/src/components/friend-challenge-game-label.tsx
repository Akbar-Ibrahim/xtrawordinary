import { Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getLetterDodgeChallengeDifficulty,
  getLetterDodgeChallengeSurvival,
  LETTER_DODGE_VARIANTS,
} from "@shared/letter-dodge";

const LETTER_BALANCE_CATEGORY_LABELS: Record<string, string> = {
  consonant_count: "Consonant Count",
  vowel_count: "Vowel Count",
  start_end_vowel: "Start & End Vowels",
  start_end_consonant: "Start & End Consonants",
  start_vowel_end_consonant: "Start Vowel, End Consonant",
  start_consonant_end_vowel: "Start Consonant, End Vowel",
  locked_balance: "Locked Balance",
};

function getLetterBalanceChallengeSummary(gameConfig?: string | null): string | undefined {
  if (!gameConfig) return undefined;

  let config: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(gameConfig);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    config = parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const category = typeof config.category === "string"
    ? LETTER_BALANCE_CATEGORY_LABELS[config.category]
    : undefined;
  const parts: string[] = category ? [category] : [];
  const level = config.level;

  if (category === "Locked Balance" && typeof level === "number" && Number.isFinite(level)) {
    parts.push(`${level}-letter words`);
    if (typeof config.consonantCount === "number" && Number.isFinite(config.consonantCount)) {
      const vowels = level - config.consonantCount;
      parts.push(`${config.consonantCount}C/${vowels}V`);
    }
  } else if (category === "Consonant Count" && (typeof level === "number" || level === "advanced")) {
    parts.push(level === "advanced" ? "Advanced" : `${level} consonants`);
  } else if (category === "Vowel Count" && (typeof level === "number" || level === "advanced")) {
    parts.push(level === "advanced" ? "Advanced" : `${level} vowels`);
  } else if (category && (typeof level === "number" || level === "advanced")) {
    parts.push(level === "advanced" ? "Advanced" : `${level}-letter words`);
  }

  if (!category && (
    typeof config.vowels === "number" ||
    typeof config.consonants === "number" ||
    typeof config.length === "number"
  )) {
    parts.push("Vowel & Consonant");
    if (typeof config.vowels === "number") parts.push(`${config.vowels} vowels`);
    if (typeof config.consonants === "number") parts.push(`${config.consonants} consonants`);
    if (typeof config.length === "number") parts.push(`${config.length} letters`);
  }

  if (config.survival === true) parts.push("Survival");
  if (typeof config.wordCount === "number" && Number.isFinite(config.wordCount)) {
    parts.push(`${config.wordCount} words`);
  }
  if (typeof config.timeLimitSeconds === "number" && Number.isFinite(config.timeLimitSeconds)) {
    parts.push(`${config.timeLimitSeconds}s`);
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function FriendChallengeGameLabel({
  challengeId,
  gameName,
  gameSlug,
  gameConfig,
}: {
  challengeId: number;
  gameName: string;
  gameSlug: string;
  gameConfig?: string | null;
}) {
  const dodgeDifficulty = gameSlug === "letter-dodge"
    ? getLetterDodgeChallengeDifficulty(gameConfig)
    : undefined;
  const dodgeDifficultyLabel = dodgeDifficulty
    ? LETTER_DODGE_VARIANTS.find(({ difficulty }) => difficulty === dodgeDifficulty)?.label
    : undefined;
  const isDodgeSurvival = gameSlug === "letter-dodge" &&
    getLetterDodgeChallengeSurvival(gameConfig);
  const letterBalanceSummary = gameSlug === "letter-balance"
    ? getLetterBalanceChallengeSummary(gameConfig)
    : undefined;

  return (
    <>
      <Gamepad2 className="h-4 w-4 text-primary shrink-0" />
      <span className="font-medium">{gameName}</span>
      {dodgeDifficultyLabel && (
        <Badge
          variant="outline"
          className="text-xs"
          data-testid={`badge-challenge-difficulty-${challengeId}`}
        >
          {dodgeDifficultyLabel}
        </Badge>
      )}
      {isDodgeSurvival && (
        <Badge
          variant="outline"
          className="text-xs"
          data-testid={`badge-challenge-survival-${challengeId}`}
        >
          Survival
        </Badge>
      )}
      {letterBalanceSummary && (
        <Badge
          variant="outline"
          className="text-xs"
          data-testid={`badge-challenge-letter-balance-config-${challengeId}`}
        >
          {letterBalanceSummary}
        </Badge>
      )}
    </>
  );
}
