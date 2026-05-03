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
  /** Client-side pre-validation. Returns error string or null. */
  validateMoveClient(input: string, currentWord: string, usedWords: string[]): string | null;
  /** Build the game:move payload for a submitted word. */
  buildWordPayload(word: string, lives: number): unknown;
  /** Build the game:move payload for a timer expiry. */
  buildTimeoutPayload(lives: number): unknown;
  /** Extract the word string from an opponent's word-move payload. */
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
  /** Call when the adapter itself determines a move is invalid (e.g. API check),
   *  so the engine can apply the 0.5s time penalty. */
  onInvalidMove: () => void;
  disabled: boolean;
  feedback: string | null;
  clearFeedback: () => void;
  /** Optional: called each time the user types a character (race mode typing indicator). */
  onTyping?: () => void;
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
  /** Words submitted by the local player (excluding the seed word). */
  myWords: string[];
  /** Words submitted by the opponent (excluding the seed word). */
  opponentWords: string[];
  /** Race-mode final counts (undefined in turn-based). */
  myFinalCount?: number;
  opponentFinalCount?: number;
}

export interface DuelTurnEngineInitialState {
  currentWord: string;
  usedWords: string[];
  isMyTurn: boolean;
  myLives: number;
  opponentLives: number;
  /** Pre-populated from server reconnect snapshot (may be empty on fresh start). */
  myWords?: string[];
  opponentWords?: string[];
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
  /** Latest WS message from the server — engine processes via useEffect. */
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
  const [timerLeft, setTimerLeft] = useState<number>(turnTimeSeconds);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [disconnectDeadline, setDisconnectDeadline] = useState<number | null>(null);
  const [disconnectSecsLeft, setDisconnectSecsLeft] = useState(30);
  const [forfeitPending, setForfeitPending] = useState(false);
  const forfeitReasonRef = useRef<"disconnect" | "manual" | undefined>(undefined);

  // Per-player word tracking (refs — only needed at game-end)
  // Pre-seed from reconnect snapshot if available so post-match lists are complete
  const myWordsRef = useRef<string[]>(initialState.myWords ?? []);
  const opponentWordsRef = useRef<string[]>(initialState.opponentWords ?? []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameEndedRef = useRef(false);
  const prevMsgRef = useRef<DuelServerMessage | null>(null);

  // When true, startTimer resets the clock to turnTimeSeconds.
  // Set to false before restoring turn after a server rejection so the
  // penalty-reduced timer value is preserved.
  const resetClockOnNextStartRef = useRef(true);

  // Optimistic-update rollback snapshot: saved before each optimistic word write.
  const rollbackRef = useRef<{ currentWord: string; usedWords: string[] } | null>(null);

  // ── Timer helpers ──────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    if (resetClockOnNextStartRef.current) {
      setTimerLeft(turnTimeSeconds);
    }
    resetClockOnNextStartRef.current = true; // restore default for next call
    timerRef.current = setInterval(() => {
      setTimerLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }, [stopTimer, turnTimeSeconds]);

  // Start/stop timer based on turn ownership
  useEffect(() => {
    if (isMyTurn) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [isMyTurn, startTimer, stopTimer]);

  // ── Timeout ────────────────────────────────────────────────────────────────

  const handleTimeout = useCallback(() => {
    stopTimer();
    setMyLives((prev) => {
      const newLives = Math.max(0, prev - 1);
      sendWs({ type: "game:move", payload: adapter.buildTimeoutPayload(newLives) });
      if (newLives <= 0 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        sendWs({ type: "game:end" });
      }
      return newLives;
    });
    rollbackRef.current = null;
    setIsMyTurn(false);
  }, [stopTimer, adapter, sendWs, opponentId]);

  useEffect(() => {
    if (timerLeft === 0 && isMyTurn) handleTimeout();
  }, [timerLeft, isMyTurn, handleTimeout]);

  // ── 0.5s penalty helper ────────────────────────────────────────────────────

  const applyTimePenalty = useCallback(() => {
    setTimerLeft((prev) => Math.max(0.5, prev - 0.5));
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    (word: string) => {
      if (!isMyTurn) return;
      const upper = word.toUpperCase().trim();

      const clientError = adapter.validateMoveClient(upper, currentWord, usedWords);
      if (clientError) {
        setFeedback(clientError);
        applyTimePenalty();
        return;
      }

      setFeedback(null);
      stopTimer();

      // Save rollback snapshot before optimistic state write
      rollbackRef.current = { currentWord, usedWords: [...usedWords] };

      // Optimistic update
      setCurrentWord(upper);
      setUsedWords((prev) => [...prev, upper]);
      myWordsRef.current = [...myWordsRef.current, upper];

      sendWs({ type: "game:move", payload: adapter.buildWordPayload(upper, myLives) });
      setIsMyTurn(false);
    },
    [isMyTurn, adapter, currentWord, usedWords, myLives, sendWs, stopTimer, applyTimePenalty],
  );

  // ── Process incoming WS messages ───────────────────────────────────────────

  useEffect(() => {
    if (!latestMessage || latestMessage === prevMsgRef.current) return;
    prevMsgRef.current = latestMessage;

    switch (latestMessage.type) {
      // --- Opponent submitted a valid word (or server-fired timeout) ---
      case "opponent:move": {
        const payload = latestMessage.payload;
        const word = adapter.extractOpponentWord(payload);
        if (word) {
          const upper = word.toUpperCase();
          setCurrentWord(upper);
          setUsedWords((prev) => [...prev, upper]);
          opponentWordsRef.current = [...opponentWordsRef.current, upper];
        }
        // Update lives — timedOutUserId is present on server-generated timeouts.
        // When present: route to myLives if I was the one who timed out,
        // or to opponentLives if the opponent timed out.
        if (payload !== null && typeof payload === "object") {
          const p = payload as { lives?: number; timedOutUserId?: number };
          if (typeof p.lives === "number") {
            const iServerTimedOutMe = p.timedOutUserId !== undefined && p.timedOutUserId === userId;
            if (iServerTimedOutMe) {
              // Server enforced a timeout on me (background tab / clock drift edge case)
              setMyLives(p.lives);
              if (p.lives <= 0 && !gameEndedRef.current) {
                gameEndedRef.current = true;
                sendWs({ type: "game:end" });
              }
              // It is now my opponent's turn — do NOT set isMyTurn=true below
              resetClockOnNextStartRef.current = true;
              setIsMyTurn(false);
            } else {
              setOpponentLives(p.lives);
              if (p.lives <= 0 && !gameEndedRef.current) {
                gameEndedRef.current = true;
                sendWs({ type: "game:end" });
              }
              // Fresh turn — clock resets to full
              resetClockOnNextStartRef.current = true;
              setIsMyTurn(true);
            }
            break;
          }
        }
        // Default: no lives field — normal opponent word submission
        resetClockOnNextStartRef.current = true;
        setIsMyTurn(true);
        break;
      }

      // --- Server rejected a move (e.g. dictionary miss) ---
      // Rollback optimistic state, deduct 0.5s, restore turn.
      // Exception: "not your turn" errors mean we are out-of-sync — do NOT
      // restore the turn, as that would give the player a turn they shouldn't
      // have (race between client timeout report and server turn advance).
      case "error": {
        const isOutOfTurnError =
          latestMessage.message?.toLowerCase().includes("not your turn");

        if (rollbackRef.current) {
          const { currentWord: prev, usedWords: prevUsed } = rollbackRef.current;
          myWordsRef.current = myWordsRef.current.slice(0, -1);
          setCurrentWord(prev);
          setUsedWords(prevUsed);
          rollbackRef.current = null;
        }
        setFeedback(latestMessage.message);

        if (isOutOfTurnError) {
          // Out-of-turn error: clear local turn state and wait for the server
          // to send opponent:move which will correctly grant us the next turn.
          stopTimer();
          setIsMyTurn(false);
        } else {
          // Normal rejection (wrong letter, duplicate, unknown word):
          // deduct 0.5s and resume timer so the player can try again.
          setTimerLeft((prev) => Math.max(0.5, prev - 0.5));
          resetClockOnNextStartRef.current = false; // preserve penalised timerLeft
          setIsMyTurn(true); // triggers useEffect → startTimer (no reset)
        }
        break;
      }

      // --- Authoritative game over — includes real ELO for all outcomes ---
      case "game:over":
        stopTimer();
        onGameOver({
          outcome: latestMessage.outcome,
          eloChange: latestMessage.eloChange,
          newElo: latestMessage.newElo,
          forfeitReason: forfeitReasonRef.current,
          myWords: [...myWordsRef.current],
          opponentWords: [...opponentWordsRef.current],
        });
        break;

      // --- Opponent disconnected: show overlay but keep playing your turn ---
      case "player:disconnect":
        setDisconnectDeadline(latestMessage.reconnectDeadlineMs);
        setDisconnectSecsLeft(
          Math.ceil((latestMessage.reconnectDeadlineMs - Date.now()) / 1000),
        );
        break;

      case "player:reconnect":
        setDisconnectDeadline(null);
        break;

      // --- Forfeit: show banner but defer to game:over for ELO ---
      case "player:forfeited":
        stopTimer();
        setForfeitPending(true);
        forfeitReasonRef.current = latestMessage.reason;
        // game:over will arrive next from the server with authoritative ELO data
        break;

      default:
        break;
    }
  }, [latestMessage, adapter, sendWs, userId, stopTimer, onGameOver]);

  // ── Disconnect countdown ───────────────────────────────────────────────────

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

      {/* Forfeit pending banner */}
      {forfeitPending && (
        <div
          className="rounded-lg border border-orange-400 bg-orange-50 dark:bg-orange-950/20 px-4 py-3 text-sm text-orange-700 dark:text-orange-300 flex items-center gap-2"
          data-testid="banner-forfeit"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          Opponent forfeited — calculating final results…
        </div>
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
                <Badge
                  variant="outline"
                  className="text-xs h-5 shrink-0"
                  data-testid="badge-opponent-turn"
                >
                  Their turn
                </Badge>
              )}
            </div>
            <Lives count={opponentLives} data-testid="lives-opponent" />
          </CardContent>
        </Card>
      </div>

      {/* Timer bar — only shown on my turn */}
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
            value={Math.min(100, timerPercent)}
            className={`h-2 ${timerLeft <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
            data-testid="progress-timer"
          />
        </div>
      )}

      {/* Game-specific display + input */}
      <Card>
        <CardContent className="py-4 px-5 space-y-3">
          {adapter.renderGameDisplay({ currentWord, usedWords, isMyTurn, opponentName })}
          {isMyTurn ? (
            adapter.renderInput({
              currentWord,
              usedWords,
              onSubmit: handleSubmit,
              onInvalidMove: applyTimePenalty,
              disabled: false,
              feedback,
              clearFeedback: () => setFeedback(null),
            })
          ) : (
            <div
              className="text-center text-sm text-muted-foreground py-2 flex items-center justify-center gap-2"
              data-testid="label-waiting-generic"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for {opponentName}…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shared used-words panel — visible to both players */}
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
