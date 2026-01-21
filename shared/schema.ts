import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const gameSchema = z.object({
  id: z.string(),
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
});

export type Game = z.infer<typeof gameSchema>;

export const gamesListSchema = z.array(gameSchema);

// Word Guessing game words
export const wordGuessingWordsSchema = z.array(z.string());
export type WordGuessingWords = z.infer<typeof wordGuessingWordsSchema>;

// Anagram Solver word sets (new structure with multiple anagrams)
export const anagramWordSetSchema = z.object({
  original: z.string(),
  anagrams: z.array(z.string()),
});
export type AnagramWordSet = z.infer<typeof anagramWordSetSchema>;
export const anagramWordSetsSchema = z.array(anagramWordSetSchema);

// Word Scramble words
export const scrambleWordSchema = z.object({
  word: z.string(),
  category: z.string(),
});
export type ScrambleWord = z.infer<typeof scrambleWordSchema>;
export const scrambleWordsSchema = z.array(scrambleWordSchema);

// Definition Match words (word + definition)
export const definitionWordSchema = z.object({
  word: z.string(),
  definition: z.string(),
  partOfSpeech: z.string(),
});
export type DefinitionWord = z.infer<typeof definitionWordSchema>;
export const definitionWordsSchema = z.array(definitionWordSchema);

// Word Builder words (word with start/end revealed)
export const builderWordSchema = z.object({
  word: z.string(),
  hint: z.string(),
  category: z.string(),
});
export type BuilderWord = z.infer<typeof builderWordSchema>;
export const builderWordsSchema = z.array(builderWordSchema);

// Word Maker words (base word + possible derivatives)
export const makerWordSchema = z.object({
  baseWord: z.string(),
  derivatives: z.array(z.string()),
  maxWords: z.number(),
});
export type MakerWord = z.infer<typeof makerWordSchema>;
export const makerWordsSchema = z.array(makerWordSchema);

// Shared word dictionary for validation-based games
export const wordDictionarySchema = z.array(z.string());
export type WordDictionary = z.infer<typeof wordDictionarySchema>;

// Word validation response
export const wordValidationResponseSchema = z.object({
  valid: z.boolean(),
  message: z.string().optional(),
});
export type WordValidationResponse = z.infer<typeof wordValidationResponseSchema>;

// Word Length game configuration
export const wordLengthConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(), // seconds
});
export type WordLengthConfig = z.infer<typeof wordLengthConfigSchema>;

// Letter Position game configuration  
export const letterPositionConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(), // seconds
});
export type LetterPositionConfig = z.infer<typeof letterPositionConfigSchema>;

// Contains game configuration
export const containsConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerLevel: z.number(), // seconds
  letterSets: z.array(z.array(z.string())), // groups of letters for the game
});
export type ContainsConfig = z.infer<typeof containsConfigSchema>;

// Beginning and End game configuration
export const wordChainConfigSchema = z.object({
  wordsPerLevel: z.number(),
  timePerWord: z.number(), // seconds per word entry
});
export type WordChainConfig = z.infer<typeof wordChainConfigSchema>;

// Consonants and Vowels game configuration
export const vowelConsonantConfigSchema = z.object({
  wordsPerRound: z.number(),
  timePerWord: z.number(), // seconds per word entry
});
export type VowelConsonantConfig = z.infer<typeof vowelConsonantConfigSchema>;
