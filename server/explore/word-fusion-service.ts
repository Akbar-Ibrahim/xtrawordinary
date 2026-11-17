import { isMySQLStorageEnabled } from "../storage-config";
import type { WordFusionExploreSource } from "./word-fusion-types";
import { wordFusionMemorySource } from "./word-fusion-memory";

export async function withWordFusionExploreSource<T>(
  callback: (source: WordFusionExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return callback(wordFusionMemorySource);

  const [{ db }, { createMySqlWordFusionExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-word-fusion"),
  ]);
  return callback(createMySqlWordFusionExploreSource(db));
}
