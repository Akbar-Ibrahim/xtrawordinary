import { isMySQLStorageEnabled } from "../storage-config";
import type { LetterSequenceExploreSource } from "./letter-sequence-types";
import { letterSequenceMemorySource } from "./letter-sequence-memory";

export async function withLetterSequenceExploreSource<T>(
  callback: (source: LetterSequenceExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return callback(letterSequenceMemorySource);

  const [{ db }, { createMySqlLetterSequenceExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-letter-sequences"),
  ]);
  return callback(createMySqlLetterSequenceExploreSource(db));
}
