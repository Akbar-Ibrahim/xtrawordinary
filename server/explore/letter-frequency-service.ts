import { isMySQLStorageEnabled } from "../storage-config";
import type { LetterFrequencyExploreSource } from "./letter-frequency-types";
import { letterFrequencyMemorySource } from "./letter-frequency-memory";

export async function withLetterFrequencyExploreSource<T>(
  action: (source: LetterFrequencyExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return action(letterFrequencyMemorySource);
  const [{ db }, { createMySqlLetterFrequencyExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-letter-frequency"),
  ]);
  return action(createMySqlLetterFrequencyExploreSource(db));
}
