import { wordDictSet } from "../game-data";
import type { ShellWordExploreDepth, ShellWordExploreItem } from "@shared/shell-word-explore";

const SHELL_WORD_PREVIEW_PAIRS: ShellWordExploreItem[] = [
  { shellWord: "ALIEN", innerWord: "LIE" },
  { shellWord: "APART", innerWord: "PAR" },
  { shellWord: "AWARD", innerWord: "WAR" },
  { shellWord: "BEARD", innerWord: "EAR" },
  { shellWord: "BLOWN", innerWord: "LOW" },
  { shellWord: "BRAND", innerWord: "RAN" },
  { shellWord: "CANDY", innerWord: "AND" },
  { shellWord: "CHAMP", innerWord: "HAM" },
  { shellWord: "CHASE", innerWord: "HAS" },
  { shellWord: "CRANE", innerWord: "RAN" },
  { shellWord: "CROWN", innerWord: "ROW" },
  { shellWord: "GRAPE", innerWord: "RAP" },
  { shellWord: "MORALE", innerWord: "ORAL" },
];

const DEEP_SHELL_WORD_PREVIEW_PAIRS: ShellWordExploreItem[] = [
  { shellWord: "ADVANCE", innerWord: "VAN" },
  { shellWord: "ALLEGED", innerWord: "LEG" },
  { shellWord: "ALLOWED", innerWord: "LOW" },
  { shellWord: "APPEARS", innerWord: "PEA" },
  { shellWord: "ARRANGE", innerWord: "RAN" },
  { shellWord: "ARTICLE", innerWord: "TIC" },
  { shellWord: "ASSUMED", innerWord: "SUM" },
  { shellWord: "AVERAGE", innerWord: "ERA" },
  { shellWord: "BELIEVE", innerWord: "LIE" },
  { shellWord: "CAPITAL", innerWord: "PIT" },
  { shellWord: "CAREFUL", innerWord: "REF" },
  { shellWord: "CHARTER", innerWord: "ART" },
  { shellWord: "CRASHED", innerWord: "ASH" },
  { shellWord: "CREATED", innerWord: "EAT" },
];

const DEPTH_THREE_PREVIEW_PAIRS: ShellWordExploreItem[] = [
  { shellWord: "COOPERATE", innerWord: "PER" },
  { shellWord: "EDUCATION", innerWord: "CAT" },
];

const DEPTH_FOUR_PREVIEW_PAIRS: ShellWordExploreItem[] = [
  { shellWord: "CHOCOLATE", innerWord: "O" },
];

const PREVIEW_ONLY_DICTIONARY_WORDS = new Set(["CHOCOLATE", "O"]);

const PREVIEW_PAIRS_BY_DEPTH: Record<ShellWordExploreDepth, ShellWordExploreItem[]> = {
  1: SHELL_WORD_PREVIEW_PAIRS,
  2: DEEP_SHELL_WORD_PREVIEW_PAIRS,
  3: DEPTH_THREE_PREVIEW_PAIRS,
  4: DEPTH_FOUR_PREVIEW_PAIRS,
};

export function getShellWordPreviewPairs(depth: ShellWordExploreDepth): ShellWordExploreItem[] {
  const pairs = PREVIEW_PAIRS_BY_DEPTH[depth];
  return pairs.filter(({ shellWord, innerWord }) =>
    isPreviewDictionaryWord(shellWord) && isPreviewDictionaryWord(innerWord),
  );
}

export function isPreviewDictionaryWord(word: string): boolean {
  return wordDictSet.has(word) || PREVIEW_ONLY_DICTIONARY_WORDS.has(word);
}
