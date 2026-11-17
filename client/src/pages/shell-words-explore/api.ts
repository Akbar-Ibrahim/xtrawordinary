import type { ExploreBrowseInput, ExploreDirection, ShellWordExploreCheck, ShellWordExplorePage } from "./types";

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

function browse(path: string, input: ExploreBrowseInput): Promise<ShellWordExplorePage> {
  const params = new URLSearchParams({ direction: input.direction });
  if (input.word) params.set("word", input.word);
  if (input.first) params.set("first", input.first);
  if (input.last) params.set("last", input.last);
  if (input.cursor) params.set("cursor", input.cursor);
  return readJson(`${path}/words?${params}`);
}

function check(path: string, input: { direction: ExploreDirection; word: string }) {
  return readJson<ShellWordExploreCheck>(`${path}/check`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function browseShellWordExplore(input: ExploreBrowseInput) {
  return browse("/api/explore/shell-words", input);
}

export function checkShellWordExplore(input: { direction: ExploreDirection; word: string }) {
  return check("/api/explore/shell-words", input);
}

export function browseDeepShellWordExplore(input: ExploreBrowseInput) {
  return browse("/api/explore/deep-shell-words", input);
}

export function checkDeepShellWordExplore(input: { direction: ExploreDirection; word: string }) {
  return check("/api/explore/deep-shell-words", input);
}
