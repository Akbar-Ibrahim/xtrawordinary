import { aliasedTable, and, eq, gt, inArray, sql } from "drizzle-orm";
import {
  WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH,
  WORD_ROOTS_EXPLORE_MAX_PAGE_SIZE,
  type WordRootsExplorePage,
} from "@shared/word-roots-explore";
import * as schema from "../db-schema";
import type { WordRootsExploreSource } from "../explore/word-roots-types";
import { WordRootsExploreWordsNotFoundError } from "../explore/word-roots-types";
import { decodeExploreCursor } from "../explore/pagination";
import {
  createWordRootsExplorePage,
  getWordRootsCursorContext,
  normalizeWordRootsInputs,
  validateWordRootsInputs,
} from "../explore/word-roots-utils";

const DATABASE_SOURCE = "database" as const;
const CURSOR_SCOPE = "word-roots-explore-base-words";
type DbHandle = any;

function isAlphabeticWord(wordColumn: unknown) {
  return sql`LOWER(${wordColumn}) REGEXP '^[a-z]+$'`;
}

async function resolveInputWordIds(db: DbHandle, inputs: string[]): Promise<number[]> {
  const rows = await db
    .select({ id: schema.words.id, word: schema.words.word })
    .from(schema.words)
    .where(and(
      inArray(sql`UPPER(${schema.words.word})`, inputs),
      isAlphabeticWord(schema.words.word),
    ));

  const idsByWord = new Map<string, number>(
    rows.map((row: { id: number; word: string }) => [row.word.toUpperCase(), row.id]),
  );
  const missingWords = inputs.filter((word) => !idsByWord.has(word));
  if (missingWords.length > 0) throw new WordRootsExploreWordsNotFoundError(missingWords);
  return inputs.map((word) => idsByWord.get(word)!);
}

async function findCommonParents(
  db: DbHandle,
  derivativeIds: number[],
  cursor: string | undefined,
  limit: number,
  baseWordLength: number | null,
): Promise<Array<{ word: string }>> {
  const parentWords = aliasedTable(schema.words, "word_roots_explore_parents");
  return db
    .select({ word: parentWords.word })
    .from(schema.wordDerivatives)
    .innerJoin(parentWords, eq(schema.wordDerivatives.wordId, parentWords.id))
    .where(and(
      inArray(schema.wordDerivatives.derivativeId, derivativeIds),
      isAlphabeticWord(parentWords.word),
      baseWordLength === null ? undefined : eq(parentWords.wordLength, baseWordLength),
      cursor ? gt(sql`UPPER(${parentWords.word})`, cursor) : undefined,
    ))
    .groupBy(parentWords.id, parentWords.word)
    .having(sql`COUNT(DISTINCT ${schema.wordDerivatives.derivativeId}) = ${derivativeIds.length}`)
    .orderBy(sql`UPPER(${parentWords.word})`)
    .limit(limit + 1);
}

export function createMySqlWordRootsExploreSource(db: DbHandle): WordRootsExploreSource {
  return {
    async findBaseWords(inputWords, options) {
      const inputs = normalizeWordRootsInputs(inputWords);
      validateWordRootsInputs(inputs);

      const length = options.length ?? null;
      if (
        length !== null
        && (!Number.isInteger(length)
          || length < 1
          || length > WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH)
      ) {
        throw new RangeError(`Base word length must be between 1 and ${WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH}.`);
      }
      const limit = Math.max(1, Math.min(Math.floor(options.limit), WORD_ROOTS_EXPLORE_MAX_PAGE_SIZE));
      const context = getWordRootsCursorContext(inputs, length);
      const after = decodeExploreCursor(options.cursor, CURSOR_SCOPE, context);

      const derivativeIds = await resolveInputWordIds(db, inputs);
      const rows = await findCommonParents(db, derivativeIds, after, limit, length);

      return createWordRootsExplorePage(
        inputs,
        rows.map((row: { word: string }) => row.word),
        limit,
        undefined,
        DATABASE_SOURCE,
        length,
      ) satisfies WordRootsExplorePage;
    },
  };
}
