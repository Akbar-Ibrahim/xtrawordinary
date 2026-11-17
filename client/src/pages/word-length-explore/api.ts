import type { WordLengthExploreCheck, WordLengthExplorePage, WordLengthExplorePattern } from "./types";

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Explore request failed");
  }
  return response.json() as Promise<T>;
}

function patternParams(pattern: WordLengthExplorePattern): URLSearchParams {
  const params = new URLSearchParams({
    variation: String(pattern.variation),
    length: String(pattern.length),
  });
  if (pattern.startsWith) params.set("startsWith", pattern.startsWith);
  if (pattern.endsWith) params.set("endsWith", pattern.endsWith);
  if (pattern.contains) params.set("contains", pattern.contains);
  return params;
}

export function searchWordLengthWords(pattern: WordLengthExplorePattern, cursor?: string) {
  const params = patternParams(pattern);
  if (cursor) params.set("cursor", cursor);
  return readJson<WordLengthExplorePage>(`/api/explore/word-length/words?${params}`);
}

export function checkWordLengthWord(input: { word: string; pattern: WordLengthExplorePattern }) {
  return readJson<WordLengthExploreCheck>("/api/explore/word-length/check", {
    method: "POST",
    body: JSON.stringify({ word: input.word, ...input.pattern }),
  });
}
