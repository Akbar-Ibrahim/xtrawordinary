import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, HeartOff, Clock, Loader2, WifiOff, ScrollText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/user-avatar";
import { motion } from "framer-motion";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DuelGameAdapter {
  /** Client-side pre-validation before sending to server.
   *  Returns an error string when invalid, or null when the move is acceptable. */
  validateMoveClient(input: string, currentWord: string, usedWords: string[]): string | null;
  /** Build the game:move payload for a submitted word. */
  buildWordPayload(word: string, lives: number): unknown;
  /** Build the game:move payload for a timer expiry. */
  buildTimeoutPayload(lives: number): unknown;
  /** Extract the word string from an opponent's word-move payload for state update. */
  extractOpponentWord(payload: unknown): string | null;
  /** Render the active-player input area. */
  renderInput(props: DuelInputProps): React.ReactNode;
  /** Render the shared game display (current word, chain hint, etc.) */
  renderGameDisplay(props: DuelDisplayProps): React.ReactNode;
}

export interface DuelInputProps {
  currentWord: string;
  usedWords: string[];
  onSubmit: (word: string) => void;
  disabled: boolean;
  feedback: string | null;
  clearFeedback: () => void;
}

export interface DuelDisplayProps {
  currentWord: string;
  usedWords: string[];
  isMyTurn: boolean;
  opponentName: string;
}

export interface GameResult {
  outcome: "you_win" | "you_lose" | "draw" | "forfeit";
  eloChange: number;
  newElo: number;
  forfeitReason?: "disconnect" | "manual";
}

export interface DuelTurnEngineInitialState {
  currentWord: string;
  usedWords: string[];
  isMyTurn: boolean;
  myLives: number;
  opponentLives: number;
}

export interface DuelTurnEngineProps {
  userId: number;
  opponentId: number | null;
  opponentName: string;
  opponentAvatarUrl: string | null;
  myName: string;
  myAvatarUrl: string | null;
  initialState: DuelTurnEngineInitialState;
  sendWs: (msg: DuelClientMessage) => void;
  /** The latest WS message from the server that the engine should process.
   *  Parent updates this whenever a game-phase message arrives. */
  latestMessage: DuelServerMessage | null;
  onGameOver: (result: GameResult) => void;
  adapter: DuelGameAdapter;
  turnTimeSeconds?: number;
}

// ─── Lives display ─────────────────────────────────────────────────────────────

function Lives({
  count,
  max = 3,
  ...domProps
}: { count: number; max?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex gap-1" aria-label={`${count} of ${max} lives`} {...domProps}>
      {Array.from({ length: max }).map((_, i) =>
        i < count ? (
          <Heart key={i} className="h-4 w-4 fill-red-500 text-red-500" />
        ) : (
          <HeartOff key={i} className="h-4 w-4 text-muted-foreground" />
        ),
      )}
    </div>
  );
}

// ─── DuelTurnEngine ────────────────────────────────────────────────────────────

export function DuelTurnEngine({
  userId,
  opponentId,
  opponentName,
  opponentAvatarUrl,
  myName,
  myAvatarUrl,
  initialState,
  sendWs,
  latestMessage,
  onGameOver,
  adapter,
  turnTimeSeconds = 8,
}: DuelTurnEngineProps) {
  const [currentWord, setCurrentWord] = useState(initialState.currentWord);
  const [usedWords, setUsedWords] = useState<string[]>(initialState.usedWords);
  const [isMyTurn, setIsMyTurn] = useState(initialState.isMyTurn);
  const [myLives, setMyLives] = useState(initialState.myLives);
  const [opponentLives, setOpponentLives] = useState(initialState.opponentLives);
  const [timerLeft, setTimerLeft] = useState(turnTimeSeconds);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [disconnectDeadline, setDisconnectDeadline] = useState<number | null>(null);
  const [disconnectSecsLeft, setDisconnectSecsLeft] = useState(30);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameEndedRef = useRef(false);
  const prevMsgRef = useRef<DuelServerMessage | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimerLeft(turnTimeSeconds);
    timerRef.current = setInterval(() => {
      setTimerLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }, [stopTimer, turnTimeSeconds]);

  // Start/stop timer when turn changes
  useEffect(() => {
    if (isMyTurn) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [isMyTurn, startTimer, stopTimer]);

  // Auto-timeout when timer hits 0
  const handleTimeout = useCallback(() => {
    stopTimer();
    setMyLives((prev) => {
      const newLives = Math.max(0, prev - 1);
      const payload = adapter.buildTimeoutPayload(newLives);
      sendWs({ type: "game:move", payload });
      if (newLives <= 0 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        sendWs({ type: "game:end", winnerId: opponentId ?? -1 });
      }
      return newLives;
    });
    setIsMyTurn(false);
  }, [stopTimer, adapter, sendWs, opponentId]);

  useEffect(() => {
    if (timerLeft === 0 && isMyTurn) handleTimeout();
  }, [timerLeft, isMyTurn, handleTimeout]);

  // Process incoming WS messages
  useEffect(() => {
    if (!latestMessage || latestMessage === prevMsgRef.current) return;
    prevMsgRef.current = latestMessage;

    switch (latestMessage.type) {
      case "opponent:move": {
        const payload = latestMessage.payload;
        const word = adapter.extractOpponentWord(payload);
        if (word) {
          const upper = word.toUpperCase();
          setCurrentWord(upper);
          setUsedWords((prev) => [...prev, upper]);
        }
        // Update opponent lives from payload
        if (payload !== null && typeof payload === "object") {
          const p = payload as { lives?: number };
          if (typeof p.lives === "number") {
            setOpponentLives(p.lives);
            if (p.lives <= 0 && !gameEndedRef.current) {
              gameEndedRef.current = true;
              sendWs({ type: "game:end", winnerId: userId });
            }
          }
        }
        setIsMyTurn(true);
        break;
      }

      case "game:over":
        stopTimer();
        onGameOver({
          outcome: latestMessage.outcome,
          eloChange: latestMessage.eloChange,
          newElo: latestMessage.newElo,
        });
        break;

      case "player:disconnect":
        setDisconnectDeadline(latestMessage.reconnectDeadlineMs);
        setDisconnectSecsLeft(
          Math.ceil((latestMessage.reconnectDeadlineMs - Date.now()) / 1000),
        );
        break;

      case "player:reconnect":
        setDisconnectDeadline(null);
        break;

      case "player:forfeited":
        stopTimer();
        onGameOver({
          outcome: "forfeit",
          eloChange: 0,
          newElo: 0,
          forfeitReason: latestMessage.reason,
        });
        break;

      default:
        break;
    }
  }, [latestMessage, adapter, sendWs, userId, stopTimer, onGameOver]);

  // Disconnect countdown
  useEffect(() => {
    if (!disconnectDeadline) return;
    const interval = setInterval(() => {
      const secs = Math.ceil((disconnectDeadline - Date.now()) / 1000);
      setDisconnectSecsLeft(Math.max(0, secs));
      if (secs <= 0) {
        clearInterval(interval);
        setDisconnectDeadline(null);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [disconnectDeadline]);

  const handleSubmit = useCallback(
    (word: string) => {
      if (!isMyTurn) return;
      const upper = word.toUpperCase().trim();
      const clientError = adapter.validateMoveClient(upper, currentWord, usedWords);
      if (clientError) {
        setFeedback(clientError);
        return;
      }
      setFeedback(null);
      stopTimer();
      setCurrentWord(upper);
      setUsedWords((prev) => [...prev, upper]);
      const payload = adapter.buildWordPayload(upper, myLives);
      sendWs({ type: "game:move", payload });
      setIsMyTurn(false);
    },
    [isMyTurn, adapter, currentWord, usedWords, myLives, sendWs, stopTimer],
  );

  const timerPercent = (timerLeft / turnTimeSeconds) * 100;

  return (
    <div className="space-y-4" data-testid="duel-turn-engine">
      {/* Disconnect overlay */}
      {disconnectDeadline && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          data-testid="overlay-disconnect"
        >
          <Card className="max-w-sm w-full border-orange-500">
            <CardContent className="py-8 text-center space-y-3">
              <WifiOff className="h-12 w-12 mx-auto text-orange-500" />
              <h3 className="text-xl font-bold">Opponent disconnected</h3>
              <p className="text-muted-foreground text-sm">
                {disconnectSecsLeft}s to reconnect…
              </p>
              <p className="text-xs text-muted-foreground">
                If they don't return in time, you win by forfeit.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Player panels */}
      <div className="grid grid-cols-2 gap-3">
        <Card
          className={isMyTurn ? "border-primary shadow-md" : ""}
          data-testid="card-player-me"
        >
          <CardContent className="py-3 px-4 space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar name={myName} avatarUrl={myAvatarUrl} className="h-6 w-6 shrink-0" />
              <p className="text-xs font-medium truncate flex-1">{myName}</p>
              {isMyTurn && (
                <Badge className="text-xs h-5 shrink-0" data-testid="badge-your-turn">
                  Your turn
                </Badge>
              )}
            </div>
            <Lives count={myLives} data-testid="lives-me" />
          </CardContent>
        </Card>

        <Card
          className={!isMyTurn ? "border-primary shadow-md" : ""}
          data-testid="card-opponent"
        >
          <CardContent className="py-3 px-4 space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar
                name={opponentName}
                avatarUrl={opponentAvatarUrl}
                className="h-6 w-6 shrink-0"
              />
              <p className="text-xs font-medium truncate flex-1">{opponentName}</p>
              {!isMyTurn && (
                <Badge variant="outline" className="text-xs h-5 shrink-0" data-testid="badge-opponent-turn">
                  Their turn
                </Badge>
              )}
            </div>
            <Lives count={opponentLives} data-testid="lives-opponent" />
          </CardContent>
        </Card>
      </div>

      {/* Timer bar */}
      {isMyTurn && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Time left
            </span>
            <span className={timerLeft <= 3 ? "text-destructive font-bold" : ""}>
              {Math.ceil(timerLeft)}s
            </span>
          </div>
          <Progress
            value={timerPercent}
            className={`h-2 ${timerLeft <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
            data-testid="progress-timer"
          />
        </div>
      )}

      {/* Game-specific display + input */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          {adapter.renderGameDisplay({
            currentWord,
            usedWords,
            isMyTurn,
            opponentName,
          })}
          {isMyTurn ? (
            adapter.renderInput({
              currentWord,
              usedWords,
              onSubmit: handleSubmit,
              disabled: false,
              feedback,
              clearFeedback: () => setFeedback(null),
            })
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for {opponentName}…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shared used-words panel */}
      {usedWords.length > 1 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Words Played ({usedWords.length - 1})
              </p>
            </div>
            <div
              className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto"
              data-testid="panel-used-words"
            >
              {usedWords.slice(1).map((w, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-xs font-mono"
                  data-testid={`word-played-${i}`}
                >
                  {w}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
