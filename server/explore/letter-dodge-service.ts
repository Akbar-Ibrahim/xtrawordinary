import { isMySQLStorageEnabled } from "../storage-config";
import type { LetterDodgeExploreSource } from "./letter-constraint-types";
import { letterDodgeMemorySource } from "./letter-dodge-memory";

export async function withLetterDodgeExploreSource<T>(
  action: (source: LetterDodgeExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return action(letterDodgeMemorySource);
  const [{ db }, { createMySqlLetterDodgeExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-letter-dodge"),
  ]);
  return action(createMySqlLetterDodgeExploreSource(db));
}
