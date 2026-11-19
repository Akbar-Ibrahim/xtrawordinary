export type ShellWordExploreDirection = "shell" | "inner";
export const SHELL_WORD_EXPLORE_DEPTHS = [1, 2, 3, 4] as const;
export type ShellWordExploreDepth = (typeof SHELL_WORD_EXPLORE_DEPTHS)[number];
export type ShellWordExploreSourceName = "preview" | "database";

export const SHELL_WORD_EXPLORE_DEFAULT_PAGE_SIZE = 100;
export const SHELL_WORD_EXPLORE_MAX_PAGE_SIZE = 100;

export interface ShellWordExploreItem {
  shellWord: string;
  innerWord: string;
}

export interface ShellWordExplorePage {
  items: ShellWordExploreItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: ShellWordExploreSourceName;
}

export interface ShellWordExploreCheck {
  word: string;
  depth: ShellWordExploreDepth;
  direction: ShellWordExploreDirection;
  dictionaryMatch: boolean;
  relationshipMatch: boolean;
  innerWord: string | null;
  linkedShellCount: number;
  source: ShellWordExploreSourceName;
}

export interface ShellWordExploreBrowseInput {
  depth: ShellWordExploreDepth;
  direction: ShellWordExploreDirection;
  word?: string;
  first?: string;
  last?: string;
}

export interface ShellWordExploreCheckInput {
  depth: ShellWordExploreDepth;
  direction: ShellWordExploreDirection;
  word: string;
}

export function normalizeShellExploreWord(word: string): string {
  return word.trim().toUpperCase();
}

export function isAlphabeticShellExploreWord(word: string): boolean {
  return /^[A-Z]+$/.test(normalizeShellExploreWord(word));
}

export function normalizeShellBoundary(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().toUpperCase();
}
