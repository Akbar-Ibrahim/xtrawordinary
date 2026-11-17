import type {
  LetterSequenceExplorePage,
  LetterSequenceType,
} from "@shared/letter-sequence-explore";

export class LetterSequenceExploreRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "LetterSequenceExploreRequestError";
  }
}

export async function fetchLetterSequenceExplorePage(
  type: LetterSequenceType,
  sequence: string,
  cursor?: string,
  length?: number | null,
): Promise<LetterSequenceExplorePage> {
  const params = new URLSearchParams({ sequence, limit: "50" });
  if (cursor) params.set("cursor", cursor);
  if (length !== undefined && length !== null) params.set("length", String(length));

  const response = await fetch(`/api/explore/letter-sequences/${type}?${params.toString()}`, {
    credentials: "include",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LetterSequenceExploreRequestError(
      typeof body.message === "string" ? body.message : "Could not load matching words.",
      response.status,
    );
  }
  return body as LetterSequenceExplorePage;
}
