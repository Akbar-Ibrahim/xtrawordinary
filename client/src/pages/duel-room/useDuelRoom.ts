import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useSound } from "@/lib/sound-provider";
import { recordDuelResult } from "@/lib/game-stats";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";
import type { GameResult, DuelTurnEngineInitialState } from "@/components/duel-turn-engine";
import type { DuelRaceEngineInitialState } from "@/components/duel-race-engine";
import type { Phase, RoomInfo, SpectatorState } from "./types";

export function useDuelRoom(roomCode: string) {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { playSoundBypass, volume, setVolume } = useSound();
  const [duelMuted, setDuelMuted] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("duelSoundMuted");
      return stored === "true";
    }
    return false;
  });
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const duelPlay = useCallback((type: Parameters<typeof playSoundBypass>[0], pitchMultiplier?: number) => {
    if (!duelMuted) playSoundBypass(type, pitchMultiplier);
  }, [duelMuted, playSoundBypass]);

  useEffect(() => {
    localStorage.setItem("duelSoundMuted", String(duelMuted));
  }, [duelMuted]);

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
                duelPlay("notify");
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
          // Rising pitch: secondsLeft 3→pitch 1.0, 2→1.25, 1→1.5
          const tickPitch = msg.secondsLeft <= 1 ? 1.5 : msg.secondsLeft === 2 ? 1.25 : 1.0;
          duelPlay("tick", tickPitch);
          if (msg.secondsLeft === 1) {
            const msToPlay = countdownStartAtRef.current
              ? Math.max(0, countdownStartAtRef.current - Date.now())
              : 1000;
            const t = setTimeout(() => {
              setCountdownNum(null);
              setPhase("playing");
              duelPlay("countdown");
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
          setOpponentDisconnected(false);
          toast({
            title: "Opponent reconnected",
            description: `${opponentName || "Your opponent"} is back — game resuming!`,
            duration: 4000,
          });
          setLatestGameMessage(msg);
          break;

        case "player:forfeited":
        case "game:over":
          setOpponentDisconnected(false);
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
            setOpponentDisconnected(true);
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
    [toast, duelPlay, opponentName],
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

  return {
    user,
    isAuthenticated,
    volume,
    setVolume,
    duelMuted,
    setDuelMuted,
    opponentDisconnected,

    phase,
    errorMsg,

    opponentId,
    opponentName,
    opponentAvatarUrl,

    roomFormat,
    raceTarget,
    raceTimeLimitMs,

    meReady,
    opponentReady,
    countdownNum,

    engineKey,
    engineInitState,
    raceEngineKey,
    raceInitState,

    gameResult,
    rematchPending,

    latestGameMessage,

    isSpectator,
    spectatorCount,
    spectatorData,
    spectatorWinner,
    reactionFlash,

    roomInfo,

    sendWs,
    handleReady,
    handleGameOver,
    handleRematch,
  };
}
