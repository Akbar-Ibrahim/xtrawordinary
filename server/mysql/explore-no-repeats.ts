import { and, eq, gt, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";
import {
  hasUniqueLetters,
  isAlphabeticWord,
  matchesNoRepeatsFilters,
  normalizeRequiredLetters,
} from "../explore/no-repeats-utils";
import type { NoRepeatsExploreFilters, NoRepeatsExploreSource } from "../explore/no-repeats-types";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
const SCOPE = "no-repeats-results";
type DbHandle = any;

function isAlphabeticDictionaryWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

function requiredLettersMatch(requiredLetters: string) {
  if (!requiredLetters) return undefined;
  const letterList = sql.join([...requiredLetters].map((letter) => sql`${letter}`), sql`, `);
  return sql`
    COUNT(DISTINCT CASE
      WHEN ${schema.letterFrequency.letter} IN (${letterList})
      THEN ${schema.letterFrequency.letter}
    END) = ${requiredLetters.length}
  `;
}

export function createMySqlNoRepeatsExploreSource(db: DbHandle): NoRepeatsExploreSource {
  return {
    async search(filters, limit, cursor) {
      const normalizedFilters: NoRepeatsExploreFilters = {
        ...filters,
        requiredLetters: normalizeRequiredLetters(filters.requiredLetters),
      };
      const context = JSON.stringify(normalizedFilters);
      const after = decodeExploreCursor(cursor, SCOPE, context);
      const cappedLimit = Math.max(1, Math.min(limit, MAX_RESULTS_LIMIT));
      const having = and(
        sql`MAX(${schema.letterFrequency.frequency}) = 1`,
        sql`COUNT(DISTINCT ${schema.letterFrequency.letter}) = ${schema.words.wordLength}`,
        requiredLettersMatch(normalizedFilters.requiredLetters),
      );
      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.letterFrequency, eq(schema.letterFrequency.wordId, schema.words.id))
        .where(and(
          isAlphabeticDictionaryWord(),
          normalizedFilters.length === undefined
            ? undefined
            : eq(schema.words.wordLength, normalizedFilters.length),
          after ? gt(sql`LOWER(${schema.words.word})`, after.toLowerCase()) : undefined,
        ))
        .groupBy(schema.words.id, schema.words.word, schema.words.wordLength)
        .having(having)
        .orderBy(sql`LOWER(${schema.words.word})`)
        .limit(cappedLimit + 1);

      const hasMore = rows.length > cappedLimit;
      const items = (hasMore ? rows.slice(0, cappedLimit) : rows)
        .map((row: { word: string }) => ({ word: row.word.toUpperCase() }));
      return {
        items,
        page: {
          limit: cappedLimit,
          hasMore,
          nextCursor: hasMore && items.length
            ? encodeExploreCursor(SCOPE, context, items[items.length - 1].word.toLowerCase())
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async check(word, filters) {
      const normalizedWord = word.toUpperCase();
      const normalizedFilters = {
        ...filters,
        requiredLetters: normalizeRequiredLetters(filters.requiredLetters),
      };
      const [dictionaryWord] = await db
        .select({ id: schema.words.id, word: schema.words.word })
        .from(schema.words)
        .where(and(
          eq(sql`UPPER(${schema.words.word})`, normalizedWord),
          isAlphabeticDictionaryWord(),
        ))
        .limit(1);

      if (!dictionaryWord || !isAlphabeticWord(normalizedWord)) {
        return {
          word: normalizedWord,
          dictionaryMatch: false,
          constraintMatch: false,
          source: DATABASE_SOURCE,
        };
      }

      const frequencyRows = await db
        .select({
          letter: schema.letterFrequency.letter,
          frequency: schema.letterFrequency.frequency,
        })
        .from(schema.letterFrequency)
        .where(eq(schema.letterFrequency.wordId, dictionaryWord.id));
      const observedUnique =
        frequencyRows.length === normalizedWord.length
          && (frequencyRows as Array<{ frequency: number }>)
            .every(({ frequency }) => Number(frequency) === 1);
      const constraintMatch =
        observedUnique
        && hasUniqueLetters(normalizedWord)
        && matchesNoRepeatsFilters(normalizedWord, normalizedFilters);

      return {
        word: dictionaryWord.word.toUpperCase(),
        dictionaryMatch: true,
        constraintMatch,
        source: DATABASE_SOURCE,
      };
    },
  };
}
