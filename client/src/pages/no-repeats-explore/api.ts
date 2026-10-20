import type {
  NoRepeatsCheckResponse,
  NoRepeatsExploreFilters,
  NoRepeatsSearchResponse,
} from "./types";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }
  if (!response.ok) {
    const message =
      result && typeof result === "object" && "message" in result && typeof result.message === "string"
        ? result.message
        : "The request could not be completed.";
    throw new Error(message);
  }
  return result as T;
}

export function searchNoRepeatsWords(
  filters: NoRepeatsExploreFilters,
  cursor?: string,
): Promise<NoRepeatsSearchResponse> {
  const params = new URLSearchParams({
    requiredLetters: filters.requiredLetters,
    limit: "100",
  });
  if (filters.length !== undefined) params.set("length", String(filters.length));
  if (cursor) params.set("cursor", cursor);
  return requestJson(`/api/explore/no-repeats/words?${params}`);
}

export function checkNoRepeatsAnswer(
  word: string,
  filters: NoRepeatsExploreFilters,
): Promise<NoRepeatsCheckResponse> {
  return requestJson("/api/explore/no-repeats/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, ...filters }),
  });
}
