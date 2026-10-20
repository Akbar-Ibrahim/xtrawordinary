import { and, eq, gt, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import type { LetterPositionExploreSource } from "../explore/letter-constraint-types";
import { letterExploreCheck, letterExploreWord, meetsLetterPositionConstraint, normalizeLetters } from "../explore/letter-constraint-utils";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
type DbHandle = any;

function isAlphabeticDictionaryWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

export function createMySqlLetterPositionExploreSource(db: DbHandle): LetterPositionExploreSource {
  return {
    async search(letter, position, limit, cursor) {
      const normalizedLetter = normalizeLetters(letter);
      const context = `${normalizedLetter}:${position}`;
      const after = decodeExploreCursor(cursor, "letter-position-results", context);
      const conditions = [
        isAlphabeticDictionaryWord(),
        eq(sql`SUBSTRING(UPPER(${schema.words.word}), ${position}, 1)`, normalizedLetter),
        after ? gt(sql`LOWER(${schema.words.word})`, after.toLowerCase()) : undefined,
      ];
      const cappedLimit = Math.min(limit, MAX_RESULTS_LIMIT);
      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(and(...conditions))
        .orderBy(sql`LOWER(${schema.words.word})`)
        .limit(cappedLimit + 1);

      const hasMore = rows.length > cappedLimit;
      const items = (hasMore ? rows.slice(0, cappedLimit) : rows)
        .map((row: { word: string }) => letterExploreWord(row.word, true, null));
      return {
        items,
        page: {
          limit: cappedLimit,
          hasMore,
          nextCursor: hasMore && items.length
            ? encodeExploreCursor("letter-position-results", context, items[items.length - 1].word.toLowerCase())
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async check(word, letter, position) {
      const normalizedWord = normalizeLetters(word);
      const normalizedLetter = normalizeLetters(letter);
      const [row] = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(and(
          eq(sql`UPPER(${schema.words.word})`, normalizedWord),
          isAlphabeticDictionaryWord(),
        ))
        .limit(1);
      const dictionaryMatch = !!row;
      const constraintMatch = meetsLetterPositionConstraint(normalizedWord, normalizedLetter, position);
      return letterExploreCheck(
        normalizedWord,
        dictionaryMatch,
        constraintMatch,
        dictionaryMatch && constraintMatch,
        null,
        DATABASE_SOURCE,
      );
    },
  };
}
