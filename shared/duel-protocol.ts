export type DuelClientMessage =
  | { type: "room:join"; roomCode: string }
  | { type: "room:ready" }
  | { type: "game:move"; payload: unknown };

export type DuelServerMessage =
  | {
      type: "room:joined";
      roomCode: string;
      opponentId: number;
      opponentName: string;
      opponentAvatarUrl: string | null;
    }
  | { type: "room:ready"; startAt: number }
  | { type: "room:countdown"; secondsLeft: number }
  | { type: "opponent:move"; payload: unknown }
  | {
      type: "game:over";
      outcome: "you_win" | "you_lose" | "draw" | "forfeit";
      eloChange: number;
      newElo: number;
    }
  | { type: "player:disconnect"; reconnectDeadlineMs: number }
  | { type: "player:reconnect" }
  | { type: "player:forfeited"; reason: "disconnect" | "manual" }
  | { type: "error"; message: string };
