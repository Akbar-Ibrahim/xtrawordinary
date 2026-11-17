import { isMySQLStorageEnabled } from "../storage-config";
import type { WordRootsExploreSource } from "./word-roots-types";
import { wordRootsMemorySource } from "./word-roots-memory";

export async function withWordRootsExploreSource<T>(
  callback: (source: WordRootsExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return callback(wordRootsMemorySource);

  const [{ db }, { createMySqlWordRootsExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-word-roots"),
  ]);
  return callback(createMySqlWordRootsExploreSource(db));
}
