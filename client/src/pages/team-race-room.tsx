import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Trophy, Timer, Send, Play, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { TeamRaceServerMessage, TeamRacePlayerInfo, TeamRaceContribution } from "@shared/team-race-protocol";

interface RoomInfo {
  id: number;
  challengerGroupId: number;
  challengeeGroupId: number;
  challengerGroupName: string;
  challengeeGroupName: string;
  gameSlug: string;
  startWord: string | null;
  raceTarget: number;
  raceTimeLimit: number;
  status: string;
  roomCode: string;
}

const GAME_NAMES: Record<string, string> = {
  "no-repeats": "No Repeats: Isogram",
  "anagram-solver": "Anagram Solver",
  "word-maker": "Word Maker",
  "definition-match": "Definition Match",
  "letter-hunt": "Letter Hunt",
  "letter-frequency": "Letter Frequency",
  "word-length": "Length Challenge",
  "letter-dodge": "Letter Dodge",
  "word-roots": "Word Roots",
};

function getConstraintLabel(slug: string, startWord: string): string {
  switch (slug) {
    case "letter-hunt":
    case "letter-frequency":
      return `Words containing the letter: ${startWord}`;
    case "word-length":
      return `Words exactly ${startWord} letters long`;
    case "no-repeats":
      return `Words with no repeated letters (min ${startWord} letters)`;
    case "anagram-solver":
      return `Anagrams of: ${startWord}`;
    case "word-maker":
      return `Words using letters (in order) from: ${startWord}`;
    case "definition-match":
      return `Words in the ${startWord.charAt(0) + startWord.slice(1).toLowerCase()} category`;
    case "letter-dodge":
      return `Words NOT containing: ${startWord.split(",").join(", ")}`;
    case "word-roots":
      return `Derivatives of the word: ${startWord}`;
    default:
      return startWord;
  }
}

function msToTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function TeamPanel({ name, count, target, players, groupId, isYourTeam }: {
  name: string;
  count: number;
  target: number;
  players: TeamRacePlayerInfo[];
  groupId: number;
  isYourTeam: boolean;
}) {
  const pct = Math.min(100, (count / target) * 100);
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isYourTeam ? "border-primary/50 bg-primary/5" : "border-muted"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm truncate">{name}</span>
        {isYourTeam && <Badge variant="outline" className="text-xs shrink-0">Your team</Badge>}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{count} words</span>
          <span>/ {target}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isYourTeam ? "bg-primary" : "bg-slate-400 dark:bg-slate-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="space-y-1">
        {players.filter(p => p.groupId === groupId).map(p => (
          <div key={p.userId} className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserAvatar name={p.name} avatarUrl={p.avatarUrl} className="h-5 w-5" />
            <span className="truncate">{p.name}</span>
          </div>
        ))}
        {players.filter(p => p.groupId === groupId).length === 0 && (
          <p className="text-xs text-muted-foreground italic">No players yet</p>
        )}
      </div>
    </div>
  );
}

export default function TeamRaceRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user } = useAuth();

  const { data: roomInfo, isLoading: roomLoading } = useQuery<RoomInfo>({
    queryKey: ["/api/team-races", roomCode, "room"],
    queryFn: async () => {
      const res = await fetch(`/api/team-races/${roomCode}/room`, { credentials: "include" });
      if (!res.ok) throw new Error("Room not found");
      return res.json();
    },
    retry: false,
  });

  const [phase, setPhase] = useState<"connecting" | "waiting" | "countdown" | "playing" | "over">("connecting");
  const [players, setPlayers] = useState<TeamRacePlayerInfo[]>([]);
  const [challengerCount, setChallengerCount] = useState(0);
  const [challengeeCount, setChallengerCountB] = useState(0);
  const [yourGroupId, setYourGroupId] = useState<number | null>(null);
  const [wordInput, setWordInput] = useState("");
  const [recentWords, setRecentWords] = useState<{ word: string; groupId: number; userName: string }[]>([]);
  const [rejectedMsg, setRejectedMsg] = useState<string | null>(null);
  const [countdownMs, setCountdownMs] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [raceTimeLimitMs, setRaceTimeLimitMs] = useState(300_000);
  const [raceTarget, setRaceTarget] = useState(20);
  const [gameSlug, setGameSlug] = useState("");
  const [startWord, setStartWord] = useState("");
  const [overResult, setOverResult] = useState<{
    winnerGroupId: number | null;
    challengerCount: number;
    challengeeCount: number;
    contributions: TeamRaceContribution[];
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const raceStartAtRef = useRef<number | null>(null);

  const handleServerMessage = useCallback((msg: TeamRaceServerMessage) => {
    switch (msg.type) {
      case "team:joined": {
        setPlayers(msg.players);
        setYourGroupId(msg.yourGroupId);
        setGameSlug(msg.gameSlug);
        setStartWord(msg.startWord);
        setRaceTarget(msg.raceTarget);
        setRaceTimeLimitMs(msg.raceTimeLimitMs);
        if (msg.status === "playing") setPhase("playing");
        else if (msg.status === "over") setPhase("over");
        else setPhase("waiting");
        break;
      }
      case "team:state": {
        setPlayers(msg.players);
        setYourGroupId(msg.yourGroupId);
        setGameSlug(msg.gameSlug);
        setStartWord(msg.startWord);
        setRaceTarget(msg.raceTarget);
        setRaceTimeLimitMs(msg.raceTimeLimitMs);
        setChallengerCount(msg.challengerCount);
        setChallengerCountB(msg.challengeeCount);
        setPhase(msg.phase === "over" ? "over" : msg.phase === "playing" ? "playing" : "waiting");
        break;
      }
      case "team:member_joined":
        setPlayers(prev => {
          const exists = prev.find(p => p.userId === msg.player.userId);
          return exists ? prev.map(p => p.userId === msg.player.userId ? msg.player : p) : [...prev, msg.player];
        });
        break;
      case "team:member_left":
        setPlayers(prev => prev.filter(p => p.userId !== msg.userId));
        break;
      case "team:countdown": {
        setPhase("countdown");
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        const targetAt = msg.startAt;
        setCountdownMs(Math.max(0, targetAt - Date.now()));
        countdownTimerRef.current = setInterval(() => {
          const remaining = targetAt - Date.now();
          if (remaining <= 0) {
            clearInterval(countdownTimerRef.current!);
            countdownTimerRef.current = null;
            setPhase("playing");
          } else {
            setCountdownMs(remaining);
          }
        }, 100);
        break;
      }
      case "team:progress": {
        setChallengerCount(msg.challengerCount);
        setChallengerCountB(msg.challengeeCount);
        if (msg.lastWord) {
          setPlayers(prev => {
            const player = prev.find(p => p.userId === msg.lastWordUserId);
            setRecentWords(rw => [
              { word: msg.lastWord, groupId: msg.lastWordGroupId, userName: player?.name ?? "?" },
              ...rw.slice(0, 8),
            ]);
            return prev;
          });
        }
        setPhase(p => p === "waiting" || p === "connecting" ? "playing" : p);
        // Arm the race timer on first progress
        if (!raceStartAtRef.current) {
          raceStartAtRef.current = Date.now();
          setRaceTimeLimitMs(tl => {
            const endAt = Date.now() + tl;
            setTimeLeftMs(tl);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
              const left = endAt - Date.now();
              if (left <= 0) {
                setTimeLeftMs(0);
                clearInterval(timerRef.current!);
                timerRef.current = null;
              } else {
                setTimeLeftMs(left);
              }
            }, 500);
            return tl;
          });
        }
        break;
      }
      case "team:word_rejected":
        setRejectedMsg(msg.error);
        setTimeout(() => setRejectedMsg(null), 2500);
        break;
      case "team:over":
        setOverResult(msg);
        setChallengerCount(msg.challengerCount);
        setChallengerCountB(msg.challengeeCount);
        setPhase("over");
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
        break;
      case "team:error":
        console.warn("[TeamRace] Error:", msg.message);
        break;
    }
  }, []);

  // WebSocket connection — depends only on roomInfo being available
  useEffect(() => {
    if (!roomInfo || !user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/team-race`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Join with groupId 0 initially; server will resolve via group membership
      ws.send(JSON.stringify({ type: "team:join", roomCode, groupId: 0 }));
    };

    ws.onmessage = (e) => {
      let msg: TeamRaceServerMessage;
      try { msg = JSON.parse(e.data); } catch { return; }
      handleServerMessage(msg);
    };

    ws.onclose = () => {};
    ws.onerror = () => {};

    return () => {
      ws.close();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    };
  }, [roomInfo?.id, user?.id]);

  // Keep message handler fresh
  useEffect(() => {
    if (!wsRef.current) return;
    const ws = wsRef.current;
    ws.onmessage = (e) => {
      let msg: TeamRaceServerMessage;
      try { msg = JSON.parse(e.data); } catch { return; }
      handleServerMessage(msg);
    };
  }, [handleServerMessage]);

  // Re-join with correct groupId once we know it
  useEffect(() => {
    if (!yourGroupId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "team:join", roomCode, groupId: yourGroupId }));
  }, [yourGroupId]);

  const sendWord = () => {
    const word = wordInput.trim();
    if (!word || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "team:move", word }));
    setWordInput("");
    inputRef.current?.focus();
  };

  const sendTyping = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "team:typing" }));
    }
  };

  const startRace = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "team:start" }));
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Please sign in to participate in Team Race.</p>
      </div>
    );
  }

  if (roomLoading || phase === "connecting") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!roomInfo) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <XCircle className="h-12 w-12 mx-auto text-destructive opacity-60" />
        <p className="text-muted-foreground">Room not found or has expired.</p>
        <Link href="/groups"><Button variant="outline">Back to groups</Button></Link>
      </div>
    );
  }

  const challengerGroupName = roomInfo.challengerGroupName;
  const challengeeGroupName = roomInfo.challengeeGroupName;
  const effectiveGameSlug = gameSlug || roomInfo.gameSlug;
  const effectiveStartWord = startWord || roomInfo.startWord || "";
  const effectiveRaceTarget = raceTarget || roomInfo.raceTarget;
  const gameName = GAME_NAMES[effectiveGameSlug] ?? effectiveGameSlug;
  const myGroupLink = yourGroupId === roomInfo.challengerGroupId
    ? `/groups/${roomInfo.challengerGroupId}`
    : `/groups/${roomInfo.challengeeGroupId}`;

  // ── Game Over ──────────────────────────────────────────────────────────────

  if (phase === "over" && overResult) {
    const winnerIsChallenger = overResult.winnerGroupId === roomInfo.challengerGroupId;
    const winnerName = overResult.winnerGroupId === roomInfo.challengerGroupId
      ? challengerGroupName
      : overResult.winnerGroupId === roomInfo.challengeeGroupId
        ? challengeeGroupName
        : null;
    const yourTeamWon = overResult.winnerGroupId === yourGroupId;
    const sortedContribs = [...overResult.contributions].sort((a, b) => b.count - a.count);

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Link href={myGroupLink}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" data-testid="button-back-group">
            <ArrowLeft className="h-4 w-4" /> Back to group
          </Button>
        </Link>

        <Card className={`border-2 ${winnerName ? (yourTeamWon ? "border-primary/60" : "border-muted") : "border-muted"}`}>
          <CardContent className="py-10 text-center space-y-3">
            <Trophy className={`h-14 w-14 mx-auto ${winnerName ? (yourTeamWon ? "text-yellow-500" : "text-slate-400") : "text-muted-foreground"}`} />
            {winnerName ? (
              <>
                <h2 className="text-2xl font-bold">{yourTeamWon ? "Your team won!" : `${winnerName} won`}</h2>
                <p className="text-muted-foreground">{winnerName} found the most words</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold">It's a tie!</h2>
                <p className="text-muted-foreground">Both teams found the same number of words</p>
              </>
            )}
            <div className="flex justify-center gap-10 pt-2">
              <div className="text-center">
                <p className="text-3xl font-bold">{overResult.challengerCount}</p>
                <p className="text-sm text-muted-foreground truncate max-w-[120px]">{challengerGroupName}</p>
              </div>
              <div className="text-center text-muted-foreground self-center text-xl font-semibold">vs</div>
              <div className="text-center">
                <p className="text-3xl font-bold">{overResult.challengeeCount}</p>
                <p className="text-sm text-muted-foreground truncate max-w-[120px]">{challengeeGroupName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Player Contributions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedContribs.map((c, i) => {
              const teamName = c.groupId === roomInfo.challengerGroupId ? challengerGroupName : challengeeGroupName;
              return (
                <div key={c.userId} className="flex items-center gap-3 py-1" data-testid={`contrib-row-${c.userId}`}>
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{teamName}</span>
                  </div>
                  <Badge variant={c.groupId === yourGroupId ? "default" : "secondary"} className="text-xs">
                    {c.count} word{c.count !== 1 ? "s" : ""}
                  </Badge>
                </div>
              );
            })}
            {sortedContribs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No contributions recorded</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Countdown ───────────────────────────────────────────────────────────────

  if (phase === "countdown") {
    const secs = Math.ceil(countdownMs / 1000);
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <p className="text-lg font-medium text-muted-foreground">{gameName} — Team Race</p>
          <div className="text-9xl font-black tabular-nums text-primary">{Math.max(1, secs)}</div>
          <p className="text-muted-foreground">Get ready!</p>
        </div>
      </div>
    );
  }

  // ── Playing ─────────────────────────────────────────────────────────────────

  if (phase === "playing") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">{gameName}</h1>
            {effectiveStartWord && (
              <p className="text-sm text-muted-foreground">{getConstraintLabel(effectiveGameSlug, effectiveStartWord)}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className={timeLeftMs > 0 && timeLeftMs < 30_000 ? "text-destructive font-bold" : "text-foreground"}>
              {timeLeftMs > 0 ? msToTime(timeLeftMs) : "--:--"}
            </span>
          </div>
        </div>

        {/* Team progress bars */}
        <div className="grid grid-cols-2 gap-3">
          <TeamPanel
            name={challengerGroupName}
            count={challengerCount}
            target={effectiveRaceTarget}
            players={players}
            groupId={roomInfo.challengerGroupId}
            isYourTeam={yourGroupId === roomInfo.challengerGroupId}
          />
          <TeamPanel
            name={challengeeGroupName}
            count={challengeeCount}
            target={effectiveRaceTarget}
            players={players}
            groupId={roomInfo.challengeeGroupId}
            isYourTeam={yourGroupId === roomInfo.challengeeGroupId}
          />
        </div>

        {/* Word input */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={wordInput}
              onChange={e => {
                setWordInput(e.target.value.toUpperCase());
                sendTyping();
              }}
              onKeyDown={e => { if (e.key === "Enter") sendWord(); }}
              placeholder="Type a word and press Enter..."
              className="uppercase font-medium text-base tracking-wider"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              data-testid="input-word"
            />
            <Button onClick={sendWord} size="icon" data-testid="button-submit-word">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {rejectedMsg && (
            <div className="flex items-center gap-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{rejectedMsg}</span>
            </div>
          )}
        </div>

        {/* Recent words */}
        {recentWords.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent words</p>
            <div className="flex flex-wrap gap-1.5">
              {recentWords.map((w, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className={`text-xs gap-1 ${w.groupId === yourGroupId ? "border border-primary/40" : ""}`}
                  data-testid={`badge-word-${i}`}
                >
                  <CheckCircle2 className={`h-3 w-3 ${w.groupId === yourGroupId ? "text-primary" : "text-muted-foreground"}`} />
                  {w.word}
                  <span className="text-muted-foreground ml-0.5">{w.userName}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Waiting lobby ────────────────────────────────────────────────────────────

  const teamAPlayers = players.filter(p => p.groupId === roomInfo.challengerGroupId);
  const teamBPlayers = players.filter(p => p.groupId === roomInfo.challengeeGroupId);
  const canStart = teamAPlayers.length > 0 && teamBPlayers.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={myGroupLink}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" data-testid="button-back-group">
            <ArrowLeft className="h-4 w-4" /> Group
          </Button>
        </Link>
        <div>
          <h1 className="font-bold text-xl">{gameName} — Team Race</h1>
          <p className="text-sm text-muted-foreground">
            {challengerGroupName} vs {challengeeGroupName}
          </p>
        </div>
      </div>

      {/* Game constraint card */}
      {effectiveStartWord && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4">
            <p className="text-sm font-medium text-primary">
              {getConstraintLabel(effectiveGameSlug, effectiveStartWord)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              First team to {effectiveRaceTarget} unique words wins &bull; {Math.floor(roomInfo.raceTimeLimit / 60)} min time limit
            </p>
          </CardContent>
        </Card>
      )}

      {/* Teams */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { gid: roomInfo.challengerGroupId, name: challengerGroupName, teamPlayers: teamAPlayers },
          { gid: roomInfo.challengeeGroupId, name: challengeeGroupName, teamPlayers: teamBPlayers },
        ].map(({ gid, name, teamPlayers }) => (
          <Card key={gid} className={yourGroupId === gid ? "border-primary/40" : ""}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Users className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{name}</span>
                {yourGroupId === gid && (
                  <Badge variant="outline" className="text-xs ml-auto shrink-0">Your team</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1.5">
              {teamPlayers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Waiting for players...</p>
              ) : teamPlayers.map(p => (
                <div key={p.userId} className="flex items-center gap-2" data-testid={`player-${gid}-${p.userId}`}>
                  <UserAvatar name={p.name} avatarUrl={p.avatarUrl} className="h-6 w-6" />
                  <span className="text-sm truncate flex-1">{p.name}</span>
                  {p.userId === user.id && <Badge variant="outline" className="text-xs">You</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Start button */}
      <div className="flex flex-col items-center gap-2">
        <Button
          size="lg"
          className="gap-2 min-w-[200px]"
          onClick={startRace}
          disabled={!canStart}
          data-testid="button-start-race"
        >
          <Play className="h-5 w-5" />
          Start Race
        </Button>
        {!canStart && (
          <p className="text-xs text-muted-foreground text-center">
            Both teams need at least one player to start
          </p>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Share this link with your team members so they can join
        </p>
      </div>

      {/* Room code display */}
      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground">Room code</p>
        <p className="font-mono font-bold tracking-widest text-xl select-all" data-testid="text-room-code">
          {roomCode}
        </p>
      </div>
    </div>
  );
}
