import { isLetterDodgeSearchResponse, type LetterDodgeCheckResponse, type LetterDodgeSearchResponse } from "./types";

const INVALID_CHECK_RESPONSE_MESSAGE =
  "The checker returned an incomplete or invalid response. No ruling was shown. Please try again.";
const INVALID_SEARCH_RESPONSE_MESSAGE =
  "The search returned an incomplete or invalid response. No results were shown. Please try again.";
const INVALID_NEXT_PAGE_RESPONSE_MESSAGE =
  "The next search page returned an incomplete or invalid response. Your existing results are still available. Retry loading more.";
const SEARCH_NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. This search wasn't completed. Reconnect and try again.";

async function readJson<T>(url: string, init?: RequestInit, networkErrorMessage?: string): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message ?? "Explore request failed");
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (networkErrorMessage && error instanceof TypeError) {
      throw new Error(networkErrorMessage);
    }
    throw error;
  }
}

export function searchLetterDodge(forbidden: string, cursor?: string) {
  const params = new URLSearchParams({ forbidden });
  if (cursor) params.set("cursor", cursor);
  return readJson<unknown>(
    `/api/explore/letter-dodge/words?${params}`,
    undefined,
    SEARCH_NETWORK_ERROR_MESSAGE,
  )
    .catch((error: unknown) => {
      if (error instanceof SyntaxError) {
        throw new Error(cursor ? INVALID_NEXT_PAGE_RESPONSE_MESSAGE : INVALID_SEARCH_RESPONSE_MESSAGE);
      }
      throw error;
    })
    .then((result) => {
      if (!isLetterDodgeSearchResponse(result)) {
        throw new Error(cursor ? INVALID_NEXT_PAGE_RESPONSE_MESSAGE : INVALID_SEARCH_RESPONSE_MESSAGE);
      }
      return result;
    });
}

export function checkLetterDodgeAnswer(input: { word: string; forbidden: string }) {
  return readJson<unknown>("/api/explore/letter-dodge/check", {
    method: "POST",
    body: JSON.stringify(input),
  }, "We couldn't reach the server. This check wasn't completed. Reconnect and try again.")
    .catch((error: unknown) => {
      if (error instanceof SyntaxError) {
        throw new Error(INVALID_CHECK_RESPONSE_MESSAGE);
      }
      throw error;
    })
    .then((result) => {
      if (
        typeof result !== "object" ||
        result === null ||
        Array.isArray(result) ||
        !("word" in result) ||
        result.word !== input.word ||
        !("dictionaryMatch" in result) ||
        typeof result.dictionaryMatch !== "boolean" ||
        !("constraintMatch" in result) ||
        typeof result.constraintMatch !== "boolean" ||
        !("playableInGame" in result) ||
        typeof result.playableInGame !== "boolean" ||
        !("gameplayExclusion" in result) ||
        !(typeof result.gameplayExclusion === "string" || result.gameplayExclusion === null) ||
        !("source" in result) ||
        !(result.source === "preview" || result.source === "database")
      ) {
        throw new Error(INVALID_CHECK_RESPONSE_MESSAGE);
      }

      return result as LetterDodgeCheckResponse;
    });
}
