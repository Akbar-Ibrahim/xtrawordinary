import { InvalidExploreCursorError, type ExplorePage, type ExploreDataSource } from "./shared-types";

interface CursorPayload {
  scope: string;
  context: string;
  after: string;
}

export function encodeExploreCursor(scope: string, context: string, after: string): string {
  const payload: CursorPayload = { scope, context, after };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeExploreCursor(
  cursor: string | undefined,
  scope: string,
  context: string,
): string | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<CursorPayload>;
    if (
      parsed.scope !== scope ||
      parsed.context !== context ||
      typeof parsed.after !== "string" ||
      !parsed.after
    ) {
      throw new InvalidExploreCursorError();
    }
    return parsed.after;
  } catch (error) {
    if (error instanceof InvalidExploreCursorError) throw error;
    throw new InvalidExploreCursorError();
  }
}

export function paginateSortedArray<T>(
  items: T[],
  limit: number,
  cursor: string | undefined,
  scope: string,
  context: string,
  getKey: (item: T) => string,
  source: ExploreDataSource,
): ExplorePage<T> {
  const after = decodeExploreCursor(cursor, scope, context);
  const remaining = after ? items.filter((item) => getKey(item) > after) : items;
  const pageItems = remaining.slice(0, limit + 1);
  const hasMore = pageItems.length > limit;
  const resultItems = hasMore ? pageItems.slice(0, limit) : pageItems;
  const last = resultItems[resultItems.length - 1];

  return {
    items: resultItems,
    page: {
      limit,
      hasMore,
      nextCursor: hasMore && last ? encodeExploreCursor(scope, context, getKey(last)) : null,
    },
    source,
  };
}
