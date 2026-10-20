import { isMySQLStorageEnabled } from "../storage-config";
import { anagramMemorySource } from "./anagram-memory";
import type { AnagramExploreSource } from "./anagram-types";

export async function withAnagramExploreSource<T>(
  callback: (source: AnagramExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return callback(anagramMemorySource);

  const [{ db }, { createMySqlAnagramExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-anagrams"),
  ]);
  return callback(createMySqlAnagramExploreSource(db));
}
