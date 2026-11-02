import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import * as schema from "../db-schema";
import { hasSameLetters } from "../explore/anagram-matching";
import { normalizeExploreWord } from "../explore/letter-matching";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";
import { AnagramBaseWordNotFoundError, type AnagramExploreSource } from "../explore/anagram-types";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
const SCAN_BATCH_SIZE = 200;
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
    .where(eq(lowerWordExpression(), normalized.toLowerCase()))
    .limit(1);

  if (!base) throw new AnagramBaseWordNotFoundError();
  return base as WordRow;
}

async function getAnagramGroupIds(db: DbHandle, baseId: number): Promise<number[]> {
  const parents: { wordId: number }[] = await db
    .select({ wordId: schema.wordAnagrams.wordId })
    .from(schema.wordAnagrams)
    .where(eq(schema.wordAnagrams.anagramId, baseId));
  return [...new Set([baseId, ...parents.map((row) => row.wordId)])];
}

async function linkedAnagrams(
  db: DbHandle, base: WordRow, groupIds: number[], limit: number, after: string | null,
): Promise<{ words: string[]; hasMore: boolean }> {
  const found: string[] = [];
  let scanAfter = after;

  while (found.length <= limit) {
    const conditions = [inArray(schema.wordAnagrams.wordId, groupIds)];
    if (scanAfter) conditions.push(gt(lowerWordExpression(), scanAfter.toLowerCase()));
    const rows: { word: string }[] = await db
      .select({ word: schema.words.word })
      .from(schema.words)
      .innerJoin(schema.wordAnagrams, or(
        eq(schema.words.id, schema.wordAnagrams.wordId),
        eq(schema.words.id, schema.wordAnagrams.anagramId),
      ))
      .where(and(...conditions))
      .groupBy(schema.words.id, schema.words.word)
      .orderBy(lowerWordExpression())
      .limit(SCAN_BATCH_SIZE);

    for (const row of rows) {
      if (hasSameLetters(base.word, row.word) && normalizeExploreWord(row.word) !== normalizeExploreWord(base.word)) {
        found.push(normalizeExploreWord(row.word));
        if (found.length > limit) break;
      }
    }
    if (found.length > limit || rows.length < SCAN_BATCH_SIZE) break;
    scanAfter = rows[rows.length - 1].word;
  }

  return { words: found.slice(0, limit), hasMore: found.length > limit };
}

export function createMySqlAnagramExploreSource(db: DbHandle): AnagramExploreSource {
  return {
    async searchBaseWords(query, limit, cursor) {
      const normalizedQuery = normalizeExploreWord(query);
      const after = decodeExploreCursor(cursor, "anagram-base-words", normalizedQuery);
      const conditions = [];
      if (normalizedQuery) conditions.push(eq(lowerWordExpression(), normalizedQuery.toLowerCase()));
      if (after) conditions.push(gt(lowerWordExpression(), after.toLowerCase()));

      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(conditions.length ? and(...conditions) : undefined)
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
      const groupIds = await getAnagramGroupIds(db, base.id);
      const after = decodeExploreCursor(cursor, "anagram-results", normalizedBaseWord);
      const pageLimit = Math.min(limit, MAX_RESULTS_LIMIT);
      const { words, hasMore } = await linkedAnagrams(db, base, groupIds, pageLimit, after ?? null);
      const last = words[words.length - 1];

      return {
        baseWord: normalizedBaseWord,
        items: words.map((word) => ({ word })),
        page: {
          limit: pageLimit,
          hasMore,
          nextCursor: hasMore && last
            ? encodeExploreCursor("anagram-results", normalizedBaseWord, last)
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async checkAnswer(baseWord, answer) {
      const base = await getBaseWord(db, baseWord);
      const normalizedAnswer = normalizeExploreWord(answer);
      if (normalizedAnswer === normalizeExploreWord(base.word) || !hasSameLetters(base.word, normalizedAnswer)) {
        return { valid: false, source: DATABASE_SOURCE };
      }
      const [candidate] = await db
        .select({ id: schema.words.id })
        .from(schema.words)
        .where(eq(lowerWordExpression(), normalizedAnswer.toLowerCase()))
        .limit(1);
      if (!candidate) return { valid: false, source: DATABASE_SOURCE };

      const groupIds = await getAnagramGroupIds(db, base.id);
      const [relationship] = await db
        .select({ wordId: schema.wordAnagrams.wordId })
        .from(schema.wordAnagrams)
        .where(and(
          inArray(schema.wordAnagrams.wordId, groupIds),
          or(
            eq(schema.wordAnagrams.wordId, candidate.id),
            eq(schema.wordAnagrams.anagramId, candidate.id),
          ),
        ))
        .limit(1);
      return { valid: Boolean(relationship), source: DATABASE_SOURCE };
    },
  };
}
