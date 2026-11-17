import type { ShellWordExploreDepth } from "@shared/shell-word-explore";
import type { ShellWordExploreSource } from "./shell-word-explore-types";
import { isMySQLStorageEnabled } from "../storage-config";
import { createShellWordMemorySource } from "./shell-word-explore-memory";

export async function withShellWordExploreSource<T>(
  depth: ShellWordExploreDepth,
  action: (source: ShellWordExploreSource) => Promise<T>,
): Promise<T> {
  if (!isMySQLStorageEnabled()) {
    return action(createShellWordMemorySource(depth));
  }

  const [{ db }, { createMySqlShellWordExploreSource }] = await Promise.all([
    import("../db"),
    import("../mysql/explore-shell-words"),
  ]);
  return action(createMySqlShellWordExploreSource(db, depth));
}
