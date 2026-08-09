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
  survivalSecondsPerWord: z.number().int().positive().nullable().optional(),
});

export type Game = z.infer<typeof gameSchema>;

export const gamesListSchema = z.array(gameSchema);

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
