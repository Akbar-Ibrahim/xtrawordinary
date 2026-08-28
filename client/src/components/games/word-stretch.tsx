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
  Expand,
  CheckCircle2,
  ChevronRight,
  Medal,
  XCircle,
  LogIn,
} from "lucide-react";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { AnimatedNumber } from "@/components/animated-number";
import { getCompletionMessage } from "@/lib/completion-messages";
import type { LeaderboardEntry } from "@shared/schema";

const CLASSIC_TIME = 120;
const SURVIVAL_TIME = 8;
const POINTS_NORMAL = 10;
const POINTS_MIDDLE = 15;
const POINTS_COMPLETION = 25;

type Mode = "classic" | "survival";
type GameStatus = "idle" | "playing" | "ended";

interface FoundEntry {
  word: string;
  isMiddle: boolean;
  points: number;
  insertPos: number;
}

function findInsertionPos(stretched: string, seed: string): number {
  for (let i = 0; i < stretched.length; i++) {
    if (stretched.slice(0, i) + stretched.slice(i + 1) === seed) return i;
  }
  return -1;
}

function isValidInsertion(input: string, seed: string): boolean {
  if (input.length !== seed.length + 1) return false;
  return findInsertionPos(input, seed) !== -1;
}

interface PuzzleData {
  word: string;
  totalSolutions: number;
}

interface WordStretchPlayProps {
  mode: Mode;
  initialSeed: number;
  onExit: () => void;
  locked?: boolean;
  isUntimed?: boolean;
}

function WordStretchPlay({ mode, initialSeed, onExit, locked, isUntimed }: WordStretchPlayProps) {
  const slug = mode === "classic" ? "word-stretch" : "word-stretch-survival";
  const { reportResult, resetRecorded } = useGameResult({ slug, isUntimed });
  const personalBest = usePersonalBest(slug);

  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [seed, setSeed] = useState(initialSeed);
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [timeLeft, setTimeLeft] = useState(mode === "classic" ? CLASSIC_TIME : SURVIVAL_TIME);
  const [found, setFound] = useState<FoundEntry[]>([]);
  const [input, setInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [validating, setValidating] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [survivalSolvedCount, setSurvivalSolvedCount] = useState(0);
  const [accumulatedScore, setAccumulatedScore] = useState(0);
  const [finalSeed, setFinalSeed] = useState(initialSeed);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedRef = useRef(false);
  const gameStatusRef = useRef<GameStatus>("playing");
  const foundRef = useRef<FoundEntry[]>([]);
  const puzzleRef = useRef<PuzzleData | null>(null);
  const accumulatedScoreRef = useRef(0);
  const survivalSolvedCountRef = useRef(0);
  const sessionSeedRef = useRef<number>(initialSeed);

  const { data: solutions } = useQuery<string[]>({
    queryKey: ["/api/games/word-stretch/solutions", finalSeed],
    queryFn: async () => {
      const r = await fetch(`/api/games/word-stretch/solutions?seed=${finalSeed}`, { credentials: "include" });
      const data = await r.json();
      return data.solutions as string[];
    },
    enabled: gameStatus === "ended" && mode === "classic",
    staleTime: 60_000,
  });

  const { data: modeLeaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", slug],
    queryFn: () => fetch(`/api/leaderboard?game=${slug}&limit=5`).then(r => r.json()),
    enabled: gameStatus === "ended" && !isUntimed,
    staleTime: 10_000,
  });

  const calcClassicScore = (entries: FoundEntry[], total: number): number => {
    const base = entries.reduce((sum, e) => sum + e.points, 0);
    const bonus = entries.length >= total ? POINTS_COMPLETION : 0;
    return base + bonus;
  };

  const endGame = useCallback((finalFound: FoundEntry[], total: number, survivedScore: number, survivedCount: number, endedSeed: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    gameStatusRef.current = "ended";
    const score = mode === "survival" ? survivedScore : calcClassicScore(finalFound, total);
    setFinalScore(score);
    setFinalSeed(endedSeed);
    setGameStatus("ended");
    setCompletionMessage(getCompletionMessage(mode === "survival" ? survivedCount > 3 : finalFound.length > 2));
    if (!recordedRef.current) {
      recordedRef.current = true;
      const count = mode === "survival" ? survivedCount : finalFound.length;
      reportResult(score, count > 0, count);
    }
  }, [mode, reportResult]);

  const fetchPuzzle = useCallback(async (s: number): Promise<PuzzleData | null> => {
    try {
      const r = await fetch(`/api/games/word-stretch/puzzle?seed=${s}`, { credentials: "include" });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }, []);

  const startTimer = useCallback((currentSeed: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const duration = mode === "classic" ? CLASSIC_TIME : SURVIVAL_TIME;
    setTimeLeft(duration);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (gameStatusRef.current === "playing") {
            const total = puzzleRef.current?.totalSolutions ?? 0;
            endGame(foundRef.current, total, accumulatedScoreRef.current, survivalSolvedCountRef.current, currentSeed);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [mode, endGame]);

  useEffect(() => {
    (async () => {
      const p = await fetchPuzzle(initialSeed);
      if (!p) return;
      setPuzzle(p);
      puzzleRef.current = p;
      if (!isUntimed) startTimer(initialSeed);
      setTimeout(() => inputRef.current?.focus(), 100);
    })();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    setTimeout(() => { setShake(false); setErrorMsg(""); }, 1500);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (validating || gameStatusRef.current !== "playing" || !puzzle) return;
    const word = input.toUpperCase().trim();
    if (!word) return;

    if (!isValidInsertion(word, puzzle.word)) {
      showError(`Must be ${puzzle.word.length + 1} letters with ${puzzle.word} inside`);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    if (foundRef.current.some(e => e.word === word)) {
      showError("Already found!");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    setValidating(true);
    try {
      const r = await fetch(
        `/api/games/word-stretch/validate?stretched=${encodeURIComponent(word)}&seedWord=${encodeURIComponent(puzzle.word)}`,
        { credentials: "include" }
      );
      const data = await r.json();

      if (!data.valid) {
        showError("Not a valid word");
        setValidating(false);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      const insertPos = findInsertionPos(word, puzzle.word);
      const isMiddle = data.isMiddle as boolean;
      const points = isMiddle ? POINTS_MIDDLE : POINTS_NORMAL;
      const entry: FoundEntry = { word, isMiddle, points, insertPos };
      const newFound = [...foundRef.current, entry];
      foundRef.current = newFound;
      setFound(newFound);
      setInput("");
      setValidating(false);

      if (mode === "survival") {
        const newAccumulated = accumulatedScoreRef.current + points;
        accumulatedScoreRef.current = newAccumulated;
        setAccumulatedScore(newAccumulated);
        const newCount = survivalSolvedCountRef.current + 1;
        survivalSolvedCountRef.current = newCount;
        setSurvivalSolvedCount(newCount);

        if (timerRef.current) clearInterval(timerRef.current);
        const nextSeed = seed + 1;
        setSeed(nextSeed);
        foundRef.current = [];
        setFound([]);
        const nextPuzzle = await fetchPuzzle(nextSeed);
        if (nextPuzzle && gameStatusRef.current === "playing") {
          setPuzzle(nextPuzzle);
          puzzleRef.current = nextPuzzle;
          if (!isUntimed) startTimer(nextSeed);
        }
      } else {
        if (newFound.length >= puzzle.totalSolutions) {
          endGame(newFound, puzzle.totalSolutions, 0, 0, seed);
        }
      }

      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      showError("Validation failed, try again");
      setValidating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, puzzle, validating, seed, mode, fetchPuzzle, startTimer, endGame, showError]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
  };

  const maxTime = mode === "classic" ? CLASSIC_TIME : SURVIVAL_TIME;
  const timerPercent = (timeLeft / maxTime) * 100;
  const timerColor = timerPercent > 33 ? "bg-[hsl(262,70%,55%)]" : timerPercent > 11 ? "bg-chart-3" : "bg-destructive";

  if (gameStatus === "ended") {
    const total = puzzle?.totalSolutions ?? 0;
    const foundWords = new Set(found.map(e => e.word));
    const unfound = solutions ? solutions.filter(s => !foundWords.has(s)) : [];
    return (
      <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <Card className="border-[hsl(262,70%,55%)]">
          <CardContent className="p-6 text-center space-y-4">
            <Trophy className="h-14 w-14 mx-auto text-[hsl(262,70%,55%)]" />
            <div>
              <h3 className="text-2xl font-bold">
              {isUntimed
                ? mode === "classic" && found.length >= total ? "All Found!" : "Session Complete"
                : mode === "classic" && found.length >= total ? "All Found!" : "Time's Up!"}
              </h3>
              <p className="text-muted-foreground mt-1">{completionMessage}</p>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              {isUntimed ? "∞ Untimed" : mode === "survival" ? "Survival Mode" : "Classic Mode"}
            </Badge>

            <div className="grid grid-cols-3 gap-3">
              {mode === "survival" ? (
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl font-bold" data-testid="text-words-solved">{survivalSolvedCount}</div>
                  <div className="text-xs text-muted-foreground">words solved</div>
                </div>
              ) : (
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl font-bold" data-testid="text-found-count">{found.length}</div>
                  <div className="text-xs text-muted-foreground">of {total} found</div>
                </div>
              )}
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold text-[hsl(262,70%,55%)]" data-testid="text-score">{finalScore}</div>
                <div className="text-xs text-muted-foreground">total score</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold">{found.filter(e => e.isMiddle).length}</div>
                <div className="text-xs text-muted-foreground">middle bonus</div>
              </div>
            </div>

            {mode === "classic" && (
              <div className="text-left space-y-2">
                {found.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-accent" />
                      Found ({found.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {found.map((e, i) => (
                        <StretchedWordBadge key={i} entry={e} seed={puzzle?.word ?? ""} data-testid={`found-word-${i}`} />
                      ))}
                    </div>
                  </div>
                )}
                {unfound.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      Missed ({unfound.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {unfound.map((w, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-muted-foreground" data-testid={`missed-word-${i}`}>
                          {w}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {modeLeaderboard && modeLeaderboard.length > 0 && (
              <div className="text-left space-y-2" data-testid="section-leaderboard">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Medal className="h-3 w-3" />
                  Top Scores ({mode === "survival" ? "Survival" : "Classic"})
                </p>
                <div className="space-y-1">
                  {modeLeaderboard.slice(0, 5).map((entry, i) => (
                    <div key={entry.id} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/50" data-testid={`leaderboard-row-${i}`}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="font-medium">{entry.playerName}</span>
                      </span>
                      <span className="font-mono font-bold text-[hsl(262,70%,55%)]">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ShareResults
              gameName="Word Stretch"
              gameSlug={slug}
              score={finalScore}
              wordsCompleted={mode === "survival" ? survivalSolvedCount : found.length}
              isWin={found.length > 0 || survivalSolvedCount > 0}
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
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  className="bg-sky-500 hover:bg-sky-600 text-white border-0"
                  onClick={() => {
                    resetRecorded();
                    foundRef.current = [];
                    accumulatedScoreRef.current = 0;
                    survivalSolvedCountRef.current = 0;
                    recordedRef.current = false;
                    gameStatusRef.current = "playing";
                    setFound([]);
                    setInput("");
                    setFinalScore(0);
                    setAccumulatedScore(0);
                    setSurvivalSolvedCount(0);
                    setGameStatus("playing");
                    const replaySeed = sessionSeedRef.current;
                    setSeed(replaySeed);
                    fetchPuzzle(replaySeed).then(p => {
                      if (p) { setPuzzle(p); puzzleRef.current = p; }
                      if (!isUntimed) startTimer(replaySeed);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    });
                  }}
                  data-testid="button-replay"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Replay
                </Button>
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                  onClick={() => {
                    resetRecorded();
                    foundRef.current = [];
                    accumulatedScoreRef.current = 0;
                    survivalSolvedCountRef.current = 0;
                    recordedRef.current = false;
                    gameStatusRef.current = "playing";
                    setFound([]);
                    setInput("");
                    setFinalScore(0);
                    setAccumulatedScore(0);
                    setSurvivalSolvedCount(0);
                    setGameStatus("playing");
                    const newSeed = Math.floor(Math.random() * 100000);
                    sessionSeedRef.current = newSeed;
                    setSeed(newSeed);
                    fetchPuzzle(newSeed).then(p => {
                      if (p) { setPuzzle(p); puzzleRef.current = p; }
                      if (!isUntimed) startTimer(newSeed);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    });
                  }}
                  data-testid="button-play-again"
                >
                  Play Again
                </Button>
                <Button className="bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={onExit} data-testid="button-main-menu">
                  Main Menu
                </Button>
                <TryAnotherGameButton currentSlug="word-stretch" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  const seedWord = puzzle?.word ?? "";
  const total = puzzle?.totalSolutions ?? 0;
  const liveScore = mode === "survival" ? accumulatedScore : calcClassicScore(found, total);

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-center gap-8">
        {isUntimed ? (
          <Badge variant="outline" className="gap-1 text-blue-600 border-blue-400 text-xs" data-testid="badge-untimed">
            ∞ Untimed
          </Badge>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Timer className={`h-4 w-4 ${timeLeft <= (mode === "survival" ? 3 : 15) ? "text-destructive animate-pulse" : ""}`} />
            <span
              className={`font-mono font-bold text-lg ${timeLeft <= (mode === "survival" ? 3 : 15) ? "text-destructive animate-pulse" : ""}`}
              data-testid="text-timer"
            >
              {mode === "survival" ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
            </span>
          </div>
        )}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Score</p>
          <AnimatedNumber value={liveScore} className="text-2xl font-bold text-primary" data-testid="text-score" />
        </div>
      </div>

      {!isUntimed && <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full transition-colors ${timerColor}`}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.5 }}
          data-testid="timer-bar"
        />
      </div>}

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {!puzzle ? (
            <div className="text-center py-8 text-muted-foreground">Loading puzzle…</div>
          ) : (
            <>
              <div className="flex justify-center gap-2">
                <Badge variant="outline" className="gap-1" data-testid="badge-mode">
                  {mode === "survival" ? <Flame className="h-3 w-3 text-destructive" /> : <Timer className="h-3 w-3" />}
                  {mode === "survival" ? "Survival" : "Classic"}
                </Badge>
                {mode === "classic" && (
                  <Badge variant="secondary" data-testid="badge-found-count">
                    {found.length} / {total} found
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-center gap-2.5 py-1.5 border-t border-b border-border/50" data-testid="word-count-strip">
                <motion.span
                  key={mode === "survival" ? survivalSolvedCount : found.length}
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl font-bold tabular-nums leading-none text-primary"
                  data-testid="text-live-word-count"
                >
                  {mode === "survival" ? survivalSolvedCount : found.length}
                </motion.span>
                <span className="text-sm text-muted-foreground leading-none">
                  {mode === "survival" ? "solved" : "found"}
                </span>
                <span className="text-muted-foreground/40 leading-none">·</span>
                <span className="text-sm text-muted-foreground leading-none">
                  PB: <span className="font-semibold text-foreground">{personalBest > 0 ? personalBest : "—"}</span>
                </span>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Insert one letter anywhere to make a new word</p>
                <div className="flex justify-center gap-1.5 flex-wrap" data-testid="seed-word-display">
                  {seedWord.split("").map((letter, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md border-2 border-[hsl(262,70%,55%)] bg-[hsl(262,70%,55%)]/10 text-[hsl(262,70%,40%)] dark:text-[hsl(262,70%,70%)]"
                      data-testid={`seed-letter-${i}`}
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
                  onChange={e => setInput(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, seedWord.length + 1))}
                  onKeyDown={handleKeyDown}
                  placeholder={`${seedWord.length + 1}-letter word…`}
                  maxLength={seedWord.length + 1}
                  className="font-mono text-lg tracking-wider uppercase max-w-xs"
                  autoFocus
                  data-testid="input-word"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={validating || !puzzle || input.length !== seedWord.length + 1}
                  className="bg-[hsl(262,70%,55%)] hover:bg-[hsl(262,70%,45%)]"
                  data-testid="button-submit"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
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
              </div>

              {found.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Found words</p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    <AnimatePresence>
                      {found.map((e, i) => (
                        <motion.div
                          key={e.word}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          data-testid={`found-word-${i}`}
                        >
                          <StretchedWordBadge entry={e} seed={seedWord} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {mode === "survival" && !isUntimed && (
                <p className="text-xs text-center text-muted-foreground">
                  Find any valid stretched word to reset the {SURVIVAL_TIME}s timer!
                </p>
              )}
              {!locked && (
                <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/40">
                  {mode === "survival" && isUntimed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => endGame(
                        foundRef.current,
                        puzzleRef.current?.totalSolutions ?? 0,
                        accumulatedScoreRef.current,
                        survivalSolvedCountRef.current,
                        seed,
                      )}
                      data-testid="button-finish-session"
                    >
                      Finish Session
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (timerRef.current) clearInterval(timerRef.current);
                      onExit();
                    }}
                    data-testid="button-menu"
                  >
                    Menu
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (timerRef.current) clearInterval(timerRef.current);
                      onExit();
                    }}
                    data-testid="button-quit"
                  >
                    Quit
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

function StretchedWordBadge({ entry, seed, "data-testid": testId }: { entry: FoundEntry; seed: string; "data-testid"?: string }) {
  const before = entry.word.slice(0, entry.insertPos);
  const inserted = entry.word[entry.insertPos];
  const after = entry.word.slice(entry.insertPos + 1);
  return (
    <div className="inline-flex items-center gap-0" data-testid={testId}>
      <span className="font-mono text-sm px-2 py-0.5 rounded-l-md bg-muted border border-border border-r-0">
        {before}
        <span className="text-[hsl(262,70%,55%)] font-bold">{inserted}</span>
        {after}
      </span>
      <Badge
        className={`rounded-l-none rounded-r-md text-xs ${entry.isMiddle ? "bg-[hsl(262,70%,55%)]" : "bg-secondary text-secondary-foreground"}`}
      >
        +{entry.points}
      </Badge>
    </div>
  );
}

interface WordStretchGameProps {
  groupSeed?: number;
  locked?: boolean;
  initialMode?: Mode;
  isUntimed?: boolean;
}

export function WordStretchGame({ groupSeed, locked, initialMode, isUntimed }: WordStretchGameProps) {
  const [mode, setMode] = useState<Mode | null>(initialMode ?? null);
  const [playKey, setPlayKey] = useState(0);
  const initialSeed = groupSeed ?? Math.floor(Math.random() * 100000);

  if (mode !== null) {
    return (
      <WordStretchPlay
        key={playKey}
        mode={mode}
        initialSeed={initialSeed}
        onExit={() => {
          if (!initialMode) setMode(null);
          setPlayKey(k => k + 1);
        }}
        locked={locked}
          isUntimed={isUntimed}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Expand className="h-7 w-7 text-[hsl(262,70%,55%)]" />
          <h2 className="text-2xl font-bold">Word Stretch</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Insert one letter anywhere into the seed word to make a new valid word. Find as many as you can!
        </p>
      </div>

      <div className="grid gap-3">
        <Card
          className="cursor-pointer hover:border-[hsl(262,70%,55%)] transition-colors"
          onClick={() => setMode("classic")}
          data-testid="button-mode-classic"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2">
                {isUntimed ? <span className="text-lg leading-none text-blue-600">∞</span> : <Timer className="h-4 w-4 text-[hsl(262,70%,55%)]" />}
                Classic
              </div>
              <div className="text-sm text-muted-foreground">
                {isUntimed ? "No timer — find all valid insertions" : "2 minutes — find all valid insertions"}
              </div>
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
                {isUntimed ? <span className="text-lg leading-none text-blue-600">∞</span> : <Flame className="h-4 w-4 text-destructive" />}
                Survival
              </div>
              <div className="text-sm text-muted-foreground">
                {isUntimed ? "No timer — find one, then move on" : "8 seconds — find one, move on"}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to score</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(262,70%,55%)]" />
            <span>Any valid insertion: <strong>10 pts</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(262,70%,55%)]" />
            <span>Middle insertion (not at start or end): <strong>15 pts</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-[hsl(262,70%,55%)]" />
            <span>Find all solutions: <strong>+25 bonus pts</strong> (Classic only)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
