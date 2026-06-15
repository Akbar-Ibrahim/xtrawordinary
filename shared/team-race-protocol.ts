export interface TeamRacePlayerInfo {
  userId: number;
  name: string;
  avatarUrl: string | null;
  groupId: number;
}

export interface TeamRaceContribution {
  userId: number;
  name: string;
  groupId: number;
  count: number;
}

export type TeamRaceClientMessage =
  | { type: "team:join"; roomCode: string; groupId: number }
  | { type: "team:start" }
  | { type: "team:move"; word: string }
  | { type: "team:typing" };

export type TeamRaceServerMessage =
  | {
      type: "team:joined";
      roomCode: string;
      gameSlug: string;
      startWord: string;
      raceTarget: number;
      raceTimeLimitMs: number;
      challengerGroupId: number;
      challengeeGroupId: number;
      players: TeamRacePlayerInfo[];
      yourGroupId: number;
      status: "waiting" | "countdown" | "playing" | "over";
    }
  | { type: "team:member_joined"; player: TeamRacePlayerInfo }
  | { type: "team:member_left"; userId: number; groupId: number }
  | { type: "team:countdown"; startAt: number }
  | {
      type: "team:progress";
      challengerCount: number;
      challengeeCount: number;
      lastWord: string;
      lastWordGroupId: number;
      lastWordUserId: number;
    }
  | { type: "team:word_rejected"; word: string; error: string }
  | { type: "team:typing"; userId: number; groupId: number }
  | {
      type: "team:over";
      winnerGroupId: number | null;
      challengerCount: number;
      challengeeCount: number;
      contributions: TeamRaceContribution[];
    }
  | { type: "team:error"; message: string }
  | {
      type: "team:state";
      phase: "waiting" | "playing" | "over";
      challengerCount: number;
      challengeeCount: number;
      players: TeamRacePlayerInfo[];
      yourGroupId: number;
      gameSlug: string;
      startWord: string;
      raceTarget: number;
      raceTimeLimitMs: number;
      challengerGroupId: number;
      challengeeGroupId: number;
    };
