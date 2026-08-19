import { getStorage } from "../storage";
import { log } from "../logger";

async function runGuildWarsJobs() {
  try {
    const st = getStorage();
    const { executeGuildBracketDraw, checkAndForfeitExpiredGuildMatches } = await import("../guild-wars-engine");
    const tournaments = await st.listGuildWarsTournaments();
    const now = new Date();

    for (const t of tournaments) {
      if (t.status === "registration" && new Date(t.registrationDeadline) <= now) {
        log(`Tournament ${t.id} registration closed — auto-drawing bracket`, "guild-wars");
        const result = await executeGuildBracketDraw(t.id);
        if ("error" in result) {
          log(`Tournament ${t.id} auto-draw failed: ${result.error}`, "guild-wars", "warn");
        } else {
          log(`Tournament ${t.id} bracket drawn (${result.matches.length} matches)`, "guild-wars");
        }
        continue;
      }

      if (t.status === "active") {
        await checkAndForfeitExpiredGuildMatches(t);
      }
    }
  } catch (err) {
    log(`Scheduler error: ${err}`, "guild-wars", "error");
  }
}

export function scheduleGuildWarsJobs() {
  runGuildWarsJobs();
  setInterval(runGuildWarsJobs, 60_000);
}
