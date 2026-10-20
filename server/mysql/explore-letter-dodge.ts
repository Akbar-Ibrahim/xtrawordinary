import { and, eq, gt, notLike, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import type { LetterDodgeExploreSource } from "../explore/letter-constraint-types";
import { DODGE_MINIMUM_WORD_LENGTH, DODGE_SHORT_WORD_EXCLUSION } from "../explore/letter-constraint-preview";
import { letterExploreCheck, letterExploreWord, meetsLetterDodgeConstraint, normalizeLetters } from "../explore/letter-constraint-utils";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
type DbHandle = any;

function isAlphabeticDictionaryWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

function forbiddenLetterConditions(letters: string) {
  return [...new Set(letters)].map((letter) =>
    notLike(sql`UPPER(${schema.words.word})`, `%${letter}%`),
  );
}

function asExploreWord(word: string) {
  const playableInGame = word.length >= DODGE_MINIMUM_WORD_LENGTH;
  return letterExploreWord(
    word,
    playableInGame,
    playableInGame ? null : DODGE_SHORT_WORD_EXCLUSION,
  );
}

export function createMySqlLetterDodgeExploreSource(db: DbHandle): LetterDodgeExploreSource {
  return {
    async search(forbiddenLetters, limit, cursor) {
      const normalizedForbidden = [...new Set(normalizeLetters(forbiddenLetters))].sort().join("");
      const after = decodeExploreCursor(cursor, "letter-dodge-results", normalizedForbidden);
      const conditions = [
        isAlphabeticDictionaryWord(),
        ...forbiddenLetterConditions(normalizedForbidden),
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
        .map((row: { word: string }) => asExploreWord(row.word));
      return {
        items,
        page: {
          limit: cappedLimit,
          hasMore,
          nextCursor: hasMore && items.length
            ? encodeExploreCursor("letter-dodge-results", normalizedForbidden, items[items.length - 1].word.toLowerCase())
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async check(word, forbiddenLetters) {
      const normalizedWord = normalizeLetters(word);
      const [row] = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(and(
          eq(sql`UPPER(${schema.words.word})`, normalizedWord),
          isAlphabeticDictionaryWord(),
        ))
        .limit(1);
      const dictionaryMatch = !!row;
      const constraintMatch = meetsLetterDodgeConstraint(normalizedWord, forbiddenLetters);
      const playableInGame = dictionaryMatch && constraintMatch && normalizedWord.length >= DODGE_MINIMUM_WORD_LENGTH;
      return letterExploreCheck(
        normalizedWord,
        dictionaryMatch,
        constraintMatch,
        playableInGame,
        dictionaryMatch && constraintMatch && !playableInGame ? DODGE_SHORT_WORD_EXCLUSION : null,
        DATABASE_SOURCE,
      );
    },
  };
}
