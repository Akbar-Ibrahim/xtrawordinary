import type { Group, GroupMember, GroupRound, GroupRoundScore, HuddleChallenge } from "@shared/schema";

export interface EnrichedHuddleChallenge extends HuddleChallenge {
  challengerGroupName: string;
  challengeeGroupName: string;
  challengerAdminName: string;
  challengeeAdminName: string | null;
}

export interface EnrichedTeamRaceChallenge {
  id: number;
  challengerGroupId: number;
  challengeeGroupId: number;
  challengerAdminId: number;
  challengeeAdminId: number | null;
  challengerGroupName: string;
  challengeeGroupName: string;
  gameSlug: string;
  raceTarget: number;
  raceTimeLimit: number;
  status: string;
  roomCode: string | null;
  winnerGroupId: number | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface GroupDetailResponse {
  group: Group;
  membership: GroupMember | null;
}

export interface LeaderboardEntry {
  userId: number;
  name: string;
  avatarUrl: string | null;
  totalScore: number;
  roundsPlayed: number;
}

export interface MemberWithUser extends GroupMember {
  user: { id: number; name: string; avatarUrl: string | null };
}

export type RoundScoreEntry = GroupRoundScore & { user: { id: number; name: string; avatarUrl: string | null } };

export interface SeasonLeaderboardEntry {
  userId: number;
  name: string;
  avatarUrl: string | null;
  totalScore: number;
  roundsPlayed: number;
}

export interface GuildWarsStats {
  tournamentsEntered: number;
  matchWins: number;
  matchLosses: number;
  championshipsWon: number;
  activeTournament: { id: number; name: string } | null;
  recentChampionships: { tournamentId: number; tournamentName: string }[];
}

export type GroupRoundLite = GroupRound;
