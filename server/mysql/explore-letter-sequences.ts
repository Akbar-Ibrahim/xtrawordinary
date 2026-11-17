import { and, eq, exists, gt, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import * as schema from "../db-schema";
import type {
  LetterSequenceExploreSource,
  LetterSequenceType,
} from "../explore/letter-sequence-types";
import { normalizeLetterSequence } from "../explore/letter-sequence-utils";
import {
  letterSequenceCursorContext,
  validateLetterSequenceLength,
} from "../explore/letter-sequence-utils";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";

const DATABASE_SOURCE = "database" as const;
const CURSOR_SCOPE = "letter-sequence-explore";
const MAX_RESULTS_LIMIT = 100;
type DbHandle = any;

function isAlphabeticDictionaryWord() {
  return sql`LOWER(${schema.words.word}) REGEXP '^[a-z]+$'`;
}

function sequenceOccursAt(
  db: DbHandle,
  type: LetterSequenceType,
  sequence: string,
) {
  const firstPosition = alias(schema.wordLetterPositions, "sequence_start");
  const conditions = [
    eq(firstPosition.wordId, schema.words.id),
    eq(firstPosition.letter, sequence[0].toLowerCase()),
  ];

  if (type === "prefix") {
    conditions.push(eq(firstPosition.position, 1));
  } else if (type === "suffix") {
    conditions.push(eq(
      firstPosition.position,
      sql`${schema.words.wordLength} - ${sequence.length} + 1`,
    ));
  } else {
    // The matching sequence must be strictly inside the word: not a prefix or suffix.
    conditions.push(
      gte(firstPosition.position, 2),
      lte(firstPosition.position, sql`${schema.words.wordLength} - ${sequence.length}`),
      sql`UPPER(LEFT(${schema.words.word}, ${sequence.length})) <> ${sequence}`,
      sql`UPPER(RIGHT(${schema.words.word}, ${sequence.length})) <> ${sequence}`,
    );
  }

  for (let offset = 1; offset < sequence.length; offset += 1) {
    const position = alias(schema.wordLetterPositions, `sequence_letter_${offset}`);
    const matchingPosition = db
      .select({ wordId: position.wordId })
      .from(position)
      .where(and(
        eq(position.wordId, firstPosition.wordId),
        eq(position.position, sql`${firstPosition.position} + ${offset}`),
        eq(position.letter, sequence[offset].toLowerCase()),
      ))
      .limit(1);
    conditions.push(exists(matchingPosition));
  }

  return exists(
    db
      .select({ wordId: firstPosition.wordId })
      .from(firstPosition)
      .where(and(...conditions))
      .limit(1),
  );
}

export function createMySqlLetterSequenceExploreSource(db: DbHandle): LetterSequenceExploreSource {
  return {
    async search(type, sequenceInput, limit, cursor, requestedLength) {
      const sequence = normalizeLetterSequence(sequenceInput);
      const length = validateLetterSequenceLength(requestedLength);
      const context = letterSequenceCursorContext(type, sequence, length);
      const after = decodeExploreCursor(cursor, CURSOR_SCOPE, context);
      const cappedLimit = Math.max(1, Math.min(Math.floor(limit), MAX_RESULTS_LIMIT));
      const rows = await db
        .select({ word: schema.words.word })
        .from(schema.words)
        .where(and(
          isAlphabeticDictionaryWord(),
          sequenceOccursAt(db, type, sequence),
          length === null ? undefined : eq(schema.words.wordLength, length),
          after ? gt(sql`UPPER(${schema.words.word})`, after) : undefined,
        ))
        .orderBy(sql`UPPER(${schema.words.word})`)
        .limit(cappedLimit + 1);

      const hasMore = rows.length > cappedLimit;
      const items = (hasMore ? rows.slice(0, cappedLimit) : rows)
        .map((row: { word: string }) => ({ word: row.word.toUpperCase() }));
      const lastWord = items.at(-1)?.word;
      return {
        type,
        sequence,
          length,
        items,
        page: {
          limit: cappedLimit,
          hasMore,
          nextCursor: hasMore && lastWord
            ? encodeExploreCursor(CURSOR_SCOPE, context, lastWord)
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },
  };
}
