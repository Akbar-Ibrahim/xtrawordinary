import { getStorage } from "../storage";
import { log } from "../logger";

export const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function runPruneJob() {
  try {
    const count = await getStorage().pruneNotifications();
    if (count > 0) {
      log(`Deleted ${count} old notification(s)`, "prune");
    }
  } catch (err) {
    log(`Error pruning notifications: ${err}`, "prune", "error");
  }
}
