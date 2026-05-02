export type DuelClientMessage =
  | { type: "room:join"; roomCode: string }
  | { type: "room:ready" }
  | { type: "game:move"; payload: unknown }
  | { type: "game:end"; winnerId: number };

export type DuelServerMessage =
  | {
      type: "room:joined";
      roomCode: string;
      opponentId: number;
      opponentName: string;
      opponentAvatarUrl: string | null;
    }
  /** Sent to the *other* player when one player clicks "Ready" */
  | { type: "room:player_ready"; userId: number }
  | { type: "room:ready"; startAt: number }
  | { type: "room:countdown"; secondsLeft: number }
  /**
   * Sent to a reconnecting player so the client can restore its phase.
   * Carries the minimal snapshot the server knows about.
   */
  | {
      type: "room:state";
      phase: "waiting" | "playing";
      opponentId: number;
      opponentName: string;
      opponentAvatarUrl: string | null;
      myLives: number;
      opponentLives: number;
    }
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
