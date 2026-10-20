import type { LetterPositionCheckResponse, LetterPositionSearchResponse } from "./types";

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

export function searchLetterPosition(letter: string, position: number, cursor?: string) {
  const params = new URLSearchParams({ letter, position: String(position) });
  if (cursor) params.set("cursor", cursor);
  return readJson<LetterPositionSearchResponse>(`/api/explore/letter-position/words?${params}`);
}

export function checkLetterPositionAnswer(input: { word: string; letter: string; position: number }) {
  return readJson<LetterPositionCheckResponse>("/api/explore/letter-position/check", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
