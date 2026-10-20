import { and, eq, gt, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";
import {
  getLetterBalanceWordStats,
  matchesLetterBalanceFilters,
  normalizeLetterBalanceWord,
} from "../explore/letter-balance-utils";
import type {
  LetterBalanceExploreFilters,
  LetterBalanceExploreSource,
} from "../explore/letter-balance-types";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
const SCOPE = "letter-balance-results";
type DbHandle = any;

function isAlphabeticDictionaryWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

function filterConditions(filters: LetterBalanceExploreFilters) {
  const conditions = [
    isAlphabeticDictionaryWord(),
    filters.length === undefined ? undefined : eq(schema.words.wordLength, filters.length),
  ];

  switch (filters.category) {
    case "vowel_count":
      conditions.push(filters.count === undefined
        ? undefined
        : eq(schema.words.vowelCount, filters.count));
      break;
    case "consonant_count":
      conditions.push(filters.count === undefined
        ? undefined
        : eq(schema.words.consonantCount, filters.count));
      break;
    case "start_end_vowel":
      conditions.push(
        sql`UPPER(LEFT(${schema.words.word}, 1)) IN ('A', 'E', 'I', 'O', 'U')`,
        sql`UPPER(RIGHT(${schema.words.word}, 1)) IN ('A', 'E', 'I', 'O', 'U')`,
      );
      break;
    case "start_end_consonant":
      conditions.push(
        sql`UPPER(LEFT(${schema.words.word}, 1)) NOT IN ('A', 'E', 'I', 'O', 'U')`,
        sql`UPPER(RIGHT(${schema.words.word}, 1)) NOT IN ('A', 'E', 'I', 'O', 'U')`,
      );
      break;
    case "start_vowel_end_consonant":
      conditions.push(
        sql`UPPER(LEFT(${schema.words.word}, 1)) IN ('A', 'E', 'I', 'O', 'U')`,
        sql`UPPER(RIGHT(${schema.words.word}, 1)) NOT IN ('A', 'E', 'I', 'O', 'U')`,
      );
      break;
    case "start_consonant_end_vowel":
      conditions.push(
        sql`UPPER(LEFT(${schema.words.word}, 1)) NOT IN ('A', 'E', 'I', 'O', 'U')`,
        sql`UPPER(RIGHT(${schema.words.word}, 1)) IN ('A', 'E', 'I', 'O', 'U')`,
      );
      break;
    case "locked_balance":
      conditions.push(
        filters.consonantCount === undefined
          ? undefined
          : eq(schema.words.consonantCount, filters.consonantCount),
      );
      break;
  }

  return conditions;
}

export function createMySqlLetterBalanceExploreSource(db: DbHandle): LetterBalanceExploreSource {
  return {
    async search(filters, limit, cursor) {
      const context = JSON.stringify(filters);
      const after = decodeExploreCursor(cursor, SCOPE, context);
      const cappedLimit = Math.max(1, Math.min(limit, MAX_RESULTS_LIMIT));
      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(and(
          ...filterConditions(filters),
          after ? gt(sql`LOWER(${schema.words.word})`, after.toLowerCase()) : undefined,
        ))
        .orderBy(sql`LOWER(${schema.words.word})`)
        .limit(cappedLimit + 1);

      const hasMore = rows.length > cappedLimit;
      const items = (hasMore ? rows.slice(0, cappedLimit) : rows)
        .map((row: { word: string }) => ({ word: normalizeLetterBalanceWord(row.word) }));
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
      const normalizedWord = normalizeLetterBalanceWord(word);
      const [dictionaryWord] = await db
        .select({
          word: schema.words.word,
          wordLength: schema.words.wordLength,
          vowelCount: schema.words.vowelCount,
          consonantCount: schema.words.consonantCount,
        })
        .from(schema.words)
        .where(and(
          eq(sql`UPPER(${schema.words.word})`, normalizedWord),
          isAlphabeticDictionaryWord(),
        ))
        .limit(1);

      if (!dictionaryWord) {
        return {
          word: normalizedWord,
          dictionaryMatch: false,
          constraintMatch: false,
          source: DATABASE_SOURCE,
        };
      }

      const derivedStats = getLetterBalanceWordStats(normalizedWord);
      const stats = {
        length: Number(dictionaryWord.wordLength ?? derivedStats.length),
        vowelCount: Number(dictionaryWord.vowelCount ?? derivedStats.vowelCount),
        consonantCount: Number(dictionaryWord.consonantCount ?? derivedStats.consonantCount),
      };
      return {
        word: normalizeLetterBalanceWord(dictionaryWord.word),
        dictionaryMatch: true,
        constraintMatch: matchesLetterBalanceFilters(normalizedWord, filters, stats),
        source: DATABASE_SOURCE,
      };
    },
  };
}
