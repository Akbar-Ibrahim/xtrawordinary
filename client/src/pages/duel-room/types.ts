export type Phase =
  | "connecting"
  | "lobby"
  | "waiting"
  | "countdown"
  | "playing"
  | "over"
  | "error";

export interface RoomInfo {
  gameSlug: string;
  seed: number;
  startWord: string;
  challengerId: number;
  challengeeId: number;
  format?: "turn" | "race";
  raceTarget?: number;
  raceTimeLimitMs?: number;
}

export interface SpectatorState {
  player1Id: number;
  player1Name: string;
  player1AvatarUrl: string | null;
  player2Id: number;
  player2Name: string;
  player2AvatarUrl: string | null;
  gameSlug: string;
  format: "turn" | "race";
  raceTarget: number;
  count1: number;
  count2: number;
  lives1: number;
  lives2: number;
}

export const REACT_EMOJIS = ["👀", "🔥", "😬", "❤️", "👏"] as const;
