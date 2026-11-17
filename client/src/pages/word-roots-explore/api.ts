import type { WordRootsExplorePage } from "@shared/word-roots-explore";

export type { WordRootsExplorePage } from "@shared/word-roots-explore";

export class WordRootsExploreRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "WordRootsExploreRequestError";
  }
}

export async function fetchWordRootsExplorePage(
  words: string[],
  length: number | null,
  cursor?: string,
): Promise<WordRootsExplorePage> {
  const params = new URLSearchParams();
  for (const word of words) params.append("word", word);
  params.set("limit", "50");
  if (length !== null) params.set("length", String(length));
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/explore/word-roots/base-words?${params.toString()}`, {
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new WordRootsExploreRequestError(
      typeof body.message === "string" ? body.message : "Could not load Word Roots matches.",
      response.status,
    );
  }
  return body as WordRootsExplorePage;
}
