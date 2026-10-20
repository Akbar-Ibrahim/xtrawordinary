import { and, eq, gt, gte, inArray, or, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";
import {
  isAlphabeticWord,
  normalizeFrequencyConstraints,
} from "../explore/letter-frequency-utils";
import type {
  LetterFrequencyExploreSource,
  LetterFrequencyMatch,
} from "../explore/letter-frequency-types";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
const SCOPE = "letter-frequency-results";
type DbHandle = any;

function isAlphabeticDictionaryWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

function constraintRows(
  constraints: ReturnType<typeof normalizeFrequencyConstraints>,
  match: LetterFrequencyMatch,
) {
  return or(...constraints.map(({ letter, count }) =>
    and(
      eq(schema.letterFrequency.letter, letter),
      match === "minimum"
        ? gte(schema.letterFrequency.frequency, count)
        : eq(schema.letterFrequency.frequency, count),
    ),
  ));
}

export function createMySqlLetterFrequencyExploreSource(db: DbHandle): LetterFrequencyExploreSource {
  return {
    async search(constraints, match, limit, cursor) {
      const normalized = normalizeFrequencyConstraints(constraints);
      const context = JSON.stringify({ constraints: normalized, match });
      const after = decodeExploreCursor(cursor, SCOPE, context);
      const cappedLimit = Math.min(limit, MAX_RESULTS_LIMIT);
      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .innerJoin(schema.letterFrequency, eq(schema.letterFrequency.wordId, schema.words.id))
        .where(and(
          isAlphabeticDictionaryWord(),
          constraintRows(normalized, match),
          after ? gt(sql`LOWER(${schema.words.word})`, after.toLowerCase()) : undefined,
        ))
        .groupBy(schema.words.id, schema.words.word)
        .having(sql`COUNT(DISTINCT ${schema.letterFrequency.letter}) = ${normalized.length}`)
        .orderBy(sql`LOWER(${schema.words.word})`)
        .limit(cappedLimit + 1);

      const hasMore = rows.length > cappedLimit;
      const items = (hasMore ? rows.slice(0, cappedLimit) : rows)
        .map((row: { word: string }) => ({ word: row.word.toUpperCase() }));
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

    async check(word, constraints, match) {
      const normalizedWord = word.toUpperCase();
      const normalizedConstraints = normalizeFrequencyConstraints(constraints);
      const [dictionaryWord] = await db
        .select({ id: schema.words.id, word: schema.words.word })
        .from(schema.words)
        .where(and(
          eq(sql`UPPER(${schema.words.word})`, normalizedWord),
          isAlphabeticDictionaryWord(),
        ))
        .limit(1);

      if (!dictionaryWord || !isAlphabeticWord(normalizedWord)) {
        return {
          word: normalizedWord,
          dictionaryMatch: false,
          constraintMatch: false,
          source: DATABASE_SOURCE,
        };
      }

      const frequencyRows = await db
        .select({
          letter: schema.letterFrequency.letter,
          frequency: schema.letterFrequency.frequency,
        })
        .from(schema.letterFrequency)
        .where(and(
          eq(schema.letterFrequency.wordId, dictionaryWord.id),
          inArray(schema.letterFrequency.letter, normalizedConstraints.map(({ letter }) => letter)),
        ));
      const counts = new Map(
        (frequencyRows as Array<{ letter: string; frequency: number }>)
          .map(({ letter, frequency }) => [letter.toUpperCase(), Number(frequency)]),
      );
      const constraintMatch = normalizedConstraints.every(({ letter, count }) => {
        const actual = counts.get(letter) ?? 0;
        return match === "minimum" ? actual >= count : actual === count;
      });

      return {
        word: dictionaryWord.word.toUpperCase(),
        dictionaryMatch: true,
        constraintMatch,
        source: DATABASE_SOURCE,
      };
    },
  };
}
