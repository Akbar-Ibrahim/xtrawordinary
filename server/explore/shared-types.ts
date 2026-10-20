export type ExploreDataSource = "preview" | "database";

export interface ExplorePageInfo {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ExplorePage<T> {
  items: T[];
  page: ExplorePageInfo;
  source: ExploreDataSource;
}

export class InvalidExploreCursorError extends Error {
  constructor() {
    super("Invalid or expired Explore cursor");
    this.name = "InvalidExploreCursorError";
  }
}
