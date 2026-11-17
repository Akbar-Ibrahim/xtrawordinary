import { isMySQLStorageEnabled } from "../storage-config";
import type { WordLengthExploreSource } from "./word-length-types";
import { wordLengthMemorySource } from "./word-length-memory";

export async function withWordLengthExploreSource<T>(
  action: (source: WordLengthExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return action(wordLengthMemorySource);

  const [{ db }, { createMySqlWordLengthExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-word-length"),
  ]);
  return action(createMySqlWordLengthExploreSource(db));
}
