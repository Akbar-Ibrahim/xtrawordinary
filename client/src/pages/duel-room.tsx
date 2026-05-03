import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/user-avatar";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trophy, ArrowLeft, Loader2, WifiOff, Swords } from "lucide-react";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";
import { DuelTurnEngine } from "@/components/duel-turn-engine";
import type { GameResult, DuelTurnEngineInitialState } from "@/components/duel-turn-engine";
import { wordChainDuelAdapter } from "@/components/games/word-chain-duel-adapter";
import { letterHuntDuelAdapter } from "@/components/games/letter-hunt-duel-adapter";
import { wordLengthDuelAdapter } from "@/components/games/word-length-duel-adapter";
import { letterFrequencyDuelAdapter } from "@/components/games/letter-frequency-duel-adapter";
import type { DuelGameAdapter } from "@/components/duel-turn-engine";

function getAdapterForSlug(gameSlug: string): DuelGameAdapter {
  switch (gameSlug) {
    case "letter-hunt":      return letterHuntDuelAdapter;
    case "word-length":      return wordLengthDuelAdapter;
    case "letter-frequency": return letterFrequencyDuelAdapter;
    default:                 return wordChainDuelAdapter;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "connecting"
  | "lobby"
  | "waiting"
  | "countdown"
  | "playing"
  | "over"
  | "error";

interface RoomInfo {
  gameSlug: string;
  seed: number;
  startWord: string;
  challengerId: number;
  challengeeId: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DuelRoom() {
  const [, params] = useRoute("/duel/:roomCode");
  const roomCode = (params?.roomCode ?? "").toUpperCase();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Server-issued startAt timestamp (epoch ms) for clock-aligned countdown display
  const countdownStartAtRef = useRef<number | null>(null);

  // ── Phase & connection state ────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  // Ref keeps handleServerMessage from capturing a stale phase value
  const phaseRef = useRef<Phase>("connecting");

  // ── Room / opponent metadata ────────────────────────────────────────────────
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null);
  // ── Waiting room ready state ────────────────────────────────────────────────
  const [meReady, setMeReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  // ── DuelTurnEngine initial state (set on first play or reconnect) ───────────
  const [engineKey, setEngineKey] = useState(0); // bump to remount engine on reconnect
  const [engineInitState, setEngineInitState] = useState<DuelTurnEngineInitialState | null>(null);

  // ── Game result (shown in 'over' phase) ────────────────────────────────────
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  // ── Latest message for DuelTurnEngine ──────────────────────────────────────
  const [latestGameMessage, setLatestGameMessage] = useState<DuelServerMessage | null>(null);

  // ── REST query for room metadata ───────────────────────────────────────────
  const { data: roomInfo, error: roomFetchError } = useQuery<RoomInfo, Error>({
    queryKey: ["/api/duels/rooms", roomCode],
    queryFn: async () => {
      const res = await fetch(`/api/duels/rooms/${roomCode}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Room not found");
      }
      return res.json();
    },
    enabled: !!roomCode && isAuthenticated,
    retry: false,
  });

  // Transition to terminal error UI if room fetch fails (404/403/410)
  useEffect(() => {
    if (roomFetchError) {
      setErrorMsg(roomFetchError.message);
      setPhase("error");
    }
  }, [roomFetchError]);

  // Keep phaseRef current so handleServerMessage never sees a stale phase
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const sendWs = useCallback((msg: DuelClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // ── Handle server messages ─────────────────────────────────────────────────
  const handleServerMessage = useCallback(
    (msg: DuelServerMessage) => {
      switch (msg.type) {
        // ── Room-phase messages ──────────────────────────────────────────────
        case "room:joined":
          // opponentId/Name may be null when the challenger joins first (no opponent yet).
          // A second room:joined arrives when the opponent joins, filling in their details.
          // When opponent fields are null (first join / fresh room), explicitly reset any
          // stale opponent state so navigating between rooms never shows leftover identity.
          if (msg.opponentId !== null) {
            setOpponentId(msg.opponentId);
          } else {
            setOpponentId(null);
            setOpponentName("");
            setOpponentAvatarUrl(null);
            setOpponentReady(false);
          }
          if (msg.opponentName !== null) setOpponentName(msg.opponentName);
          setOpponentAvatarUrl(msg.opponentAvatarUrl);
          setPhase("waiting");
          break;

        case "room:player_ready":
          setOpponentReady(true);
          break;

        case "room:state":
          // Reconnect snapshot — restore full game state including per-player word history.
          // IMPORTANT: clear latestGameMessage BEFORE bumping engineKey so the new engine
          // instance never sees the pre-reconnect message on its first render cycle.
          // Without this, the remounted engine (prevMsgRef=null) would immediately
          // re-process the last stale message, duplicating opponent:move side-effects
          // (wrong turn, duplicate used word, incorrect life count).
          setLatestGameMessage(null);
          setOpponentId(msg.opponentId);
          setOpponentName(msg.opponentName);
          setOpponentAvatarUrl(msg.opponentAvatarUrl);
          setEngineInitState({
            currentWord: msg.currentWord,
            usedWords: msg.usedWords,
            isMyTurn: msg.isMyTurn,
            myLives: msg.myLives,
            opponentLives: msg.opponentLives,
            myWords: msg.myWords,
            opponentWords: msg.opponentWords,
          });
          setEngineKey((k) => k + 1); // remount engine with restored state
          setPhase("playing");
          break;

        case "room:ready":
          // Store server's startAt for clock-aligned countdown display
          countdownStartAtRef.current = msg.startAt;
          setPhase("countdown");
          break;

        case "room:countdown": {
          // Derive display number from server's startAt when available for
          // accurate sync under network latency rather than raw server ticks.
          const displayNum = countdownStartAtRef.current
            ? Math.max(1, Math.ceil((countdownStartAtRef.current - Date.now()) / 1000))
            : msg.secondsLeft;
          setCountdownNum(displayNum);
          if (msg.secondsLeft === 1) {
            // Schedule playing-phase transition based on actual time remaining
            const msToPlay = countdownStartAtRef.current
              ? Math.max(0, countdownStartAtRef.current - Date.now())
              : 1000;
            const t = setTimeout(() => {
              setCountdownNum(null);
              setPhase("playing");
            }, msToPlay);
            countdownTimeoutRef.current = t;
          }
          break;
        }

        case "error":
          // During active play forward to the engine so it can rollback the
          // optimistic word update, apply the 0.5s time penalty, and restore turn.
          // Read phaseRef (not closed-over phase) so we always see the live value.
          if (phaseRef.current === "playing") {
            setLatestGameMessage(msg);
          } else if (
            phaseRef.current === "connecting" ||
            phaseRef.current === "lobby" ||
            phaseRef.current === "waiting"
          ) {
            // Terminal pre-game error (e.g. completed/declined challenge) — show error screen
            setErrorMsg(msg.message);
            setPhase("error");
          } else {
            toast({ title: "Duel error", description: msg.message, variant: "destructive" });
          }
          break;

        // ── Game-phase messages → forwarded to DuelTurnEngine ────────────────
        case "opponent:move":
        case "player:reconnect":
        case "player:forfeited":
        case "game:over":
          setLatestGameMessage(msg);
          break;

        case "challenge:cancelled":
          // Server closed the room because the challengee declined/cancelled/expired.
          // Show a clear error so the challenger doesn't see a stale waiting room.
          setErrorMsg(
            msg.reason === "declined"
              ? "Your friend declined the duel challenge."
              : msg.reason === "cancelled"
              ? "The duel challenge was cancelled."
              : "The duel challenge has expired.",
          );
          setPhase("error");
          break;

        case "player:disconnect":
          // reconnectDeadlineMs=0 means the opponent left before the game began
          // (waiting or countdown phase). Reset ALL opponent presence + readiness
          // so the UI returns to a true "waiting for opponent" state.
          if (msg.reconnectDeadlineMs === 0) {
            if (countdownTimeoutRef.current !== null) {
              clearTimeout(countdownTimeoutRef.current);
              countdownTimeoutRef.current = null;
            }
            setOpponentId(null);
            setOpponentName("");
            setOpponentAvatarUrl(null);
            setOpponentReady(false);
            setMeReady(false);
            setCountdownNum(null);
            setPhase("waiting");
          } else {
            // In-game disconnect: pass to DuelTurnEngine to show reconnect overlay
            setLatestGameMessage(msg);
          }
          break;
      }
    },
    [toast],
  );

  // ── Set initial engine state when room info + phase arrive ─────────────────
  useEffect(() => {
    if (phase === "playing" && roomInfo && user && !engineInitState) {
      const isFirst = user.id === roomInfo.challengerId;
      const isWordChain = roomInfo.gameSlug === "word-chain";
      setEngineInitState({
        currentWord: roomInfo.startWord,
        usedWords: isWordChain ? [roomInfo.startWord.toUpperCase()] : [],
        isMyTurn: isFirst,
        myLives: 3,
        opponentLives: 3,
      });
    }
  }, [phase, roomInfo, user, engineInitState]);

  // ── WebSocket setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !roomCode || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/duel`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      sendWs({ type: "room:join", roomCode });
      setPhase("lobby");
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: DuelServerMessage;
      try {
        msg = JSON.parse(event.data as string) as DuelServerMessage;
      } catch {
        return;
      }
      handleServerMessage(msg);
    };

    ws.onerror = () => {
      setPhase("error");
      setErrorMsg("Connection error. Please try again.");
    };

    ws.onclose = () => {
      setPhase((current) => {
        if (current !== "over" && current !== "error") {
          setErrorMsg("Disconnected from server.");
          return "error";
        }
        return current;
      });
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomCode, isAuthenticated, user?.id]);

  const handleReady = () => {
    setMeReady(true);
    sendWs({ type: "room:ready" });
  };

  const handleGameOver = useCallback(
    (result: GameResult) => {
      setGameResult(result);
      setPhase("over");
    },
    [],
  );

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Swords className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sign in to join a duel.</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/friends">
        <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Friends
        </Button>
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Swords className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Word Chain Duel</h1>
        {roomCode && (
          <Badge variant="outline" className="font-mono text-xs ml-auto" data-testid="text-room-code">
            {roomCode}
          </Badge>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Connecting / Lobby ─────────────────────────────────────────── */}
        {(phase === "connecting" || phase === "lobby") && (
          <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="py-16 text-center space-y-4">
                <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                <p className="text-muted-foreground">Connecting to duel room…</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-destructive">
              <CardContent className="py-12 text-center space-y-4">
                <WifiOff className="h-12 w-12 mx-auto text-destructive" />
                <p className="font-semibold text-destructive">{errorMsg || "Connection failed"}</p>
                <Link href="/friends">
                  <Button variant="outline">Go to Friends</Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Waiting Room ──────────────────────────────────────────────── */}
        {phase === "waiting" && (
          <motion.div key="waiting" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="py-8 space-y-6">
                <p className="text-center text-muted-foreground text-sm font-medium uppercase tracking-wide">
                  Waiting Room
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50" data-testid="card-player-me">
                    <UserAvatar name={user?.name ?? "You"} avatarUrl={user?.avatarUrl} className="h-14 w-14 text-lg" />
                    <p className="font-semibold text-sm text-center truncate max-w-full">{user?.name ?? "You"}</p>
                    {meReady
                      ? <Badge className="bg-green-500 text-white text-xs" data-testid="badge-me-ready">Ready!</Badge>
                      : <Badge variant="secondary" className="text-xs">Waiting…</Badge>
                    }
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50" data-testid="card-player-opponent">
                    {opponentName ? (
                      <>
                        <UserAvatar name={opponentName} avatarUrl={opponentAvatarUrl} className="h-14 w-14 text-lg" />
                        <p className="font-semibold text-sm text-center truncate max-w-full">{opponentName}</p>
                        {opponentReady
                          ? <Badge className="bg-green-500 text-white text-xs" data-testid="badge-opponent-ready">Ready!</Badge>
                          : <Badge variant="secondary" className="text-xs" data-testid="badge-opponent-status">In Room</Badge>
                        }
                      </>
                    ) : (
                      <>
                        <div className="h-14 w-14 rounded-full bg-muted animate-pulse" />
                        <p className="text-sm text-muted-foreground">Waiting for opponent…</p>
                      </>
                    )}
                  </div>
                </div>
                {!meReady ? (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                    onClick={handleReady}
                    disabled={!opponentName}
                    data-testid="button-ready"
                  >
                    <Heart className="h-4 w-4" />
                    {opponentName ? "I'm Ready!" : "Waiting for opponent to join…"}
                  </Button>
                ) : (
                  <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for opponent to get ready…
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Countdown ─────────────────────────────────────────────────── */}
        {phase === "countdown" && (
          <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="py-24 text-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={countdownNum ?? "go"}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <p className="text-9xl font-black text-primary" data-testid="text-countdown">
                      {countdownNum ?? "GO!"}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Playing ───────────────────────────────────────────────────── */}
        {phase === "playing" && engineInitState && (
          <motion.div key="playing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <DuelTurnEngine
              key={engineKey}
              userId={user?.id ?? 0}
              opponentId={opponentId}
              opponentName={opponentName}
              opponentAvatarUrl={opponentAvatarUrl}
              myName={user?.name ?? "You"}
              myAvatarUrl={user?.avatarUrl ?? null}
              initialState={engineInitState}
              sendWs={sendWs}
              latestMessage={latestGameMessage}
              onGameOver={handleGameOver}
              adapter={getAdapterForSlug(roomInfo?.gameSlug ?? "word-chain")}
            />
          </motion.div>
        )}

        {/* ── Game Over ─────────────────────────────────────────────────── */}
        {phase === "over" && gameResult && (
          <motion.div key="over" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className={
              gameResult.outcome === "you_win" || gameResult.outcome === "forfeit"
                ? "border-yellow-400"
                : gameResult.outcome === "draw"
                ? "border-blue-400"
                : "border-muted"
            }>
              <CardContent className="py-10 space-y-6">
                {/* Winner banner */}
                <div className="text-center space-y-2">
                  <Trophy className={`h-14 w-14 mx-auto ${
                    gameResult.outcome === "you_win" || gameResult.outcome === "forfeit"
                      ? "text-yellow-500"
                      : "text-muted-foreground"
                  }`} />
                  <h2 className="text-3xl font-black" data-testid="text-outcome">
                    {gameResult.outcome === "you_win"
                      ? "You Win! 🎉"
                      : gameResult.outcome === "you_lose"
                      ? "You Lose"
                      : gameResult.outcome === "draw"
                      ? "It's a Draw"
                      : "Forfeit Victory 🎉"}
                  </h2>
                  {(gameResult.outcome === "forfeit") && (
                    <p className="text-sm text-muted-foreground">
                      Your opponent{" "}
                      {gameResult.forfeitReason === "disconnect" ? "disconnected" : "forfeited"}.
                    </p>
                  )}
                </div>

                {/* ELO delta */}
                <div className="flex justify-center gap-8">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">ELO change</p>
                    <p
                      className={`text-2xl font-bold ${
                        gameResult.eloChange > 0
                          ? "text-green-600"
                          : gameResult.eloChange < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }`}
                      data-testid="text-elo-change"
                    >
                      {gameResult.eloChange > 0 ? `+${gameResult.eloChange}` : gameResult.eloChange}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">New ELO</p>
                    <p className="text-2xl font-bold" data-testid="text-new-elo">
                      {gameResult.newElo}
                    </p>
                  </div>
                </div>

                {/* Both players' word lists */}
                {(gameResult.myWords.length > 0 || gameResult.opponentWords.length > 0) && (
                  <div className="grid grid-cols-2 gap-3" data-testid="section-word-lists">
                    {/* My words */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Your words ({gameResult.myWords.length})
                      </p>
                      <div
                        className="flex flex-wrap gap-1 max-h-32 overflow-y-auto"
                        data-testid="list-my-words"
                      >
                        {gameResult.myWords.length > 0 ? (
                          gameResult.myWords.map((w, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-xs font-mono"
                              data-testid={`word-mine-${i}`}
                            >
                              {w}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic">None</p>
                        )}
                      </div>
                    </div>
                    {/* Opponent words */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {opponentName || "Opponent"}'s words ({gameResult.opponentWords.length})
                      </p>
                      <div
                        className="flex flex-wrap gap-1 max-h-32 overflow-y-auto"
                        data-testid="list-opponent-words"
                      >
                        {gameResult.opponentWords.length > 0 ? (
                          gameResult.opponentWords.map((w, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-xs font-mono"
                              data-testid={`word-opponent-${i}`}
                            >
                              {w}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic">None</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-center pt-1">
                  <Link href="/friends">
                    <Button variant="outline" data-testid="button-back-friends">Back to Friends</Button>
                  </Link>
                  <Link href="/games/word-chain">
                    <Button data-testid="button-play-again">Play Word Chain</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
