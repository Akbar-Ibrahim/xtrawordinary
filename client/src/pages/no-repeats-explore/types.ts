export type NoRepeatsExploreFilters = {
  length?: number;
  requiredLetters: string;
};

export type NoRepeatsExploreWord = {
  word: string;
};

export type NoRepeatsSearchResponse = {
  items: NoRepeatsExploreWord[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: "preview" | "database";
};

export type NoRepeatsCheckResponse = {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  source: "preview" | "database";
};
