import type {
  LetterSequenceExplorePage,
  LetterSequenceType,
} from "@shared/letter-sequence-explore";
import { LETTER_SEQUENCE_EXPLORE_MAX_WORD_LENGTH } from "@shared/letter-sequence-explore";
import { paginateSortedArray } from "./pagination";

const CURSOR_SCOPE = "letter-sequence-explore";
const PREVIEW_SOURCE = "preview" as const;

export function normalizeLetterSequence(sequence: string): string {
  return sequence.trim().toUpperCase();
}

export function wordMatchesLetterSequence(
  wordInput: string,
  sequenceInput: string,
  type: LetterSequenceType,
): boolean {
  const word = wordInput.toUpperCase();
  const sequence = normalizeLetterSequence(sequenceInput);
  if (!word || !sequence) return false;

  if (type === "prefix") return word.startsWith(sequence);
  if (type === "suffix") return word.endsWith(sequence);

  const matchStart = word.indexOf(sequence);
  return matchStart > 0
    && matchStart + sequence.length < word.length
    && !word.startsWith(sequence)
    && !word.endsWith(sequence);
}

export function letterSequenceCursorContext(
  type: LetterSequenceType,
  sequence: string,
  length?: number | null,
): string {
  return `${type}:${sequence}:${length ?? "any"}`;
}

export function validateLetterSequenceLength(length?: number | null): number | null {
  const normalizedLength = length ?? null;
  if (
    normalizedLength !== null
    && (!Number.isInteger(normalizedLength)
      || normalizedLength < 1
      || normalizedLength > LETTER_SEQUENCE_EXPLORE_MAX_WORD_LENGTH)
  ) {
    throw new RangeError(`Word length must be between 1 and ${LETTER_SEQUENCE_EXPLORE_MAX_WORD_LENGTH}.`);
  }
  return normalizedLength;
}

export function createLetterSequenceExplorePage(
  type: LetterSequenceType,
  sequenceInput: string,
  dictionaryWords: readonly string[],
  limit: number,
  cursor?: string,
  length?: number | null,
): LetterSequenceExplorePage {
  const sequence = normalizeLetterSequence(sequenceInput);
  const normalizedLength = validateLetterSequenceLength(length);
  const words = [...new Set(dictionaryWords.map((word) => word.trim().toUpperCase()))]
    .filter((word) => /^[A-Z]+$/.test(word) && wordMatchesLetterSequence(word, sequence, type))
    .filter((word) => normalizedLength === null || word.length === normalizedLength)
    .sort((left, right) => left.localeCompare(right, "en"));
  const page = paginateSortedArray(
    words,
    limit,
    cursor,
    CURSOR_SCOPE,
    letterSequenceCursorContext(type, sequence, normalizedLength),
    (word) => word,
    PREVIEW_SOURCE,
  );

  return {
    ...page,
    sequence,
    type,
    length: normalizedLength,
    items: page.items.map((word) => ({ word })),
  };
}
