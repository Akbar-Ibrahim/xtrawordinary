import { isMySQLStorageEnabled } from "../storage-config";
import type { WordMakerExploreSource } from "./word-maker-types";
import { wordMakerMemorySource } from "./word-maker-memory";

export async function withWordMakerExploreSource<T>(
  callback: (source: WordMakerExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) {
    return callback(wordMakerMemorySource);
  }

  const [{ db }, { createMySqlWordMakerExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-word-maker"),
  ]);
  return callback(createMySqlWordMakerExploreSource(db));
}
