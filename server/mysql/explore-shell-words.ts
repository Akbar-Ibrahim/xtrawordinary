import { aliasedTable, and, eq, gt, sql } from "drizzle-orm";
import * as schema from "../db-schema";
import type {
  ShellWordExploreBrowseInput,
  ShellWordExploreDepth,
  ShellWordExploreDirection,
} from "@shared/shell-word-explore";
import type { ShellWordExploreSource } from "../explore/shell-word-explore-types";
import { decodeExploreCursor, encodeExploreCursor } from "../explore/pagination";

const DATABASE_SOURCE = "database" as const;
const MAX_RESULTS_LIMIT = 100;
type DbHandle = any;

function isAlphabeticWord(wordColumn: unknown) {
  return sql`LOWER(${wordColumn}) REGEXP '^[a-z]+$'`;
}

function searchContext(input: ShellWordExploreBrowseInput, depth: ShellWordExploreDepth): string {
  return JSON.stringify({
    depth,
    direction: input.direction,
    word: input.word?.toUpperCase() ?? "",
    first: input.first?.toUpperCase() ?? "",
    last: input.last?.toUpperCase() ?? "",
  });
}

function createSearchConditions(
  input: ShellWordExploreBrowseInput,
  depth: ShellWordExploreDepth,
  outerWords: any,
  innerWords: any,
  after?: string,
) {
  const selectedWord = input.direction === "shell" ? outerWords.word : innerWords.word;
  return [
    eq(schema.shellWords.depth, depth),
    isAlphabeticWord(outerWords.word),
    isAlphabeticWord(innerWords.word),
    input.word ? eq(sql`UPPER(${selectedWord})`, input.word.toUpperCase()) : undefined,
    input.first
      ? eq(sql`UPPER(LEFT(${outerWords.word}, ${depth}))`, input.first.toUpperCase())
      : undefined,
    input.last
      ? eq(sql`UPPER(RIGHT(${outerWords.word}, ${depth}))`, input.last.toUpperCase())
      : undefined,
    after ? gt(sql`UPPER(${outerWords.word})`, after.toUpperCase()) : undefined,
  ];
}

function cursorScope(depth: ShellWordExploreDepth): string {
  return depth === 1 ? "shell-words-explore-results" : "deep-shell-words-explore-results";
}

export function createMySqlShellWordExploreSource(
  db: DbHandle,
  depth: ShellWordExploreDepth,
): ShellWordExploreSource {
  const outerWords = aliasedTable(schema.words, `shell_explore_outer_${depth}`);
  const innerWords = aliasedTable(schema.words, `shell_explore_inner_${depth}`);

  return {
    async search(input, limit, cursor) {
      const context = searchContext(input, depth);
      const scope = cursorScope(depth);
      const after = decodeExploreCursor(cursor, scope, context);
      const cappedLimit = Math.min(limit, MAX_RESULTS_LIMIT);
      const rows = await db
        .select({
          shellWord: outerWords.word,
          innerWord: innerWords.word,
        })
        .from(schema.shellWords)
        .innerJoin(outerWords, eq(schema.shellWords.shellWordId, outerWords.id))
        .innerJoin(innerWords, eq(schema.shellWords.innerWordId, innerWords.id))
        .where(and(...createSearchConditions(input, depth, outerWords, innerWords, after)))
        .orderBy(sql`UPPER(${outerWords.word})`)
        .limit(cappedLimit + 1);

      const hasMore = rows.length > cappedLimit;
      const items = (hasMore ? rows.slice(0, cappedLimit) : rows)
        .map((row: { shellWord: string; innerWord: string }) => ({
          shellWord: row.shellWord.toUpperCase(),
          innerWord: row.innerWord.toUpperCase(),
        }));
      return {
        items,
        page: {
          limit: cappedLimit,
          hasMore,
          nextCursor: hasMore && items.length
            ? encodeExploreCursor(scope, context, items[items.length - 1].shellWord)
            : null,
        },
        source: DATABASE_SOURCE,
      };
    },

    async check(input) {
      const word = input.word.toUpperCase();
      const dictionaryTable = input.direction === "shell" ? outerWords : innerWords;
      const [dictionaryRow] = await db
        .select({ word: dictionaryTable.word })
        .from(dictionaryTable)
        .where(and(
          eq(sql`UPPER(${dictionaryTable.word})`, word),
          isAlphabeticWord(dictionaryTable.word),
        ))
        .limit(1);

      if (!dictionaryRow) {
        return {
          word,
          direction: input.direction,
          dictionaryMatch: false,
          relationshipMatch: false,
          innerWord: null,
          linkedShellCount: 0,
          source: DATABASE_SOURCE,
        };
      }

      if (input.direction === "shell") {
        const [relationship] = await db
          .select({ innerWord: innerWords.word })
          .from(schema.shellWords)
          .innerJoin(outerWords, eq(schema.shellWords.shellWordId, outerWords.id))
          .innerJoin(innerWords, eq(schema.shellWords.innerWordId, innerWords.id))
          .where(and(
            eq(schema.shellWords.depth, depth),
            eq(sql`UPPER(${outerWords.word})`, word),
            isAlphabeticWord(outerWords.word),
            isAlphabeticWord(innerWords.word),
          ))
          .limit(1);

        return {
          word,
          direction: input.direction,
          dictionaryMatch: true,
          relationshipMatch: !!relationship,
          innerWord: relationship?.innerWord?.toUpperCase() ?? null,
          linkedShellCount: relationship ? 1 : 0,
          source: DATABASE_SOURCE,
        };
      }

      const [relationship] = await db
        .select({ count: sql<number>`COUNT(${outerWords.id})` })
        .from(innerWords)
        .leftJoin(schema.shellWords, and(
          eq(schema.shellWords.innerWordId, innerWords.id),
          eq(schema.shellWords.depth, depth),
        ))
        .leftJoin(outerWords, and(
          eq(schema.shellWords.shellWordId, outerWords.id),
          isAlphabeticWord(outerWords.word),
        ))
        .where(and(
          eq(sql`UPPER(${innerWords.word})`, word),
          isAlphabeticWord(innerWords.word),
        ))
        .groupBy(innerWords.id, innerWords.word)
        .limit(1);
      const linkedShellCount = Number(relationship?.count ?? 0);

      return {
        word,
        direction: input.direction as ShellWordExploreDirection,
        dictionaryMatch: true,
        relationshipMatch: linkedShellCount > 0,
        innerWord: null,
        linkedShellCount,
        source: DATABASE_SOURCE,
      };
    },
  };
}
