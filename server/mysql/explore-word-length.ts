import { and, eq, gt, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import {
  createWordLengthExploreCheck,
  createWordLengthExploreItem,
  normalizeWordLengthPattern,
  type WordLengthExplorePattern,
} from "@shared/word-length-explore";
import type { WordLengthExploreSource } from "../explore/word-length-types";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
type DbHandle = any;

function isAlphabeticDictionaryWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

function buildPatternConditions(pattern: WordLengthExplorePattern) {
  const normalized = normalizeWordLengthPattern(pattern);
  const conditions = [eq(schema.words.wordLength, normalized.length)];

  switch (normalized.variation) {
    case 1:
      break;
    case 2:
      conditions.push(sql`UPPER(LEFT(${schema.words.word}, 1)) = ${normalized.startsWith}`);
      break;
    case 3:
      conditions.push(sql`UPPER(RIGHT(${schema.words.word}, 1)) = ${normalized.endsWith}`);
      break;
    case 4:
      conditions.push(
        sql`UPPER(LEFT(${schema.words.word}, 1)) = ${normalized.startsWith}`,
        sql`LOCATE(${normalized.contains}, LEFT(UPPER(${schema.words.word}), ${schema.words.wordLength} - 1)) > 0`,
      );
      break;
    case 5:
      conditions.push(
        sql`UPPER(RIGHT(${schema.words.word}, 1)) = ${normalized.endsWith}`,
        sql`LOCATE(${normalized.contains}, SUBSTRING(UPPER(${schema.words.word}), 2)) > 0`,
      );
      break;
  }

  return conditions;
}

function patternContext(pattern: WordLengthExplorePattern): string {
  return JSON.stringify(normalizeWordLengthPattern(pattern));
}

export function createMySqlWordLengthExploreSource(db: DbHandle): WordLengthExploreSource {
  return {
    async search(pattern, limit, cursor) {
      const context = patternContext(pattern);
      const after = decodeExploreCursor(cursor, "word-length-explore-results", context);
      const cappedLimit = Math.min(limit, MAX_RESULTS_LIMIT);
      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(and(
          isAlphabeticDictionaryWord(),
          ...buildPatternConditions(pattern),
          after ? gt(sql`LOWER(${schema.words.word})`, after.toLowerCase()) : undefined,
        ))
        .orderBy(sql`LOWER(${schema.words.word})`)
        .limit(cappedLimit + 1);

      const hasMore = rows.length > cappedLimit;
      const items = (hasMore ? rows.slice(0, cappedLimit) : rows)
        .map((row: { word: string }) => createWordLengthExploreItem(row.word));

      return {
        items,
        page: {
          limit: cappedLimit,
          hasMore,
          nextCursor: hasMore && items.length
            ? encodeExploreCursor("word-length-explore-results", context, items[items.length - 1].word.toLowerCase())
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async check(word, pattern) {
      const normalizedWord = word.toUpperCase();
      const [row] = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(and(
          eq(sql`UPPER(${schema.words.word})`, normalizedWord),
          isAlphabeticDictionaryWord(),
        ))
        .limit(1);

      return createWordLengthExploreCheck(
        normalizedWord,
        !!row,
        pattern,
        DATABASE_SOURCE,
      );
    },
  };
}
