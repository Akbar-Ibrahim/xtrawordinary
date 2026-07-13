import { eq, and, sql, between, isNotNull, inArray, gte } from "drizzle-orm";
import type { DefinitionWord, LetterPoolWord, MakerWord, WordRootsPuzzle, WordStackPuzzle, WordSplitPuzzle } from "@shared/schema";
import * as schema from "../db-schema";
import { generateLetterPool } from "../game-data";

export async function getDefinitionWords(db: any, gameData: any): Promise<DefinitionWord[]> {
  try {
    const pool = await db.select().from(schema.wordCategories).orderBy(sql`RAND()`).limit(50);
    const words: DefinitionWord[] = pool
      .filter((w: any) => Array.isArray(w.definitions) && w.definitions.length > 0)
      .map((w: any) => ({ word: w.word, partOfSpeech: w.partOfSpeech ?? "", definitions: w.definitions as string[] }));
    if (words.length > 0) return words;
  } catch {}
  return gameData.getDefinitionWords();
}

export async function getLetterPoolWords(db: any, gameData: any): Promise<LetterPoolWord[]> {
  try {
    const pool = await db.select().from(schema.words).where(isNotNull(schema.words.category)).orderBy(sql`RAND()`).limit(50);
    const words: LetterPoolWord[] = pool.map((w: any) => ({
      word: w.word, hint: w.hint ?? "", category: w.category!, letterPool: generateLetterPool(w.word),
    }));
    if (words.length > 0) return words;
  } catch {}
  return gameData.getLetterPoolWords();
}

export async function getMakerWords(db: any, gameData: any): Promise<MakerWord[]> {
  try {
    const baseWords = await db
      .select({ id: schema.words.id, word: schema.words.word })
      .from(schema.words)
      .innerJoin(schema.wordDerivatives, eq(schema.words.id, schema.wordDerivatives.wordId))
      .where(between(schema.words.wordLength, 6, 10))
      .groupBy(schema.words.id, schema.words.word)
      .orderBy(sql`RAND()`)
      .limit(50);
    if (baseWords.length === 0) return gameData.getMakerWords();
    const baseIds = baseWords.map((b: any) => b.id);
    const derivWords = schema.words;
    const pairs = await db
      .select({ wordId: schema.wordDerivatives.wordId, derivWord: derivWords.word })
      .from(schema.wordDerivatives)
      .innerJoin(derivWords, eq(schema.wordDerivatives.derivativeId, derivWords.id))
      .where(and(inArray(schema.wordDerivatives.wordId, baseIds), gte(derivWords.wordLength, 3)));
    const derivMap = new Map<number, string[]>();
    for (const p of pairs) {
      const arr = derivMap.get(p.wordId) ?? [];
      arr.push(p.derivWord);
      derivMap.set(p.wordId, arr);
    }
    const result: MakerWord[] = baseWords
      .map((b: any) => {
        const derivatives = derivMap.get(b.id) ?? [];
        return { baseWord: b.word, derivatives, maxWords: Math.min(derivatives.length, 10) };
      })
      .filter((m: MakerWord) => m.derivatives.length > 0);
    if (result.length > 0) return result;
  } catch {}
  return gameData.getMakerWords();
}

export async function getWordRootsPuzzles(db: any, gameData: any): Promise<WordRootsPuzzle[]> {
  try {
    const baseWords = await db
      .select({ id: schema.words.id, word: schema.words.word })
      .from(schema.words)
      .innerJoin(schema.wordDerivatives, eq(schema.words.id, schema.wordDerivatives.wordId))
      .where(between(schema.words.wordLength, 6, 10))
      .groupBy(schema.words.id, schema.words.word)
      .orderBy(sql`RAND()`)
      .limit(50);
    if (baseWords.length === 0) return gameData.getWordRootsPuzzles();
    const baseIds = baseWords.map((b: any) => b.id);
    const derivWords = schema.words;
    const pairs = await db
      .select({ wordId: schema.wordDerivatives.wordId, derivWord: derivWords.word })
      .from(schema.wordDerivatives)
      .innerJoin(derivWords, eq(schema.wordDerivatives.derivativeId, derivWords.id))
      .where(and(inArray(schema.wordDerivatives.wordId, baseIds), gte(derivWords.wordLength, 3)));
    const derivMap = new Map<number, string[]>();
    for (const p of pairs) {
      const arr = derivMap.get(p.wordId) ?? [];
      arr.push(p.derivWord);
      derivMap.set(p.wordId, arr);
    }
    const puzzles: WordRootsPuzzle[] = baseWords
      .map((b: any) => ({
        canonicalWord: b.word,
        derivatives: derivMap.get(b.id) ?? [],
      }))
      .filter((p: WordRootsPuzzle) => p.derivatives.length > 0);
    if (puzzles.length > 0) return puzzles;
  } catch {}
  return gameData.getWordRootsPuzzles();
}

export async function getWordStackPuzzles(db: any, gameData: any): Promise<WordStackPuzzle[]> {
  try {
    const pool = await db.select().from(schema.words).where(sql`${schema.words.isWordStack} = 1`).orderBy(sql`RAND()`).limit(50);
    const puzzles: WordStackPuzzle[] = pool.map((w: any) => ({ targetWord: w.word, startWord: "", hint: w.hint ?? "" }));
    if (puzzles.length > 0) return puzzles;
  } catch {}
  return gameData.getWordStackPuzzles();
}

export async function getWordSplitPuzzles(db: any, gameData: any): Promise<WordSplitPuzzle[]> {
  try {
    const pool = await db.select().from(schema.words).where(sql`${schema.words.isWordSplit} = 1`).orderBy(sql`RAND()`).limit(50);
    const puzzles: WordSplitPuzzle[] = pool.map((w: any) => ({ targetWord: w.word, hint: w.hint ?? "" }));
    if (puzzles.length > 0) return puzzles;
  } catch {}
  return gameData.getWordSplitPuzzles();
}

export async function getWordChainStartWord(db: any, gameData: any, variation: number, level: number, seed?: number): Promise<string | null> {
  try {
    if (seed !== undefined) {
      const all = await db.select({ word: schema.words.word }).from(schema.words);
      if (all.length > 0) return all[seed % all.length].word;
    }
    const rows = await db.select({ word: schema.words.word }).from(schema.words).orderBy(sql`RAND()`).limit(1);
    if (rows.length > 0) return rows[0].word;
  } catch {}
  return gameData.getWordChainStartWord(variation, level, seed);
}

export async function getWordChainComputerWord(db: any, gameData: any, playerWord: string, variation: number, level: number, usedWords: string[]): Promise<string | null> {
  try {
    const upper = playerWord.toUpperCase();
    const startsWith = variation === 1 ? upper[upper.length - 1] : upper.slice(-2);
    const usedSet = usedWords.map((w: string) => w.toUpperCase());
    let whereClause = sql`${schema.words.word} LIKE ${startsWith + "%"}`;
    if (usedSet.length > 0) {
      whereClause = sql`${whereClause} AND ${schema.words.word} NOT IN (${sql.join(usedSet.map((w: string) => sql`${w}`), sql`, `)})`;
    }
    if (level === 2) {
      whereClause = sql`${whereClause} AND ${schema.words.wordLength} BETWEEN 3 AND 8`;
    }
    const rows = await db.select({ word: schema.words.word }).from(schema.words).where(whereClause).orderBy(sql`RAND()`).limit(1);
    if (rows.length > 0) return rows[0].word;
  } catch {}
  return gameData.getWordChainComputerWord(playerWord, variation, level, usedWords);
}

export function validateShellWord(wordSet: Set<string>, word: string): { valid: boolean; innerWord: string | null } {
  const upper = word.toUpperCase().trim();
  if (upper.length < 4) return { valid: false, innerWord: null };
  const inner = upper.slice(1, -1);
  if (wordSet.size > 0) {
    return wordSet.has(upper) && wordSet.has(inner)
      ? { valid: true, innerWord: inner }
      : { valid: false, innerWord: null };
  }
  return { valid: false, innerWord: null };
}

export function validateDeepShellWord(wordSet: Set<string>, word: string): { valid: boolean; innerWord: string | null } {
  const upper = word.toUpperCase().trim();
  if (upper.length < 7) return { valid: false, innerWord: null };
  const inner = upper.slice(2, -2);
  if (wordSet.size > 0) {
    return wordSet.has(upper) && wordSet.has(inner)
      ? { valid: true, innerWord: inner }
      : { valid: false, innerWord: null };
  }
  return { valid: false, innerWord: null };
}

export async function getShellWordPuzzle(db: any, gameData: any, seed: number): Promise<{ middle: string; count: number } | null> {
  try {
    const groups = await db.select({ innerWord: schema.shellWords.innerWord, cnt: sql<number>`COUNT(*)` })
      .from(schema.shellWords).where(eq(schema.shellWords.shellDepth, 1))
      .groupBy(schema.shellWords.innerWord).having(sql`COUNT(*) >= 3`).orderBy(schema.shellWords.innerWord);
    if (groups.length === 0) return gameData.getShellWordPuzzle(seed);
    const idx = ((seed % groups.length) + groups.length) % groups.length;
    return { middle: groups[idx].innerWord, count: groups[idx].cnt };
  } catch {
    return gameData.getShellWordPuzzle(seed);
  }
}

export async function getCrackPuzzle(db: any, gameData: any, seed: number): Promise<{ first: string; last: string } | null> {
  try {
    const pairs = await db.select({
      first: sql<string>`LEFT(${schema.shellWords.outerWord}, 1)`,
      last: sql<string>`RIGHT(${schema.shellWords.outerWord}, 1)`,
    }).from(schema.shellWords).where(eq(schema.shellWords.shellDepth, 1))
      .groupBy(sql`LEFT(${schema.shellWords.outerWord}, 1)`, sql`RIGHT(${schema.shellWords.outerWord}, 1)`)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(sql`LEFT(${schema.shellWords.outerWord}, 1)`, sql`RIGHT(${schema.shellWords.outerWord}, 1)`);
    if (pairs.length === 0) return gameData.getCrackPuzzle(seed);
    const idx = ((seed % pairs.length) + pairs.length) % pairs.length;
    return pairs[idx];
  } catch {
    return gameData.getCrackPuzzle(seed);
  }
}

export async function getDeepShellWordPuzzle(db: any, gameData: any, seed: number): Promise<{ middle: string; count: number } | null> {
  try {
    const groups = await db.select({ innerWord: schema.shellWords.innerWord, cnt: sql<number>`COUNT(*)` })
      .from(schema.shellWords).where(eq(schema.shellWords.shellDepth, 2))
      .groupBy(schema.shellWords.innerWord).having(sql`COUNT(*) >= 3`).orderBy(schema.shellWords.innerWord);
    if (groups.length === 0) return gameData.getDeepShellWordPuzzle(seed);
    const idx = ((seed % groups.length) + groups.length) % groups.length;
    return { middle: groups[idx].innerWord, count: groups[idx].cnt };
  } catch {
    return gameData.getDeepShellWordPuzzle(seed);
  }
}

export async function getDeepCrackPuzzle(db: any, gameData: any, seed: number): Promise<{ first: string; last: string } | null> {
  try {
    const pairs = await db.select({
      first: sql<string>`LEFT(${schema.shellWords.outerWord}, 2)`,
      last: sql<string>`RIGHT(${schema.shellWords.outerWord}, 2)`,
    }).from(schema.shellWords).where(eq(schema.shellWords.shellDepth, 2))
      .groupBy(sql`LEFT(${schema.shellWords.outerWord}, 2)`, sql`RIGHT(${schema.shellWords.outerWord}, 2)`)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(sql`LEFT(${schema.shellWords.outerWord}, 2)`, sql`RIGHT(${schema.shellWords.outerWord}, 2)`);
    if (pairs.length === 0) return gameData.getDeepCrackPuzzle(seed);
    const idx = ((seed % pairs.length) + pairs.length) % pairs.length;
    return pairs[idx];
  } catch {
    return gameData.getDeepCrackPuzzle(seed);
  }
}

export async function getDeepCrackAnswer(db: any, gameData: any, seed: number): Promise<string | null> {
  try {
    const pair = await getDeepCrackPuzzle(db, gameData, seed);
    if (!pair) return null;
    const rows = await db.select({ innerWord: schema.shellWords.innerWord })
      .from(schema.shellWords)
      .where(and(
        eq(schema.shellWords.shellDepth, 2),
        sql`LEFT(${schema.shellWords.outerWord}, 2) = ${pair.first}`,
        sql`RIGHT(${schema.shellWords.outerWord}, 2) = ${pair.last}`,
      )).limit(1);
    return rows.length > 0 ? rows[0].innerWord : null;
  } catch {
    return gameData.getDeepCrackAnswer(seed);
  }
}

/**
 * Pure helper: count words in wordSet whose character at the given 1-based
 * position equals letter (case-insensitive).  Exported so it can be unit
 * tested independently of MySQLStorage.
 */
export function countWordsAtLetterPosition(
  wordSet: Set<string>,
  letter: string,
  position: number,
): number {
  const l = letter.toUpperCase();
  let count = 0;
  wordSet.forEach((w) => { if (w[position - 1] === l) count++; });
  return count;
}
