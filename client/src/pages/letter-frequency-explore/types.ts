export type LetterFrequencyConstraint = {
  letter: string;
  count: number;
};

export type LetterFrequencyMatch = "exact" | "minimum";

export type LetterFrequencyExploreWord = {
  word: string;
};

export type LetterFrequencySearchResponse = {
  items: LetterFrequencyExploreWord[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: "preview" | "database";
};

export type LetterFrequencyCheckResponse = {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  source: "preview" | "database";
};

export type FrequencyExploreMode = "single" | "multi";
