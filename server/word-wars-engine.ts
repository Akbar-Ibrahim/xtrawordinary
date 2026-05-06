import { storage } from "./storage";
import { WORD_WARS_ELIGIBLE_SLUGS } from "@shared/schema";
import type { WordWarsRegistration, WordWarsTournament, WordWarsMatch, WordWarsMatchGame } from "@shared/schema";

/** In-process guard: prevents concurrent bracket draws for the same tournament. */
const drawsInProgress = new Set<number>();

/**
 * Per-tournament lock for round-advancement.  When two matches in the same
 * round finalize concurrently, the first resolver to acquire this lock does
 * the "is round done? → create next-round matches" check and creation; the
 * second resolver returns early and lets the first one handle advancement.
 * This is safe because updateWordWarsMatch (which marks the match completed)
 * is called *before* the lock is acquired, so the first resolver's snapshot
 * always reflects the most up-to-date match statuses.
 */
const roundAdvancementsInProgress = new Set<number>();

/**
 * Shared bracket-draw logic — called by both the admin REST endpoint and the
 * background scheduler so they can never get out of sync.
 *
 * Returns { matches } on success, { error } if the tournament cannot be drawn
 * (not found, wrong status, or not enough players).  When there are fewer than
 * 2 players the tournament is cancelled automatically.
 */
export async function executeBracketDraw(
  tournamentId: number,
): Promise<{ matches: WordWarsMatch[] } | { error: string }> {
  if (drawsInProgress.has(tournamentId)) {
    return { error: "Bracket draw already in progress for this tournament" };
  }
  drawsInProgress.add(tournamentId);
  try {
    return await _doDraw(tournamentId);
  } finally {
    drawsInProgress.delete(tournamentId);
  }
}

async function _doDraw(
  tournamentId: number,
): Promise<{ matches: WordWarsMatch[] } | { error: string }> {
  const tournament = await storage.getWordWarsTournament(tournamentId);
  if (!tournament) return { error: "Tournament not found" };
  if (tournament.status !== "registration") return { error: "Tournament is not in registration phase" };

  const registrations = await storage.getWordWarsRegistrationsForTournament(tournamentId);
  if (registrations.length < 2) {
    await storage.updateWordWarsTournament(tournamentId, { status: "cancelled" });
    return { error: "Not enough players — tournament cancelled" };
  }

  const matchData = await buildBracket(registrations, tournament);

  await storage.updateWordWarsTournament(tournamentId, { status: "active" });

  const createdMatches: WordWarsMatch[] = [];
  for (const match of matchData) {
    const created = await storage.createWordWarsMatch(match);
    createdMatches.push(created);

    await Promise.all([1, 2, 3].map((num) =>
      storage.createWordWarsMatchGame({
        matchId: created.id,
        gameNumber: num,
        gameSlug: num === 1 ? match.game1Slug : num === 2 ? match.game2Slug : match.game3Slug,
        roomCode: null,
        winnerId: null,
        status: match.status === "bye" ? "completed" : "pending",
      }),
    ));

    if (match.player1Id && match.player2Id && match.status !== "bye") {
      for (const playerId of [match.player1Id, match.player2Id]) {
        const opponentId = playerId === match.player1Id ? match.player2Id! : match.player1Id!;
        try {
          const [opponentUser, prefs] = await Promise.all([
            storage.getUserById(opponentId),
            storage.getNotificationPreferences(playerId),
          ]);
          if (prefs["word_war_matched"]) {
            await storage.createNotification({
              userId: playerId,
              type: "word_war_matched",
              title: "⚔️ Your opponent awaits!",
              body: `You've been drawn against ${opponentUser?.name ?? "your opponent"} in "${tournament.name}". The battle begins!`,
              linkUrl: `/word-wars/${tournamentId}`,
            });
          }
        } catch (e) {
          console.error("[word-wars-engine] notification error", e);
        }
      }
    }
  }

  return { matches: createdMatches };
}

async function buildBracket(
  registrations: WordWarsRegistration[],
  tournament: WordWarsTournament,
): Promise<Omit<WordWarsMatch, "id" | "createdAt">[]> {
  const userIds = registrations.map((r) => r.userId);
  const ratings = await Promise.all(userIds.map((uid) => storage.getDuelRating(uid)));

  const seeded = userIds
    .map((uid, i) => ({ userId: uid, elo: ratings[i]?.elo ?? 1200 }))
    .sort((a, b) => b.elo - a.elo);

  let size = 1;
  while (size < seeded.length) size *= 2;

  const slots: (number | null)[] = seeded.map((s) => s.userId);
  while (slots.length < size) slots.push(null);

  const deadline = tournament.roundDeadlineHours
    ? new Date(Date.now() + tournament.roundDeadlineHours * 60 * 60 * 1000).toISOString()
    : null;

  const matches: Omit<WordWarsMatch, "id" | "createdAt">[] = [];
  const half = size / 2;

  for (let i = 0; i < half; i++) {
    const p1 = slots[i];
    const p2 = slots[size - 1 - i];
    const [g1, g2, g3] = pickThreeGames();

    if (p1 !== null && p2 === null) {
      matches.push({
        tournamentId: tournament.id,
        round: 1,
        player1Id: p1,
        player2Id: null,
        winnerId: p1,
        status: "bye",
        deadline: null,
        game1Slug: g1,
        game2Slug: g2,
        game3Slug: g3,
      });
    } else {
      matches.push({
        tournamentId: tournament.id,
        round: 1,
        player1Id: p1,
        player2Id: p2,
        winnerId: null,
        status: "pending",
        deadline,
        game1Slug: g1,
        game2Slug: g2,
        game3Slug: g3,
      });
    }
  }

  return matches;
}

function pickThreeGames(): [string, string, string] {
  const pool = [...WORD_WARS_ELIGIBLE_SLUGS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [pool[0], pool[1], pool[2]];
}

// ==================== DUEL FINALIZE HOOK ====================

/**
 * Called by finalizeGame in duel-ws.ts after ELO + session are persisted.
 * Looks up whether this duel room belongs to a Word Wars match game, and if
 * so records the game winner, checks if the series (first to 2 wins) is over,
 * advances the bracket, and fires notifications.
 *
 * winnerId = -1 means draw (no win credited to either player for this game).
 */
export async function resolveWordWarsGame(
  roomCode: string,
  winnerId: number,
): Promise<void> {
  try {
    const matchGame = await storage.getMatchGameByRoomCode(roomCode);
    if (!matchGame) return; // not a Word Wars game

    if (matchGame.status === "completed") return; // already resolved (idempotent at game level)

    const match = await storage.getWordWarsMatch(matchGame.matchId);
    if (!match) return;
    if (!match.player1Id || !match.player2Id) return;

    // Record this individual game result (always, even if the series was already decided)
    const gameWinnerId = winnerId === -1 ? null : winnerId;
    await storage.updateWordWarsMatchGame(matchGame.id, {
      status: "completed",
      winnerId: gameWinnerId,
    });

    // IDEMPOTENCY: if the parent match is already decided, skip bracket advancement.
    // This handles the case where game 2 already decided the series and advanced the
    // bracket, but game 3 (which was already in progress) now also finalizes.
    if (match.status === "completed" || match.status === "bye") return;

    // Count wins for each player across all completed games in this match
    const allGames = await storage.getWordWarsMatchGames(match.id);
    // Treat the current game as completed with our recorded winner when counting
    const completedGames = allGames.map(g =>
      g.id === matchGame.id ? { ...g, status: "completed" as const, winnerId: gameWinnerId } : g
    ).filter(g => g.status === "completed");

    let p1Wins = 0;
    let p2Wins = 0;
    for (const g of completedGames) {
      if (g.winnerId === match.player1Id) p1Wins++;
      else if (g.winnerId === match.player2Id) p2Wins++;
    }

    const totalCompleted = completedGames.length;
    const seriesWinnerId = p1Wins >= 2 ? match.player1Id
      : p2Wins >= 2 ? match.player2Id
      : totalCompleted >= 3
        // All 3 done, no one has 2 — whoever has more wins advances; player1 wins ties
        ? (p1Wins >= p2Wins ? match.player1Id : match.player2Id)
        : null;

    if (seriesWinnerId === null) return; // Series not decided yet

    // Mark match completed — this write happens BEFORE the lock so that when
    // another concurrent resolver holds the lock and re-queries, it sees our
    // match as completed in storage.
    await storage.updateWordWarsMatch(match.id, {
      status: "completed",
      winnerId: seriesWinnerId,
    });

    // Acquire per-tournament advancement lock.  Only one resolver at a time
    // may run the "is-round-done → create-next-round" section.  If another
    // resolver already holds the lock for this tournament, we return early —
    // the lock-holder will re-query storage (which now includes our completed
    // match) and handle advancement if the round is fully done.
    if (roundAdvancementsInProgress.has(match.tournamentId)) return;
    roundAdvancementsInProgress.add(match.tournamentId);
    try {
      await _advanceBracket(match.tournamentId, match.round);
    } finally {
      roundAdvancementsInProgress.delete(match.tournamentId);
    }
  } catch (err) {
    console.error("[word-wars-engine] resolveWordWarsGame error", err);
  }
}

/**
 * Checks whether all matches in `round` are complete and, if so, either
 * crowns a champion (final round) or creates next-round matches.
 * Must always be called while holding `roundAdvancementsInProgress` for the
 * given tournamentId so only one execution path runs at a time.
 */
async function _advanceBracket(tournamentId: number, round: number): Promise<void> {
    const tournament = await storage.getWordWarsTournament(tournamentId);
    if (!tournament) return;

    // Re-fetch from storage inside the lock — reflects all writes that happened
    // before the lock was acquired (including the match we just completed).
    const allMatchesInTournament = await storage.listWordWarsMatchesForTournament(tournamentId);
    const currentRoundMatches = allMatchesInTournament.filter(m => m.round === round);
    const allCurrentRoundDone = currentRoundMatches.every(
      m => m.status === "completed" || m.status === "bye",
    );

    if (!allCurrentRoundDone) return;

    // Safety check: ensure next-round matches don't already exist (extra guard
    // against edge cases where the lock was bypassed or champion was already set)
    const nextRound = round + 1;
    const existingNextRoundMatches = allMatchesInTournament.filter(m => m.round === nextRound);
    if (existingNextRoundMatches.length > 0) return;

    // Collect winners from this round (byes and completed matches)
    const roundWinners = currentRoundMatches.map(m => m.winnerId)
      .filter((id): id is number => id !== null);

    if (roundWinners.length === 1) {
      // Final match decided — crown champion (only if not already completed)
      if (tournament.status === "completed") return;
      const championId = roundWinners[0];
      await storage.updateWordWarsTournament(tournamentId, { status: "completed" });
      await storage.createWordWarsChampion(tournamentId, championId);

      try {
        const prefs = await storage.getNotificationPreferences(championId);
        if (prefs["word_war_champion"]) {
          await storage.createNotification({
            userId: championId,
            type: "word_war_champion",
            title: "Champion",
            body: "You have conquered the Word Wars. Glory is yours.",
            linkUrl: `/word-wars/${tournamentId}`,
          });
        }
      } catch (e) {
        console.error("[word-wars-engine] champion notification error", e);
      }
      return;
    }

    // Pair up winners for next round

    const deadline = tournament.roundDeadlineHours
      ? new Date(Date.now() + tournament.roundDeadlineHours * 60 * 60 * 1000).toISOString()
      : null;

    const newMatches: WordWarsMatch[] = [];
    for (let i = 0; i < roundWinners.length; i += 2) {
      const p1 = roundWinners[i];
      const p2 = roundWinners[i + 1] ?? null;
      const [g1, g2, g3] = pickThreeGames();

      if (p2 === null) {
        // Bye
        const created = await storage.createWordWarsMatch({
          tournamentId,
          round: nextRound,
          player1Id: p1,
          player2Id: null,
          winnerId: p1,
          status: "bye",
          deadline: null,
          game1Slug: g1,
          game2Slug: g2,
          game3Slug: g3,
        });
        newMatches.push(created);
        for (const num of [1, 2, 3]) {
          await storage.createWordWarsMatchGame({
            matchId: created.id,
            gameNumber: num,
            gameSlug: num === 1 ? g1 : num === 2 ? g2 : g3,
            roomCode: null,
            winnerId: null,
            status: "completed",
          });
        }
      } else {
        const created = await storage.createWordWarsMatch({
          tournamentId,
          round: nextRound,
          player1Id: p1,
          player2Id: p2,
          winnerId: null,
          status: "pending",
          deadline,
          game1Slug: g1,
          game2Slug: g2,
          game3Slug: g3,
        });
        newMatches.push(created);
        for (const num of [1, 2, 3]) {
          await storage.createWordWarsMatchGame({
            matchId: created.id,
            gameNumber: num,
            gameSlug: num === 1 ? g1 : num === 2 ? g2 : g3,
            roomCode: null,
            winnerId: null,
            status: "pending",
          });
        }

        // Notify both players of their new match
        for (const [playerId, opponentId] of [[p1, p2], [p2, p1]] as [number, number][]) {
          try {
            const [opponent, prefs] = await Promise.all([
              storage.getUserById(opponentId),
              storage.getNotificationPreferences(playerId),
            ]);
            if (prefs["word_war_matched"]) {
              await storage.createNotification({
                userId: playerId,
                type: "word_war_matched",
                title: "Your opponent awaits",
                body: `${opponent?.name ?? "Your opponent"} stands between you and glory. The war continues.`,
                linkUrl: `/word-wars/${tournamentId}`,
              });
            }
            if (prefs["word_war_round_start"]) {
              await storage.createNotification({
                userId: playerId,
                type: "word_war_round_start",
                title: `Round ${nextRound} begins`,
                body: "Your next battle has been assigned.",
                linkUrl: `/word-wars/${tournamentId}`,
              });
            }
          } catch (e) {
            console.error("[word-wars-engine] round notification error", e);
          }
        }
      }
    }
}
