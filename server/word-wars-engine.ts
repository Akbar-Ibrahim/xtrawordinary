import { storage } from "./storage";
import { WORD_WARS_ELIGIBLE_SLUGS } from "@shared/schema";
import type { WordWarsRegistration, WordWarsTournament, WordWarsMatch } from "@shared/schema";

/** In-process guard: prevents concurrent bracket draws for the same tournament. */
const drawsInProgress = new Set<number>();

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
