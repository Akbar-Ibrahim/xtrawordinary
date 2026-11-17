import type {
  WordSplitExploreFilters,
  WordSplitExploreItem,
  WordSplitExplorePage,
  WordSplitExploreSource,
} from "./word-split-types";
import { WordSplitSearchTooComplexError } from "./word-split-types";
import { InvalidExploreCursorError } from "./shared-types";
import { EXPLORE_MAX_WORD_LENGTH_FILTER } from "@shared/explore-limits";
import { decodeExploreCursor, encodeExploreCursor } from "./pagination";

const CURSOR_SCOPE = "word-split-explore-results";
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_STEPS = 750_000;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Candidate = {
  word: string;
  length: number;
  counts: number[];
};

type SplitResult = {
  words: string[];
  cursorKey: string;
};

function normalizeWord(value: string): string {
  return value.trim().toUpperCase();
}

function countLetters(word: string): number[] {
  const counts = Array<number>(LETTERS.length).fill(0);
  for (const letter of word) {
    const index = LETTERS.indexOf(letter);
    if (index >= 0) counts[index] += 1;
  }
  return counts;
}

function fitsRemaining(candidate: Candidate, remaining: number[]): boolean {
  return candidate.counts.every((count, index) => count <= remaining[index]);
}

function subtractCandidate(candidate: Candidate, remaining: number[]): number[] {
  return remaining.map((count, index) => count - candidate.counts[index]);
}

function compareSplitWords(left: readonly string[], right: readonly string[]): number {
  const commonLength = Math.min(left.length, right.length);
  for (let index = 0; index < commonLength; index += 1) {
    const comparison = left[index].localeCompare(right[index], "en");
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

function encodeSplitCursor(words: readonly string[]): string {
  return JSON.stringify(words);
}

function decodeSplitCursor(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed)
      || parsed.length < 2
      || parsed.some((word) => typeof word !== "string" || !/^[A-Z]+$/.test(word))
    ) {
      throw new InvalidExploreCursorError();
    }
    const words = parsed as string[];
    if (words.some((word, index) => index > 0 && words[index - 1].localeCompare(word, "en") > 0)) {
      throw new InvalidExploreCursorError();
    }
    return words;
  } catch (error) {
    if (error instanceof InvalidExploreCursorError) throw error;
    throw new InvalidExploreCursorError();
  }
}

function filterContext(filters: WordSplitExploreFilters): string {
  return JSON.stringify({
    targetWord: normalizeWord(filters.targetWord),
    wordCount: filters.wordCount,
    minWordLength: filters.minWordLength,
  });
}

function makeCandidates(
  targetWord: string,
  candidates: readonly string[],
  targetCounts: number[],
  minWordLength: number,
): Candidate[] {
  return [...new Set(candidates.map(normalizeWord))]
    .filter((word) => /^[A-Z]+$/.test(word) && word.length >= minWordLength && word.length < targetWord.length)
    .map((word) => ({ word, length: word.length, counts: countLetters(word) }))
    .filter((candidate) => fitsRemaining(candidate, targetCounts))
    .sort((left, right) => left.word.localeCompare(right.word, "en"));
}

function enumerateSplitResults(
  targetWord: string,
  candidates: Candidate[],
  filters: WordSplitExploreFilters,
  after: string[] | undefined,
  limit: number,
): SplitResult[] {
  const targetCounts = countLetters(targetWord);
  const initialRemaining = targetWord.length;
  const maxWordCount = Math.floor(targetWord.length / filters.minWordLength);
  const results: SplitResult[] = [];
  const path: string[] = [];
  let visited = 0;
  let stopped = false;

  function visit(startIndex: number, remaining: number[], remainingCount: number): void {
    if (stopped) return;
    visited += 1;
    if (visited > MAX_SEARCH_STEPS) throw new WordSplitSearchTooComplexError();

    if (remainingCount === 0) {
      if (path.length >= 2 && (filters.wordCount === null || path.length === filters.wordCount)) {
        if (!after || compareSplitWords(path, after) > 0) {
          results.push({ words: [...path], cursorKey: encodeSplitCursor(path) });
          if (results.length > limit) stopped = true;
        }
      }
      return;
    }

    if (path.length >= maxWordCount) return;
    if (filters.wordCount !== null && path.length >= filters.wordCount) return;

    const minimumPartsNeeded = filters.wordCount === null
      ? Math.max(0, 2 - path.length)
      : filters.wordCount - path.length;
    if (remainingCount < minimumPartsNeeded * filters.minWordLength) return;

    for (let index = startIndex; index < candidates.length && !stopped; index += 1) {
      const candidate = candidates[index];
      if (candidate.length > remainingCount || !fitsRemaining(candidate, remaining)) continue;

      const nextRemaining = subtractCandidate(candidate, remaining);
      const nextCount = remainingCount - candidate.length;
      const nextPathLength = path.length + 1;

      if (filters.wordCount !== null) {
        const remainingParts = filters.wordCount - nextPathLength;
        if (remainingParts < 0 || nextCount < remainingParts * filters.minWordLength) continue;
        if (remainingParts === 0 && nextCount !== 0) continue;
      } else if (nextCount > 0 && nextCount < Math.max(0, 2 - nextPathLength) * filters.minWordLength) {
        continue;
      }

      path.push(candidate.word);
      visit(index, nextRemaining, nextCount);
      path.pop();
    }
  }

  visit(0, targetCounts, initialRemaining);
  return results;
}

export function createWordSplitExplorePage(
  targetWordInput: string,
  candidateWords: readonly string[],
  filters: WordSplitExploreFilters,
  limit: number,
  cursor: string | undefined,
  source: WordSplitExplorePage["source"],
): WordSplitExplorePage {
  const targetWord = normalizeWord(targetWordInput);
  const normalizedFilters: WordSplitExploreFilters = {
    targetWord,
    wordCount: filters.wordCount,
    minWordLength: filters.minWordLength,
  };

  if (!/^[A-Z]+$/.test(targetWord)) throw new RangeError("Target word must contain letters only");
  if (
    !Number.isInteger(normalizedFilters.minWordLength)
    || normalizedFilters.minWordLength < 1
    || normalizedFilters.minWordLength > EXPLORE_MAX_WORD_LENGTH_FILTER
  ) {
    throw new RangeError(`Minimum word length must be between 1 and ${EXPLORE_MAX_WORD_LENGTH_FILTER}`);
  }
  if (
    normalizedFilters.wordCount !== null
    && (!Number.isInteger(normalizedFilters.wordCount) || normalizedFilters.wordCount < 2)
  ) {
    throw new RangeError("A split must contain at least two words");
  }

  const cappedLimit = Math.max(1, Math.min(Math.floor(limit), MAX_PAGE_SIZE));
  const context = filterContext(normalizedFilters);
  const after = decodeSplitCursor(
    decodeExploreCursor(cursor, CURSOR_SCOPE, context),
  );
  const usableCandidates = makeCandidates(
    targetWord,
    candidateWords,
    countLetters(targetWord),
    normalizedFilters.minWordLength,
  );
  const results = enumerateSplitResults(
    targetWord,
    usableCandidates,
    normalizedFilters,
    after,
    cappedLimit,
  );
  const hasMore = results.length > cappedLimit;
  const resultPage = hasMore ? results.slice(0, cappedLimit) : results;
  const last = resultPage[resultPage.length - 1];

  return {
    targetWord,
    wordCount: normalizedFilters.wordCount,
    minWordLength: normalizedFilters.minWordLength,
    items: resultPage.map(({ words }): WordSplitExploreItem => ({ words })),
    page: {
      limit: cappedLimit,
      hasMore,
      nextCursor: hasMore && last
        ? encodeExploreCursor(CURSOR_SCOPE, context, last.cursorKey)
        : null,
    },
    source,
  };
}
