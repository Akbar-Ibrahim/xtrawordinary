import {
  isAlphabeticShellExploreWord,
  normalizeShellExploreWord,
  type ShellWordExploreBrowseInput,
  type ShellWordExploreDepth,
  type ShellWordExploreDirection,
  type ShellWordExploreItem,
} from "@shared/shell-word-explore";
import type { ExplorePage } from "./shared-types";
import { paginateSortedArray } from "./pagination";
import type { ShellWordExploreSource } from "./shell-word-explore-types";
import { getShellWordPreviewPairs, isPreviewDictionaryWord } from "./shell-word-explore-preview-data";

const PREVIEW_SOURCE = "preview" as const;
const MAX_RESULTS_LIMIT = 100;

function buildSearchContext(input: ShellWordExploreBrowseInput, depth: ShellWordExploreDepth): string {
  return JSON.stringify({
    depth,
    direction: input.direction,
    word: input.word ? normalizeShellExploreWord(input.word) : "",
    first: input.first ? normalizeShellExploreWord(input.first) : "",
    last: input.last ? normalizeShellExploreWord(input.last) : "",
  });
}

function matchesBrowseInput(
  item: ShellWordExploreItem,
  input: ShellWordExploreBrowseInput,
  depth: ShellWordExploreDepth,
): boolean {
  const word = input.word ? normalizeShellExploreWord(input.word) : undefined;
  const searchedWord = input.direction === "shell" ? item.shellWord : item.innerWord;
  const first = input.first ? normalizeShellExploreWord(input.first) : undefined;
  const last = input.last ? normalizeShellExploreWord(input.last) : undefined;

  return (!word || searchedWord === word)
    && (!first || item.shellWord.startsWith(first.slice(0, depth)))
    && (!last || item.shellWord.endsWith(last.slice(-depth)));
}

function createPage(
  items: ShellWordExploreItem[],
  limit: number,
  cursor: string | undefined,
  depth: ShellWordExploreDepth,
  input: ShellWordExploreBrowseInput,
): ExplorePage<ShellWordExploreItem> {
  return paginateSortedArray(
    items,
    Math.min(limit, MAX_RESULTS_LIMIT),
    cursor,
    depth === 1 ? "shell-words-explore" : "deep-shell-words-explore",
    buildSearchContext(input, depth),
    (item) => item.shellWord,
    PREVIEW_SOURCE,
  );
}

function countLinkedShells(items: ShellWordExploreItem[], word: string): number {
  return items.filter(({ innerWord }) => innerWord === word).length;
}

export function createShellWordMemorySource(depth: ShellWordExploreDepth): ShellWordExploreSource {
  return {
    async search(input, limit, cursor) {
      const pairs = getShellWordPreviewPairs(depth)
        .filter((item) => matchesBrowseInput(item, input, depth))
        .sort((left, right) => left.shellWord.localeCompare(right.shellWord));
      return createPage(pairs, limit, cursor, depth, input);
    },

    async check(input) {
      const word = normalizeShellExploreWord(input.word);
      const pairs = getShellWordPreviewPairs(depth);
      const dictionaryMatch = isAlphabeticShellExploreWord(word) && isPreviewDictionaryWord(word);
      const relationship = input.direction === "shell"
        ? pairs.find((pair) => pair.shellWord === word)
        : undefined;
      const linkedShellCount = input.direction === "inner" && dictionaryMatch
        ? countLinkedShells(pairs, word)
        : 0;

      return {
        word,
        direction: input.direction as ShellWordExploreDirection,
        dictionaryMatch,
        relationshipMatch: input.direction === "shell"
          ? !!relationship
          : linkedShellCount > 0,
        innerWord: relationship?.innerWord ?? null,
        linkedShellCount,
        source: PREVIEW_SOURCE,
      };
    },
  };
}

export const shellWordMemorySource = createShellWordMemorySource(1);
export const deepShellWordMemorySource = createShellWordMemorySource(2);
