export interface UnscrambleExamplesResponse {
  items: string[];
  source: "preview" | "database";
}

export interface UnscrambleResultsResponse {
  input: string;
  items: string[];
  hasMore: boolean;
  nextCursor: string | null;
  source: "preview" | "database";
}
