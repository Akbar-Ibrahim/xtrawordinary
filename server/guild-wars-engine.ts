import { storage } from "./storage";
import { WORD_WARS_ELIGIBLE_SLUGS } from "@shared/schema";
import type { GuildWarsRegistration, GuildWarsTournament, GuildWarsMatch, GuildWarsMatchGame } from "@shared/schema";

const drawsInProgress = new Set<number>();
const roundAdvancementsInProgress = new Set<number>();
const pendingRoundAdvancements = new Map<number, number>();

function pickThreeGames(): [string, string, string] {
  const pool = [...WORD_WARS_ELIGIBLE_SLUGS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [pool[0], pool[1], pool[2]];
}

async function notifyGroupMembers(
  groupId: number,
  type: "guild_war_matched" | "guild_war_round_start" | "guild_war_champion" | "guild_war_cancelled",
  title: string,
  body: string,
  linkUrl: string,
): Promise<void> {
  try {
    const members = await storage.getGroupMembers(groupId);
    await Promise.all(members.map(async (m) => {
      try {
        const prefs = await storage.getNotificationPreferences(m.user.id);
        if (prefs[type]) {
          await storage.createNotification({ userId: m.user.id, type, title, body, linkUrl });
        }
      } catch (e) {
        console.error("[guild-wars-engine] member notification error", e);
      }
    }));
  } catch (e) {
    console.error("[guild-wars-engine] notifyGroupMembers error", e);
  }
}

export async function executeGuildBracketDraw(
  tournamentId: number,
): Promise<{ matches: GuildWarsMatch[] } | { error: string }> {
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
): Promise<{ matches: GuildWarsMatch[] } | { error: string }> {
  const tournament = await storage.getGuildWarsTournament(tournamentId);
  if (!tournament) return { error: "Tournament not found" };
  if (tournament.status !== "registration") return { error: "Tournament is not in registration phase" };

  const registrations = await storage.getGuildWarsRegistrationsForTournament(tournamentId);
  const minRequired = tournament.minGroups ?? 2;
  if (registrations.length < minRequired) {
    await storage.updateGuildWarsTournament(tournamentId, { status: "cancelled" });
    // Notify all registered groups that it was cancelled
    for (const reg of registrations) {
      await notifyGroupMembers(
        reg.groupId,
        "guild_war_cancelled",
        "Guild Wars Tournament Cancelled",
        `"${tournament.name}" was cancelled due to insufficient group registrations.`,
        "/guild-wars",
      );
    }
    return { error: `Not enough groups (need ${minRequired}, have ${registrations.length}) — tournament cancelled` };
  }

  const matchData = await _buildBracket(registrations, tournament);
  await storage.updateGuildWarsTournament(tournamentId, { status: "active" });

  const createdMatches: GuildWarsMatch[] = [];
  for (const match of matchData) {
    const created = await storage.createGuildWarsMatch(match);
    createdMatches.push(created);

    await Promise.all([1, 2, 3].map((num) =>
      storage.createGuildWarsMatchGame({
        matchId: created.id,
        gameNumber: num,
        gameSlug: num === 1 ? match.game1Slug : num === 2 ? match.game2Slug : match.game3Slug,
        roomCode: null,
        winnerGroupId: null,
        status: match.status === "bye" ? "completed" : "pending",
      }),
    ));

    if (match.status === "bye" && match.group1Id) {
      await notifyGroupMembers(
        match.group1Id,
        "guild_war_matched",
        "The bracket is live — you have a bye",
        "The bracket has been drawn. Your group advances automatically in round 1 — prepare for round 2.",
        `/guild-wars/${tournamentId}`,
      );
    } else if (match.group1Id && match.group2Id) {
      const [group1, group2] = await Promise.all([
        storage.getGroup(match.group1Id),
        storage.getGroup(match.group2Id),
      ]);
      await Promise.all([
        notifyGroupMembers(
          match.group1Id,
          "guild_war_matched",
          "Your opponent group awaits",
          `"${group2?.name ?? "Your opponents"}" stands between you and glory. The guild war begins.`,
          `/guild-wars/${tournamentId}`,
        ),
        notifyGroupMembers(
          match.group2Id,
          "guild_war_matched",
          "Your opponent group awaits",
          `"${group1?.name ?? "Your opponents"}" stands between you and glory. The guild war begins.`,
          `/guild-wars/${tournamentId}`,
        ),
      ]);
    }
  }

  return { matches: createdMatches };
}

async function _buildBracket(
  registrations: GuildWarsRegistration[],
  tournament: GuildWarsTournament,
): Promise<Omit<GuildWarsMatch, "id" | "createdAt">[]> {
  // v1: seed by registration order (first registered = highest seed)
  const groupIds = registrations.map((r) => r.groupId);

  let size = 1;
  while (size < groupIds.length) size *= 2;

  const slots: (number | null)[] = [...groupIds];
  while (slots.length < size) slots.push(null);

  const deadline = tournament.roundDeadlineHours
    ? new Date(Date.now() + tournament.roundDeadlineHours * 60 * 60 * 1000).toISOString()
    : null;

  const matches: Omit<GuildWarsMatch, "id" | "createdAt">[] = [];
  const half = size / 2;

  for (let i = 0; i < half; i++) {
    const g1 = slots[i];
    const g2 = slots[size - 1 - i];
    const [slug1, slug2, slug3] = pickThreeGames();

    if (g1 !== null && g2 === null) {
      matches.push({
        tournamentId: tournament.id,
        round: 1,
        group1Id: g1,
        group2Id: null,
        winnerGroupId: g1,
        status: "bye",
        deadline: null,
        game1Slug: slug1,
        game2Slug: slug2,
        game3Slug: slug3,
      });
    } else {
      matches.push({
        tournamentId: tournament.id,
        round: 1,
        group1Id: g1,
        group2Id: g2,
        winnerGroupId: null,
        status: "pending",
        deadline,
        game1Slug: slug1,
        game2Slug: slug2,
        game3Slug: slug3,
      });
    }
  }

  return matches;
}

export async function checkAndForfeitExpiredGuildMatches(tournament: GuildWarsTournament): Promise<void> {
  try {
    if (tournament.status !== "active") return;

    const matches = await storage.listGuildWarsMatchesForTournament(tournament.id);
    const expirable = matches.filter(
      (m) =>
        (m.status === "pending" || m.status === "active") &&
        m.deadline !== null &&
        new Date(m.deadline) <= new Date() &&
        m.group1Id !== null &&
        m.group2Id !== null,
    );

    for (const match of expirable) {
      const games = await storage.getGuildWarsMatchGames(match.id);
      const completed = games.filter((g) => g.status === "completed");
      let g1Wins = 0;
      let g2Wins = 0;
      for (const g of completed) {
        if (g.winnerGroupId === match.group1Id) g1Wins++;
        else if (g.winnerGroupId === match.group2Id) g2Wins++;
      }
      const winnerGroupId =
        g1Wins > g2Wins
          ? match.group1Id!
          : g2Wins > g1Wins
          ? match.group2Id!
          : Math.random() < 0.5
          ? match.group1Id!
          : match.group2Id!;
      const loserGroupId = winnerGroupId === match.group1Id ? match.group2Id! : match.group1Id!;

      await storage.updateGuildWarsMatch(match.id, { status: "forfeited", winnerGroupId });

      await Promise.all([
        notifyGroupMembers(
          winnerGroupId,
          "guild_war_round_start",
          "Match decided by forfeit",
          "The opponent group didn't complete their games in time. Your group advances.",
          `/guild-wars/${tournament.id}`,
        ),
        notifyGroupMembers(
          loserGroupId,
          "guild_war_round_start",
          "Your group was forfeited",
          "The round deadline passed before all games were completed. Your group has been eliminated.",
          `/guild-wars/${tournament.id}`,
        ),
      ]);

      _triggerGuildAdvancement(match.tournamentId, match.round);
    }
  } catch (err) {
    console.error("[guild-wars-engine] checkAndForfeitExpiredGuildMatches error", err);
  }
}

export async function resolveGuildWarsGame(
  roomCode: string,
  winnerUserId: number,
): Promise<void> {
  try {
    const matchGame = await storage.getGuildWarsMatchGameByRoomCode(roomCode);
    if (!matchGame) return;
    if (matchGame.status === "completed") return;

    const match = await storage.getGuildWarsMatch(matchGame.matchId);
    if (!match || !match.group1Id || !match.group2Id) return;

    // Map winnerUserId → winnerGroupId via registrations
    let winnerGroupId: number | null = null;
    if (winnerUserId !== -1) {
      const [reg1, reg2] = await Promise.all([
        storage.getGuildWarsRegistration(match.tournamentId, match.group1Id),
        storage.getGuildWarsRegistration(match.tournamentId, match.group2Id),
      ]);
      if (reg1?.registeredBy === winnerUserId) {
        winnerGroupId = match.group1Id;
      } else if (reg2?.registeredBy === winnerUserId) {
        winnerGroupId = match.group2Id;
      } else {
        console.error("[guild-wars-engine] Cannot map winner userId", winnerUserId, "to a group in match", match.id);
        winnerGroupId = null;
      }
    }

    await storage.updateGuildWarsMatchGame(matchGame.id, {
      status: "completed",
      winnerGroupId,
    });

    if (match.status === "completed" || match.status === "bye" || match.status === "forfeited") return;

    const allGames = await storage.getGuildWarsMatchGames(match.id);
    const completedGames = allGames.map(g =>
      g.id === matchGame.id ? { ...g, status: "completed" as const, winnerGroupId } : g
    ).filter(g => g.status === "completed");

    let g1Wins = 0;
    let g2Wins = 0;
    for (const g of completedGames) {
      if (g.winnerGroupId === match.group1Id) g1Wins++;
      else if (g.winnerGroupId === match.group2Id) g2Wins++;
    }

    const totalCompleted = completedGames.length;
    const seriesWinnerGroupId = g1Wins >= 2 ? match.group1Id
      : g2Wins >= 2 ? match.group2Id
      : totalCompleted >= 3
        ? (g1Wins >= g2Wins ? match.group1Id : match.group2Id)
        : null;

    if (seriesWinnerGroupId === null) return;

    await storage.updateGuildWarsMatch(match.id, {
      status: "completed",
      winnerGroupId: seriesWinnerGroupId,
    });

    _triggerGuildAdvancement(match.tournamentId, match.round);
  } catch (err) {
    console.error("[guild-wars-engine] resolveGuildWarsGame error", err);
  }
}

function _triggerGuildAdvancement(tournamentId: number, round: number): void {
  if (roundAdvancementsInProgress.has(tournamentId)) {
    pendingRoundAdvancements.set(tournamentId, round);
    return;
  }
  roundAdvancementsInProgress.add(tournamentId);
  _advanceGuildBracket(tournamentId, round)
    .catch(e => console.error("[guild-wars-engine] advance error", e))
    .finally(() => {
      roundAdvancementsInProgress.delete(tournamentId);
      const pending = pendingRoundAdvancements.get(tournamentId);
      if (pending !== undefined) {
        pendingRoundAdvancements.delete(tournamentId);
        setImmediate(() => _triggerGuildAdvancement(tournamentId, pending));
      }
    });
}

async function _advanceGuildBracket(tournamentId: number, round: number): Promise<void> {
  const tournament = await storage.getGuildWarsTournament(tournamentId);
  if (!tournament) return;

  const allMatches = await storage.listGuildWarsMatchesForTournament(tournamentId);
  const currentRound = allMatches.filter(m => m.round === round);
  const allDone = currentRound.every(
    m => m.status === "completed" || m.status === "bye" || m.status === "forfeited",
  );

  if (!allDone) return;

  const nextRound = round + 1;
  const existingNext = allMatches.filter(m => m.round === nextRound);
  if (existingNext.length > 0) return;

  const roundWinners = currentRound.map(m => m.winnerGroupId).filter((id): id is number => id !== null);

  if (roundWinners.length === 1) {
    if (tournament.status === "completed") return;
    const championGroupId = roundWinners[0];
    await storage.updateGuildWarsTournament(tournamentId, { status: "completed" });
    await storage.createGuildWarsChampion(tournamentId, championGroupId);

    await notifyGroupMembers(
      championGroupId,
      "guild_war_champion",
      "Champions",
      "Your guild has conquered the Guild Wars. Glory and honour are yours.",
      `/guild-wars/${tournamentId}`,
    );
    return;
  }

  const deadline = tournament.roundDeadlineHours
    ? new Date(Date.now() + tournament.roundDeadlineHours * 60 * 60 * 1000).toISOString()
    : null;

  for (let i = 0; i < roundWinners.length; i += 2) {
    const g1 = roundWinners[i];
    const g2 = roundWinners[i + 1] ?? null;
    const [slug1, slug2, slug3] = pickThreeGames();

    if (g2 === null) {
      const created = await storage.createGuildWarsMatch({
        tournamentId,
        round: nextRound,
        group1Id: g1,
        group2Id: null,
        winnerGroupId: g1,
        status: "bye",
        deadline: null,
        game1Slug: slug1,
        game2Slug: slug2,
        game3Slug: slug3,
      });
      for (const num of [1, 2, 3]) {
        await storage.createGuildWarsMatchGame({
          matchId: created.id,
          gameNumber: num,
          gameSlug: num === 1 ? slug1 : num === 2 ? slug2 : slug3,
          roomCode: null,
          winnerGroupId: null,
          status: "completed",
        });
      }
    } else {
      const created = await storage.createGuildWarsMatch({
        tournamentId,
        round: nextRound,
        group1Id: g1,
        group2Id: g2,
        winnerGroupId: null,
        status: "pending",
        deadline,
        game1Slug: slug1,
        game2Slug: slug2,
        game3Slug: slug3,
      });
      for (const num of [1, 2, 3]) {
        await storage.createGuildWarsMatchGame({
          matchId: created.id,
          gameNumber: num,
          gameSlug: num === 1 ? slug1 : num === 2 ? slug2 : slug3,
          roomCode: null,
          winnerGroupId: null,
          status: "pending",
        });
      }

      const [group1, group2] = await Promise.all([
        storage.getGroup(g1),
        storage.getGroup(g2),
      ]);

      await Promise.all([
        notifyGroupMembers(
          g1,
          "guild_war_round_start",
          `Round ${nextRound} begins`,
          `Your next opponent is "${group2?.name ?? "your challenger"}". The battle continues.`,
          `/guild-wars/${tournamentId}`,
        ),
        notifyGroupMembers(
          g2,
          "guild_war_round_start",
          `Round ${nextRound} begins`,
          `Your next opponent is "${group1?.name ?? "your challenger"}". The battle continues.`,
          `/guild-wars/${tournamentId}`,
        ),
      ]);
    }
  }
}
