import { isMySQLStorageEnabled } from "../storage-config";
import type { LetterHuntExploreSource } from "./letter-constraint-types";
import { letterHuntMemorySource } from "./letter-hunt-memory";

export async function withLetterHuntExploreSource<T>(
  action: (source: LetterHuntExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return action(letterHuntMemorySource);
  const [{ db }, { createMySqlLetterHuntExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-letter-hunt"),
  ]);
  return action(createMySqlLetterHuntExploreSource(db));
}
