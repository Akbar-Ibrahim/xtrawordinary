import { aliasedTable, and, eq, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import type { WordSplitExploreSource } from "../explore/word-split-types";
import { WordSplitTargetNotFoundError } from "../explore/word-split-types";
import { createWordSplitExplorePage } from "../explore/word-split-utils";

const DATABASE_SOURCE = "database" as const;
type DbHandle = any;

function isAlphabeticWord(wordColumn: unknown) {
  return sql`LOWER(${wordColumn}) REGEXP '^[a-z]+$'`;
}

export function createMySqlWordSplitExploreSource(db: DbHandle): WordSplitExploreSource {
  const derivativeWords = aliasedTable(schema.words, "word_split_explore_derivatives");

  return {
    async getSplits(filters, limit, cursor) {
      const targetWord = filters.targetWord.trim().toUpperCase();
      const [target] = await db
        .select({ id: schema.words.id, word: schema.words.word })
        .from(schema.words)
        .where(and(
          eq(sql`UPPER(${schema.words.word})`, targetWord),
          isAlphabeticWord(schema.words.word),
        ))
        .limit(1);

      if (!target) throw new WordSplitTargetNotFoundError();

      const derivativeRows = await db
        .select({ word: derivativeWords.word })
        .from(schema.wordDerivatives)
        .innerJoin(derivativeWords, eq(schema.wordDerivatives.derivativeId, derivativeWords.id))
        .where(and(
          eq(schema.wordDerivatives.wordId, target.id),
          isAlphabeticWord(derivativeWords.word),
        ))
        .orderBy(sql`UPPER(${derivativeWords.word})`);

      return createWordSplitExplorePage(
        target.word,
        derivativeRows.map((row: { word: string }) => row.word),
        { ...filters, targetWord: target.word },
        limit,
        cursor,
        DATABASE_SOURCE,
      );
    },
  };
}
