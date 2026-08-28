import { runPruneJob, PRUNE_INTERVAL_MS } from "./prune-notifications";
import { scheduleWordWarsJobs } from "./word-wars";
import { scheduleGuildWarsJobs } from "./guild-wars";
import { runDailyJobs } from "./daily";
import { runFriendChallengeExpiry } from "./friend-challenge-expiry";
import { ANALYTICS_CLEANUP_INTERVAL_MS, runAnalyticsCleanup } from "./analytics-cleanup";

export function scheduleAllJobs() {
  runPruneJob();
  setInterval(runPruneJob, PRUNE_INTERVAL_MS);

  scheduleWordWarsJobs();
  scheduleGuildWarsJobs();

  runDailyJobs();
  setInterval(runDailyJobs, 60 * 60 * 1000);

  runFriendChallengeExpiry();
  setInterval(runFriendChallengeExpiry, 30 * 60 * 1000);

  void runAnalyticsCleanup();
  setInterval(() => void runAnalyticsCleanup(), ANALYTICS_CLEANUP_INTERVAL_MS);
}
