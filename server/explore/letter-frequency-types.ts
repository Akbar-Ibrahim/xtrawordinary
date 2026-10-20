export type LetterFrequencyConstraint = {
  letter: string;
  count: number;
};

export type LetterFrequencyMatch = "exact" | "minimum";

export type LetterFrequencyExploreWord = {
  word: string;
};

export type LetterFrequencySearchResult = {
  items: LetterFrequencyExploreWord[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: "preview" | "database";
};

export type LetterFrequencyCheckResult = {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  source: "preview" | "database";
};

export interface LetterFrequencyExploreSource {
  search(
    constraints: LetterFrequencyConstraint[],
    match: LetterFrequencyMatch,
    limit: number,
    cursor?: string,
  ): Promise<LetterFrequencySearchResult>;
  check(
    word: string,
    constraints: LetterFrequencyConstraint[],
    match: LetterFrequencyMatch,
  ): Promise<LetterFrequencyCheckResult>;
}
