import { isMySQLStorageEnabled } from "../storage-config";
import type { LetterPositionExploreSource } from "./letter-constraint-types";
import { letterPositionMemorySource } from "./letter-position-memory";

export async function withLetterPositionExploreSource<T>(
  action: (source: LetterPositionExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return action(letterPositionMemorySource);
  const [{ db }, { createMySqlLetterPositionExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-letter-position"),
  ]);
  return action(createMySqlLetterPositionExploreSource(db));
}
