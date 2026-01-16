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

// Anagram Solver word sets
export const anagramWordSetSchema = z.object({
  original: z.string(),
  anagram: z.string(),
  hint: z.string(),
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
