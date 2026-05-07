import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useSound } from "@/lib/sound-provider";
import { UserAvatar } from "@/components/user-avatar";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trophy, ArrowLeft, Loader2, WifiOff, Swords, Eye } from "lucide-react";
import { recordDuelResult } from "@/lib/game-stats";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";
import { DuelTurnEngine } from "@/components/duel-turn-engine";
import type { GameResult, DuelTurnEngineInitialState } from "@/components/duel-turn-engine";
import { DuelRaceEngine } from "@/components/duel-race-engine";
import type { DuelRaceEngineInitialState } from "@/components/duel-race-engine";
import { wordChainDuelAdapter } from "@/components/games/word-chain-duel-adapter";
import { ladderRushDuelAdapter, ladderRushDoubleDuelAdapter } from "@/components/games/ladder-rush-duel-adapter";
import { letterHuntDuelAdapter } from "@/components/games/letter-hunt-duel-adapter";
import { wordLengthDuelAdapter } from "@/components/games/word-length-duel-adapter";
import { letterFrequencyDuelAdapter } from "@/components/games/letter-frequency-duel-adapter";
import { letterPositionDuelAdapter } from "@/components/games/letter-position-duel-adapter";
import { letterBalanceDuelAdapter } from "@/components/games/letter-balance-duel-adapter";
import {
  wordScrambleRaceAdapter,
  noRepeatsRaceAdapter,
  anagramSolverRaceAdapter,
  wordStackRaceAdapter,
  letterPoolRaceAdapter,
  wordMakerRaceAdapter,
  wordSplitRaceAdapter,
  definitionMatchRaceAdapter,
} from "@/components/race-adapters";
import type { DuelGameAdapter } from "@/components/duel-turn-engine";

function getAdapterForSlug(gameSlug: string): DuelGameAdapter {
  switch (gameSlug) {
    case "letter-hunt":           return letterHuntDuelAdapter;
    case "word-length":           return wordLengthDuelAdapter;
    case "letter-frequency":      return letterFrequencyDuelAdapter;
    case "letter-position":       return letterPositionDuelAdapter;
    case "letter-balance":        return letterBalanceDuelAdapter;
    case "word-scramble":         return wordScrambleRaceAdapter;
    case "no-repeats":            return noRepeatsRaceAdapter;
    case "anagram-solver":        return anagramSolverRaceAdapter;
    case "word-stack":            return wordStackRaceAdapter;
    case "letter-pool":           return letterPoolRaceAdapter;
    case "word-maker":            return wordMakerRaceAdapter;
    case "word-split":            return wordSplitRaceAdapter;
    case "definition-match":      return definitionMatchRaceAdapter;
    case "ladder-rush-4":
    case "ladder-rush-5":
    case "ladder-rush-6":         return ladderRushDuelAdapter;
    case "ladder-rush-double-4":
    case "ladder-rush-double-5":
    case "ladder-rush-double-6":  return ladderRushDoubleDuelAdapter;
    default:                      return wordChainDuelAdapter;
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
  format?: "turn" | "race";
  raceTarget?: number;
  raceTimeLimitMs?: number;
}

interface SpectatorState {
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

const REACT_EMOJIS = ["👀", "🔥", "😬", "❤️", "👏"] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function DuelRoom() {
  const [, params] = useRoute("/duel/:roomCode");
  const roomCode = (params?.roomCode ?? "").toUpperCase();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { playSound } = useSound();

  const wsRef = useRef<WebSocket | null>(null);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownStartAtRef = useRef<number | null>(null);
  const handleServerMessageRef = useRef<(msg: DuelServerMessage) => void>(() => {});

  // ── Phase & connection state ────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const phaseRef = useRef<Phase>("connecting");

  // ── Room / opponent metadata ────────────────────────────────────────────────
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null);

  // ── Race format metadata (set from WS messages) ─────────────────────────────
  const [roomFormat, setRoomFormat] = useState<"turn" | "race">("turn");
  const [raceTarget, setRaceTarget] = useState(15);
  const [raceTimeLimitMs, setRaceTimeLimitMs] = useState(300_000);

  // ── Waiting room ready state ────────────────────────────────────────────────
  const [meReady, setMeReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  // ── DuelTurnEngine initial state ────────────────────────────────────────────
  const [engineKey, setEngineKey] = useState(0);
  const [engineInitState, setEngineInitState] = useState<DuelTurnEngineInitialState | null>(null);

  // ── DuelRaceEngine initial state ────────────────────────────────────────────
  const [raceEngineKey, setRaceEngineKey] = useState(0);
  const [raceInitState, setRaceInitState] = useState<DuelRaceEngineInitialState | null>(null);

  // ── Game result (shown in 'over' phase) ────────────────────────────────────
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [rematchPending, setRematchPending] = useState(false);

  // ── Latest message for engines ──────────────────────────────────────────────
  const [latestGameMessage, setLatestGameMessage] = useState<DuelServerMessage | null>(null);

  // ── Spectator state ─────────────────────────────────────────────────────────
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectatorData, setSpectatorData] = useState<SpectatorState | null>(null);
  const [spectatorWinner, setSpectatorWinner] = useState<string | null>(null);
  const [reactionFlash, setReactionFlash] = useState<string | null>(null);
  const [wsReady, setWsReady] = useState(false);

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

  useEffect(() => {
    if (roomFetchError) {
      setErrorMsg(roomFetchError.message);
      setPhase("error");
    }
  }, [roomFetchError]);

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
        case "room:joined":
          if (msg.opponentId !== null) {
            setOpponentId((prev) => {
              if (prev === null && phaseRef.current === "waiting") {
                toast({
                  title: "Opponent has arrived!",
                  description: `${msg.opponentName ?? "Your opponent"} just joined — get ready!`,
                  duration: 4000,
                });
                playSound("notify");
              }
              return msg.opponentId;
            });
          } else {
            setOpponentId(null);
            setOpponentName("");
            setOpponentAvatarUrl(null);
            setOpponentReady(false);
          }
          if (msg.opponentName !== null) setOpponentName(msg.opponentName);
          setOpponentAvatarUrl(msg.opponentAvatarUrl);
          if (msg.format) setRoomFormat(msg.format);
          if (msg.raceTarget) setRaceTarget(msg.raceTarget);
          if (msg.raceTimeLimitMs) setRaceTimeLimitMs(msg.raceTimeLimitMs);
          setPhase("waiting");
          break;

        case "room:player_ready":
          setOpponentReady(true);
          break;

        case "room:state": {
          setLatestGameMessage(null);
          setOpponentId(msg.opponentId);
          setOpponentName(msg.opponentName);
          setOpponentAvatarUrl(msg.opponentAvatarUrl);
          const fmt = msg.format ?? "turn";
          setRoomFormat(fmt);
          if (msg.raceTarget) setRaceTarget(msg.raceTarget);
          if (msg.raceTimeLimitMs) setRaceTimeLimitMs(msg.raceTimeLimitMs);

          if (fmt === "race") {
            setRaceInitState({
              myCount: msg.myCount ?? 0,
              opponentCount: msg.opponentCount ?? 0,
              myWords: msg.myWords ?? [],
              opponentWords: msg.opponentWords ?? [],
              raceTimeLimitMs: msg.raceTimeLimitMs ?? 300_000,
            });
            setRaceEngineKey((k) => k + 1);
          } else {
            setEngineInitState({
              currentWord: msg.currentWord,
              usedWords: msg.usedWords,
              isMyTurn: msg.isMyTurn,
              myLives: msg.myLives,
              opponentLives: msg.opponentLives,
              myWords: msg.myWords,
              opponentWords: msg.opponentWords,
            });
            setEngineKey((k) => k + 1);
          }
          setPhase("playing");
          break;
        }

        case "room:ready":
          countdownStartAtRef.current = msg.startAt;
          if (msg.format) setRoomFormat(msg.format);
          if (msg.raceTarget) setRaceTarget(msg.raceTarget);
          if (msg.raceTimeLimitMs) setRaceTimeLimitMs(msg.raceTimeLimitMs);
          setPhase("countdown");
          break;

        case "room:countdown": {
          const displayNum = countdownStartAtRef.current
            ? Math.max(1, Math.ceil((countdownStartAtRef.current - Date.now()) / 1000))
            : msg.secondsLeft;
          setCountdownNum(displayNum);
          playSound("tick");
          if (msg.secondsLeft === 1) {
            const msToPlay = countdownStartAtRef.current
              ? Math.max(0, countdownStartAtRef.current - Date.now())
              : 1000;
            const t = setTimeout(() => {
              setCountdownNum(null);
              setPhase("playing");
              playSound("countdown");
            }, msToPlay);
            countdownTimeoutRef.current = t;
          }
          break;
        }

        case "error":
          if (phaseRef.current === "playing") {
            setLatestGameMessage(msg);
          } else if (
            phaseRef.current === "connecting" ||
            phaseRef.current === "lobby" ||
            phaseRef.current === "waiting"
          ) {
            setErrorMsg(msg.message);
            setPhase("error");
          } else {
            toast({ title: "Duel error", description: msg.message, variant: "destructive" });
          }
          break;

        case "race:progress":
          // Update spectator live counts when watching
          setSpectatorData((prev) => {
            if (!prev) return prev;
            if (msg.userId === prev.player1Id) return { ...prev, count1: msg.count };
            if (msg.userId === prev.player2Id) return { ...prev, count2: msg.count };
            return prev;
          });
          setLatestGameMessage(msg);
          break;

        case "opponent:move":
          // Update spectator lives from turn-based timeout payloads
          setSpectatorData((prev) => {
            if (!prev) return prev;
            const payload = msg.payload as Record<string, unknown> | null;
            if (payload && payload.type === "timeout" && typeof payload.lives === "number") {
              // The move came from the opponent of whoever we're tracking — find which player it's from
              // We can't tell which player sent it here, but lives will be corrected server-side.
            }
            return prev;
          });
          setLatestGameMessage(msg);
          break;

        case "player:reconnect":
          toast({
            title: "Opponent reconnected",
            description: `${opponentName || "Your opponent"} is back — game resuming!`,
            duration: 4000,
          });
          setLatestGameMessage(msg);
          break;

        case "player:forfeited":
        case "game:over":
          setLatestGameMessage(msg);
          break;

        case "spectator:joined":
          setSpectatorData({
            player1Id: msg.player1Id,
            player1Name: msg.player1Name,
            player1AvatarUrl: msg.player1AvatarUrl,
            player2Id: msg.player2Id,
            player2Name: msg.player2Name,
            player2AvatarUrl: msg.player2AvatarUrl,
            gameSlug: msg.gameSlug,
            format: msg.format,
            raceTarget: msg.raceTarget,
            count1: msg.count1,
            count2: msg.count2,
            lives1: msg.lives1,
            lives2: msg.lives2,
          });
          setRaceTarget(msg.raceTarget);
          setSpectatorCount(msg.spectatorCount);
          setPhase("playing");
          break;

        case "spectator:count":
          setSpectatorCount(msg.count);
          break;

        case "spectator:reaction":
          setReactionFlash(msg.emoji);
          setTimeout(() => setReactionFlash(null), 1200);
          break;

        case "spectator:game_over":
          setSpectatorWinner(msg.winnerName);
          setPhase("over");
          break;

        case "challenge:cancelled":
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
          if (msg.reconnectDeadlineMs === 0) {
            toast({
              title: "Opponent forfeited",
              description: `${opponentName || "Your opponent"} forfeited the match.`,
              duration: 5000,
            });
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
            const seconds = Math.round(msg.reconnectDeadlineMs / 1000);
            toast({
              title: "Opponent disconnected",
              description: `${opponentName || "Your opponent"} disconnected — they have ${seconds} second${seconds !== 1 ? "s" : ""} to reconnect.`,
              duration: Math.max(3000, Math.min(msg.reconnectDeadlineMs, 8000)),
            });
            setLatestGameMessage(msg);
          }
          break;
      }
    },
    [toast, playSound, opponentName],
  );

  useEffect(() => {
    handleServerMessageRef.current = handleServerMessage;
  }, [handleServerMessage]);

  // ── Set initial engine state when room info + phase arrive (fresh start) ────
  useEffect(() => {
    if (phase === "playing" && roomInfo && user) {
      const fmt = roomInfo.format ?? "turn";
      if (fmt === "race" && !raceInitState) {
        setRaceInitState({
          myCount: 0,
          opponentCount: 0,
          myWords: [],
          opponentWords: [],
          raceTimeLimitMs: roomInfo.raceTimeLimitMs ?? 300_000,
        });
      } else if (fmt === "turn" && !engineInitState) {
        const isFirst = user.id === roomInfo.challengerId;
        const isWordChain = roomInfo.gameSlug === "word-chain";
        const isLadderRush = roomInfo.gameSlug.startsWith("ladder-rush");
        setEngineInitState({
          currentWord: roomInfo.startWord,
          usedWords: (isWordChain || isLadderRush) ? [roomInfo.startWord.toUpperCase()] : [],
          isMyTurn: isFirst,
          myLives: 3,
          opponentLives: 3,
        });
      }
    }
  }, [phase, roomInfo, user, engineInitState, raceInitState]);

  // ── WebSocket setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !roomCode || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/duel`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsReady(true);
      setPhase("lobby");
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: DuelServerMessage;
      try {
        msg = JSON.parse(event.data as string) as DuelServerMessage;
      } catch {
        return;
      }
      handleServerMessageRef.current(msg);
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
      setWsReady(false);
    };
  }, [roomCode, isAuthenticated, user?.id]);

  // Send the correct join message once both the WS is open and we know
  // whether the current user is a participant or a spectator.
  useEffect(() => {
    if (!wsReady || !roomInfo || !user) return;
    const isSpec = user.id !== roomInfo.challengerId && user.id !== roomInfo.challengeeId;
    setIsSpectator(isSpec);
    if (isSpec) {
      sendWs({ type: "spectator:join", roomCode });
    } else {
      sendWs({ type: "room:join", roomCode });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsReady, roomInfo?.challengerId, roomInfo?.challengeeId, user?.id]);

  const handleReady = () => {
    setMeReady(true);
    sendWs({ type: "room:ready" });
  };

  const handleGameOver = useCallback((result: GameResult) => {
    setGameResult(result);
    setPhase("over");

    const isRace = (roomInfo?.format ?? "turn") === "race";
    const newAchievements = recordDuelResult(result.outcome, isRace);
    for (const ach of newAchievements) {
      toast({
        title: "Achievement Unlocked! 🏆",
        description: `${ach.title} — ${ach.description}`,
        duration: 5000,
      });
    }
  }, [roomInfo, toast]);

  const handleRematch = useCallback(async () => {
    if (!opponentId || !roomInfo) return;
    setRematchPending(true);
    try {
      const body: Record<string, unknown> = {
        challengeeId: opponentId,
        gameSlug: roomInfo.gameSlug,
        format: roomFormat,
      };
      if (roomFormat === "race") {
        body.raceTarget = raceTarget;
        body.raceTimeLimit = Math.round(raceTimeLimitMs / 1000);
      }
      const res = await fetch("/api/duels/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to create rematch");
      }
      const data = await res.json();
      navigate(`/duel/${data.roomCode}`);
    } catch (err) {
      toast({
        title: "Rematch failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      setRematchPending(false);
    }
  }, [opponentId, roomInfo, roomFormat, raceTarget, raceTimeLimitMs, navigate, toast]);

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Swords className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sign in to join a duel.</p>
      </div>
    );
  }

  const adapter = getAdapterForSlug(roomInfo?.gameSlug ?? "word-chain");
  const startWord = roomInfo?.startWord ?? "";
  const isRace = roomFormat === "race";

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
        <h1 className="text-2xl font-bold">
          {roomInfo
            ? `${roomInfo.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} ${isRace ? "Race" : "Duel"}`
            : "Duel"}
        </h1>
        {roomCode && (
          <Badge variant="outline" className="font-mono text-xs ml-auto" data-testid="text-room-code">
            {roomCode}
          </Badge>
        )}
        {isRace && (
          <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-race-format">
            ⚡ Race to {raceTarget}
          </Badge>
        )}
        {isSpectator && (
          <Badge className="text-xs gap-1 bg-violet-600 text-white" data-testid="badge-spectating">
            <Eye className="h-3 w-3" /> Watching
          </Badge>
        )}
        {!isSpectator && spectatorCount > 0 && (
          <Badge variant="outline" className="text-xs gap-1 text-violet-600 border-violet-300 dark:border-violet-700" data-testid="badge-spectator-count">
            <Eye className="h-3 w-3" /> {spectatorCount} watching
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
                {isRace && (
                  <div className="flex justify-center">
                    <Badge variant="secondary" className="text-xs gap-1.5" data-testid="badge-race-info">
                      ⚡ Race Format — first to {raceTarget} words wins
                    </Badge>
                  </div>
                )}
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

        {/* ── Playing (Turn) ─────────────────────────────────────────────── */}
        {phase === "playing" && !isRace && engineInitState && (
          <motion.div key="playing-turn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
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
              adapter={adapter}
            />
          </motion.div>
        )}

        {/* ── Spectator View ─────────────────────────────────────────────── */}
        {phase === "playing" && isSpectator && spectatorData && (
          <motion.div key="spectating" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              {/* Players scoreboard */}
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-center text-muted-foreground uppercase tracking-widest mb-4 font-medium">
                    Live Match · {spectatorData.gameSlug.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    {" "}· {spectatorData.format === "race" ? "Race" : "Turn-Based"}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: spectatorData.player1Id, name: spectatorData.player1Name, avatar: spectatorData.player1AvatarUrl, count: spectatorData.count1, lives: spectatorData.lives1 },
                      { id: spectatorData.player2Id, name: spectatorData.player2Name, avatar: spectatorData.player2AvatarUrl, count: spectatorData.count2, lives: spectatorData.lives2 },
                    ].map((p) => (
                      <div key={p.id} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/40 border">
                        <UserAvatar name={p.name} avatarUrl={p.avatar} className="h-14 w-14 text-lg" />
                        <p className="font-semibold text-sm text-center truncate max-w-full">{p.name}</p>
                        {spectatorData.format === "race" ? (
                          <div className="text-center">
                            <p className="text-3xl font-black text-primary">{p.count}</p>
                            <p className="text-xs text-muted-foreground">/ {spectatorData.raceTarget} words</p>
                          </div>
                        ) : (
                          <div className="flex gap-0.5">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Heart key={i} className={`h-5 w-5 ${i < p.lives ? "text-red-500 fill-red-500" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Reaction flash overlay */}
              <AnimatePresence>
                {reactionFlash && (
                  <motion.div
                    key={reactionFlash + Date.now()}
                    className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.6 }}
                    transition={{ duration: 0.5 }}
                  >
                    <span className="text-8xl drop-shadow-xl">{reactionFlash}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Emoji reaction bar */}
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-center text-muted-foreground mb-3">React to the match</p>
                  <div className="flex justify-center gap-3">
                    {REACT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => sendWs({ type: "spectator:react", emoji })}
                        className="text-2xl hover:scale-125 active:scale-95 transition-transform duration-150 focus:outline-none"
                        data-testid={`button-react-${emoji}`}
                        title={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ── Playing (Race) ─────────────────────────────────────────────── */}
        {phase === "playing" && isRace && raceInitState && (
          <motion.div key="playing-race" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <DuelRaceEngine
              key={raceEngineKey}
              userId={user?.id ?? 0}
              opponentId={opponentId}
              opponentName={opponentName}
              opponentAvatarUrl={opponentAvatarUrl}
              myName={user?.name ?? "You"}
              myAvatarUrl={user?.avatarUrl ?? null}
              raceTarget={raceTarget}
              initialState={raceInitState}
              sendWs={sendWs}
              latestMessage={latestGameMessage}
              onGameOver={handleGameOver}
              adapter={adapter}
              startWord={startWord}
            />
          </motion.div>
        )}

        {/* ── Spectator Game Over ───────────────────────────────────────── */}
        {phase === "over" && isSpectator && (
          <motion.div key="spectator-over" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-violet-400">
              <CardContent className="py-12 text-center space-y-5">
                <Trophy className="h-14 w-14 mx-auto text-yellow-500" />
                <div>
                  <h2 className="text-3xl font-black" data-testid="text-spectator-outcome">
                    {spectatorWinner ? `${spectatorWinner} wins! 🎉` : "It's a Draw!"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">The match has ended</p>
                </div>
                <Link href="/duels">
                  <Button className="gap-2" data-testid="button-back-lobby">
                    <Swords className="h-4 w-4" />
                    Back to Duels
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Game Over ─────────────────────────────────────────────────── */}
        {phase === "over" && !isSpectator && gameResult && (
          <motion.div key="over" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className={
              gameResult.outcome === "you_win" || gameResult.outcome === "forfeit"
                ? "border-yellow-400"
                : gameResult.outcome === "draw"
                ? "border-blue-400"
                : "border-muted"
            }>
              <CardContent className="py-10 space-y-6">
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

                {isRace && gameResult.myFinalCount != null && (
                  <div className="rounded-lg border bg-muted/30 px-4 py-3" data-testid="section-race-counts">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide text-center mb-2">Final Scores</p>
                    <div className="flex justify-center gap-8">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5 truncate max-w-[90px]">{user?.name ?? "You"}</p>
                        <p className="text-3xl font-black text-green-600" data-testid="text-my-final-count">
                          {gameResult.myFinalCount}
                          <span className="text-sm font-normal text-muted-foreground"> / {raceTarget}</span>
                        </p>
                      </div>
                      <div className="flex items-center text-muted-foreground font-bold text-lg">vs</div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5 truncate max-w-[90px]">{opponentName || "Opponent"}</p>
                        <p className="text-3xl font-black text-blue-600" data-testid="text-opp-final-count">
                          {gameResult.opponentFinalCount ?? 0}
                          <span className="text-sm font-normal text-muted-foreground"> / {raceTarget}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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

                {(gameResult.myWords.length > 0 || gameResult.opponentWords.length > 0) && (
                  <div className="grid grid-cols-2 gap-3" data-testid="section-word-lists">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Your words ({gameResult.myWords.length})
                      </p>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto" data-testid="list-my-words">
                        {gameResult.myWords.length > 0 ? (
                          gameResult.myWords.map((w, i) => (
                            <Badge key={i} variant="secondary" className="text-xs font-mono" data-testid={`word-mine-${i}`}>
                              {w}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic">None</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {opponentName || "Opponent"}'s words ({gameResult.opponentWords.length})
                      </p>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto" data-testid="list-opponent-words">
                        {gameResult.opponentWords.length > 0 ? (
                          gameResult.opponentWords.map((w, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-mono" data-testid={`word-opponent-${i}`}>
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

                <div className="flex flex-wrap gap-3 justify-center pt-1">
                  <Link href="/duels/leaderboard">
                    <Button variant="outline" className="gap-1.5" data-testid="button-see-rankings">
                      <Trophy className="h-4 w-4" />
                      See Rankings
                    </Button>
                  </Link>
                  <Link href="/friends">
                    <Button variant="outline" data-testid="button-back-friends">Back to Friends</Button>
                  </Link>
                  {opponentId && (
                    <Button
                      variant="secondary"
                      onClick={handleRematch}
                      disabled={rematchPending}
                      data-testid="button-rematch"
                    >
                      {rematchPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                      ) : (
                        <><Swords className="h-4 w-4 mr-2" />Rematch</>
                      )}
                    </Button>
                  )}
                  <Link href={`/games/${roomInfo?.gameSlug ?? "word-chain"}`}>
                    <Button data-testid="button-play-again">
                      Play Again
                    </Button>
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
