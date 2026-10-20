import { and, eq, gt, like, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import * as schema from "../db-schema";
import { normalizeExploreWord } from "../explore/letter-matching";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";
import { AnagramBaseWordNotFoundError, type AnagramExploreSource } from "../explore/anagram-types";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
type DbHandle = any;
type WordRow = { id: number; word: string };

function lowerWordExpression() {
  return sql`LOWER(${schema.words.word})`;
}

async function getBaseWord(db: DbHandle, value: string): Promise<WordRow> {
  const normalized = normalizeExploreWord(value);
  const [base] = await db
    .select({ id: schema.words.id, word: schema.words.word })
    .from(schema.words)
    .innerJoin(schema.wordAnagrams, eq(schema.words.id, schema.wordAnagrams.wordId))
    .where(eq(lowerWordExpression(), normalized.toLowerCase()))
    .groupBy(schema.words.id, schema.words.word)
    .limit(1);

  if (!base) throw new AnagramBaseWordNotFoundError();
  return base as WordRow;
}

export function createMySqlAnagramExploreSource(db: DbHandle): AnagramExploreSource {
  return {
    async searchBaseWords(query, limit, cursor) {
      const normalizedQuery = normalizeExploreWord(query);
      const after = decodeExploreCursor(cursor, "anagram-base-words", normalizedQuery);
      const conditions = [];
      if (normalizedQuery) conditions.push(like(lowerWordExpression(), `${normalizedQuery.toLowerCase()}%`));
      if (after) conditions.push(gt(lowerWordExpression(), after.toLowerCase()));

      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.wordAnagrams, eq(schema.words.id, schema.wordAnagrams.wordId))
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(schema.words.id, schema.words.word)
        .orderBy(lowerWordExpression())
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      const resultRows = hasMore ? rows.slice(0, limit) : rows;
      const last = resultRows[resultRows.length - 1];

      return {
        items: resultRows.map((row: { word: string }) => ({ baseWord: normalizeExploreWord(row.word) })),
        page: {
          limit,
          hasMore,
          nextCursor: hasMore && last
            ? encodeExploreCursor("anagram-base-words", normalizedQuery, normalizeExploreWord(last.word))
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async randomBaseWord() {
      const anagramWords = alias(schema.words, "anagram_words");
      const [row] = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.wordAnagrams, eq(schema.words.id, schema.wordAnagrams.wordId))
        .innerJoin(anagramWords, eq(schema.wordAnagrams.anagramId, anagramWords.id))
        .groupBy(schema.words.id, schema.words.word)
        .orderBy(sql`RAND()`)
        .limit(1);
      if (!row) throw new AnagramBaseWordNotFoundError();
      return { baseWord: normalizeExploreWord(row.word), source: DATABASE_SOURCE };
    },

    async getWords(baseWord, limit, cursor) {
      const normalizedBaseWord = normalizeExploreWord(baseWord);
      const base = await getBaseWord(db, normalizedBaseWord);
      const after = decodeExploreCursor(cursor, "anagram-results", normalizedBaseWord);
      const conditions = [eq(schema.wordAnagrams.wordId, base.id)];
      if (after) conditions.push(gt(lowerWordExpression(), after.toLowerCase()));

      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.wordAnagrams, eq(schema.words.id, schema.wordAnagrams.anagramId))
        .where(and(...conditions))
        .orderBy(lowerWordExpression())
        .limit(Math.min(limit, MAX_RESULTS_LIMIT) + 1);
      const hasMore = rows.length > Math.min(limit, MAX_RESULTS_LIMIT);
      const resultRows = hasMore ? rows.slice(0, Math.min(limit, MAX_RESULTS_LIMIT)) : rows;
      const last = resultRows[resultRows.length - 1];

      return {
        baseWord: normalizedBaseWord,
        items: resultRows.map((row: { word: string }) => ({ word: normalizeExploreWord(row.word) })),
        page: {
          limit: Math.min(limit, MAX_RESULTS_LIMIT),
          hasMore,
          nextCursor: hasMore && last
            ? encodeExploreCursor("anagram-results", normalizedBaseWord, normalizeExploreWord(last.word))
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async checkAnswer(baseWord, answer) {
      const base = await getBaseWord(db, baseWord);
      const normalizedAnswer = normalizeExploreWord(answer);
      const [candidate] = await db
        .select({ id: schema.words.id })
        .from(schema.words)
        .where(eq(lowerWordExpression(), normalizedAnswer.toLowerCase()))
        .limit(1);
      if (!candidate) return { valid: false, source: DATABASE_SOURCE };

      const [relationship] = await db
        .select({ wordId: schema.wordAnagrams.wordId })
        .from(schema.wordAnagrams)
        .where(and(
          eq(schema.wordAnagrams.wordId, base.id),
          eq(schema.wordAnagrams.anagramId, candidate.id),
        ))
        .limit(1);
      return { valid: Boolean(relationship), source: DATABASE_SOURCE };
    },
  };
}
