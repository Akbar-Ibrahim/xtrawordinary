import type {
  LetterFrequencyCheckResponse,
  LetterFrequencyConstraint,
  LetterFrequencyMatch,
  LetterFrequencySearchResponse,
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

export function searchLetterFrequency(
  constraints: LetterFrequencyConstraint[],
  match: LetterFrequencyMatch,
  cursor?: string,
): Promise<LetterFrequencySearchResponse> {
  const params = new URLSearchParams({
    constraints: JSON.stringify(constraints),
    match,
    limit: "100",
  });
  if (cursor) params.set("cursor", cursor);
  return requestJson(`/api/explore/letter-frequency/words?${params}`);
}

export function checkLetterFrequencyAnswer(
  word: string,
  constraints: LetterFrequencyConstraint[],
  match: LetterFrequencyMatch,
): Promise<LetterFrequencyCheckResponse> {
  return requestJson("/api/explore/letter-frequency/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, constraints, match }),
  });
}
