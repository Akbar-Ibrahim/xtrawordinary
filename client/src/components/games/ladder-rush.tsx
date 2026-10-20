import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Loader2, Zap, Clock, ChevronRight, Star, Medal, Flame, Timer, LogIn, Lightbulb } from "lucide-react";
import { useSound } from "@/lib/sound-provider";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";
import { useGameSession } from "@/hooks/use-game-session";
import type { LadderRushPuzzle, LeaderboardEntry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";

const GAME_DURATION = 90;
const SURVIVAL_TIME_PER_WORD = 8;
const DEFAULT_MAX_HINTS = 3;
const DEFAULT_HINT_PENALTY = 2;
const SURVIVAL_TIME_OPTIONS = [
  { label: "Easy",   seconds: 15 },
  { label: "Normal", seconds: 8  },
  { label: "Hard",   seconds: 5  },
] as const;
const WORD_LENGTHS = [
  { length: 4, label: "Easy", sublabel: "4-letter words", description: "More neighbors, easier to chain" },
  { length: 5, label: "Medium", sublabel: "5-letter words", description: "Balanced challenge" },
  { length: 6, label: "Hard", sublabel: "6-letter words", description: "Trickier, but higher score" },
];

function isNLetterDiff(a: string, b: string, n: number): boolean {
  if (a.length !== b.length) return false;
  const freqA: Record<string, number> = {};
  const freqB: Record<string, number> = {};
  for (const c of a) freqA[c] = (freqA[c] || 0) + 1;
  for (const c of b) freqB[c] = (freqB[c] || 0) + 1;
  let added = 0, removed = 0;
  const allLetters = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  for (const c of allLetters) {
    const diff = (freqB[c] || 0) - (freqA[c] || 0);
    if (diff > 0) added += diff;
    else removed -= diff;
  }
  return added === n && removed === n;
}

function calcScore(wordsChained: number, hintDeductions: number = 0): number {
  return Math.max(0, wordsChained - hintDeductions);
}

interface LadderRushPlayProps {
  wordLength: number;
  puzzles: LadderRushPuzzle[];
  isSurvival: boolean;
  survivalTime?: number;
  timeLimitSeconds?: number;
  doubleSwap?: boolean;
  onExit: () => void;
  onPlayAgain: () => void;
  onReplay: (startWord: string) => void;
  initialStartWord?: string;
  locked?: boolean;
  isUntimed?: boolean;
  maxHints?: number;
  hintPenalty?: number;
}

function LadderRushPlay({ wordLength, puzzles, isSurvival, survivalTime, timeLimitSeconds, doubleSwap, onExit, onPlayAgain, onReplay, initialStartWord, locked, isUntimed, maxHints = DEFAULT_MAX_HINTS, hintPenalty = DEFAULT_HINT_PENALTY }: LadderRushPlayProps) {
  const { playSound } = useSound();
  const swapCount = doubleSwap ? 2 : 1;
  const baseSlug = doubleSwap ? `ladder-rush-double-${wordLength}` : `ladder-rush-${wordLength}`;
  const slug = isSurvival ? `${baseSlug}-survival` : baseSlug;
  const { reportResult } = useGameResult({ slug, isUntimed });
  const effectiveSurvivalTime = survivalTime ?? SURVIVAL_TIME_PER_WORD;

  const [gameStatus, setGameStatus] = useState<"playing" | "ended">("playing");
  const [chain, setChain] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const effectiveGameDuration = timeLimitSeconds ?? GAME_DURATION;
  const [timeLeft, setTimeLeft] = useState(isSurvival ? effectiveSurvivalTime : effectiveGameDuration);
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [validating, setValidating] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chainEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    sessionId,
    startSession,
    endSession,
    isSessionActive,
  } = useGameSession();
  const activeSessionRef = useRef<number | null>(null);
  const recordedRef = useRef(false);
  const chainRef = useRef<string[]>([]);
  const isSurvivalRef = useRef(isSurvival);
  const [hintsUsed, setHintsUsed] = useState(0);
  const hintsUsedRef = useRef(0);
  const [hintedWordIndices, setHintedWordIndices] = useState<number[]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState("");

  const { data: modeLeaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", slug],
    queryFn: () => fetch(`/api/leaderboard/${encodeURIComponent(slug)}`).then(r => r.json()),
    staleTime: 60_000,
  });

  const topScore = modeLeaderboard && modeLeaderboard.length > 0 ? modeLeaderboard[0].score : null;

  const pickStartWord = useCallback((): string => {
    const filtered = puzzles.filter(p => p.wordLength === wordLength);
    const pool = filtered.length > 0 ? filtered : puzzles;
    if (pool.length === 0) return "";
    return pool[Math.floor(Math.random() * pool.length)].start;
  }, [puzzles, wordLength]);

  const endGame = useCallback((activeSession: number, finalChain: string[]) => {
    if (!endSession(activeSession)) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const wordsChained = finalChain.length - 1;
    const wordsChainedByPlayer = wordsChained - hintsUsedRef.current;
    const deductions = hintsUsedRef.current * hintPenalty;
    const score = calcScore(wordsChainedByPlayer, deductions);
    setFinalScore(score);
    setGameStatus("ended");
  }, [endSession, hintPenalty]);

  useEffect(() => {
    if (gameStatus !== "ended" || recordedRef.current) return;
    recordedRef.current = true;
    const wordsChained = chainRef.current.length - 1;
    setCompletionMessage(getCompletionMessage(wordsChained > 3));
    playSound(wordsChained > 3 ? "win" : "wrong");
    const isCompetitive = !isSurvivalRef.current || effectiveSurvivalTime === SURVIVAL_TIME_PER_WORD;
    if (isCompetitive) {
      reportResult(finalScore, wordsChained > 0, wordsChained);
    }
  }, [gameStatus, finalScore, playSound, reportResult, effectiveSurvivalTime]);

  const startSurvivalTimer = useCallback((activeSession: number) => {
    if (!isSessionActive(activeSession)) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(effectiveSurvivalTime);
    const timer = setInterval(() => {
      if (timerRef.current !== timer || !isSessionActive(activeSession)) return;
      setTimeLeft(prev => {
        if (!isSessionActive(activeSession)) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          timerRef.current = null;
          endGame(activeSession, chainRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = timer;
  }, [effectiveSurvivalTime, endGame, isSessionActive]);

  const lastStartWordRef = useRef<string>("");

  // This keyed component represents one run; initialize it once when mounted.
  useEffect(() => {
    const startWord = initialStartWord || pickStartWord();
    if (!startWord) return;
    const activeSession = startSession();
    activeSessionRef.current = activeSession;
    lastStartWordRef.current = startWord;
    recordedRef.current = false;
    const initialChain = [startWord];
    chainRef.current = initialChain;
    setChain(initialChain);
    setHintedWordIndices([]);
    setCurrentInput("");
    setTimeLeft(isSurvivalRef.current ? effectiveSurvivalTime : effectiveGameDuration);
    setErrorMsg("");
    setTimeout(() => {
      if (isSessionActive(activeSession)) inputRef.current?.focus();
    }, 100);
  }, []);

  useEffect(() => () => {
    const activeSession = activeSessionRef.current;
    if (activeSession !== null) endSession(activeSession);
  }, [endSession]);

  useEffect(() => {
    if (isUntimed || !isSessionActive(sessionId)) return;
    // Survival mode resets this interval after each word; this interval starts
    // the first survival countdown and the classic countdown.
    const timer = setInterval(() => {
      if (timerRef.current !== timer || !isSessionActive(sessionId)) return;
      setTimeLeft(prev => {
        if (!isSessionActive(sessionId)) return prev;
        if (prev <= 1) {
          clearInterval(timer);
          timerRef.current = null;
          endGame(sessionId, chainRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = timer;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [endGame, isUntimed, sessionId, isSessionActive]);

  useEffect(() => {
    if (chain.length > 1) {
      chainEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chain]);

  const submitWord = useCallback(async () => {
    if (validating || gameStatus !== "playing" || !isSessionActive(sessionId)) return;
    const activeSession = sessionId;
    const word = currentInput.toUpperCase().trim();
    if (!word) return;

    if (word.length !== wordLength) {
      setErrorMsg(`Word must be ${wordLength} letters`);
      setShake(true);
      playSound("wrong");
      setTimeout(() => {
        if (isSessionActive(activeSession)) { setShake(false); setErrorMsg(""); }
      }, 1500);
      return;
    }

    const lastWord = chainRef.current[chainRef.current.length - 1];
    if (!isNLetterDiff(lastWord, word, swapCount)) {
      setErrorMsg(swapCount === 1 ? "Change exactly one letter" : `Change exactly ${swapCount} letters`);
      setShake(true);
      playSound("wrong");
      setTimeout(() => {
        if (isSessionActive(activeSession)) { setShake(false); setErrorMsg(""); }
      }, 1500);
      return;
    }

    if (chainRef.current.includes(word)) {
      setErrorMsg("Word already used in this chain");
      setShake(true);
      playSound("wrong");
      setTimeout(() => {
        if (isSessionActive(activeSession)) { setShake(false); setErrorMsg(""); }
      }, 1500);
      return;
    }

    setValidating(true);
    try {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      if (!isSessionActive(activeSession)) return;
      const data = await response.json();
      if (!isSessionActive(activeSession)) return;

      if (!data.valid) {
        flushSync(() => {
          setErrorMsg("Not a valid word");
          setShake(true);
          setValidating(false);
        });
        playSound("wrong");
        setTimeout(() => {
          if (isSessionActive(activeSession)) { setShake(false); setErrorMsg(""); }
        }, 1500);
        if (isSessionActive(activeSession)) inputRef.current?.focus();
        return;
      }

      const newChain = [...chainRef.current, word];
      chainRef.current = newChain;
      flushSync(() => {
        setValidating(false);
        setChain(newChain);
        setCurrentInput("");
      });
      playSound("correct");

      if (isSurvivalRef.current) {
        startSurvivalTimer(activeSession);
      }

      setTimeout(() => {
        if (isSessionActive(activeSession)) inputRef.current?.focus();
      }, 50);
    } catch {
      if (!isSessionActive(activeSession)) return;
      flushSync(() => {
        setErrorMsg("Validation failed, try again");
        setValidating(false);
      });
      setTimeout(() => {
        if (isSessionActive(activeSession)) setErrorMsg("");
      }, 2000);
    }
  }, [currentInput, wordLength, validating, gameStatus, sessionId, isSessionActive, playSound, startSurvivalTimer]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); submitWord(); }
  }, [submitWord]);

  const useHint = useCallback(async () => {
    if (hintsUsedRef.current >= maxHints || gameStatus !== "playing" || hintLoading || !isSessionActive(sessionId)) return;
    const activeSession = sessionId;
    setHintLoading(true);
    setHintError("");
    try {
      const response = await apiRequest("POST", "/api/games/ladder-rush/hint", {
        currentWord: chainRef.current[chainRef.current.length - 1],
        usedWords: chainRef.current,
        doubleSwap: doubleSwap ?? false,
      });
      if (!isSessionActive(activeSession)) return;
      const data = await response.json();
      if (!isSessionActive(activeSession)) return;
      if (typeof data?.word === "string" && data.word) {
        const newChain = [...chainRef.current, data.word];
        chainRef.current = newChain;
        hintsUsedRef.current += 1;
        setHintedWordIndices(indices => [...indices, newChain.length - 1]);
        setChain(newChain);
        setHintsUsed(hintsUsedRef.current);
        setCurrentInput("");
        setHintError("");
        playSound("correct");
        if (isSurvivalRef.current) startSurvivalTimer(activeSession);
        setTimeout(() => {
          if (isSessionActive(activeSession)) inputRef.current?.focus();
        }, 50);
      } else {
        setHintError("Hint unavailable. Try again.");
      }
    } catch {
      if (!isSessionActive(activeSession)) return;
      setHintError("Hint unavailable. Try again.");
    } finally {
      if (isSessionActive(activeSession)) setHintLoading(false);
    }
  }, [gameStatus, hintLoading, maxHints, doubleSwap, sessionId, isSessionActive, playSound, startSurvivalTimer]);

  const wordsChained = chain.length - 1;
  // Hint words don't count toward score; penalty applied separately
  const wordsChainedByPlayer = wordsChained - hintsUsed;
  const hintDeductions = hintsUsed * hintPenalty;
  const liveScore = calcScore(wordsChainedByPlayer, hintDeductions);
  const hintsRemaining = maxHints - hintsUsed;
  const maxTime = isSurvivalRef.current ? effectiveSurvivalTime : effectiveGameDuration;
  const timerPercent = (timeLeft / maxTime) * 100;
  const timerColor = timeLeft > (maxTime * 0.33) ? "bg-accent" : timeLeft > (maxTime * 0.11) ? "bg-chart-3" : "bg-destructive";

  if (gameStatus === "ended") {
    const endedWordsChained = chain.length - 1;
    return (
      <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-4"
      >
        <Card className="border-[hsl(38,92%,50%)]">
          <CardContent className="p-6 text-center space-y-4">
            <Trophy className="h-14 w-14 mx-auto text-[hsl(38,92%,50%)]" />
            <div>
              <h3 className="text-2xl font-bold">Time's Up!</h3>
              <p className="text-muted-foreground mt-1">{completionMessage}</p>
            </div>
            {isSurvivalRef.current ? (
              <Badge variant="secondary" className="gap-1.5">
                <Flame className="h-3 w-3" />
                Survival Mode
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5">
                <Timer className="h-3 w-3" />
                Classic Mode
              </Badge>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold" data-testid="text-words-chained">{endedWordsChained}</div>
                <div className="text-xs text-muted-foreground">words chained</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold text-[hsl(38,92%,50%)]" data-testid="text-score">{finalScore}</div>
                <div className="text-xs text-muted-foreground">total score</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-2xl font-bold">{wordLength}L</div>
                <div className="text-xs text-muted-foreground">word length</div>
              </div>
            </div>
            {maxHints > 0 && hintsUsed > 0 && (
              <p className="text-xs text-muted-foreground text-center" data-testid="text-hints-used">
                <Lightbulb className="inline h-3 w-3 mr-1 opacity-60" />
                {hintsUsed} hint{hintsUsed !== 1 ? "s" : ""} used (−{hintsUsed * hintPenalty} pts)
              </p>
            )}

            {chain.length > 0 && (
              <div className="text-left space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your chain</p>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {chain.map((word, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <Badge
                        variant={i === 0 ? "default" : "secondary"}
                        className={`font-mono ${hintedWordIndices.includes(i) ? "border-amber-500 bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-300" : ""}`}
                        data-testid={`chain-word-${i}`}
                        data-hinted-word={hintedWordIndices.includes(i) ? "true" : "false"}
                      >
                        {word}
                      </Badge>
                      {hintedWordIndices.includes(i) && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          Hint
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {modeLeaderboard && modeLeaderboard.length > 0 && (
              <div className="text-left space-y-2" data-testid="section-mode-leaderboard">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Medal className="h-3 w-3" />
                  {wordLength}-letter Top Scores {isSurvivalRef.current ? "(Survival)" : "(Classic)"}
                </p>
                <div className="space-y-1">
                  {modeLeaderboard.slice(0, 5).map((entry, i) => (
                    <div key={entry.id} className="flex items-center justify-between text-sm px-2 py-1 rounded bg-muted/50" data-testid={`leaderboard-row-${i}`}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="font-medium">{entry.playerName}</span>
                      </span>
                      <span className="font-mono font-bold text-[hsl(38,92%,50%)]">{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ShareResults
              gameName={doubleSwap ? "Ladder Rush: Double Swap" : "Ladder Rush"}
              gameSlug={slug}
              score={finalScore}
              wordsCompleted={endedWordsChained}
              isWin={endedWordsChained > 0}
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
                  onClick={() => onReplay(lastStartWordRef.current)}
                  data-testid="button-replay"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Replay
                </Button>
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                  onClick={onPlayAgain}
                  data-testid="button-play-again"
                >
                  Play Again
                </Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-white border-0"
                  onClick={onExit}
                  data-testid="button-main-menu"
                >
                  Main Menu
                </Button>
                <TryAnotherGameButton currentSlug="ladder-rush" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isUntimed ? (
            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-400 text-xs" data-testid="badge-untimed">
              ∞ Untimed
            </Badge>
          ) : (
            <>
              <Clock className={`h-4 w-4 ${timeLeft <= (isSurvivalRef.current ? 3 : 10) ? "text-destructive animate-pulse" : ""}`} />
              <span
                className={`font-mono font-bold text-lg ${timeLeft <= (isSurvivalRef.current ? 3 : 10) ? "text-destructive animate-pulse" : ""}`}
                data-testid="badge-timer"
                role="timer"
                aria-label={`Time remaining: ${isSurvivalRef.current ? timeLeft + "s" : Math.floor(timeLeft / 60) + ":" + (timeLeft % 60).toString().padStart(2, "0")}`}
              >
                {isSurvivalRef.current ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
              </span>
              {isSurvivalRef.current && (
                <Badge variant="outline" className="gap-1 text-destructive border-destructive/50 text-xs" data-testid="badge-survival">
                  <Flame className="h-3 w-3" />
                  Survival
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Score</p>
          <div className="flex items-center justify-center gap-2">
            <AnimatedNumber value={liveScore} className="text-2xl font-bold text-primary" data-testid="badge-score" />
            {hintsUsed > 0 && (
              <span className="text-xs text-muted-foreground" data-testid="text-live-hint-deduction">
                {hintsUsed} hint{hintsUsed !== 1 ? "s" : ""} used · −{hintDeductions} pts
              </span>
            )}
          </div>
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
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs" data-testid="badge-length">
              {wordLength}-letter
            </Badge>
            {isSurvivalRef.current ? (
              <Badge variant="outline" className="gap-1 text-destructive border-destructive/50 text-xs">
                <Flame className="h-3 w-3" />
                Survival
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-classic">
                <Timer className="h-3 w-3" />
                Classic
              </Badge>
            )}
          </div>
          <div className="h-[300px] overflow-y-auto space-y-2 flex flex-col items-center">
            {chain.map((word, i) => {
              const isStart = i === 0;
              const isLatest = i === chain.length - 1;
              const prevWord = i > 0 ? chain[i - 1] : null;
              return (
                <motion.div
                  key={`${word}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2"
                  ref={isLatest ? chainEndRef : undefined}
                >
                  <div className="flex gap-1" data-testid={`chain-rung-${i}`}>
                    {word.split("").map((letter, li) => {
                      const changed = prevWord && prevWord[li] !== letter;
                      return (
                        <div
                          key={li}
                          className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-base sm:text-lg font-bold rounded-md border-2 transition-colors ${
                            isStart
                              ? "bg-primary text-primary-foreground border-primary"
                              : changed
                              ? "bg-[hsl(38,92%,50%)] text-white border-[hsl(38,92%,50%)] shadow-sm"
                              : "border-border bg-card"
                          }`}
                          data-testid={`letter-${i}-${li}`}
                        >
                          {letter}
                        </div>
                      );
                    })}
                  </div>
                  {isStart && (
                    <Badge variant="secondary" className="text-xs shrink-0" data-testid="badge-start">
                      START
                    </Badge>
                  )}
                  {isLatest && !isStart && (
                    <Badge className="text-xs bg-[hsl(38,92%,50%)]/20 text-[hsl(38,92%,35%)] border border-[hsl(38,92%,50%)]/30 shrink-0" data-testid="badge-latest">
                      +{swapCount}
                    </Badge>
                  )}
                </motion.div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2.5 py-1.5 border-t border-b border-border/50" data-testid="word-count-strip">
            <motion.span
              key={wordsChained}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-2xl font-bold tabular-nums leading-none text-primary"
              data-testid="text-live-word-count"
            >
              {wordsChained}
            </motion.span>
            <span className="text-sm text-muted-foreground leading-none">
              word{wordsChained !== 1 ? "s" : ""} chained
            </span>
            {topScore !== null && (
              <>
                <span className="text-muted-foreground/40 leading-none">·</span>
                <span className="text-sm text-muted-foreground leading-none">
                  Top: <span className="font-semibold text-foreground" data-testid="text-top-score">{topScore}</span>
                </span>
              </>
            )}
          </div>

          {isSurvivalRef.current && (
            <p className="text-xs text-center text-muted-foreground">
              Correct answer resets the {effectiveSurvivalTime}s timer!
            </p>
          )}

          <div className={`flex gap-2 justify-center ${shake ? "animate-shake" : ""}`}>
            <Input
              ref={inputRef}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, wordLength))}
              onKeyDown={handleKeyDown}
              placeholder={`${wordLength}-letter word…`}
              maxLength={wordLength}
              className="font-mono text-lg tracking-wider uppercase max-w-xs"
              autoFocus
              data-testid="input-word"
            />
            <Button
              onClick={submitWord}
              disabled={validating || currentInput.length !== wordLength}
              data-testid="button-submit"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
          {!locked && (
            <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  timerRef.current = null;
                  endSession(sessionId);
                  onExit();
                }}
                data-testid="button-menu"
              >
                Menu
              </Button>
              {maxHints > 0 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={useHint}
                    disabled={hintsRemaining <= 0 || hintLoading || gameStatus !== "playing"}
                    className="gap-1.5"
                    data-testid="button-hint"
                  >
                    {hintLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Lightbulb className="h-3.5 w-3.5" />}
                    Hint ({hintsRemaining})
                  </Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="text-hint-cost">
                    −{hintPenalty} pts / hint
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => endGame(sessionId, chainRef.current)}
                data-testid="button-end-game"
              >
                End Game
              </Button>
            </div>
          )}
          {hintError && (
            <p
              className="text-sm text-destructive text-center font-medium"
              role="status"
              aria-live="polite"
              data-testid="text-hint-error"
            >
              {hintError}
            </p>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className="text-sm text-destructive text-center font-medium" data-testid="text-error">
              {errorMsg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

interface LadderRushGameProps {
  groupSeed?: number;
  dailyChallengeSeed?: number;
  locked?: boolean;
  doubleSwap?: boolean;
  isUntimed?: boolean;
  timeLimitSeconds?: number;
}

export function LadderRushGame({ groupSeed, dailyChallengeSeed, locked, doubleSwap, isUntimed, timeLimitSeconds }: LadderRushGameProps) {
  const [selectedLength, setSelectedLength] = useState<number | null>(() =>
    dailyChallengeSeed === undefined ? null : 4 + (Math.abs(dailyChallengeSeed) % 3),
  );
  const [isSurvival, setIsSurvival] = useState(false);
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME_PER_WORD);
  const [playing, setPlaying] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [replayStartWord, setReplayStartWord] = useState<string | undefined>(undefined);

  const { data: puzzles = [], isLoading } = useQuery<LadderRushPuzzle[]>({
    queryKey: ["/api/games/ladder-rush/puzzles", selectedLength],
    queryFn: async () => {
      if (!selectedLength) return [];
      const r = await fetch(`/api/games/ladder-rush/puzzles?wordLength=${selectedLength}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to fetch Ladder Rush puzzles");
      return r.json();
    },
    enabled: selectedLength !== null,
  });
  const dailyStartWord = useMemo(() => {
    if (dailyChallengeSeed === undefined || selectedLength === null) return undefined;
    const starts = puzzles
      .filter(puzzle => puzzle.wordLength === selectedLength)
      .map(puzzle => puzzle.start)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return starts.length > 0
      ? starts[Math.abs(dailyChallengeSeed) % starts.length]
      : undefined;
  }, [dailyChallengeSeed, selectedLength, puzzles]);

  useEffect(() => {
    if (
      dailyChallengeSeed === undefined ||
      selectedLength === null ||
      isLoading ||
      !dailyStartWord
    ) {
      return;
    }
    setReplayStartWord(dailyStartWord);
    setPlaying(true);
  }, [dailyChallengeSeed, selectedLength, isLoading, dailyStartWord]);

  if (playing && selectedLength) {
    return (
      <LadderRushPlay
        key={playKey}
        wordLength={selectedLength}
        puzzles={puzzles}
        isSurvival={isSurvival}
        survivalTime={survivalTime}
        timeLimitSeconds={!isUntimed ? timeLimitSeconds : undefined}
        doubleSwap={doubleSwap}
        initialStartWord={replayStartWord ?? dailyStartWord}
        onExit={() => {
          setPlaying(false);
          setSelectedLength(null);
          setReplayStartWord(undefined);
        }}
        onPlayAgain={() => { setReplayStartWord(undefined); setPlayKey(k => k + 1); }}
        onReplay={(startWord) => { setReplayStartWord(startWord); setPlayKey(k => k + 1); }}
        locked={locked}
        isUntimed={isUntimed}
      />
    );
  }

  if (dailyChallengeSeed !== undefined) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          {isLoading || dailyStartWord ? (
            <p className="text-muted-foreground" role="status">Preparing today&apos;s Ladder Rush challenge…</p>
          ) : (
            <p className="text-muted-foreground" role="alert">
              Unable to load today&apos;s Ladder Rush challenge. Please refresh and try again.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Zap className="h-7 w-7 text-[hsl(38,92%,50%)]" />
          <h2 className="text-2xl font-bold">{doubleSwap ? "Ladder Rush: Double Swap" : "Ladder Rush"}</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          {doubleSwap ? "Chain words by changing two letters at a time." : "Chain words by changing one letter at a time."}
        </p>
        {!groupSeed && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button
              variant={!isSurvival ? "default" : "outline"}
              size="sm"
              onClick={() => setIsSurvival(false)}
              className="gap-1.5"
              data-testid="button-mode-classic"
            >
              <Timer className="h-3.5 w-3.5" />
              Classic (90s)
            </Button>
            <Button
              variant={isSurvival ? "default" : "outline"}
              size="sm"
              onClick={() => setIsSurvival(true)}
              className="gap-1.5"
              data-testid="button-mode-survival"
            >
              <Flame className="h-3.5 w-3.5" />
              {isSurvival ? `Survival (${survivalTime}s/word)` : "Survival"}
            </Button>
          </div>
        )}
        {isSurvival ? (
          <>
            <div className="flex items-center justify-center gap-2 pt-1">
              {SURVIVAL_TIME_OPTIONS.map(opt => (
                <Button
                  key={opt.seconds}
                  variant={survivalTime === opt.seconds ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSurvivalTime(opt.seconds)}
                  data-testid={`button-survival-time-${opt.label.toLowerCase()}`}
                >
                  {opt.label} ({opt.seconds}s)
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {survivalTime}s per word — timer resets on each correct answer!
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Score = number of words you chain beyond the starting word
          </p>
        )}
      </div>

      <div className="grid gap-3">
        {WORD_LENGTHS.map(({ length, label, sublabel, description }) => (
          <motion.button
            key={length}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full text-left"
            onClick={() => setSelectedLength(length)}
            data-testid={`button-mode-${length}`}
          >
            <Card className={`cursor-pointer transition-colors hover:border-[hsl(38,92%,50%)] ${selectedLength === length ? "border-[hsl(38,92%,50%)] bg-[hsl(38,92%,50%)]/5" : ""}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {label}
                    <Badge variant="outline" className="text-xs">{sublabel}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{description}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </motion.button>
        ))}
      </div>

      {selectedLength && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => {
              setPlayKey(k => k + 1);
              setPlaying(true);
            }}
            disabled={isLoading || puzzles.length === 0}
            data-testid="button-start"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
            Start Rush!
          </Button>
        </motion.div>
      )}
    </div>
  );
}
