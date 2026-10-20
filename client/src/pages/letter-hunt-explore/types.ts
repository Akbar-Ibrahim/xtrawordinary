export interface LetterHuntWord {
  word: string;
  playableInGame: boolean;
  gameplayExclusion: string | null;
}

export interface LetterHuntSearchResponse {
  items: LetterHuntWord[];
  page: { limit: number; hasMore: boolean; nextCursor: string | null };
  source: "preview" | "database";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLetterHuntWord(value: unknown): value is LetterHuntWord {
  return isRecord(value) &&
    typeof value.word === "string" &&
    typeof value.playableInGame === "boolean" &&
    (typeof value.gameplayExclusion === "string" || value.gameplayExclusion === null);
}

export function isLetterHuntSearchResponse(value: unknown): value is LetterHuntSearchResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(isLetterHuntWord) ||
    !isRecord(value.page) ||
    typeof value.page.limit !== "number" ||
    !Number.isInteger(value.page.limit) ||
    value.page.limit < 1 ||
    typeof value.page.hasMore !== "boolean" ||
    !(typeof value.page.nextCursor === "string" || value.page.nextCursor === null) ||
    (value.page.hasMore
      ? typeof value.page.nextCursor !== "string" || value.page.nextCursor.length === 0
      : value.page.nextCursor !== null) ||
    !(value.source === "preview" || value.source === "database")
  ) {
    return false;
  }
  return true;
}

export interface LetterHuntCheckResponse {
  word: string;
  dictionaryMatch: boolean;
  constraintMatch: boolean;
  playableInGame: boolean;
  gameplayExclusion: string | null;
  source: "preview" | "database";
}
