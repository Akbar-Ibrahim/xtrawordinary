export type DuelClientMessage =
  | { type: "room:join"; roomCode: string }
  | { type: "room:ready" }
  | { type: "game:move"; payload: unknown }
  /** Signal that the game has ended. The server derives the winner from
   *  authoritative life counts — no winnerId needed from the client. */
  | { type: "game:end" }
  | { type: "game:forfeit" };

export type DuelFormat = "turn" | "race";

export type DuelServerMessage =
  | {
      type: "room:joined";
      roomCode: string;
      /** null when the local player joins first and the opponent hasn't arrived yet */
      opponentId: number | null;
      /** null when waiting for opponent */
      opponentName: string | null;
      opponentAvatarUrl: string | null;
      /** Format of the duel room ("turn" or "race") */
      format: DuelFormat;
      /** Target word count for race format */
      raceTarget: number;
      /** Race time limit in milliseconds */
      raceTimeLimitMs: number;
    }
  /** Sent to the *other* player when one player clicks "Ready" */
  | { type: "room:player_ready"; userId: number }
  | { type: "room:ready"; startAt: number; format: DuelFormat; raceTarget: number; raceTimeLimitMs: number }
  | { type: "room:countdown"; secondsLeft: number }
  /**
   * Sent to a reconnecting player so the client can restore its phase.
   * Contains the full authoritative game snapshot needed to resume.
   */
  | {
      type: "room:state";
      phase: "waiting" | "playing";
      opponentId: number;
      opponentName: string;
      opponentAvatarUrl: string | null;
      format: DuelFormat;
      raceTarget: number;
      raceTimeLimitMs: number;
      /** Race: this player's word count */
      myCount: number;
      /** Race: opponent's word count */
      opponentCount: number;
      myLives: number;
      /** Words this player has submitted so far (excluding the seed word). */
      myWords: string[];
      /** Words the opponent has submitted so far (excluding the seed word). */
      opponentWords: string[];
      opponentLives: number;
      /** Current word in the chain (head of the chain). */
      currentWord: string;
      /** All words used so far (uppercased). Turn-based only. */
      usedWords: string[];
      /** Whether it is the reconnecting player's turn. */
      isMyTurn: boolean;
    }
  | { type: "opponent:move"; payload: unknown }
  /** Broadcast to both players after each valid race move */
  | { type: "race:progress"; userId: number; count: number }
  | {
      type: "game:over";
      outcome: "you_win" | "you_lose" | "draw" | "forfeit";
      eloChange: number;
      newElo: number;
    }
  | { type: "player:disconnect"; reconnectDeadlineMs: number }
  | { type: "player:reconnect" }
  | { type: "player:forfeited"; reason: "disconnect" | "manual" }
  | { type: "challenge:cancelled"; reason: "declined" | "cancelled" | "expired" }
  | { type: "error"; message: string };
