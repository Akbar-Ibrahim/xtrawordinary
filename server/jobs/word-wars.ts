import { getStorage } from "../storage";
import { log } from "../logger";

async function runWordWarsJobs() {
  try {
    const st = getStorage();
    const { executeBracketDraw } = await import("../word-wars-engine");
    const tournaments = await st.listWordWarsTournaments();
    const now = new Date();

    for (const t of tournaments) {
      if (t.status === "registration" && new Date(t.registrationDeadline) <= now) {
        log(`Tournament ${t.id} registration closed — auto-drawing bracket`, "word-wars");
        const result = await executeBracketDraw(t.id);
        if ("error" in result) {
          log(`Tournament ${t.id} auto-draw failed: ${result.error}`, "word-wars", "warn");
        } else {
          log(`Tournament ${t.id} bracket drawn (${result.matches.length} matches)`, "word-wars");
        }
        continue;
      }

      if (t.status === "active") {
        const matches = await st.listWordWarsMatchesForTournament(t.id);
        for (const m of matches) {
          if (m.status === "active" && m.deadline && new Date(m.deadline) <= now) {
            const games = await st.getWordWarsMatchGames(m.id);
            const p1Wins = games.filter(g => g.winnerId === m.player1Id).length;
            const p2Wins = games.filter(g => g.winnerId === m.player2Id).length;
            let forfeitWinner: number | null = null;
            if (p1Wins > p2Wins) forfeitWinner = m.player1Id;
            else if (p2Wins > p1Wins) forfeitWinner = m.player2Id;
            else forfeitWinner = Math.random() < 0.5 ? m.player1Id : m.player2Id;
            await st.updateWordWarsMatch(m.id, { status: "forfeited", winnerId: forfeitWinner });
            log(`Match ${m.id} timed out — winner: ${forfeitWinner}`, "word-wars", "warn");
          }
        }

        const unresolvedMatches = matches.filter(
          m => m.status !== "completed" && m.status !== "forfeited" && m.status !== "bye",
        );
        if (unresolvedMatches.length === 0 && matches.length > 0) {
          await st.updateWordWarsTournament(t.id, { status: "completed" });
          log(`Tournament ${t.id} completed`, "word-wars");
        }
      }
    }
  } catch (err) {
    log(`Scheduler error: ${err}`, "word-wars", "error");
  }
}

export function scheduleWordWarsJobs() {
  runWordWarsJobs();
  setInterval(runWordWarsJobs, 60_000);
}
