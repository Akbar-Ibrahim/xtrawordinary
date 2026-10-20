import type {
  LetterBalanceExploreCheck,
  LetterBalanceExploreFilters,
  LetterBalanceExplorePage,
} from "./types";

function buildParams(filters: LetterBalanceExploreFilters): URLSearchParams {
  const params = new URLSearchParams({ category: filters.category });
  if (filters.count !== undefined) params.set("count", String(filters.count));
  if (filters.length !== undefined) params.set("length", String(filters.length));
  if (filters.consonantCount !== undefined) {
    params.set("consonantCount", String(filters.consonantCount));
  }
  return params;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string };
    return body.message ?? "The Vowel & Consonant Explore request failed.";
  } catch {
    return "The Vowel & Consonant Explore response could not be read.";
  }
}

export async function searchLetterBalanceWords(
  filters: LetterBalanceExploreFilters,
  cursor?: string,
): Promise<LetterBalanceExplorePage> {
  const params = buildParams(filters);
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/explore/letter-balance/words?${params}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<LetterBalanceExplorePage>;
}

export async function checkLetterBalanceWord(
  word: string,
  filters: LetterBalanceExploreFilters,
): Promise<LetterBalanceExploreCheck> {
  const response = await fetch("/api/explore/letter-balance/check", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, ...filters }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<LetterBalanceExploreCheck>;
}
