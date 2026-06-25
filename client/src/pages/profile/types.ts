import type { UserGameStats, UserAchievement, QuizSession } from "@shared/schema";

export type QuizSessionWithCount = QuizSession & { playerCount: number };

export interface PublicProfile {
  user: { id: number; name: string; avatarUrl: string | null; createdAt: string; isPremium: boolean };
  stats: UserGameStats[];
  achievements: UserAchievement[];
  leaderboardRankings: Array<{ gameSlug: string; rank: number; score: number }>;
}

export type DuelHistoryEntry = {
  id: number;
  roomCode: string;
  opponentId: number;
  opponentName: string;
  opponentAvatarUrl: string | null;
  gameSlug: string;
  outcome: "win" | "loss" | "draw" | null;
  isForfeit: boolean;
  eloDelta: number | null;
  startedAt: string;
  endedAt: string | null;
};

export type FriendEntry = { id: number; friendUser: { id: number; name: string; avatarUrl: string | null } };
export type GroupSummary = { id: number; name: string; memberCount: number; isPublic: boolean };
