import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import type {
  WordFusionExplorePage,
  WordFusionExploreSource,
} from "../explore/word-fusion-types";
import {
  WordFusionComponentsNotFoundError,
  WordFusionLetterDataMissingError,
} from "../explore/word-fusion-types";
import {
  countWordFusionLetters,
  normalizeWordFusionComponents,
} from "../explore/word-fusion-utils";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";

const DATABASE_SOURCE = "database" as const;
const CURSOR_SCOPE = "word-fusion-explore-results";
const MAX_RESULTS_LIMIT = 100;
type DbHandle = any;
type ComponentLetterRow = {
  id: number;
  word: string;
  letter: string | null;
  frequency: number | null;
};

function isAlphabeticWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

function getCursorContext(components: readonly string[]): string {
  return JSON.stringify([...components].sort((left, right) => left.localeCompare(right, "en")));
}

function validateComponentLetterRows(
  components: readonly string[],
  rows: ComponentLetterRow[],
): void {
  const byId = new Map<number, { word: string; counts: Map<string, number> }>();
  for (const row of rows) {
    let entry = byId.get(row.id);
    if (!entry) {
      entry = { word: row.word.toUpperCase(), counts: new Map() };
      byId.set(row.id, entry);
    }
    if (row.letter && row.frequency !== null) {
      entry.counts.set(row.letter.toUpperCase(), Number(row.frequency));
    }
  }

  const byWord = new Map([...byId.values()].map((entry) => [entry.word, entry.counts]));
  const missing = [...new Set(components.filter((word) => !byWord.has(word)))];
  if (missing.length > 0) throw new WordFusionComponentsNotFoundError(missing);

  for (const word of new Set(components)) {
    const actual = byWord.get(word);
    const expected = countWordFusionLetters([word]);
    if (
      !actual
      || actual.size !== expected.size
      || [...expected].some(([letter, count]) => actual.get(letter) !== count)
    ) {
      throw new WordFusionLetterDataMissingError(word);
    }
  }
}

async function loadAndValidateComponents(db: DbHandle, components: string[]): Promise<void> {
  const uniqueComponents = [...new Set(components)];
  const rows = await db
    .select({
      id: schema.words.id,
      word: schema.words.word,
      letter: schema.letterFrequency.letter,
      frequency: schema.letterFrequency.frequency,
    })
    .from(schema.words)
    .leftJoin(schema.letterFrequency, eq(schema.letterFrequency.wordId, schema.words.id))
    .where(and(
      inArray(sql`UPPER(${schema.words.word})`, uniqueComponents),
      isAlphabeticWord(),
    ));
  validateComponentLetterRows(components, rows);
}

async function findMatchingWords(
  db: DbHandle,
  letterCounts: Array<[string, number]>,
  totalLetters: number,
  after: string | undefined,
  limit: number,
): Promise<Array<{ word: string }>> {
  const exactLetterRows = or(...letterCounts.map(([letter, count]) =>
    and(
      eq(schema.letterFrequency.letter, letter),
      eq(schema.letterFrequency.frequency, count),
    ),
  ));
  return db
    .select({ word: schema.words.word })
    .from(schema.words)
    .innerJoin(schema.letterFrequency, eq(schema.letterFrequency.wordId, schema.words.id))
    .where(and(
      eq(schema.words.wordLength, totalLetters),
      exactLetterRows,
      isAlphabeticWord(),
      after ? gt(sql`UPPER(${schema.words.word})`, after) : undefined,
    ))
    .groupBy(schema.words.id, schema.words.word)
    .having(sql`
      COUNT(DISTINCT ${schema.letterFrequency.letter}) = ${letterCounts.length}
      AND SUM(${schema.letterFrequency.frequency}) = ${totalLetters}
    `)
    .orderBy(sql`UPPER(${schema.words.word})`)
    .limit(limit + 1);
}

function createDatabasePage(
  components: string[],
  rows: Array<{ word: string }>,
  limit: number,
  cursorContext: string,
): WordFusionExplorePage {
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows)
    .map(({ word }) => ({ word: word.toUpperCase() }));
  const lastWord = items.at(-1)?.word;

  return {
    components,
    items,
    page: {
      limit,
      hasMore,
      nextCursor: hasMore && lastWord
        ? encodeExploreCursor(CURSOR_SCOPE, cursorContext, lastWord)
        : null,
    },
    source: DATABASE_SOURCE,
  };
}

export function createMySqlWordFusionExploreSource(db: DbHandle): WordFusionExploreSource {
  return {
    async search(componentInput, limit, cursor) {
      const components = normalizeWordFusionComponents(componentInput);
      await loadAndValidateComponents(db, components);
      const letterCounts = [...countWordFusionLetters(components)];
      const totalLetters = [...letterCounts].reduce((sum, [, count]) => sum + count, 0);
      const context = getCursorContext(components);
      const after = decodeExploreCursor(cursor, CURSOR_SCOPE, context);
      const cappedLimit = Math.max(1, Math.min(Math.floor(limit), MAX_RESULTS_LIMIT));
      const rows = await findMatchingWords(db, letterCounts, totalLetters, after, cappedLimit);
      return createDatabasePage(components, rows, cappedLimit, context);
    },
  };
}
