import type { ShellWordExploreDepth } from "@shared/shell-word-explore";
import { SHELL_WORD_EXPLORE_DEPTHS } from "@shared/shell-word-explore";

export interface ShellWordDictionaryEntry {
  id: number;
  word: string;
}

export interface ShellWordRelationship {
  shellWordId: number;
  innerWordId: number;
  depth: ShellWordExploreDepth;
}

export function deriveShellWordRelationships(
  dictionary: readonly ShellWordDictionaryEntry[],
): ShellWordRelationship[] {
  const idsByWord = new Map<string, number>();

  for (const { id, word } of dictionary) {
    if (!/^[A-Za-z]+$/.test(word)) continue;
    const normalizedWord = word.toUpperCase();
    const existingId = idsByWord.get(normalizedWord);
    if (existingId !== undefined && existingId !== id) {
      throw new Error(`The dictionary contains duplicate words that differ only by case: ${word}.`);
    }
    idsByWord.set(normalizedWord, id);
  }

  const relationships: ShellWordRelationship[] = [];
  for (const { id: shellWordId, word } of dictionary) {
    if (!/^[A-Za-z]+$/.test(word)) continue;

    const shellWord = word.toUpperCase();
    for (const depth of SHELL_WORD_EXPLORE_DEPTHS) {
      if (shellWord.length <= depth * 2) continue;

      const innerWord = shellWord.slice(depth, -depth);
      const innerWordId = idsByWord.get(innerWord);
      if (innerWordId === undefined) continue;

      relationships.push({ shellWordId, innerWordId, depth });
    }
  }

  return relationships;
}

export function shellWordRelationshipKey(shellWordId: number, depth: number): string {
  return `${shellWordId}:${depth}`;
}
