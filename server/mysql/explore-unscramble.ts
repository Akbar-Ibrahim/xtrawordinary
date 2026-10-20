import { and, between, eq, gt, or, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import { countLetters, normalizeScrambledLetters, shuffleLetters } from "../explore/unscramble-utils";
import type { UnscrambleSource } from "../explore/unscramble-types";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
const SAMPLE_MIN_LENGTH = 3;
const SAMPLE_MAX_LENGTH = 12;
type DbHandle = any;

function isAlphabeticWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

export function createMySqlUnscrambleSource(db: DbHandle): UnscrambleSource {
  return {
    async getExamples(limit) {
      const candidates = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.letterFrequency, eq(schema.letterFrequency.wordId, schema.words.id))
        .where(and(
          between(schema.words.wordLength, SAMPLE_MIN_LENGTH, SAMPLE_MAX_LENGTH),
          isAlphabeticWord(),
        ))
        .groupBy(schema.words.id, schema.words.word)
        .having(sql`COUNT(DISTINCT ${schema.letterFrequency.letter}) > 1`)
        .orderBy(sql`RAND()`)
        .limit(Math.max(limit * 8, 32));

      const examples: string[] = [];
      const seen = new Set<string>();
      for (const { word } of candidates as Array<{ word: string }>) {
        const scrambled = shuffleLetters(word);
        if (scrambled === normalizeScrambledLetters(word) || seen.has(scrambled)) continue;
        examples.push(scrambled);
        seen.add(scrambled);
        if (examples.length >= limit) break;
      }

      return { items: examples, source: DATABASE_SOURCE };
    },

    async solve(letters, limit, cursor) {
      const input = normalizeScrambledLetters(letters);
      const after = decodeExploreCursor(cursor, "unscramble-results", input);
      const letterCounts = [...countLetters(input).entries()];
      const exactLetterRows = or(...letterCounts.map(([letter, count]) => and(
        eq(schema.letterFrequency.letter, letter),
        eq(schema.letterFrequency.frequency, count),
      )));
      const cappedLimit = Math.min(limit, MAX_RESULTS_LIMIT);
      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.letterFrequency, eq(schema.letterFrequency.wordId, schema.words.id))
        .where(and(
          eq(schema.words.wordLength, input.length),
          exactLetterRows,
          isAlphabeticWord(),
          after ? gt(sql`LOWER(${schema.words.word})`, after.toLowerCase()) : undefined,
        ))
        .groupBy(schema.words.id, schema.words.word)
        .having(sql`
          COUNT(DISTINCT ${schema.letterFrequency.letter}) = ${letterCounts.length}
          AND SUM(${schema.letterFrequency.frequency}) = ${input.length}
        `)
        .orderBy(sql`LOWER(${schema.words.word})`)
        .limit(cappedLimit + 1);

      const hasMore = rows.length > cappedLimit;
      const items = (hasMore ? rows.slice(0, cappedLimit) : rows)
        .map((row: { word: string }) => row.word.toUpperCase());
      return {
        input,
        items,
        hasMore,
        nextCursor: hasMore && items.length
          ? encodeExploreCursor("unscramble-results", input, items[items.length - 1])
          : null,
        source: DATABASE_SOURCE,
      };
    },
  };
}
