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

export function getShellWordPreviewPairs(depth: ShellWordExploreDepth): ShellWordExploreItem[] {
  const pairs = depth === 1 ? SHELL_WORD_PREVIEW_PAIRS : DEEP_SHELL_WORD_PREVIEW_PAIRS;
  return pairs.filter(({ shellWord, innerWord }) =>
    wordDictSet.has(shellWord) && wordDictSet.has(innerWord),
  );
}

export function isPreviewDictionaryWord(word: string): boolean {
  return wordDictSet.has(word);
}
