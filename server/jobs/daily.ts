import { getStorage } from "../storage";
import { log } from "../logger";

let lastStreakAtRiskDate: string | null = null;

export async function runDailyJobs() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastStreakAtRiskDate === today) return;
  lastStreakAtRiskDate = today;
  try {
    const st = getStorage();
    const usersAtRisk = await st.getUsersWithStreakAtRisk();
    for (const { userId, currentStreak } of usersAtRisk) {
      const prefs = await st.getNotificationPreferences(userId);
      if (prefs["streak_at_risk"] === false) continue;
      await st.createNotification({
        userId,
        type: "streak_at_risk",
        title: "Your streak is at risk!",
        body: `Play a game today to keep your ${currentStreak}-day streak alive.`,
        linkUrl: "/",
      });
    }
  } catch (err) {
    log(`Job error: ${err}`, "daily", "error");
  }
}
