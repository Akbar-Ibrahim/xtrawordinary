// @refresh reset
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/user-avatar";
import { Timer, WifiOff, Loader2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";
import type { DuelGameAdapter, GameResult } from "@/components/duel-turn-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DuelRaceEngineInitialState {
  myCount: number;
  opponentCount: number;
  myWords: string[];
  opponentWords: string[];
  raceTimeLimitMs: number;
}

export interface DuelRaceEngineProps {
  userId: number;
  opponentId: number | null;
  opponentName: string;
  opponentAvatarUrl: string | null;
  myName: string;
  myAvatarUrl: string | null;
  raceTarget: number;
  initialState: DuelRaceEngineInitialState;
  sendWs: (msg: DuelClientMessage) => void;
  latestMessage: DuelServerMessage | null;
  onGameOver: (result: GameResult) => void;
  adapter: DuelGameAdapter;
  startWord: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DuelRaceEngine({
  userId,
  opponentId,
  opponentName,
  opponentAvatarUrl,
  myName,
  myAvatarUrl,
  raceTarget,
  initialState,
  sendWs,
  latestMessage,
  onGameOver,
  adapter,
  startWord,
}: DuelRaceEngineProps) {
  const [myCount, setMyCount] = useState(initialState.myCount);
  const [opponentCount, setOpponentCount] = useState(initialState.opponentCount);
  const myCountRef = useRef(initialState.myCount);
  const opponentCountRef = useRef(initialState.opponentCount);
  const [myWords, setMyWords] = useState<string[]>(initialState.myWords);
  const [opponentWords, setOpponentWords] = useState<string[]>(initialState.opponentWords);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [disconnectSecsLeft, setDisconnectSecsLeft] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(initialState.raceTimeLimitMs);

  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevMsgRef = useRef<DuelServerMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());
  /** Track the last optimistically appended word so we can roll it back on server error. */
  const pendingWordRef = useRef<string | null>(null);

  // Countdown timer display
  useEffect(() => {
    if (done || initialState.raceTimeLimitMs <= 0) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, initialState.raceTimeLimitMs - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [done, initialState.raceTimeLimitMs]);

  // Process server messages
  useEffect(() => {
    if (!latestMessage || latestMessage === prevMsgRef.current) return;
    prevMsgRef.current = latestMessage;

    const msg = latestMessage;

    switch (msg.type) {
      case "race:progress": {
        if (msg.userId === userId) {
          setMyCount(msg.count);
          myCountRef.current = msg.count;
          // Server confirmed the move — clear pending so rollback won't fire
          pendingWordRef.current = null;
        } else {
          setOpponentCount(msg.count);
          opponentCountRef.current = msg.count;
        }
        break;
      }

      case "game:over": {
        if (done) break;
        setDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
        const myW = myWords;
        const oppW = opponentWords;
        onGameOver({
          outcome: msg.outcome,
          eloChange: msg.eloChange ?? 0,
          newElo: msg.newElo ?? 1000,
          myWords: myW,
          opponentWords: oppW,
          myFinalCount: myCountRef.current,
          opponentFinalCount: opponentCountRef.current,
        });
        break;
      }

      case "player:forfeited": {
        if (done) break;
        setDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
        onGameOver({
          outcome: "forfeit",
          eloChange: 0,
          newElo: 0,
          forfeitReason: "manual",
          myWords,
          opponentWords,
        });
        break;
      }

      case "player:disconnect": {
        if (msg.reconnectDeadlineMs <= 0) break;
        const secsLeft = Math.ceil(msg.reconnectDeadlineMs / 1000);
        setDisconnectSecsLeft(secsLeft);
        if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = setInterval(() => {
          setDisconnectSecsLeft((s) => {
            if (s === null || s <= 1) {
              if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
              return null;
            }
            return s - 1;
          });
        }, 1000);
        break;
      }

      case "player:reconnect": {
        setDisconnectSecsLeft(null);
        if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
        break;
      }

      case "error": {
        // Rollback any optimistic word append that the server rejected
        if (pendingWordRef.current !== null) {
          const rejected = pendingWordRef.current;
          pendingWordRef.current = null;
          setMyWords((prev) => {
            const idx = prev.lastIndexOf(rejected);
            if (idx === -1) return prev;
            return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
          });
        }
        setFeedback(msg.message);
        setTimeout(() => setFeedback(null), 3000);
        break;
      }

      default:
        break;
    }
  }, [latestMessage]);

  // Cleanup
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
  }, []);

  const handleSubmit = useCallback((word: string) => {
    if (done) return;
    const upper = word.toUpperCase().trim();
    if (!upper) return;

    // Client-side validation
    const err = adapter.validateMoveClient(upper, startWord, myWords);
    if (err) {
      setFeedback(err);
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    // Optimistic update (track pending so we can roll back on server error)
    pendingWordRef.current = upper;
    setMyWords((prev) => [...prev, upper]);
    setFeedback(null);

    sendWs({ type: "game:move", payload: { type: "word", word: upper } });
  }, [done, adapter, startWord, myWords, sendWs]);

  const formatTime = (ms: number) => {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const myPct = Math.min(100, (myCount / raceTarget) * 100);
  const oppPct = Math.min(100, (opponentCount / raceTarget) * 100);
  const timePct = initialState.raceTimeLimitMs > 0
    ? Math.min(100, (timeLeft / initialState.raceTimeLimitMs) * 100)
    : 100;

  return (
    <div className="space-y-3">
      {/* Disconnect overlay */}
      {disconnectSecsLeft !== null && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 p-3 flex items-center gap-3 text-sm"
        >
          <WifiOff className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="text-yellow-800 dark:text-yellow-300">
            Opponent disconnected — waiting for reconnect ({disconnectSecsLeft}s)
          </span>
          <Loader2 className="h-4 w-4 animate-spin ml-auto text-yellow-600" />
        </motion.div>
      )}

      {/* Race header: timer + target */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Race to {raceTarget} words</span>
            </div>
            {initialState.raceTimeLimitMs > 0 && (
              <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${timePct < 20 ? "text-destructive" : "text-muted-foreground"}`}>
                <Timer className="h-3.5 w-3.5" />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
          {initialState.raceTimeLimitMs > 0 && (
            <Progress
              value={timePct}
              className={`h-1.5 ${timePct < 20 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
            />
          )}
        </CardContent>
      </Card>

      {/* Player progress bars */}
      <div className="grid grid-cols-2 gap-3">
        {/* Me */}
        <Card>
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex items-center gap-2">
              <UserAvatar name={myName} avatarUrl={myAvatarUrl} className="h-6 w-6 text-xs" />
              <span className="text-xs font-medium truncate max-w-[80px]">{myName}</span>
              <Badge variant="secondary" className="ml-auto text-xs tabular-nums" data-testid="text-my-count">
                {myCount}/{raceTarget}
              </Badge>
            </div>
            <Progress value={myPct} className="h-2 [&>div]:bg-green-500" />
          </CardContent>
        </Card>
        {/* Opponent */}
        <Card>
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex items-center gap-2">
              <UserAvatar name={opponentName} avatarUrl={opponentAvatarUrl} className="h-6 w-6 text-xs" />
              <span className="text-xs font-medium truncate max-w-[80px]">{opponentName || "Opponent"}</span>
              <Badge variant="outline" className="ml-auto text-xs tabular-nums" data-testid="text-opp-count">
                {opponentCount}/{raceTarget}
              </Badge>
            </div>
            <Progress value={oppPct} className="h-2 [&>div]:bg-blue-500" />
          </CardContent>
        </Card>
      </div>

      {/* Game display (constraint) */}
      <Card>
        <CardContent className="py-4 px-4">
          {adapter.renderGameDisplay({
            currentWord: startWord,
            usedWords: myWords,
            isMyTurn: true,
            opponentName,
          })}
        </CardContent>
      </Card>

      {/* Input */}
      <Card>
        <CardContent className="py-4 px-4">
          {adapter.renderInput({
            currentWord: startWord,
            usedWords: myWords,
            onSubmit: handleSubmit,
            onInvalidMove: () => {},
            disabled: done,
            feedback,
            clearFeedback: () => setFeedback(null),
          })}
        </CardContent>
      </Card>

      {/* My word list */}
      {myWords.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Your words ({myWords.length})</p>
          <div className="flex flex-wrap gap-1">
            {myWords.map((w, i) => (
              <Badge key={i} variant="secondary" className="font-mono text-xs" data-testid={`word-race-mine-${i}`}>
                {w}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Forfeit */}
      {!done && (
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive text-xs"
            onClick={() => sendWs({ type: "game:forfeit" })}
            data-testid="button-forfeit"
          >
            Forfeit
          </Button>
        </div>
      )}
    </div>
  );
}
