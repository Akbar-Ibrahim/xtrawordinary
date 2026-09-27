import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const gameModeSchema = z.object({
  label: z.string(),
  slug: z.string(),
});
export type GameMode = z.infer<typeof gameModeSchema>;

export const gameSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  longDescription: z.string(),
  rules: z.array(z.string()),
  difficulty: difficultySchema,
  estimatedTime: z.string(),
  icon: z.string(),
  color: z.string(),
  playCount: z.number(),
  isActive: z.boolean().optional(),
  hasSurvival: z.boolean().optional(),
  modes: z.array(gameModeSchema).optional(),
  timeLimitSeconds: z.number().int().positive().nullable().optional(),
  wordTarget: z.number().int().positive().nullable().optional(),
  livesCount: z.number().int().positive().nullable().optional(),
  ogImage: z.string().optional(),
});

export type Game = z.infer<typeof gameSchema>;

export const gamesListSchema = z.array(gameSchema);

export const gameConfigFieldSchema = z.enum([
  "timeLimitSeconds",
  "wordTarget",
  "livesCount",
]);
export type GameConfigField = z.infer<typeof gameConfigFieldSchema>;
export type GameConfigUpdate = Partial<Record<GameConfigField, number | null>>;
export type GameConfigConstraint = { max?: number };

export const GAME_CONFIG_SUPPORT: Readonly<Record<string, readonly GameConfigField[]>> = {
  "anagram-solver": ["timeLimitSeconds"],
  "definition-match": ["timeLimitSeconds", "wordTarget"],
  "ladder-rush": ["timeLimitSeconds"],
  "ladder-rush-double": ["timeLimitSeconds"],
  "letter-balance": ["timeLimitSeconds"],
  "letter-dodge": ["timeLimitSeconds"],
  "letter-frequency": ["timeLimitSeconds"],
  "letter-hunt": ["timeLimitSeconds"],
  "letter-pool": ["livesCount"],
  "letter-position": ["timeLimitSeconds"],
  "no-repeats": ["timeLimitSeconds", "wordTarget"],
  "progressive-reveal": ["livesCount"],
  "shell-words": ["timeLimitSeconds"],
  "deep-shell-words": ["timeLimitSeconds"],
  "word-chain": ["wordTarget"],
  "word-extension": ["timeLimitSeconds"],
  "word-fusion": ["timeLimitSeconds", "wordTarget"],
  "word-length": ["timeLimitSeconds"],
  "word-roots": ["timeLimitSeconds", "wordTarget"],
  "word-scramble": ["livesCount"],
};

export function getSupportedGameConfigFields(slug: string): readonly GameConfigField[] {
  return GAME_CONFIG_SUPPORT[slug] ?? [];
}

const GAME_CONFIG_CONSTRAINTS: Readonly<
  Record<string, Partial<Record<GameConfigField, GameConfigConstraint>>>
> = {
  "word-fusion": { wordTarget: { max: 50 } },
  "word-roots": { wordTarget: { max: 5 } },
};

export function getGameConfigConstraint(
  slug: string,
  field: GameConfigField,
): GameConfigConstraint {
  return GAME_CONFIG_CONSTRAINTS[slug]?.[field] ?? {};
}

export type StandardPlayContext = {
  isSenderMode: boolean;
  isReceiverMode: boolean;
  isCustomPlay: boolean;
};

export function getStandardPlayGameConfig(
  game: Pick<Game, GameConfigField>,
  context: StandardPlayContext,
): GameConfigUpdate {
  if (context.isSenderMode || context.isReceiverMode || context.isCustomPlay) {
    return {};
  }
  return {
    ...(game.timeLimitSeconds != null ? { timeLimitSeconds: game.timeLimitSeconds } : {}),
    ...(game.wordTarget != null ? { wordTarget: game.wordTarget } : {}),
    ...(game.livesCount != null ? { livesCount: game.livesCount } : {}),
  };
}

function formatRuleDuration(seconds: number): string {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

function formatTimerDuration(seconds: number): string {
  return seconds % 60 === 0
    ? `${seconds / 60}-minute`
    : `${seconds}-second`;
}

function formatLives(count: number): string {
  return `${count} ${count === 1 ? "life" : "lives"}`;
}

export function getGameDetailDescription(
  game: Pick<Game, "slug" | "longDescription" | GameConfigField>,
  context: StandardPlayContext,
): string {
  const config = getStandardPlayGameConfig(game, context);
  let description = game.longDescription;

  switch (game.slug) {
    case "word-scramble":
      return config.livesCount != null
        ? description.replace("only have 3 lives", `only have ${formatLives(config.livesCount)}`)
        : description;
    case "word-chain":
      return config.wordTarget != null
        ? description.replace("Complete 100 words per level", `Complete ${config.wordTarget} words per level`)
        : description;
    case "ladder-rush":
      return config.timeLimitSeconds != null
        ? description.replace("in 90 seconds", `in ${formatRuleDuration(config.timeLimitSeconds)}`)
        : description;
    case "letter-dodge":
      return config.timeLimitSeconds != null
        ? description.replace(
            "Classic mode gives 90 seconds",
            `Classic mode gives ${formatRuleDuration(config.timeLimitSeconds)}`,
          )
        : description;
    default:
      return description;
  }
}

export function getGameDetailRules(
  game: Pick<Game, "slug" | "rules" | GameConfigField>,
  context: StandardPlayContext,
): string[] {
  const config = getStandardPlayGameConfig(game, context);
  if (Object.keys(config).length === 0) return game.rules;

  const duration = config.timeLimitSeconds != null
    ? formatRuleDuration(config.timeLimitSeconds)
    : null;

  return game.rules.map((rule) => {
    switch (game.slug) {
      case "word-scramble":
        return config.livesCount != null && rule === "You have 3 lives - wrong answers lose a life"
          ? `You have ${formatLives(config.livesCount)} - wrong answers lose a life`
          : rule;
      case "letter-pool":
        return config.livesCount != null && rule === "Wrong letters cost a life. You have 3 lives."
          ? `Wrong letters cost a life. You have ${formatLives(config.livesCount)}.`
          : rule;
      case "progressive-reveal":
        return config.livesCount != null && rule === "Wrong guesses cost a life - you have 3 lives"
          ? `Wrong guesses cost a life - you have ${formatLives(config.livesCount)}`
          : rule;
      case "word-chain":
        return config.wordTarget != null && rule === "Complete 100 valid words per level to advance"
          ? `Complete ${config.wordTarget} valid words per level to advance`
          : rule;
      case "word-roots":
        if (rule !== "Complete 5 rounds in 3 minutes") return rule;
        return rule
          .replace("5 rounds", `${config.wordTarget ?? 5} rounds`)
          .replace("3 minutes", duration ?? "3 minutes");
      case "ladder-rush":
      case "ladder-rush-double":
        return duration && /^You have 90 seconds\./.test(rule)
          ? rule.replace("90 seconds", duration)
          : rule;
      case "shell-words":
      case "deep-shell-words":
        return duration && rule.includes("Classic gives 90 seconds")
          ? rule.replace("Classic gives 90 seconds", `Classic gives ${duration}`)
          : rule;
      case "letter-dodge":
        return duration && rule === "Classic: you have 90 seconds to submit as many valid words as possible"
          ? `Classic: you have ${duration} to submit as many valid words as possible`
          : rule;
      case "word-fusion":
        if (rule !== "Complete 5 rounds before the 90-second timer ends") return rule;
        return rule
          .replace("5 rounds", `${config.wordTarget ?? 5} rounds`)
          .replace(
            "90-second",
            config.timeLimitSeconds != null
              ? formatTimerDuration(config.timeLimitSeconds)
              : "90-second",
          );
      default:
        return rule;
    }
  });
}

export function getEffectiveWordFusionTarget(
  configuredTarget: number | null | undefined,
  puzzleCount: number,
): number {
  const requestedTarget =
    Number.isInteger(configuredTarget) && (configuredTarget ?? 0) > 0
      ? configuredTarget!
      : 5;
  return Math.min(requestedTarget, Math.max(0, puzzleCount));
}

type WordFusionSubmissionSnapshot = {
  run: number;
  request: number;
  round: number;
  combinationId: number | null;
};

export function isCurrentWordFusionSubmission(
  gameActive: boolean,
  submitted: WordFusionSubmissionSnapshot,
  current: WordFusionSubmissionSnapshot,
): boolean {
  return (
    gameActive &&
    submitted.run === current.run &&
    submitted.request === current.request &&
    submitted.round === current.round &&
    submitted.combinationId === current.combinationId
  );
}

export const wordGuessingWordsSchema = z.array(z.string());
export type WordGuessingWords = z.infer<typeof wordGuessingWordsSchema>;

export const anagramWordSetSchema = z.object({
  original: z.string(),
  anagrams: z.array(z.string()),
});
export type AnagramWordSet = z.infer<typeof anagramWordSetSchema>;
export const anagramWordSetsSchema = z.array(anagramWordSetSchema);

export const scrambleWordSchema = z.object({
  word: z.string(),
  category: z.string(),
  validAnswers: z.array(z.string()).optional(),
});
export type ScrambleWord = z.infer<typeof scrambleWordSchema>;
export const scrambleWordsSchema = z.array(scrambleWordSchema);

export const definitionWordSchema = z.object({
  word: z.string(),
  definitions: z.tuple([z.string(), z.string(), z.string()]),
  partOfSpeech: z.string(),
});
export type DefinitionWord = z.infer<typeof definitionWordSchema>;
export const definitionWordsSchema = z.array(definitionWordSchema);

export const letterPoolWordSchema = z.object({
  word: z.string(),
  hint: z.string(),
  category: z.string(),
  letterPool: z.array(z.string()),
});
export type LetterPoolWord = z.infer<typeof letterPoolWordSchema>;
export const letterPoolWordsSchema = z.array(letterPoolWordSchema);

export const makerWordSchema = z.object({
  baseWord: z.string(),
  derivatives: z.array(z.string()),
  maxWords: z.number(),
});
export type MakerWord = z.infer<typeof makerWordSchema>;
export const makerWordsSchema = z.array(makerWordSchema);

export const wordRootsPuzzleSchema = z.object({
  canonicalWord: z.string(),
  derivatives: z.array(z.string()),
  validAnswers: z.array(z.string()).optional(),
});
export type WordRootsPuzzle = z.infer<typeof wordRootsPuzzleSchema>;

export const wordDictionarySchema = z.array(z.string());
export type WordDictionary = z.infer<typeof wordDictionarySchema>;

export const wordValidationResponseSchema = z.object({
  valid: z.boolean(),
  message: z.string().optional(),
});
export type WordValidationResponse = z.infer<typeof wordValidationResponseSchema>;

export const wordLengthConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(),
});
export type WordLengthConfig = z.infer<typeof wordLengthConfigSchema>;

export const letterPositionConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(),
});
export type LetterPositionConfig = z.infer<typeof letterPositionConfigSchema>;

export const letterHuntConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(),
  letterSets: z.array(z.array(z.string())),
});
export type LetterHuntConfig = z.infer<typeof letterHuntConfigSchema>;

export const wordChainConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerWord: z.number(),
});
export type WordChainConfig = z.infer<typeof wordChainConfigSchema>;

export const vowelConsonantConfigSchema = z.object({
  wordsPerRound: z.number(),
  timePerWord: z.number(),
});
export type VowelConsonantConfig = z.infer<typeof vowelConsonantConfigSchema>;

export const wordStackPuzzleSchema = z.object({
  targetWord: z.string(),
  startWord: z.string(),
});
export type WordStackPuzzle = z.infer<typeof wordStackPuzzleSchema>;
export const wordStackPuzzlesSchema = z.array(wordStackPuzzleSchema);

export const wordSplitPuzzleSchema = z.object({
  targetWord: z.string(),
});
export type WordSplitPuzzle = z.infer<typeof wordSplitPuzzleSchema>;
export const wordSplitPuzzlesSchema = z.array(wordSplitPuzzleSchema);

export const wordFusionAlternativeSchema = z.object({
  id: z.number().int(),
  components: z.array(z.string().min(3)).min(2),
});
export type WordFusionAlternative = z.infer<typeof wordFusionAlternativeSchema>;

export const wordFusionPuzzleSchema = z.object({
  id: z.number().int(),
  baseWordId: z.number().int(),
  components: z.array(z.string().min(3)).min(2),
  alternates: z.array(wordFusionAlternativeSchema),
});
export type WordFusionPuzzle = z.infer<typeof wordFusionPuzzleSchema>;
export const wordFusionPuzzlesSchema = z.array(wordFusionPuzzleSchema);

export const wordFusionValidationResponseSchema = z.object({
  valid: z.boolean(),
  exact: z.boolean().optional(),
  canonicalWord: z.string().optional(),
  points: z.number().int().nonnegative().optional(),
});
export type WordFusionValidationResponse = z.infer<typeof wordFusionValidationResponseSchema>;

export const progressiveRevealWordSchema = z.object({
  word: z.string(),
  subcategory: z.string(),
  hint: z.string().optional(),
});
export type ProgressiveRevealWord = z.infer<typeof progressiveRevealWordSchema>;
export const progressiveRevealWordsSchema = z.array(progressiveRevealWordSchema);

export const wordSweepGridSchema = z.object({
  grid: z.array(z.array(z.string())),
  size: z.number(),
});
export type WordSweepGrid = z.infer<typeof wordSweepGridSchema>;

export const wordUnpackPuzzleSchema = z.object({
  grid: z.array(z.array(z.string())),
  size: z.number(),
  words: z.array(z.string()),
});
export type WordUnpackPuzzle = z.infer<typeof wordUnpackPuzzleSchema>;

export const wordLadderPuzzleSchema = z.object({
  start: z.string(),
  target: z.string(),
  par: z.number(),
  optimalPaths: z.array(z.array(z.string())),
});
export type WordLadderPuzzle = z.infer<typeof wordLadderPuzzleSchema>;
export const wordLadderPuzzlesSchema = z.array(wordLadderPuzzleSchema);

export const ladderRushPuzzleSchema = z.object({
  start: z.string(),
  wordLength: z.number(),
});
export type LadderRushPuzzle = z.infer<typeof ladderRushPuzzleSchema>;
export const ladderRushPuzzlesSchema = z.array(ladderRushPuzzleSchema);

export const partOfSpeechSchema = z.object({
  id: z.number(),
  name: z.string(),
});
export type PartOfSpeech = z.infer<typeof partOfSpeechSchema>;
export const wordExtensionPuzzleSchema = z.object({
  shownWord: z.string(),
  lettersToAdd: z.number(),
  validAnswers: z.array(z.string()).optional(),
});
export type WordExtensionPuzzle = z.infer<typeof wordExtensionPuzzleSchema>;

export const insertPartOfSpeechSchema = partOfSpeechSchema.omit({ id: true });
export type InsertPartOfSpeech = z.infer<typeof insertPartOfSpeechSchema>;

export const wordDefinitionSchema = z.object({
  id: z.number(),
  wordId: z.number(),
  partOfSpeechId: z.number(),
  definition: z.string(),
  sortOrder: z.number(),
});
export type WordDefinition = z.infer<typeof wordDefinitionSchema>;
export const insertWordDefinitionSchema = wordDefinitionSchema.omit({ id: true });
export type InsertWordDefinition = z.infer<typeof insertWordDefinitionSchema>;
