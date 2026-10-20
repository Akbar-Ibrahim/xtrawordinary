import { asc, and, between, inArray, sql } from "drizzle-orm";
import { isValidSpokenWord } from "@shared/spoken-word";
import * as schema from "../db-schema";

type FrequencyLevel = "very_low" | "low" | "medium_low" | "medium" | "medium_high" | "high" | "very_high";

export const SPOKEN_WORD_FREQUENCY_LEVELS: FrequencyLevel[] = [
  "high",
  "very_high",
  "medium",
  "medium_high",
  "medium_low",
];

const SPOKEN_WORD_ROUND_SIZE = 10;

export async function getSpokenWordWords(db: any, seed?: number): Promise<string[]> {
  const ordering = seed === undefined
    ? sql`RAND()`
    : sql`CRC32(CONCAT(${seed}, ':', ${schema.words.id}))`;
  const rows = await db
    .select({ id: schema.words.id, word: schema.words.word })
    .from(schema.words)
    .where(and(
      inArray(schema.words.frequencyLevel, SPOKEN_WORD_FREQUENCY_LEVELS),
      between(schema.words.wordLength, 4, 8),
      sql`${schema.words.word} REGEXP '^[A-Za-z]{4,8}$'`,
      sql`${schema.words.word} REGEXP '[AEIOUaeiou]'`,
      sql`${schema.words.word} REGEXP '[BCDFGHJKLMNPQRSTVWXYZbcdfghjklmnpqrstvwxyz]'`,
    ))
    .orderBy(ordering, asc(schema.words.id))
    .limit(SPOKEN_WORD_ROUND_SIZE);

  const words: string[] = Array.from(new Set<string>(
    rows
      .map((row: { word: string }) => row.word.trim().toLowerCase())
      .filter(isValidSpokenWord),
  ));
  return words.slice(0, SPOKEN_WORD_ROUND_SIZE);
}
