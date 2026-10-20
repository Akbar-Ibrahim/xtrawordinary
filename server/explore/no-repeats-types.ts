export type NoRepeatsExploreFilters = {
  length?: number;
  requiredLetters: string;
};

export type NoRepeatsExploreWord = {
  word: string;
};

export type NoRepeatsSearchResult = {
  items: NoRepeatsExploreWord[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: "preview" | "database";
};

export type NoRepeatsCheckResult = {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  source: "preview" | "database";
};

export interface NoRepeatsExploreSource {
  search(
    filters: NoRepeatsExploreFilters,
    limit: number,
    cursor?: string,
  ): Promise<NoRepeatsSearchResult>;
  check(word: string, filters: NoRepeatsExploreFilters): Promise<NoRepeatsCheckResult>;
}
