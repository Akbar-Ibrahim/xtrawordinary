import { isMySQLStorageEnabled } from "../storage-config";
import type { NoRepeatsExploreSource } from "./no-repeats-types";
import { noRepeatsMemorySource } from "./no-repeats-memory";

export async function withNoRepeatsExploreSource<T>(
  action: (source: NoRepeatsExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return action(noRepeatsMemorySource);
  const [{ db }, { createMySqlNoRepeatsExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-no-repeats"),
  ]);
  return action(createMySqlNoRepeatsExploreSource(db));
}
