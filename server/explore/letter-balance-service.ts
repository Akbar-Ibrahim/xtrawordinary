import { isMySQLStorageEnabled } from "../storage-config";
import { letterBalanceMemorySource } from "./letter-balance-memory";
import type { LetterBalanceExploreSource } from "./letter-balance-types";

export async function withLetterBalanceExploreSource<T>(
  action: (source: LetterBalanceExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return action(letterBalanceMemorySource);
  const [{ db }, { createMySqlLetterBalanceExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-letter-balance"),
  ]);
  return action(createMySqlLetterBalanceExploreSource(db));
}
