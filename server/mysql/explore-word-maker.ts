import { and, between, eq, gt, inArray, like, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import * as schema from "../db-schema";
import { COMMON_FREQUENCY_LEVELS } from "./words";
import { canFormFromLetters, getGameplayExclusion, normalizeExploreWord } from "../explore/letter-matching";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";
import { WordMakerBaseWordNotFoundError, type WordMakerExploreSource } from "../explore/word-maker-types";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
const BASE_WORD_MIN_LENGTH = 6;
const BASE_WORD_MAX_LENGTH = 10;

type DbHandle = any;
type BaseWordRow = {
  id: number;
  word: string;
  wordLength: number;
  frequencyLevel: string | null;
};

function lowerWordExpression() {
  return sql`LOWER(${schema.words.word})`;
}

function baseWordConditions() {
  return [
    between(schema.words.wordLength, BASE_WORD_MIN_LENGTH, BASE_WORD_MAX_LENGTH),
    inArray(schema.words.frequencyLevel, COMMON_FREQUENCY_LEVELS),
    sql`${lowerWordExpression()} REGEXP '^[a-z]+$'`,
  ];
}

async function getEligibleBaseWord(db: DbHandle, baseWord: string): Promise<BaseWordRow> {
  const normalized = normalizeExploreWord(baseWord);
  const [base] = await db
    .select({
      id: schema.words.id,
      word: schema.words.word,
      wordLength: schema.words.wordLength,
      frequencyLevel: schema.words.frequencyLevel,
    })
    .from(schema.words)
    .where(and(
      eq(lowerWordExpression(), normalized.toLowerCase()),
      ...baseWordConditions(),
    ))
    .limit(1);

  if (!base) throw new WordMakerBaseWordNotFoundError();
  const [derivative] = await db
    .select({ wordId: schema.wordDerivatives.wordId })
    .from(schema.wordDerivatives)
    .where(eq(schema.wordDerivatives.wordId, base.id))
    .limit(1);
  if (!derivative) throw new WordMakerBaseWordNotFoundError();
  return base as BaseWordRow;
}

function getMatchingLetterConditions(baseWord: string) {
  const normalizedBase = normalizeExploreWord(baseWord).toLowerCase();
  const lowerWord = lowerWordExpression();
  const distinctLetters = [...new Set(normalizedBase)].sort();
  const allowedLettersPattern = `^[${distinctLetters.join("")}]+$`;

  return [
    sql`CHAR_LENGTH(${lowerWord}) >= 1`,
    sql`CHAR_LENGTH(${lowerWord}) <= ${normalizedBase.length}`,
    sql`${lowerWord} REGEXP ${allowedLettersPattern}`,
    sql`${lowerWord} <> ${normalizedBase}`,
    ...distinctLetters.map((letter) => {
      const availableCount = normalizedBase.split("").filter((candidate) => candidate === letter).length;
      return sql`CHAR_LENGTH(${lowerWord}) - CHAR_LENGTH(REPLACE(${lowerWord}, ${letter}, '')) <= ${availableCount}`;
    }),
  ];
}

function getCorrelatedLetterConditions(baseWord: SQL, candidateWord: SQL): SQL[] {
  return [
    sql`CHAR_LENGTH(${candidateWord}) >= 1`,
    sql`CHAR_LENGTH(${candidateWord}) <= CHAR_LENGTH(${baseWord})`,
    sql`${candidateWord} REGEXP CONCAT('^[', ${baseWord}, ']+$')`,
    sql`${candidateWord} <> ${baseWord}`,
    ...[..."abcdefghijklmnopqrstuvwxyz"].map((letter) => sql`
      CHAR_LENGTH(${candidateWord}) - CHAR_LENGTH(REPLACE(${candidateWord}, ${letter}, ''))
      <= CHAR_LENGTH(${baseWord}) - CHAR_LENGTH(REPLACE(${baseWord}, ${letter}, ''))
    `),
  ];
}

function createCheckResult(
  dictionaryMatch: boolean,
  word: string,
  acceptedDerivatives: ReadonlySet<string>,
  baseEligibleForGameplay: boolean,
  reasonIfNotMatch: string,
) {
  const gameplayExclusion = dictionaryMatch
    ? getGameplayExclusion(word, acceptedDerivatives, baseEligibleForGameplay)
    : reasonIfNotMatch;
  return {
    dictionaryMatch,
    playableInGame: dictionaryMatch && gameplayExclusion === null,
    gameplayExclusion,
    source: DATABASE_SOURCE,
  } as const;
}

export function createMySqlWordMakerExploreSource(db: DbHandle): WordMakerExploreSource {
  return {
    async searchBaseWords(query, limit, cursor) {
      const normalizedQuery = normalizeExploreWord(query);
      const after = decodeExploreCursor(cursor, "word-maker-base-words", normalizedQuery);
      const conditions = baseWordConditions();
      if (normalizedQuery) {
        conditions.push(like(lowerWordExpression(), `${normalizedQuery.toLowerCase()}%`));
      }
      if (after) conditions.push(gt(lowerWordExpression(), after.toLowerCase()));

      const rows = await db
        .select({ id: schema.words.id, word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.wordDerivatives, eq(schema.words.id, schema.wordDerivatives.wordId))
        .where(and(...conditions))
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
            ? encodeExploreCursor("word-maker-base-words", normalizedQuery, normalizeExploreWord(last.word))
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async randomBaseWord() {
      const randomDerivative = alias(schema.words, "random_derivative");
      const baseWord = lowerWordExpression();
      const candidateWord = sql`LOWER(${randomDerivative.word})`;
      const [row] = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.wordDerivatives, eq(schema.words.id, schema.wordDerivatives.wordId))
        .innerJoin(randomDerivative, eq(schema.wordDerivatives.derivativeId, randomDerivative.id))
        .where(and(
          ...baseWordConditions(),
          ...getCorrelatedLetterConditions(baseWord, candidateWord),
        ))
        .groupBy(schema.words.id, schema.words.word)
        .orderBy(sql`RAND()`)
        .limit(1);
      if (!row) throw new WordMakerBaseWordNotFoundError();
      return { baseWord: normalizeExploreWord(row.word), source: DATABASE_SOURCE };
    },

    async getWords(baseWord, limit, cursor) {
      const normalizedBaseWord = normalizeExploreWord(baseWord);
      const base = await getEligibleBaseWord(db, normalizedBaseWord);
      const after = decodeExploreCursor(cursor, "word-maker-results", normalizedBaseWord);
      const conditions = [
        eq(schema.wordDerivatives.wordId, base.id),
        ...getMatchingLetterConditions(normalizedBaseWord),
      ];
      if (after) conditions.push(gt(lowerWordExpression(), after.toLowerCase()));

      const rows = await db
        .select({
          id: schema.words.id,
          word: schema.words.word,
          wordLength: schema.words.wordLength,
        })
        .from(schema.words)
        .innerJoin(schema.wordDerivatives, eq(schema.words.id, schema.wordDerivatives.derivativeId))
        .where(and(...conditions))
        .orderBy(lowerWordExpression())
        .limit(Math.min(limit, MAX_RESULTS_LIMIT) + 1);
      const hasMore = rows.length > Math.min(limit, MAX_RESULTS_LIMIT);
      const resultRows = hasMore ? rows.slice(0, Math.min(limit, MAX_RESULTS_LIMIT)) : rows;
      const last = resultRows[resultRows.length - 1];

      return {
        baseWord: normalizedBaseWord,
        items: resultRows.map((row: { id: number; word: string; wordLength: number }) => {
          const isPlayable = row.wordLength >= 3;
          const gameplayExclusion = row.wordLength < 3
            ? "below_minimum_length"
            : isPlayable ? null : "not_in_word_maker_derivatives";
          return {
            word: normalizeExploreWord(row.word),
            playableInGame: isPlayable,
            gameplayExclusion,
          };
        }),
        page: {
          limit: Math.min(limit, MAX_RESULTS_LIMIT),
          hasMore,
          nextCursor: hasMore && last
            ? encodeExploreCursor("word-maker-results", normalizedBaseWord, normalizeExploreWord(last.word))
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async checkAnswer(baseWord, answer) {
      const normalizedBaseWord = normalizeExploreWord(baseWord);
      const normalizedAnswer = normalizeExploreWord(answer);
      const base = await getEligibleBaseWord(db, normalizedBaseWord);
      const [candidate] = await db
        .select({
          id: schema.words.id,
          word: schema.words.word,
          wordLength: schema.words.wordLength,
        })
        .from(schema.words)
        .where(eq(lowerWordExpression(), normalizedAnswer.toLowerCase()))
        .limit(1);

      if (!candidate) {
        return createCheckResult(false, normalizedAnswer, new Set(), true, "not_in_dictionary");
      }
      if (!canFormFromLetters(normalizedBaseWord, normalizedAnswer)) {
        return createCheckResult(false, normalizedAnswer, new Set(), true, "letters_not_available");
      }
      if (normalizedAnswer === normalizedBaseWord) {
        return createCheckResult(false, normalizedAnswer, new Set(), true, "base_word_not_a_subword");
      }

      const [derivative] = await db
        .select({ derivativeId: schema.wordDerivatives.derivativeId })
        .from(schema.wordDerivatives)
        .where(and(
          eq(schema.wordDerivatives.wordId, base.id),
          eq(schema.wordDerivatives.derivativeId, candidate.id),
        ))
        .limit(1);
      if (!derivative) {
        return createCheckResult(false, normalizedAnswer, new Set(), true, "not_in_word_maker_derivatives");
      }
      const accepted = candidate.wordLength >= 3 && !!derivative;
      return createCheckResult(
        true,
        normalizedAnswer,
        accepted ? new Set([normalizedAnswer]) : new Set(),
        true,
        "not_in_dictionary",
      );
    },
  };
}
