import { and, eq, gt, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import type { LetterHuntExploreSource } from "../explore/letter-constraint-types";
import { letterExploreCheck, letterExploreWord, meetsLetterHuntConstraint, normalizeLetters } from "../explore/letter-constraint-utils";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
type DbHandle = any;

function isAlphabeticDictionaryWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

function requiredLetterConditions(letters: string) {
  const counts = new Map<string, number>();
  for (const letter of letters) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  return [...counts].map(([letter, count]) =>
    sql`CHAR_LENGTH(UPPER(${schema.words.word})) - CHAR_LENGTH(REPLACE(UPPER(${schema.words.word}), ${letter}, '')) >= ${count}`,
  );
}

function orderedSequenceCondition(letters: string) {
  const sequencePattern = `.*${[...letters].join(".*")}.*`;
  return sql`UPPER(${schema.words.word}) REGEXP ${sequencePattern}`;
}

function checkResult(word: string, letters: string, ordered: boolean, dictionaryMatch: boolean) {
  const constraintMatch = meetsLetterHuntConstraint(word, letters, ordered);
  return letterExploreCheck(
    word,
    dictionaryMatch,
    constraintMatch,
    dictionaryMatch && constraintMatch,
    null,
    DATABASE_SOURCE,
  );
}

export function createMySqlLetterHuntExploreSource(db: DbHandle): LetterHuntExploreSource {
  return {
    async search(letters, ordered, limit, cursor) {
      const normalizedLetters = normalizeLetters(letters);
      const context = `${normalizedLetters}:${ordered ? "ordered" : "unordered"}`;
      const after = decodeExploreCursor(cursor, "letter-hunt-results", context);
      const conditions = [
        isAlphabeticDictionaryWord(),
        ...requiredLetterConditions(normalizedLetters),
        ordered ? orderedSequenceCondition(normalizedLetters) : undefined,
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
            ? encodeExploreCursor("letter-hunt-results", context, items[items.length - 1].word.toLowerCase())
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async check(word, letters, ordered) {
      const normalizedWord = normalizeLetters(word);
      const [row] = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(and(
          eq(sql`UPPER(${schema.words.word})`, normalizedWord),
          isAlphabeticDictionaryWord(),
        ))
        .limit(1);
      return checkResult(normalizedWord, normalizeLetters(letters), ordered, !!row);
    },
  };
}
