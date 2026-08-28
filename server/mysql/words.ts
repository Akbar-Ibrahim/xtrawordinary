import { eq, and, sql, between, inArray, gte, like, notLike, aliasedTable, isNotNull } from "drizzle-orm";
import type { AnagramWordSet, ScrambleWord, DefinitionWord, LetterPoolWord, MakerWord, WordRootsPuzzle, WordStackPuzzle, WordSplitPuzzle, WordFusionPuzzle, WordFusionValidationResponse, ProgressiveRevealWord } from "@shared/schema";
import * as schema from "../db-schema";
import { generateLetterPool } from "../game-data";

export async function getDefinitionWords(db: any, gameData: any): Promise<DefinitionWord[]> {
  try {
    const pool = await db
      .select({
        word: schema.wordCategories.word,
        definitions: schema.wordCategories.definitions,
        posName: schema.partsOfSpeech.name,
      })
      .from(schema.wordCategories)
      .leftJoin(schema.partsOfSpeech, eq(schema.wordCategories.partOfSpeechId, schema.partsOfSpeech.id))
      .orderBy(sql`RAND()`)
      .limit(200);
    const words: DefinitionWord[] = pool
      .filter((w: any) => Array.isArray(w.definitions) && w.definitions.length > 0)
      .map((w: any) => ({ word: w.word, partOfSpeech: w.posName ?? "", definitions: w.definitions as string[] }));
    if (words.length > 0) return words;
  } catch {}
  return gameData.getDefinitionWords();
}

type FrequencyLevel = "very_low" | "low" | "medium_low" | "medium" | "medium_high" | "high" | "very_high";
const COMMON_FREQUENCY_LEVELS: FrequencyLevel[] = ["medium_low", "medium", "medium_high", "high", "very_high"];
const HINT_GAME_FREQUENCY_LEVELS: FrequencyLevel[] = ["medium_high", "high", "very_high"];

export async function getLetterPoolWords(db: any, gameData: any): Promise<LetterPoolWord[]> {
  try {
    const wordPool = await db
      .select()
      .from(schema.words)
      .where(and(
        isNotNull(schema.words.hint),
        inArray(schema.words.frequencyLevel, HINT_GAME_FREQUENCY_LEVELS),
      ))
      .orderBy(sql`RAND()`)
      .limit(50);
    if (wordPool.length > 0) {
      return wordPool.map((w: any) => ({
        word: w.word,
        hint: Array.isArray(w.hint) ? (w.hint[0] ?? "") : (w.hint ?? ""),
        category: w.category!,
        letterPool: generateLetterPool(w.word),
      }));
    }
  } catch {}
  return gameData.getLetterPoolWords();
}

export async function getProgressiveRevealWords(db: any, gameData: any): Promise<ProgressiveRevealWord[]> {
  try {
    const wordPool = await db
      .select()
      .from(schema.words)
      .where(and(
        isNotNull(schema.words.hint),
        inArray(schema.words.frequencyLevel, HINT_GAME_FREQUENCY_LEVELS),
      ))
      .orderBy(sql`RAND()`)
      .limit(50);
    if (wordPool.length > 0) {
      return wordPool.map((w: any) => ({
        word: w.word,
        subcategory: w.category ?? "",
        hint: Array.isArray(w.hint) ? (w.hint[0] ?? undefined) : (w.hint ?? undefined),
      }));
    }
  } catch {}
  return gameData.getProgressiveRevealWords();
}

export async function getScrambleWords(db: any, gameData: any): Promise<ScrambleWord[]> {
  try {
    const rows = await db
      .select({ id: schema.words.id, word: schema.words.word, category: schema.words.category })
      .from(schema.words)
      .innerJoin(schema.wordAnagrams, eq(schema.words.id, schema.wordAnagrams.wordId))
      .where(inArray(schema.words.frequencyLevel, COMMON_FREQUENCY_LEVELS))
      .groupBy(schema.words.id, schema.words.word, schema.words.category)
      .orderBy(sql`RAND()`)
      .limit(200);
    if (rows.length === 0) return gameData.getScrambleWords();
    const wordIds = rows.map((r: any) => r.id);
    const anagramWords = schema.words;
    const pairs = await db
      .select({ wordId: schema.wordAnagrams.wordId, anagramWord: anagramWords.word })
      .from(schema.wordAnagrams)
      .innerJoin(anagramWords, eq(schema.wordAnagrams.anagramId, anagramWords.id))
      .where(inArray(schema.wordAnagrams.wordId, wordIds));
    const anagramMap = new Map<number, string[]>();
    for (const p of pairs) {
      const arr = anagramMap.get(p.wordId) ?? [];
      arr.push(p.anagramWord);
      anagramMap.set(p.wordId, arr);
    }
    return rows.map((r: any) => ({
      word: r.word,
      category: r.category ?? "",
      validAnswers: anagramMap.get(r.id) ?? [],
    }));
  } catch {}
  return gameData.getScrambleWords();
}

export async function getAnagramWordSets(db: any, gameData: any): Promise<AnagramWordSet[]> {
  try {
    const originals = await db
      .select({ id: schema.words.id, word: schema.words.word })
      .from(schema.words)
      .innerJoin(schema.wordAnagrams, eq(schema.words.id, schema.wordAnagrams.wordId))
      .where(inArray(schema.words.frequencyLevel, COMMON_FREQUENCY_LEVELS))
      .groupBy(schema.words.id, schema.words.word)
      .orderBy(sql`RAND()`)
      .limit(200);
    if (originals.length === 0) return gameData.getAnagramWordSets();
    const originalIds = originals.map((o: any) => o.id);
    const anagramWords = schema.words;
    const pairs = await db
      .select({ wordId: schema.wordAnagrams.wordId, anagramWord: anagramWords.word })
      .from(schema.wordAnagrams)
      .innerJoin(anagramWords, eq(schema.wordAnagrams.anagramId, anagramWords.id))
      .where(inArray(schema.wordAnagrams.wordId, originalIds));
    const anagramMap = new Map<number, string[]>();
    for (const p of pairs) {
      const arr = anagramMap.get(p.wordId) ?? [];
      arr.push(p.anagramWord);
      anagramMap.set(p.wordId, arr);
    }
    const result: AnagramWordSet[] = originals
      .map((o: any) => ({
        original: o.word,
        anagrams: anagramMap.get(o.id) ?? [],
      }))
      .filter((s: AnagramWordSet) => s.anagrams.length > 0);
    if (result.length > 0) return result;
  } catch {}
  return gameData.getAnagramWordSets();
}

export async function getMakerWords(db: any, gameData: any): Promise<MakerWord[]> {
  try {
    const baseWords = await db
      .select({ id: schema.words.id, word: schema.words.word })
      .from(schema.words)
      .innerJoin(schema.wordDerivatives, eq(schema.words.id, schema.wordDerivatives.wordId))
      .where(and(between(schema.words.wordLength, 6, 10), inArray(schema.words.frequencyLevel, COMMON_FREQUENCY_LEVELS)))
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
      .where(and(between(schema.words.wordLength, 6, 10), inArray(schema.words.frequencyLevel, COMMON_FREQUENCY_LEVELS)))
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
    const anagramWords = schema.words;
    const anagramPairs = await db
      .select({ wordId: schema.wordAnagrams.wordId, anagramWord: anagramWords.word })
      .from(schema.wordAnagrams)
      .innerJoin(anagramWords, eq(schema.wordAnagrams.anagramId, anagramWords.id))
      .where(inArray(schema.wordAnagrams.wordId, baseIds));
    const anagramMap = new Map<number, string[]>();
    for (const p of anagramPairs) {
      const arr = anagramMap.get(p.wordId) ?? [];
      arr.push(p.anagramWord);
      anagramMap.set(p.wordId, arr);
    }
    const puzzles: WordRootsPuzzle[] = baseWords
      .map((b: any) => ({
        canonicalWord: b.word,
        derivatives: derivMap.get(b.id) ?? [],
        validAnswers: anagramMap.get(b.id) ?? [],
      }))
      .filter((p: WordRootsPuzzle) => p.derivatives.length > 0);
    if (puzzles.length > 0) return puzzles;
  } catch {}
  return gameData.getWordRootsPuzzles();
}

export async function getWordStackPuzzles(db: any, gameData: any): Promise<WordStackPuzzle[]> {
  try {
    const pool = await db.select().from(schema.words).where(and(
      sql`${schema.words.isWordStack} = 1`,
      inArray(schema.words.frequencyLevel, COMMON_FREQUENCY_LEVELS),
    )).orderBy(sql`RAND()`).limit(50);
    const puzzles: WordStackPuzzle[] = pool.map((w: any) => ({ targetWord: w.word, startWord: "" }));
    if (puzzles.length > 0) return puzzles;
  } catch {}
  return gameData.getWordStackPuzzles();
}

export async function getWordSplitPuzzles(db: any, gameData: any): Promise<WordSplitPuzzle[]> {
  try {
    const pool = await db.select().from(schema.words).where(and(
      sql`${schema.words.isWordSplit} = 1`,
      inArray(schema.words.frequencyLevel, COMMON_FREQUENCY_LEVELS),
      gte(schema.words.wordLength, 6),
    )).orderBy(sql`RAND()`).limit(50);
    const puzzles: WordSplitPuzzle[] = pool.map((w: any) => ({ targetWord: w.word }));
    if (puzzles.length > 0) return puzzles;
  } catch {}
  return gameData.getWordSplitPuzzles();
}

export async function getWordFusionPuzzles(db: any, gameData: any): Promise<WordFusionPuzzle[]> {
  try {
    const componentWords = aliasedTable(schema.words, "fusion_component_words");
    const rows = await db
      .select({
        id: schema.wordAssemblyComponents.combinationId,
        baseWordId: schema.wordAssemblyComponents.wordId,
        component: componentWords.word,
      })
      .from(schema.wordAssemblyComponents)
      .innerJoin(schema.words, eq(schema.wordAssemblyComponents.wordId, schema.words.id))
      .innerJoin(componentWords, eq(schema.wordAssemblyComponents.componentWordId, componentWords.id))
      .where(and(
        gte(schema.words.wordLength, 6),
        inArray(schema.words.frequencyLevel, COMMON_FREQUENCY_LEVELS),
      ))
      .orderBy(schema.wordAssemblyComponents.wordId, schema.wordAssemblyComponents.combinationId, schema.wordAssemblyComponents.id);

    if (rows.length === 0) return gameData.getWordFusionPuzzles();

    const grouped = new Map<number, { baseWordId: number; components: string[] }>();
    for (const row of rows) {
      const current: { baseWordId: number; components: string[] } =
        grouped.get(row.id) ?? { baseWordId: row.baseWordId, components: [] };
      current.components.push(row.component);
      grouped.set(row.id, current);
    }

    const byBase = new Map<number, WordFusionPuzzle[]>();
    for (const [id, group] of grouped) {
      const puzzle: WordFusionPuzzle = { id, baseWordId: group.baseWordId, components: group.components, alternates: [] };
      const bucket = byBase.get(group.baseWordId) ?? [];
      bucket.push(puzzle);
      byBase.set(group.baseWordId, bucket);
    }
    return Array.from(byBase.values()).flatMap(bucket => {
      const [first, ...alternates] = bucket;
      return [{
        ...first,
        alternates: alternates.map(({ id, components }) => ({ id, components })),
      }];
    });
  } catch {
    return gameData.getWordFusionPuzzles();
  }
}

export async function validateWordFusionAnswer(
  db: any,
  gameData: any,
  combinationId: number,
  answer: string,
): Promise<WordFusionValidationResponse> {
  try {
    const combination = await db
      .select({ baseWordId: schema.wordAssemblyComponents.wordId })
      .from(schema.wordAssemblyComponents)
      .where(eq(schema.wordAssemblyComponents.combinationId, combinationId))
      .limit(1);
    if (combination.length === 0) return gameData.validateWordFusionAnswer(combinationId, answer);

    const baseRows = await db
      .select({ id: schema.words.id, word: schema.words.word })
      .from(schema.words)
      .where(eq(schema.words.id, combination[0].baseWordId))
      .limit(1);
    if (baseRows.length === 0) return { valid: false };

    const links = await db
      .select({ wordId: schema.wordAnagrams.wordId, anagramId: schema.wordAnagrams.anagramId })
      .from(schema.wordAnagrams)
      .where(sql`${schema.wordAnagrams.wordId} = ${combination[0].baseWordId} OR ${schema.wordAnagrams.anagramId} = ${combination[0].baseWordId}`);
    const answerIds = Array.from(new Set([
      combination[0].baseWordId,
      ...links.map((link: { wordId: number; anagramId: number }) =>
        link.wordId === combination[0].baseWordId ? link.anagramId : link.wordId),
    ]));
    const answerRows = await db
      .select({ word: schema.words.word })
      .from(schema.words)
      .where(inArray(schema.words.id, answerIds));
    const normalized = answer.replace(/[^a-z]/gi, "").toUpperCase();
    const canonicalWord = baseRows[0].word.toUpperCase();
    const accepted = answerRows.map((row: { word: string }) => row.word.toUpperCase());
    const valid = accepted.includes(normalized);
    const exact = normalized === canonicalWord;
    return { valid, exact, canonicalWord: valid ? canonicalWord : undefined, points: valid ? (exact ? 15 : 10) : undefined };
  } catch {
    return gameData.validateWordFusionAnswer(combinationId, answer);
  }
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
  if (upper.length < 5) return { valid: false, innerWord: null };
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
    const innerWords = aliasedTable(schema.words, "inner_words");
    const groups = await db.select({ innerWord: innerWords.word, cnt: sql<number>`COUNT(*)` })
      .from(schema.shellWords)
      .innerJoin(innerWords, eq(schema.shellWords.innerWordId, innerWords.id))
      .where(and(eq(schema.shellWords.depth, 1), inArray(innerWords.frequencyLevel, COMMON_FREQUENCY_LEVELS), gte(innerWords.wordLength, 3)))
      .groupBy(schema.shellWords.innerWordId)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(innerWords.word);
    if (groups.length === 0) return gameData.getShellWordPuzzle(seed);
    const idx = ((seed % groups.length) + groups.length) % groups.length;
    return { middle: groups[idx].innerWord, count: groups[idx].cnt };
  } catch {
    return gameData.getShellWordPuzzle(seed);
  }
}

export async function getCrackPuzzle(db: any, gameData: any, seed: number): Promise<{ first: string; last: string } | null> {
  try {
    const outerWords = aliasedTable(schema.words, "outer_words");
    const pairs = await db.select({
      first: sql<string>`LEFT(${outerWords.word}, 1)`,
      last: sql<string>`RIGHT(${outerWords.word}, 1)`,
    })
      .from(schema.shellWords)
      .innerJoin(outerWords, eq(schema.shellWords.shellWordId, outerWords.id))
      .where(and(eq(schema.shellWords.depth, 1), inArray(outerWords.frequencyLevel, COMMON_FREQUENCY_LEVELS)))
      .groupBy(sql`LEFT(${outerWords.word}, 1)`, sql`RIGHT(${outerWords.word}, 1)`)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(sql`LEFT(${outerWords.word}, 1)`, sql`RIGHT(${outerWords.word}, 1)`);
    if (pairs.length === 0) return gameData.getCrackPuzzle(seed);
    const idx = ((seed % pairs.length) + pairs.length) % pairs.length;
    return pairs[idx];
  } catch {
    return gameData.getCrackPuzzle(seed);
  }
}

export async function getDeepShellWordPuzzle(db: any, gameData: any, seed: number): Promise<{ middle: string; count: number } | null> {
  try {
    const innerWords = aliasedTable(schema.words, "inner_words");
    const groups = await db.select({ innerWord: innerWords.word, cnt: sql<number>`COUNT(*)` })
      .from(schema.shellWords)
      .innerJoin(innerWords, eq(schema.shellWords.innerWordId, innerWords.id))
      .where(and(eq(schema.shellWords.depth, 2), inArray(innerWords.frequencyLevel, COMMON_FREQUENCY_LEVELS), gte(innerWords.wordLength, 3)))
      .groupBy(schema.shellWords.innerWordId)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(innerWords.word);
    if (groups.length === 0) return gameData.getDeepShellWordPuzzle(seed);
    const idx = ((seed % groups.length) + groups.length) % groups.length;
    return { middle: groups[idx].innerWord, count: groups[idx].cnt };
  } catch {
    return gameData.getDeepShellWordPuzzle(seed);
  }
}

export async function getDeepCrackPuzzle(db: any, gameData: any, seed: number): Promise<{ first: string; last: string } | null> {
  try {
    const outerWords = aliasedTable(schema.words, "outer_words");
    const pairs = await db.select({
      first: sql<string>`LEFT(${outerWords.word}, 2)`,
      last: sql<string>`RIGHT(${outerWords.word}, 2)`,
    })
      .from(schema.shellWords)
      .innerJoin(outerWords, eq(schema.shellWords.shellWordId, outerWords.id))
      .where(and(eq(schema.shellWords.depth, 2), inArray(outerWords.frequencyLevel, COMMON_FREQUENCY_LEVELS)))
      .groupBy(sql`LEFT(${outerWords.word}, 2)`, sql`RIGHT(${outerWords.word}, 2)`)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(sql`LEFT(${outerWords.word}, 2)`, sql`RIGHT(${outerWords.word}, 2)`);
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
    const outerWords = aliasedTable(schema.words, "outer_words");
    const innerWords = aliasedTable(schema.words, "inner_words");
    const rows = await db.select({ innerWord: innerWords.word })
      .from(schema.shellWords)
      .innerJoin(outerWords, eq(schema.shellWords.shellWordId, outerWords.id))
      .innerJoin(innerWords, eq(schema.shellWords.innerWordId, innerWords.id))
      .where(and(
        eq(schema.shellWords.depth, 2),
        sql`LEFT(${outerWords.word}, 2) = ${pair.first}`,
        sql`RIGHT(${outerWords.word}, 2) = ${pair.last}`,
      )).limit(1);
    return rows.length > 0 ? rows[0].innerWord : null;
  } catch {
    return gameData.getDeepCrackAnswer(seed);
  }
}

export async function getWordExamples(
  db: any,
  game: "letter-hunt" | "letter-dodge",
  letters: string[],
  limit: number
): Promise<{ words: string[]; total: number }> {
  if (letters.length === 0) return { words: [], total: 0 };
  try {
    const upper = letters.map(l => l.toUpperCase());
    const conditions =
      game === "letter-hunt"
        ? upper.map(l => like(schema.words.word, `%${l}%`))
        : upper.map(l => notLike(schema.words.word, `%${l}%`));

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const countResult = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(schema.words)
      .where(where);
    const total = Number(countResult[0]?.cnt ?? 0);

    if (total === 0) return { words: [], total: 0 };

    const rows = await db
      .select({ word: schema.words.word })
      .from(schema.words)
      .where(where)
      .orderBy(sql`RAND()`)
      .limit(limit);

    const words = rows.map((r: any) => (r.word as string).toUpperCase());
    return { words, total };
  } catch {
    return { words: [], total: 0 };
  }
}

export async function getWordExtensionPuzzles(
  db: any,
  gameData: any,
  lettersToAdd: number,
  seed?: number,
): Promise<import("@shared/schema").WordExtensionPuzzle[]> {
  try {
    // word_derivatives: derivativeId = shorter shown word, wordId = longer parent word (answer).
    // Base word length is 4–6 letters (random per puzzle); answer is base + lettersToAdd.
    const shortWords = aliasedTable(schema.words, "short_words");
    const longWords = aliasedTable(schema.words, "long_words");

    const rows = await db
      .select({ shownWord: shortWords.word, targetWord: longWords.word })
      .from(schema.wordDerivatives)
      .innerJoin(shortWords, eq(schema.wordDerivatives.derivativeId, shortWords.id))
      .innerJoin(longWords, eq(schema.wordDerivatives.wordId, longWords.id))
      .where(and(
        between(shortWords.wordLength, 4, 6),
        sql`${longWords.wordLength} = ${shortWords.wordLength} + ${lettersToAdd}`,
        inArray(shortWords.frequencyLevel, COMMON_FREQUENCY_LEVELS),
      ))
      .orderBy(
        seed === undefined
          ? sql`RAND()`
          : sql`MD5(CONCAT(${seed}, '-', ${shortWords.id}, '-', ${longWords.id}))`,
      )
      .limit(200);

    if (rows.length === 0) return gameData.getWordExtensionPuzzles(lettersToAdd, seed);

    // Group by shownWord → collect validAnswers
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const arr = map.get(row.shownWord) ?? [];
      arr.push(row.targetWord);
      map.set(row.shownWord, arr);
    }

    const puzzles: import("@shared/schema").WordExtensionPuzzle[] = [];
    for (const [shownWord, validAnswers] of map) {
      if (puzzles.length >= 30) break;
      puzzles.push({ shownWord, lettersToAdd, validAnswers });
    }
    if (puzzles.length > 0) return puzzles;
  } catch {}
  return gameData.getWordExtensionPuzzles(lettersToAdd, seed);
}

export async function validateWordExtension(db: any, gameData: any, shownWord: string, submittedWord: string, lettersToAdd: number): Promise<{ valid: boolean }> {
  try {
    // Enforce exact length — also checked by the route but verified here as defence-in-depth.
    if (submittedWord.length !== shownWord.length + lettersToAdd) return { valid: false };

    // word_derivatives: derivativeId = shorter shown word, wordId = longer parent word (answer).
    const shortWords = aliasedTable(schema.words, "short_words");
    const longWords = aliasedTable(schema.words, "long_words");

    const rows = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(schema.wordDerivatives)
      .innerJoin(shortWords, and(
        eq(schema.wordDerivatives.derivativeId, shortWords.id),
        eq(shortWords.word, shownWord.toUpperCase()),
      ))
      .innerJoin(longWords, and(
        eq(schema.wordDerivatives.wordId, longWords.id),
        eq(longWords.word, submittedWord.toUpperCase()),
      ));

    // Authoritative: DB result is final — no fallback to dictionary.
    return { valid: Number(rows[0]?.cnt ?? 0) > 0 };
  } catch {}
  // Only reach here on DB error — delegate to fallback pairs for resilience.
  return gameData.validateWordExtension(shownWord, submittedWord, lettersToAdd);
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
