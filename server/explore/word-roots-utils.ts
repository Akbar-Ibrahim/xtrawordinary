import {
  WORD_ROOTS_EXPLORE_MAX_INPUTS,
  WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH,
  WORD_ROOTS_EXPLORE_MAX_PAGE_SIZE,
  WORD_ROOTS_EXPLORE_MIN_INPUTS,
  type WordRootsExplorePage,
} from "@shared/word-roots-explore";
import { decodeExploreCursor, encodeExploreCursor } from "./pagination";

const CURSOR_SCOPE = "word-roots-explore-base-words";

function compareWords(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeWordRootsInputs(inputs: readonly string[]): string[] {
  return inputs.map((word) => word.trim().toUpperCase());
}

export function validateWordRootsInputs(inputs: readonly string[]): void {
  if (inputs.length < WORD_ROOTS_EXPLORE_MIN_INPUTS || inputs.length > WORD_ROOTS_EXPLORE_MAX_INPUTS) {
    throw new RangeError(`Enter between ${WORD_ROOTS_EXPLORE_MIN_INPUTS} and ${WORD_ROOTS_EXPLORE_MAX_INPUTS} words.`);
  }
  if (inputs.some((word) => !/^[A-Z]+$/.test(word))) {
    throw new RangeError("Enter words using letters A–Z only.");
  }
  if (new Set(inputs).size !== inputs.length) {
    throw new RangeError("Enter each word only once.");
  }
}

export function getWordRootsCursorContext(inputs: readonly string[], length?: number | null): string {
  return JSON.stringify({
    inputs: [...inputs].sort(compareWords),
    length: length ?? null,
  });
}

export function createWordRootsExplorePage(
  inputWords: readonly string[],
  candidateWords: readonly string[],
  limit: number,
  cursor: string | undefined,
  source: WordRootsExplorePage["source"],
  length?: number | null,
): WordRootsExplorePage {
  const inputs = normalizeWordRootsInputs(inputWords);
  validateWordRootsInputs(inputs);

  const cappedLimit = Math.max(1, Math.min(Math.floor(limit), WORD_ROOTS_EXPLORE_MAX_PAGE_SIZE));
  const normalizedLength = length ?? null;
  if (
    normalizedLength !== null
    && (!Number.isInteger(normalizedLength)
      || normalizedLength < 1
      || normalizedLength > WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH)
  ) {
    throw new RangeError(`Base word length must be between 1 and ${WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH}.`);
  }
  const context = getWordRootsCursorContext(inputs, normalizedLength);
  const after = decodeExploreCursor(cursor, CURSOR_SCOPE, context);
  const matchingWords = [...new Set(candidateWords.map((word) => word.trim().toUpperCase()))]
    .filter((word) => /^[A-Z]+$/.test(word))
    .filter((word) => normalizedLength === null || word.length === normalizedLength)
    .sort(compareWords)
    .filter((word) => !after || word > after);
  const pageWords = matchingWords.slice(0, cappedLimit + 1);
  const hasMore = pageWords.length > cappedLimit;
  const items = (hasMore ? pageWords.slice(0, cappedLimit) : pageWords).map((word) => ({ word }));
  const lastWord = items.at(-1)?.word;

  return {
    inputs,
    length: normalizedLength,
    items,
    page: {
      limit: cappedLimit,
      hasMore,
      nextCursor: hasMore && lastWord
        ? encodeExploreCursor(CURSOR_SCOPE, context, lastWord)
        : null,
    },
    source,
  };
}
