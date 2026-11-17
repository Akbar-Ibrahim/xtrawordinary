import type { WordFusionExplorePage } from "@shared/word-fusion-explore";

export type { WordFusionExplorePage } from "@shared/word-fusion-explore";

export class WordFusionExploreRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "WordFusionExploreRequestError";
  }
}

export async function fetchWordFusionExplorePage(
  components: string[],
  cursor?: string,
): Promise<WordFusionExplorePage> {
  const params = new URLSearchParams();
  for (const component of components) params.append("component", component);
  params.set("limit", "50");
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/explore/word-fusion/matches?${params.toString()}`, {
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new WordFusionExploreRequestError(
      typeof body.message === "string" ? body.message : "Could not load Word Fusion results.",
      response.status,
    );
  }
  return body as WordFusionExplorePage;
}
