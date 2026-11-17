export type ShellWordExploreDirection = "shell" | "inner";
export type ShellWordExploreDepth = 1 | 2;
export type ShellWordExploreSourceName = "preview" | "database";

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
  direction: ShellWordExploreDirection;
  dictionaryMatch: boolean;
  relationshipMatch: boolean;
  innerWord: string | null;
  linkedShellCount: number;
  source: ShellWordExploreSourceName;
}

export interface ShellWordExploreBrowseInput {
  direction: ShellWordExploreDirection;
  word?: string;
  first?: string;
  last?: string;
}

export interface ShellWordExploreCheckInput {
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
