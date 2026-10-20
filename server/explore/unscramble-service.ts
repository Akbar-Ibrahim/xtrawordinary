import { isMySQLStorageEnabled } from "../storage-config";
import { unscrambleMemorySource } from "./unscramble-memory";
import type { UnscrambleSource } from "./unscramble-types";

export async function withUnscrambleSource<T>(
  callback: (source: UnscrambleSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) return callback(unscrambleMemorySource);

  const [{ db }, { createMySqlUnscrambleSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-unscramble"),
  ]);
  return callback(createMySqlUnscrambleSource(db));
}
