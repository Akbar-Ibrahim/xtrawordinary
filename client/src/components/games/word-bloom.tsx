import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Timer,
  RotateCcw,
  Trophy,
  Flame,
  Sprout,
  ChevronRight,
  Medal,
  ArrowUp,
  LogIn,
} from "lucide-react";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { useGameResult } from "@/hooks/use-game-result";
import { getCompletionMessage } from "@/lib/completion-messages";
import type { LeaderboardEntry } from "@shared/schema";

const CLASSIC_TIME = 120;
const SURVIVAL_TIME = 8;
const POINTS_BASE = 10;
const POINTS_GROWTH_BONUS = 5;
const BLOOM_COLOR = "hsl(142, 60%, 40%)";

type Mode = "classic" | "survival";
type GameStatus = "playing" | "ended";

interface ChainEntry {
  word: string;
  insertPos: number;
  points: number;
}

/** Find which position was inserted to go from prevWord to nextWord */
function findInsertPos(prev: string, next: string): number {
  for (let i = 0; i < next.length; i++) {
    if (next.slice(0, i) + next.slice(i + 1) === prev) return i;
  }
  return -1;
}

/** Quick client-side structural check before hitting the server */
function isStructurallyValid(current: string, next: string): boolean {
  if (next.length !== current.length + 1) return false;
  return findInsertPos(current, next) !== -1;
}

interface PuzzleData { seed: string; maxDepth: number }

interface WordBloomPlayProps {
  mode: Mode;
  initialSeed: number;
  onExit: () => void;
  locked?: boolean;
}

function WordBloomPlay({ mode, initialSeed, onExit, locked }: WordBloomPlayProps) {
  const slug = mode === "classic" ? "word-bloom" : "word-bloom-survival";
  const { reportResult } = useGameResult({ slug });

  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [currentWord, setCurrentWord] = useState("");
  const [chain, setChain] = useState<ChainEntry[]>([]); // seed + each growth step
  const [timeLeft, setTimeLeft] = useState(mode === "classic" ? CLASSIC_TIME : SURVIVAL_TIME);
  const [input, setInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [validating, setValidating] = useState(false);
  const [score, setScore] = useState(0);
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedRef = useRef(false);
  const gameStatusRef = useRef<GameStatus>("playing");
  const currentWordRef = useRef("");
  const chainRef = useRef<ChainEntry[]>([]);
  const scoreRef = useRef(0);
  const seedLenRef = useRef(0);

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", slug],
    queryFn: () => fetch(`/api/leaderboard?game=${slug}&limit=5`).then(r => r.json()),
    enabled: gameStatus === "ended",
    staleTime: 10_000,
  });

  const endGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    gameStatusRef.current = "ended";
    setGameStatus("ended");
    const steps = chainRef.current.length - 1; // subtract seed entry
    setCompletionMessage(getCompletionMessage(steps >= 3));
    if (!recordedRef.current) {
      recordedRef.current = true;
      reportResult(scoreRef.current, steps > 0, steps);
    }
  }, [reportResult]);

  const startTimer = useCallback((duration: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(duration);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (gameStatusRef.current === "playing") endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [endGame]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/games/word-bloom/puzzle?seed=${initialSeed}`, { credentials: "include" });
        if (!r.ok) return;
        const p: PuzzleData = await r.json();
        setPuzzle(p);
        const seedEntry: ChainEntry = { word: p.seed, insertPos: -1, points: 0 };
        setChain([seedEntry]);
        chainRef.current = [seedEntry];
        setCurrentWord(p.seed);
        currentWordRef.current = p.seed;
        seedLenRef.current = p.seed.length;
        startTimer(mode === "classic" ? CLASSIC_TIME : SURVIVAL_TIME);
        setTimeout(() => inputRef.current?.focus(), 100);
      } catch { /* silent */ }
    })();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (validating || gameStatusRef.current !== "playing") return;
    const word = input.toUpperCase().trim();
    if (!word) return;
    const cw = currentWordRef.current;

    if (!isStructurallyValid(cw, word)) {
      showError(`Must be ${cw.length + 1} letters with ${cw} inside (in order)`);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    setValidating(true);
    try {
      const r = await fetch(
        `/api/games/word-bloom/validate?current=${encodeURIComponent(cw)}&next=${encodeURIComponent(word)}`,
        { credentials: "include" }
      );
      const data = await r.json();

      if (!data.valid) {
        showError("Not a valid word");
        setValidating(false);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      const insertPos = findInsertPos(cw, word);
      const pts = POINTS_BASE + POINTS_GROWTH_BONUS * (word.length - seedLenRef.current);

      const entry: ChainEntry = { word, insertPos, points: pts };
      const newChain = [...chainRef.current, entry];
      chainRef.current = newChain;
      setChain(newChain);

      const newScore = scoreRef.current + pts;
      scoreRef.current = newScore;
      setScore(newScore);

      setCurrentWord(word);
      currentWordRef.current = word;
      setInput("");
      setValidating(false);

      if (mode === "survival") {
        startTimer(SURVIVAL_TIME);
      }

      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      showError("Validation failed, try again");
      setValidating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, validating, mode, showError, startTimer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
  };

  const maxTime = mode === "classic" ? CLASSIC_TIME : SURVIVAL_TIME;
  const timerPercent = (timeLeft / maxTime) * 100;
  const timerColor = timerPercent > 33 ? "bg-[hsl(142,60%,40%)]" : timerPercent > 11 ? "bg-chart-3" : "bg-destructive";

  if (gameStatus === "ended") {
    const steps = chain.length - 1;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <Card className="border-[hsl(142,60%,40%)]">
          <CardContent className="p-6 text-center space-y-4">
            <Trophy className="h-14 w-14 mx-auto text-[hsl(142,60%,40%)]" />
            <div>
              <h3 className="text-2xl font-bold">
                {steps === 0 ? "Better luck next time!" : steps >= 5 ? "Bloomed!" : "Time's Up!"}
              </h3>
              <p className="text-muted-foreground mt-1">{completionMessage}</p>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              {mode === "survival" ? <Flame className="h-3 w-3 text-destructive" /> : <Timer className="h-3 w-3" />}
              {mode === "survival" ? "Survival Mode" : "Classic Mode"}
            </Badge>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold" data-testid="text-chain-length">{steps}</div>
                <div className="text-xs text-muted-foreground">steps deep</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold text-[hsl(142,60%,40%)]" data-testid="text-score">{score}</div>
                <div className="text-xs text-muted-foreground">total score</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold">{chain[chain.length - 1]?.word.length ?? 0}</div>
                <div className="text-xs text-muted-foreground">final length</div>
              </div>
            </div>

            {chain.length > 1 && (
              <div className="text-left space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your chain</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {chain.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`chain-entry-${i}`}>
                      {i > 0 && <ArrowUp className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {i === 0 && <Sprout className="h-3 w-3 text-[hsl(142,60%,40%)] shrink-0" />}
                      <ChainWordDisplay entry={entry} />
                      {i > 0 && (
                        <Badge variant="outline" className="text-xs ml-auto shrink-0">
                          +{entry.points}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leaderboard && leaderboard.length > 0 && (
              <div className="text-left space-y-2" data-testid="section-leaderboard">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Medal className="h-3 w-3" />
                  Top Scores ({mode === "survival" ? "Survival" : "Classic"})
                </p>
                <div className="space-y-1">
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <div key={entry.id} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/50" data-testid={`leaderboard-row-${i}`}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="font-medium">{entry.playerName}</span>
                      </span>
                      <span className="font-mono font-bold text-[hsl(142,60%,40%)]">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ShareResults
              gameName="Word Bloom"
              gameSlug={slug}
              score={score}
              wordsCompleted={steps}
              isWin={steps > 0}
            />
            {!user && (
              <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                <LogIn className="h-4 w-4 shrink-0" />
                <span>
                  <button className="underline font-medium" onClick={() => setAuthOpen(true)} data-testid="button-sign-in-cta">Sign in</button>{" "}
                  to save your score to the leaderboard!
                </span>
              </div>
            )}

            {!locked && (
              <div className="flex gap-3 pt-2 flex-wrap">
                <Button variant="outline" className="flex-1 gap-2" onClick={onExit} data-testid="button-change-mode">
                  Change Mode
                </Button>
                <Button
                  className="flex-1 gap-2"
                  style={{ backgroundColor: BLOOM_COLOR }}
                  onClick={() => {
                    chainRef.current = [];
                    scoreRef.current = 0;
                    recordedRef.current = false;
                    gameStatusRef.current = "playing";
                    setChain([]);
                    setScore(0);
                    setInput("");
                    setCurrentWord("");
                    setGameStatus("playing");
                    const newSeed = Math.floor(Math.random() * 100000);
                    (async () => {
                      const r = await fetch(`/api/games/word-bloom/puzzle?seed=${newSeed}`, { credentials: "include" });
                      if (!r.ok) return;
                      const p: PuzzleData = await r.json();
                      setPuzzle(p);
                      const seedEntry: ChainEntry = { word: p.seed, insertPos: -1, points: 0 };
                      setChain([seedEntry]);
                      chainRef.current = [seedEntry];
                      setCurrentWord(p.seed);
                      currentWordRef.current = p.seed;
                      seedLenRef.current = p.seed.length;
                      startTimer(mode === "classic" ? CLASSIC_TIME : SURVIVAL_TIME);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    })();
                  }}
                  data-testid="button-play-again"
                >
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </Button>
                <TryAnotherGameButton currentSlug="word-bloom" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const seedWord = puzzle?.seed ?? "";
  const steps = chain.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1" data-testid="badge-mode">
            {mode === "survival" ? <Flame className="h-3 w-3 text-destructive" /> : <Timer className="h-3 w-3" />}
            {mode === "survival" ? "Survival" : "Classic"}
          </Badge>
          <Badge variant="secondary" data-testid="badge-chain-length">
            {steps} step{steps !== 1 ? "s" : ""}
          </Badge>
          <Badge style={{ backgroundColor: BLOOM_COLOR }} className="text-white" data-testid="badge-score">
            {score} pts
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono font-bold tabular-nums text-sm ${timeLeft <= (mode === "survival" ? 3 : 15) ? "text-destructive" : ""}`}
            data-testid="text-timer"
          >
            {timeLeft}s
          </span>
          {!locked && (
            <Button variant="outline" size="sm" onClick={() => endGame()} data-testid="button-quit">
              Give Up
            </Button>
          )}
        </div>
      </div>

      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full transition-colors ${timerColor}`}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.5 }}
          data-testid="timer-bar"
        />
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {!puzzle ? (
            <div className="text-center py-8 text-muted-foreground">Loading puzzle…</div>
          ) : (
            <>
              {/* Chain history */}
              {chain.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto" data-testid="chain-display">
                  {chain.map((entry, i) => (
                    <motion.div
                      key={entry.word + i}
                      initial={i === chain.length - 1 && i > 0 ? { opacity: 0, y: 6 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2"
                      data-testid={`chain-step-${i}`}
                    >
                      {i === 0 && <Sprout className="h-3.5 w-3.5 text-[hsl(142,60%,40%)] shrink-0" />}
                      {i > 0 && <ArrowUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <ChainWordDisplay entry={entry} />
                      {i > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto">+{entry.points}</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Current word as tiles */}
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Insert one letter anywhere into{" "}
                  <strong className="text-foreground">{currentWord || seedWord}</strong>
                </p>
                <div className="flex justify-center gap-1.5 flex-wrap" data-testid="current-word-display">
                  {(currentWord || seedWord).split("").map((letter, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md border-2 border-[hsl(142,60%,40%)] bg-[hsl(142,60%,40%)]/10 text-[hsl(142,45%,30%)] dark:text-[hsl(142,60%,60%)]"
                      data-testid={`current-letter-${i}`}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`flex gap-2 justify-center ${shake ? "animate-shake" : ""}`}>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, (currentWord || seedWord).length + 1))}
                  onKeyDown={handleKeyDown}
                  placeholder={`${(currentWord || seedWord).length + 1}-letter word…`}
                  maxLength={(currentWord || seedWord).length + 1}
                  className="font-mono text-lg tracking-wider uppercase max-w-xs"
                  disabled={validating}
                  autoFocus
                  data-testid="input-word"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={validating || input.length !== (currentWord || seedWord).length + 1}
                  style={{ backgroundColor: BLOOM_COLOR }}
                  className="hover:opacity-90 text-white"
                  data-testid="button-submit"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <AnimatePresence>
                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-destructive text-center font-medium"
                    data-testid="text-error"
                  >
                    {errorMsg}
                  </motion.p>
                )}
              </AnimatePresence>

              {mode === "survival" && (
                <p className="text-xs text-center text-muted-foreground">
                  Find a valid next word to reset the {SURVIVAL_TIME}s timer and keep the chain growing!
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function ChainWordDisplay({ entry }: { entry: ChainEntry }) {
  if (entry.insertPos < 0) {
    return (
      <span className="font-mono text-sm font-semibold text-[hsl(142,60%,40%)]">
        {entry.word}
      </span>
    );
  }
  const before = entry.word.slice(0, entry.insertPos);
  const inserted = entry.word[entry.insertPos];
  const after = entry.word.slice(entry.insertPos + 1);
  return (
    <span className="font-mono text-sm font-medium">
      {before}
      <span className="text-[hsl(142,60%,40%)] font-bold underline decoration-dotted">{inserted}</span>
      {after}
    </span>
  );
}

interface WordBloomGameProps {
  groupSeed?: number;
  locked?: boolean;
  initialMode?: Mode;
}

export function WordBloomGame({ groupSeed, locked, initialMode }: WordBloomGameProps) {
  const [mode, setMode] = useState<Mode | null>(initialMode ?? null);
  const [playKey, setPlayKey] = useState(0);
  const initialSeed = groupSeed ?? Math.floor(Math.random() * 100000);

  if (mode !== null) {
    return (
      <WordBloomPlay
        key={playKey}
        mode={mode}
        initialSeed={initialSeed}
        onExit={() => {
          if (!initialMode) setMode(null);
          setPlayKey(k => k + 1);
        }}
        locked={locked}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sprout className="h-7 w-7 text-[hsl(142,60%,40%)]" />
          <h2 className="text-2xl font-bold">Word Bloom</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Start with a short seed word and grow it one letter at a time — without rearranging!
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          BE → BET → BEST → BEAST → BREAST
        </p>
      </div>

      <div className="grid gap-3">
        <Card
          className="cursor-pointer hover:border-[hsl(142,60%,40%)] transition-colors"
          onClick={() => setMode("classic")}
          data-testid="button-mode-classic"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2">
                <Timer className="h-4 w-4 text-[hsl(142,60%,40%)]" />
                Classic
              </div>
              <div className="text-sm text-muted-foreground">2 minutes — grow the chain as deep as possible</div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-destructive transition-colors"
          onClick={() => setMode("survival")}
          data-testid="button-mode-survival"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" />
                Survival
              </div>
              <div className="text-sm text-muted-foreground">8 seconds per step — keep the chain alive</div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to score</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ArrowUp className="h-3.5 w-3.5 text-[hsl(142,60%,40%)]" />
            <span>Each valid step: <strong>10 pts</strong> base</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUp className="h-3.5 w-3.5 text-[hsl(142,60%,40%)]" />
            <span>+<strong>5 pts</strong> per letter beyond seed length</span>
          </div>
          <div className="text-xs text-muted-foreground/70 pl-5">
            e.g. seed AM (2 letters) → AIM (3) = 10+5×1 = <strong>15 pts</strong>; AIM → AIMS (4) = 10+5×2 = <strong>20 pts</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
