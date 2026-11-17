import { isMySQLStorageEnabled } from "../storage-config";
import type { WordSplitExploreSource } from "./word-split-types";
import { wordSplitMemorySource } from "./word-split-memory";

export async function withWordSplitExploreSource<T>(
  callback: (source: WordSplitExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return callback(wordSplitMemorySource);

  const [{ db }, { createMySqlWordSplitExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-word-split"),
  ]);
  return callback(createMySqlWordSplitExploreSource(db));
}
