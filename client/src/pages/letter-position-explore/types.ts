export interface LetterPositionWord {
  word: string;
  playableInGame: boolean;
  gameplayExclusion: string | null;
}

export interface LetterPositionSearchResponse {
  items: LetterPositionWord[];
  page: { limit: number; hasMore: boolean; nextCursor: string | null };
  source: "preview" | "database";
}

export interface LetterPositionCheckResponse {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  playableInGame: boolean;
  gameplayExclusion: string | null;
  source: "preview" | "database";
}
