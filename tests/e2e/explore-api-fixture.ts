import type { Route } from "@playwright/test";

// Explore tests isolate unrelated APIs, but game-detail comments still need
// the paginated response contract rather than the old bare array.
export function fulfillExploreFallback(route: Route) {
  const path = new URL(route.request().url()).pathname;
  return route.fulfill({
    json: path === "/api/comments"
      ? { comments: [], totalCount: 0, hasMore: false, page: 1, pageSize: 20, pinnedComment: null, canManagePins: false }
      : [],
  });
}
