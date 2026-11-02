export class ExploreRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function readExploreJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ExploreRequestError(detail?.message || `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}
