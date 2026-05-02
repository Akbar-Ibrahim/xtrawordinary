import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserAvatar } from "@/components/user-avatar";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, HeartOff, Trophy, Clock, ArrowLeft, Loader2, Wifi, WifiOff, Swords } from "lucide-react";
import type { DuelClientMessage, DuelServerMessage } from "@shared/duel-protocol";
import type { WordValidationResponse } from "@shared/schema";

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

interface GameResult {
  outcome: "you_win" | "you_lose" | "draw" | "forfeit";
  eloChange: number;
  newElo: number;
  reason?: "disconnect" | "manual";
}

type WordChainPayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

const TURN_TIME = 8;

function Lives({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-1" aria-label={`${count} of ${max} lives`}>
      {Array.from({ length: max }).map((_, i) => (
        i < count
          ? <Heart key={i} className="h-4 w-4 fill-red-500 text-red-500" />
          : <HeartOff key={i} className="h-4 w-4 text-muted-foreground" />
      ))}
    </div>
  );
}

export default function DuelRoom() {
  const [, params] = useRoute("/duel/:roomCode");
  const roomCode = (params?.roomCode ?? "").toUpperCase();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameEndedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState("");
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null);
  const [meReady, setMeReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  const [currentWord, setCurrentWord] = useState("");
  const [userInput, setUserInput] = useState("");
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [myLives, setMyLives] = useState(3);
  const [opponentLives, setOpponentLives] = useState(3);
  const [myWords, setMyWords] = useState<string[]>([]);
  const [opponentWords, setOpponentWords] = useState<string[]>([]);
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [timerLeft, setTimerLeft] = useState(TURN_TIME);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [disconnectDeadline, setDisconnectDeadline] = useState<number | null>(null);
  const [disconnectSecsLeft, setDisconnectSecsLeft] = useState(30);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isChallenger, setIsChallenger] = useState(false);

  const { data: roomInfo } = useQuery<RoomInfo>({
    queryKey: ["/api/duels/rooms", roomCode],
    queryFn: async () => {
      const res = await fetch(`/api/duels/rooms/${roomCode}`, { credentials: "include" });
      if (!res.ok) throw new Error("Room not found");
      return res.json();
    },
    enabled: !!roomCode && isAuthenticated,
    retry: false,
  });

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const res = await apiRequest("POST", "/api/games/validate-word", { word });
      return res.json() as Promise<WordValidationResponse>;
    },
  });

  const sendWs = useCallback((msg: DuelClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimerLeft(TURN_TIME);
    timerRef.current = setInterval(() => {
      setTimerLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  const handleTimeout = useCallback(() => {
    stopTimer();
    setMyLives((prev) => {
      const newLives = prev - 1;
      const payload: WordChainPayload = { type: "timeout", lives: newLives };
      sendWs({ type: "game:move", payload });
      if (newLives <= 0 && !gameEndedRef.current) {
        gameEndedRef.current = true;
        sendWs({ type: "game:end", winnerId: opponentId ?? -1 });
      }
      return newLives;
    });
    setIsMyTurn(false);
  }, [stopTimer, sendWs, opponentId]);

  useEffect(() => {
    if (timerLeft === 0 && isMyTurn && phase === "playing") {
      handleTimeout();
    }
  }, [timerLeft, isMyTurn, phase, handleTimeout]);

  useEffect(() => {
    if (isMyTurn && phase === "playing") {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [isMyTurn, phase, startTimer, stopTimer]);

  useEffect(() => {
    if (!roomInfo || !user) return;
    setIsChallenger(user.id === roomInfo.challengerId);
  }, [roomInfo, user]);

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
      if (phase !== "over" && phase !== "error") {
        setPhase("error");
        setErrorMsg("Disconnected from server.");
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
      stopTimer();
    };
  }, [roomCode, isAuthenticated, user?.id]);

  function handleServerMessage(msg: DuelServerMessage) {
    switch (msg.type) {
      case "room:joined":
        setOpponentId(msg.opponentId);
        setOpponentName(msg.opponentName);
        setOpponentAvatarUrl(msg.opponentAvatarUrl);
        setPhase("waiting");
        break;

      case "room:player_ready":
        // The opponent signalled ready — update their badge in real time
        setOpponentReady(true);
        break;

      case "room:state":
        // Reconnect snapshot — restore phase from server state
        setOpponentId(msg.opponentId);
        setOpponentName(msg.opponentName);
        setOpponentAvatarUrl(msg.opponentAvatarUrl);
        setMyLives(msg.myLives);
        setOpponentLives(msg.opponentLives);
        setPhase("playing");
        break;

      case "room:ready":
        setPhase("countdown");
        break;

      case "room:countdown":
        setCountdownNum(msg.secondsLeft);
        if (msg.secondsLeft === 1) {
          setTimeout(() => {
            setCountdownNum(null);
            setPhase("playing");
          }, 1000);
        }
        break;

      case "opponent:move": {
        const payload = msg.payload as WordChainPayload;
        if (payload.type === "word") {
          setOpponentWords((prev) => [...prev, payload.word]);
          setUsedWords((prev) => [...prev, payload.word.toUpperCase()]);
          setCurrentWord(payload.word.toUpperCase());
          setOpponentLives(payload.lives);
        } else if (payload.type === "timeout") {
          setOpponentLives(payload.lives);
          if (payload.lives <= 0 && !gameEndedRef.current) {
            gameEndedRef.current = true;
            sendWs({ type: "game:end", winnerId: user?.id ?? -1 });
          }
        }
        setIsMyTurn(true);
        break;
      }

      case "game:over":
        stopTimer();
        setGameResult({
          outcome: msg.outcome,
          eloChange: msg.eloChange,
          newElo: msg.newElo,
        });
        setPhase("over");
        break;

      case "player:disconnect":
        setDisconnectDeadline(msg.reconnectDeadlineMs);
        setDisconnectSecsLeft(Math.ceil((msg.reconnectDeadlineMs - Date.now()) / 1000));
        break;

      case "player:reconnect":
        setDisconnectDeadline(null);
        break;

      case "player:forfeited":
        stopTimer();
        setGameResult({
          outcome: "forfeit",
          eloChange: 0,
          newElo: 0,
          reason: msg.reason,
        });
        setPhase("over");
        break;

      case "error":
        toast({ title: "Duel error", description: msg.message, variant: "destructive" });
        break;
    }
  }

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

  useEffect(() => {
    if (phase === "playing" && roomInfo && user) {
      const isFirst = user.id === roomInfo.challengerId;
      setCurrentWord(roomInfo.startWord);
      setUsedWords([roomInfo.startWord.toUpperCase()]);
      setIsMyTurn(isFirst);
    }
  }, [phase, roomInfo, user?.id]);

  const handleReady = () => {
    setMeReady(true);
    sendWs({ type: "room:ready" });
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || !isMyTurn || phase !== "playing") return;
    const word = userInput.trim().toUpperCase();

    if (usedWords.includes(word)) {
      setFeedback("That word was already used!");
      return;
    }

    const lastLetter = currentWord[currentWord.length - 1];
    if (!word.startsWith(lastLetter)) {
      setFeedback(`Word must start with "${lastLetter}"`);
      setTimerLeft((prev) => Math.max(0, prev - 0.5));
      return;
    }

    setFeedback(null);
    try {
      const result = await validateMutation.mutateAsync(word);
      if (!result.valid) {
        setFeedback(`"${word}" is not a valid word`);
        setTimerLeft((prev) => Math.max(0, prev - 0.5));
        return;
      }

      stopTimer();
      setMyWords((prev) => [...prev, word]);
      setUsedWords((prev) => [...prev, word]);
      setCurrentWord(word);
      setUserInput("");
      setFeedback(null);

      const payload: WordChainPayload = { type: "word", word, lives: myLives };
      sendWs({ type: "game:move", payload });
      setIsMyTurn(false);
    } catch {
      setFeedback("Validation failed. Try again.");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Swords className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Sign in to join a duel.</p>
      </div>
    );
  }

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
        {phase === "connecting" || phase === "lobby" ? (
          <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="py-16 text-center space-y-4">
                <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                <p className="text-muted-foreground">Connecting to duel room…</p>
              </CardContent>
            </Card>
          </motion.div>
        ) : phase === "error" ? (
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
        ) : phase === "waiting" ? (
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
        ) : phase === "countdown" ? (
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
        ) : phase === "playing" ? (
          <motion.div key="playing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
                <Card className={isMyTurn ? "border-primary shadow-md" : ""} data-testid="card-player-me">
                  <CardContent className="py-3 px-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate">{user?.name ?? "You"}</p>
                      {isMyTurn && <Badge className="text-xs h-5" data-testid="badge-your-turn">Your turn</Badge>}
                    </div>
                    <Lives count={myLives} data-testid="lives-me" />
                    <div className="text-xs text-muted-foreground">{myWords.length} words</div>
                  </CardContent>
                </Card>
                <Card className={!isMyTurn ? "border-primary shadow-md" : ""} data-testid="card-opponent">
                  <CardContent className="py-3 px-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate">{opponentName || "Opponent"}</p>
                      {!isMyTurn && <Badge variant="outline" className="text-xs h-5" data-testid="badge-opponent-turn">Their turn</Badge>}
                    </div>
                    <Lives count={opponentLives} />
                    <div className="text-xs text-muted-foreground">{opponentWords.length} words</div>
                  </CardContent>
                </Card>
              </div>

              {isMyTurn && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Time left</span>
                    <span className={timerLeft <= 3 ? "text-destructive font-bold" : ""}>{Math.ceil(timerLeft)}s</span>
                  </div>
                  <Progress
                    value={(timerLeft / TURN_TIME) * 100}
                    className={`h-2 ${timerLeft <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary"}`}
                    data-testid="progress-timer"
                  />
                </div>
              )}

              <Card>
                <CardContent className="py-4 px-5 space-y-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Chain from</p>
                    <p className="text-3xl font-black text-primary tracking-wider" data-testid="text-current-word">
                      {currentWord}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Next word must start with <strong>"{currentWord[currentWord.length - 1]}"</strong>
                    </p>
                  </div>
                  {isMyTurn ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={userInput}
                          onChange={(e) => {
                            setUserInput(e.target.value.toUpperCase());
                            setFeedback(null);
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                          placeholder={`Start with "${currentWord[currentWord.length - 1]}"…`}
                          className="font-mono uppercase"
                          autoFocus
                          disabled={validateMutation.isPending}
                          data-testid="input-word"
                          maxLength={30}
                        />
                        <Button
                          onClick={handleSubmit}
                          disabled={!userInput.trim() || validateMutation.isPending}
                          data-testid="button-submit"
                        >
                          {validateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                        </Button>
                      </div>
                      {feedback && (
                        <p className="text-xs text-destructive text-center" data-testid="text-feedback">{feedback}</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-2 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for {opponentName}…
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Your words</p>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto" data-testid="list-my-words">
                    {myWords.map((w, i) => (
                      <Badge key={i} variant="default" className="text-xs font-mono">{w}</Badge>
                    ))}
                    {myWords.length === 0 && <span className="text-xs text-muted-foreground">None yet</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{opponentName}'s words</p>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto" data-testid="list-opponent-words">
                    {opponentWords.map((w, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-mono">{w}</Badge>
                    ))}
                    {opponentWords.length === 0 && <span className="text-xs text-muted-foreground">None yet</span>}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : phase === "over" ? (
          <motion.div key="over" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className={
              !gameResult ? "" :
              gameResult.outcome === "you_win" || (gameResult.outcome === "forfeit" && !gameResult.reason)
                ? "border-green-500"
                : gameResult.outcome === "you_lose"
                ? "border-muted"
                : gameResult.outcome === "draw"
                ? "border-blue-400"
                : "border-green-500"
            }>
              <CardContent className="py-8 text-center space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                  <Trophy className={`h-16 w-16 mx-auto ${
                    gameResult?.outcome === "you_win" || gameResult?.outcome === "forfeit"
                      ? "text-yellow-500"
                      : gameResult?.outcome === "draw"
                      ? "text-blue-500"
                      : "text-muted-foreground"
                  }`} />
                </motion.div>

                <div>
                  <h2 className="text-3xl font-black" data-testid="text-result-outcome">
                    {!gameResult
                      ? "Match Over"
                      : gameResult.outcome === "you_win"
                      ? "You Win! 🎉"
                      : gameResult.outcome === "you_lose"
                      ? "You Lose"
                      : gameResult.outcome === "draw"
                      ? "Draw!"
                      : "Forfeit Win!"}
                  </h2>
                  {gameResult?.outcome === "forfeit" && gameResult.reason && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {opponentName} {gameResult.reason === "disconnect" ? "disconnected and forfeited" : "forfeited"}
                    </p>
                  )}
                </div>

                {gameResult && gameResult.outcome !== "forfeit" && (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                    gameResult.eloChange > 0
                      ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                      : gameResult.eloChange < 0
                      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-muted text-muted-foreground"
                  }`} data-testid="text-elo-change">
                    {gameResult.eloChange > 0 ? "+" : ""}{gameResult.eloChange} ELO
                    <span className="text-xs font-normal opacity-70">→ {gameResult.newElo}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-left mt-2">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Your words ({myWords.length})</p>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {myWords.map((w, i) => <Badge key={i} variant="default" className="text-xs font-mono">{w}</Badge>)}
                      {myWords.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">{opponentName}'s words ({opponentWords.length})</p>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {opponentWords.map((w, i) => <Badge key={i} variant="outline" className="text-xs font-mono">{w}</Badge>)}
                      {opponentWords.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-center flex-wrap pt-2">
                  <Link href="/friends">
                    <Button variant="outline" data-testid="button-back-to-friends">Back to Friends</Button>
                  </Link>
                  {user && (
                    <Link href={`/profile/${user.id}`}>
                      <Button variant="ghost" data-testid="button-view-profile">View Profile</Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
