import { and, eq, inArray, or, sql } from "drizzle-orm";
import * as schema from "../db-schema";

export type DatabaseWordExamplesResult = {
  words: string[];
  total: number;
};

export type WordLengthExampleRequest = {
  game: "word-length";
  length: number;
  variation: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

export type LetterFrequencyExampleRequest = {
  game: "letter-frequency";
  mode: "exact" | "minimum";
  constraints: Array<{ letter: string; count: number }>;
};

export type LetterBalanceExampleRequest = {
  game: "letter-balance";
  category:
    | "consonant_count"
    | "vowel_count"
    | "start_end_vowel"
    | "start_end_consonant"
    | "start_vowel_end_consonant"
    | "start_consonant_end_vowel"
    | "locked_balance"
    | "custom";
  length?: number;
  vowelCount?: number;
  consonantCount?: number;
};

export type DatabaseWordExamplesRequest =
  | WordLengthExampleRequest
  | LetterFrequencyExampleRequest
  | LetterBalanceExampleRequest;

const VOWELS = ["A", "E", "I", "O", "U"];
const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ".split("");

function toResult(rows: Array<{ word: string }>, total: number): DatabaseWordExamplesResult {
  return {
    total,
    words: rows.map(row => row.word.toUpperCase()),
  };
}

async function findMatchingWords(db: any, conditions: any[], limit: number): Promise<DatabaseWordExamplesResult> {
  const where = and(...conditions);
  const countRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.words)
    .where(where);
  const total = Number(countRows[0]?.count ?? 0);

  if (total === 0) return { words: [], total: 0 };

  const rows = await db
    .select({ word: schema.words.word })
    .from(schema.words)
    .where(where)
    .orderBy(sql`RAND()`)
    .limit(limit);

  return toResult(rows, total);
}

function edgeMatches(type: "vowel" | "consonant", position: "start" | "end") {
  const allowedLetters = type === "vowel" ? VOWELS : CONSONANTS;
  const edge = position === "start"
    ? sql<string>`UPPER(LEFT(${schema.words.word}, 1))`
    : sql<string>`UPPER(RIGHT(${schema.words.word}, 1))`;
  return inArray(edge, allowedLetters);
}

export async function getWordLengthExamples(
  db: any,
  request: WordLengthExampleRequest,
  limit: number,
): Promise<DatabaseWordExamplesResult> {
  const conditions: any[] = [eq(schema.words.wordLength, request.length)];

  if (request.startsWith) {
    conditions.push(sql`UPPER(LEFT(${schema.words.word}, 1)) = ${request.startsWith}`);
  }
  if (request.endsWith) {
    conditions.push(sql`UPPER(RIGHT(${schema.words.word}, 1)) = ${request.endsWith}`);
  }
  if (request.contains) {
    if (request.variation === 4) {
      conditions.push(sql`LOCATE(${request.contains}, LEFT(${schema.words.word}, ${schema.words.wordLength} - 1)) > 0`);
    } else if (request.variation === 5) {
      conditions.push(sql`LOCATE(${request.contains}, SUBSTRING(${schema.words.word}, 2)) > 0`);
    } else {
      conditions.push(sql`LOCATE(${request.contains}, ${schema.words.word}) > 0`);
    }
  }

  return findMatchingWords(db, conditions, limit);
}

export async function getLetterFrequencyExamples(
  db: any,
  request: LetterFrequencyExampleRequest,
  limit: number,
): Promise<DatabaseWordExamplesResult> {
  const matchesConstraint = or(...request.constraints.map(({ letter, count }) => {
    const countMatch = request.mode === "minimum"
      ? sql`${schema.letterFrequency.frequency} >= ${count}`
      : eq(schema.letterFrequency.frequency, count);
    return and(eq(schema.letterFrequency.letter, letter), countMatch);
  }));

  const matchingWords = db.$with("matching_words").as(
    db
      .select({ id: schema.words.id })
      .from(schema.words)
      .innerJoin(schema.letterFrequency, eq(schema.letterFrequency.wordId, schema.words.id))
      .where(matchesConstraint)
      .groupBy(schema.words.id)
      .having(sql`COUNT(DISTINCT ${schema.letterFrequency.letter}) = ${request.constraints.length}`),
  );

  const countRows = await db
    .with(matchingWords)
    .select({ count: sql<number>`COUNT(*)` })
    .from(matchingWords);
  const total = Number(countRows[0]?.count ?? 0);

  if (total === 0) return { words: [], total: 0 };

  const rows = await db
    .select({ word: schema.words.word })
    .from(schema.words)
    .innerJoin(schema.letterFrequency, eq(schema.letterFrequency.wordId, schema.words.id))
    .where(matchesConstraint)
    .groupBy(schema.words.id, schema.words.word)
    .having(sql`COUNT(DISTINCT ${schema.letterFrequency.letter}) = ${request.constraints.length}`)
    .orderBy(sql`RAND()`)
    .limit(limit);

  return toResult(rows, total);
}

export async function getLetterBalanceExamples(
  db: any,
  request: LetterBalanceExampleRequest,
  limit: number,
): Promise<DatabaseWordExamplesResult> {
  const conditions: any[] = [];

  if (request.length !== undefined) {
    conditions.push(eq(schema.words.wordLength, request.length));
  }
  if (request.vowelCount !== undefined) {
    conditions.push(eq(schema.words.vowelCount, request.vowelCount));
  }
  if (request.consonantCount !== undefined) {
    conditions.push(eq(schema.words.consonantCount, request.consonantCount));
  }

  switch (request.category) {
    case "start_end_vowel":
      conditions.push(edgeMatches("vowel", "start"), edgeMatches("vowel", "end"));
      break;
    case "start_end_consonant":
      conditions.push(edgeMatches("consonant", "start"), edgeMatches("consonant", "end"));
      break;
    case "start_vowel_end_consonant":
      conditions.push(edgeMatches("vowel", "start"), edgeMatches("consonant", "end"));
      break;
    case "start_consonant_end_vowel":
      conditions.push(edgeMatches("consonant", "start"), edgeMatches("vowel", "end"));
      break;
  }

  return findMatchingWords(db, conditions, limit);
}

export async function getDatabaseWordExamples(
  db: any,
  request: DatabaseWordExamplesRequest,
  limit: number,
): Promise<DatabaseWordExamplesResult> {
  switch (request.game) {
    case "word-length":
      return getWordLengthExamples(db, request, limit);
    case "letter-frequency":
      return getLetterFrequencyExamples(db, request, limit);
    case "letter-balance":
      return getLetterBalanceExamples(db, request, limit);
  }
}