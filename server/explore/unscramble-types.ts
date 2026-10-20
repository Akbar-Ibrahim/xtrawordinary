export interface UnscrambleResults {
  input: string;
  items: string[];
  hasMore: boolean;
  nextCursor: string | null;
  source: "preview" | "database";
}

export interface UnscrambleExamples {
  items: string[];
  source: "preview" | "database";
}

export interface UnscrambleSource {
  getExamples(limit: number): Promise<UnscrambleExamples>;
  solve(letters: string, limit: number, cursor?: string): Promise<UnscrambleResults>;
}
