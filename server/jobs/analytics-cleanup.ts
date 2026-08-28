import { getStorage } from "../storage";
import { log } from "../logger";
import { analyticsRetentionDays } from "../analytics";

export const ANALYTICS_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function runAnalyticsCleanup(): Promise<void> {
  try {
    const removed = await getStorage().cleanupAnalyticsEvents();
    if (removed > 0) {
      log(`Removed ${removed} analytics event(s) older than ${analyticsRetentionDays()} days`, "analytics");
    }
  } catch (error) {
    log(`Analytics cleanup failed (non-fatal): ${error}`, "analytics", "error");
  }
}