import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Timer,
  RotateCcw,
  CheckCircle2,
  XCircle,
  LogIn,
  Shell,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Zap,
  SkipForward,
} from "lucide-react";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { AnimatedNumber } from "@/components/animated-number";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { ShareResults } from "@/components/share-results";
import { getCompletionMessage } from "@/lib/completion-messages";
import { usePuzzleHistory } from "@/hooks/use-puzzle-history";

const BLITZ_TIME = 90;
const WRAPPER_TIME = 120;
const SURVIVAL_TIME = 8;
const CRACK_ROUNDS = 10;

const SLUGS: Record<string, string> = {
  "blitz-classic": "shell-words",
  "blitz-survival": "shell-words-blitz-survival",
  "wrapper-classic": "shell-words-guided",
  "wrapper-survival": "shell-words-wrapper-survival",
  "crack-classic": "shell-words-crack",
  "crack-survival": "shell-words-crack-survival",
};

type Variation = "blitz" | "wrapper" | "crack";
type SubMode = "classic" | "survival";
type GameStatus = "idle" | "playing" | "ended";

interface FoundWord {
  outer: string;
  inner: string;
  points: number;
}

function blitzScore(outerLen: number) { return 10 + outerLen * 2; }
function wrapperClassicScore(found: number, timeLeft: number) { return found * 15 + timeLeft * 2; }
function crackScore(innerLen: number) { return 20 + innerLen * 8; }
function getSlug(v: Variation, s: SubMode) { return SLUGS[`${v}-${s}`]; }

const VARIATION_LABELS: Record<Variation, string> = {
  blitz: "Blitz",
  wrapper: "Wrapper",
  crack: "Crack",
};

const MODE_DESCRIPTIONS: Record<string, string> = {
  "blitz-classic": "Find as many shell words as you can in 90 seconds. Score more for longer outer words.",
  "blitz-survival": "Enter a shell word every 8 seconds or it's game over. Each correct word resets the clock.",
  "wrapper-classic": "Given an inner word, enter one word that wraps around it to advance to the next. You have 2 minutes.",
  "wrapper-survival": "Given an inner word, find one valid wrapper in 8 seconds. Each success brings a new word.",
  "crack-classic": "10 rounds: given two boundary letters, type a word that fits in the middle to form a valid shell word.",
  "crack-survival": "Given boundary letters, crack the shell before the 8 second timer runs out. Each success resets the clock.",
};

const MODE_SCORING: Record<string, string> = {
  "blitz-classic": "Score: 10 + (outer length × 2) per word",
  "blitz-survival": "Score: 10 + (outer length × 2) per word",
  "wrapper-classic": "Score: 15 per wrapper + 2 per second remaining",
  "wrapper-survival": "Score: 15 per correct wrapper",
  "crack-classic": "Score: 20 + (inner length × 8) per correct round",
  "crack-survival": "Score: 20 + (inner length × 8) per correct answer",
};

export function ShellWordsGame({
  groupSeed,
  locked,
  initialMode,
  isUntimed,
  timeLimitSeconds,
}: { groupSeed?: number; locked?: boolean; initialMode?: "blitz" | "wrapper"; isUntimed?: boolean; timeLimitSeconds?: number } = {}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const [variation, setVariation] = useState<Variation>(
    initialMode === "wrapper" ? "wrapper" : "blitz"
  );
  const [subMode, setSubMode] = useState<SubMode>("classic");
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");

  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [foundWords, setFoundWords] = useState<FoundWord[]>([]);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; message: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");

  const effectiveBlitzTime = timeLimitSeconds ?? BLITZ_TIME;
  const [timeLeft, setTimeLeft] = useState(effectiveBlitzTime);
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME);

  const [puzzleMiddle, setPuzzleMiddle] = useState<string | null>(null);
  const [puzzleCount, setPuzzleCount] = useState(0);
  const [wrapperSeed, setWrapperSeed] = useState(0);
  const [wrapperSeedHistory, setWrapperSeedHistory] = useState<number[]>([]);

  const [crackPair, setCrackPair] = useState<{ first: string; last: string } | null>(null);
  const [crackRound, setCrackRound] = useState(0);
  const [crackSeedBase, setCrackSeedBase] = useState(0);
  const [crackAdvancing, setCrackAdvancing] = useState(false);
  const [wrapperTransitioning, setWrapperTransitioning] = useState(false);

  const classicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const survivalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foundSet = useRef<Set<string>>(new Set());
  const scoreRef = useRef(0);
  const solvedCountRef = useRef(0);
  const variationRef = useRef<Variation>(variation);
  const subModeRef = useRef<SubMode>(subMode);
  const timeLeftRef = useRef(effectiveBlitzTime);
  const survivalTurnRef = useRef(0);

  useEffect(() => { variationRef.current = variation; }, [variation]);
  useEffect(() => { subModeRef.current = subMode; }, [subMode]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const activeSlug = getSlug(variation, subMode);
  const { reportResult, resetRecorded } = useGameResult({ slug: activeSlug, isUntimed });
  const personalBest = usePersonalBest(activeSlug);
  const { markSeen, hasSeen } = usePuzzleHistory("shell-words");
  const puzzleHistoryScope = `${variation}-${subMode}`;

  const clearAllTimers = useCallback(() => {
    if (classicTimerRef.current) clearInterval(classicTimerRef.current);
    if (survivalTimerRef.current) clearInterval(survivalTimerRef.current);
    if (feedbackRef.current) clearTimeout(feedbackRef.current);
  }, []);

  const clearFeedback = useCallback(() => {
    if (feedbackRef.current) clearTimeout(feedbackRef.current);
    feedbackRef.current = setTimeout(() => setFeedback(null), 1400);
  }, []);

  const endGame = useCallback(
    (tLeft = 0) => {
      if (classicTimerRef.current) clearInterval(classicTimerRef.current);
      if (survivalTimerRef.current) clearInterval(survivalTimerRef.current);
      setGameStatus("ended");
      setCompletionMessage(getCompletionMessage(true));
      let finalScore = scoreRef.current;
      if (variationRef.current === "wrapper" && subModeRef.current === "classic") {
        finalScore = wrapperClassicScore(solvedCountRef.current, tLeft);
      }
      setScore(finalScore);
      reportResult(finalScore, true, solvedCountRef.current);
    },
    [reportResult]
  );

  const startClassicTimer = useCallback(
    (duration: number) => {
      if (classicTimerRef.current) clearInterval(classicTimerRef.current);
      let remaining = duration;
      setTimeLeft(remaining);
      timeLeftRef.current = remaining;
      classicTimerRef.current = setInterval(() => {
        remaining -= 1;
        setTimeLeft(remaining);
        timeLeftRef.current = remaining;
        if (remaining <= 0) {
          clearInterval(classicTimerRef.current!);
          endGame(0);
        }
      }, 1000);
    },
    [endGame]
  );

  const stopSurvivalTimer = useCallback(() => {
    if (survivalTimerRef.current) {
      clearInterval(survivalTimerRef.current);
      survivalTimerRef.current = null;
    }
    survivalTurnRef.current++;
  }, []);

  const startSurvivalTimer = useCallback(() => {
    stopSurvivalTimer();
    const thisTurn = survivalTurnRef.current;
    setSurvivalTime(SURVIVAL_TIME);
    let remaining = SURVIVAL_TIME;
    survivalTimerRef.current = setInterval(() => {
      if (survivalTurnRef.current !== thisTurn) {
        clearInterval(survivalTimerRef.current!);
        return;
      }
      remaining -= 1;
      setSurvivalTime(remaining);
      if (remaining <= 0) {
        clearInterval(survivalTimerRef.current!);
        endGame(0);
      }
    }, 1000);
  }, [stopSurvivalTimer, endGame]);


  const fetchWrapperPuzzle = useCallback(async (seed: number) => {
    const res = await fetch(`/api/games/shell-words/puzzle?seed=${seed}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch puzzle");
    return (await res.json()) as { middle: string; count: number };
  }, []);

  const fetchCrackPair = useCallback(async (seed: number) => {
    const res = await fetch(`/api/games/shell-words/crack?seed=${seed}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch crack pair");
    return (await res.json()) as { first: string; last: string };
  }, []);

  const loadFreshWrapperPuzzle = useCallback(async (initialSeed: number, replaying = false) => {
    let seed = initialSeed;
    let fallback: { seed: number; puzzle: { middle: string; count: number } } | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const puzzle = await fetchWrapperPuzzle(seed);
      fallback = { seed, puzzle };
      if (replaying || groupSeed !== undefined || !hasSeen(puzzle.middle, puzzleHistoryScope)) {
        if (!replaying && groupSeed === undefined) {
          markSeen(puzzle.middle, puzzleHistoryScope);
        }
        return { seed, puzzle };
      }
      seed += 1;
    }

    if (!fallback) throw new Error("Failed to load puzzle");
    if (!replaying && groupSeed === undefined) {
      markSeen(fallback.puzzle.middle, puzzleHistoryScope);
    }
    return fallback;
  }, [fetchWrapperPuzzle, groupSeed, hasSeen, markSeen, puzzleHistoryScope]);

  const loadFreshCrackPair = useCallback(async (initialSeed: number, replaying = false) => {
    let seed = initialSeed;
    let fallback: { seed: number; pair: { first: string; last: string } } | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const pair = await fetchCrackPair(seed);
      fallback = { seed, pair };
      const key = `${pair.first}:${pair.last}`;
      if (replaying || groupSeed !== undefined || !hasSeen(key, puzzleHistoryScope)) {
        if (!replaying && groupSeed === undefined) {
          markSeen(key, puzzleHistoryScope);
        }
        return { seed, pair };
      }
      seed += 1;
    }

    if (!fallback) throw new Error("Failed to load crack pair");
    if (!replaying && groupSeed === undefined) {
      markSeen(`${fallback.pair.first}:${fallback.pair.last}`, puzzleHistoryScope);
    }
    return fallback;
  }, [fetchCrackPair, groupSeed, hasSeen, markSeen, puzzleHistoryScope]);

  const crackRoundSeedsRef = useRef<number[]>([]);

  const advanceCrackRound = useCallback(
    async (nextRound: number, seedBase: number) => {
      if (nextRound >= CRACK_ROUNDS) {
        endGame(0);
        setCrackAdvancing(false);
        return;
      }
      try {
        const knownSeed = crackRoundSeedsRef.current[nextRound];
        const { seed, pair } = await loadFreshCrackPair(
          knownSeed ?? seedBase + nextRound,
          knownSeed !== undefined,
        );
        crackRoundSeedsRef.current[nextRound] = seed;
        setCrackPair(pair);
        setCrackRound(nextRound);
        setInput("");
        setCrackAdvancing(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      } catch {
        setFeedback({ type: "err", message: "Failed to load next puzzle" });
        setCrackAdvancing(false);
      }
    },
    [endGame, loadFreshCrackPair]
  );

  const lastWrapperSeedRef = useRef<number | null>(null);
  const lastCrackSeedBaseRef = useRef<number | null>(null);

  const startGame = useCallback(async (overrideWrapperSeed?: number, overrideCrackSeedBase?: number) => {
    resetRecorded();
    foundSet.current = new Set();
    scoreRef.current = 0;
    setFoundWords([]);
    setScore(0);
    setInput("");
    setFeedback(null);
    setCompletionMessage("");
    solvedCountRef.current = 0;
    crackRoundSeedsRef.current = [];
    setCrackAdvancing(false);
    setWrapperTransitioning(false);

    if (variation === "wrapper") {
      const seed = overrideWrapperSeed ?? (groupSeed !== undefined ? groupSeed : Math.floor(Math.random() * 100000));
      try {
        const { seed: selectedSeed, puzzle } = await loadFreshWrapperPuzzle(seed, overrideWrapperSeed !== undefined);
        lastWrapperSeedRef.current = selectedSeed;
        setWrapperSeed(selectedSeed);
        setWrapperSeedHistory([selectedSeed]);
        setPuzzleMiddle(puzzle.middle);
        setPuzzleCount(puzzle.count);
      } catch {
        setFeedback({ type: "err", message: "Failed to load puzzle" });
        return;
      }
    } else if (variation === "crack") {
      const seedBase = overrideCrackSeedBase ?? Math.floor(Math.random() * 100000);
      setCrackRound(0);
      try {
        const { seed: selectedSeed, pair } = await loadFreshCrackPair(seedBase, overrideCrackSeedBase !== undefined);
        lastCrackSeedBaseRef.current = selectedSeed;
        setCrackSeedBase(selectedSeed);
        crackRoundSeedsRef.current = [selectedSeed];
        setCrackPair(pair);
      } catch {
        setFeedback({ type: "err", message: "Failed to load puzzle" });
        return;
      }
    }

    setGameStatus("playing");

    if (!isUntimed) {
      if (subMode === "classic") {
        if (variation === "blitz") startClassicTimer(effectiveBlitzTime);
        else if (variation === "wrapper") startClassicTimer(WRAPPER_TIME);
      } else {
        startSurvivalTimer();
      }
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [
    variation, subMode, groupSeed,
    loadFreshWrapperPuzzle, loadFreshCrackPair,
    resetRecorded, startClassicTimer, startSurvivalTimer, isUntimed,
  ]);

  const switchMode = useCallback(
    (v: Variation, s: SubMode) => {
      clearAllTimers();
      setVariation(v);
      setSubMode(s);
      setGameStatus("idle");
      setScore(0);
      scoreRef.current = 0;
      setFoundWords([]);
      setInput("");
      setFeedback(null);
      setCompletionMessage("");
      setPuzzleMiddle(null);
      setPuzzleCount(0);
      setCrackPair(null);
      setCrackRound(0);
      setCrackAdvancing(false);
      setWrapperTransitioning(false);
      setWrapperSeedHistory([]);
      foundSet.current = new Set();
      resetRecorded();
    },
    [clearAllTimers, resetRecorded]
  );

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isValidating || gameStatus !== "playing" || crackAdvancing || wrapperTransitioning) return;
    const word = input.trim().toUpperCase();

    setIsValidating(true);
    try {
      if (variation === "crack") {
        if (!crackPair) return;
        if (!/^[A-Z]+$/.test(word)) {
          setFeedback({ type: "err", message: "Middle word must contain letters only" });
          clearFeedback();
          setInput("");
          return;
        }
        const outer = crackPair.first + word + crackPair.last;

        const res = await fetch(
          `/api/games/shell-words/validate?word=${encodeURIComponent(outer)}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Validation request failed");
        const data = (await res.json()) as { valid: boolean; innerWord: string | null };

        if (!data.valid) {
          setFeedback({ type: "err", message: `"${outer}" is not a valid shell word` });
          clearFeedback();
          setInput("");
          return;
        }

        const pts = crackScore(word.length);
        scoreRef.current += pts;
        solvedCountRef.current++;
        setScore(scoreRef.current);
        setFoundWords(prev => [{ outer, inner: word, points: pts }, ...prev]);
        setFeedback({ type: "ok", message: `+${pts} pts` });
        clearFeedback();
        setInput("");

        if (subMode === "classic") {
          setCrackAdvancing(true);
          setTimeout(() => {
            advanceCrackRound(crackRound + 1, crackSeedBase);
          }, 600);
        } else {
          stopSurvivalTimer();
          setCrackAdvancing(true);
          const newSeed = Math.floor(Math.random() * 100000);
          loadFreshCrackPair(newSeed).then(({ pair }) => {
            setCrackPair(pair);
            setCrackAdvancing(false);
            if (!isUntimed) startSurvivalTimer();
            setTimeout(() => inputRef.current?.focus(), 50);
          }).catch(() => {
            setFeedback({ type: "err", message: "Failed to load next puzzle" });
            setCrackAdvancing(false);
          });
        }
        return;
      }

      if (foundSet.current.has(word)) {
        setFeedback({ type: "err", message: "Already found!" });
        setInput("");
        clearFeedback();
        return;
      }

      const res = await fetch(
        `/api/games/shell-words/validate?word=${encodeURIComponent(word)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Validation request failed");
      const data = (await res.json()) as { valid: boolean; innerWord: string | null };

      if (!data.valid) {
        setFeedback({ type: "err", message: `"${word}" is not a valid shell word` });
        setInput("");
        clearFeedback();
        return;
      }

      if (variation === "wrapper" && data.innerWord !== puzzleMiddle) {
        setFeedback({ type: "err", message: `"${word}" doesn't wrap "${puzzleMiddle}"` });
        setInput("");
        clearFeedback();
        return;
      }

      foundSet.current.add(word);
      const pts = variation === "blitz" ? blitzScore(word.length) : 15;
      scoreRef.current += pts;
      solvedCountRef.current++;
      setFoundWords(prev => [{ outer: word, inner: data.innerWord!, points: pts }, ...prev]);
      setScore(scoreRef.current);
      setFeedback({
        type: "ok",
        message: variation === "blitz" ? `+${pts} pts` : `+1 found`,
      });
      setInput("");
      clearFeedback();

      if (variation === "wrapper" && subMode === "survival") {
        stopSurvivalTimer();
        setWrapperTransitioning(true);
        const newSeed = wrapperSeed + 1;
        foundSet.current = new Set();
        loadFreshWrapperPuzzle(newSeed).then(({ seed, puzzle }) => {
          setWrapperSeed(seed);
          setPuzzleMiddle(puzzle.middle);
          setPuzzleCount(puzzle.count);
          setWrapperTransitioning(false);
          if (!isUntimed) startSurvivalTimer();
          setTimeout(() => inputRef.current?.focus(), 50);
        }).catch(() => {
          setFeedback({ type: "err", message: "Failed to load next puzzle" });
          setWrapperTransitioning(false);
        });
        return;
      }

      if (variation === "wrapper" && subMode === "classic") {
        setWrapperTransitioning(true);
        const newSeed = wrapperSeed + 1;
        foundSet.current = new Set();
        loadFreshWrapperPuzzle(newSeed).then(({ seed, puzzle }) => {
          setWrapperSeed(seed);
          setWrapperSeedHistory(prev => [...prev, seed]);
          setPuzzleMiddle(puzzle.middle);
          setPuzzleCount(puzzle.count);
          setWrapperTransitioning(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }).catch(() => {
          setFeedback({ type: "err", message: "Failed to load next puzzle" });
          setWrapperTransitioning(false);
        });
        return;
      }

      if (variation === "blitz" && subMode === "survival" && !isUntimed) {
        startSurvivalTimer();
      }

    } catch {
      setFeedback({ type: "err", message: "Connection error" });
      clearFeedback();
    } finally {
      setIsValidating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [
    input, isValidating, gameStatus, crackAdvancing, wrapperTransitioning,
    variation, subMode, crackPair, crackRound, crackSeedBase,
    puzzleMiddle, puzzleCount, wrapperSeed,
    clearFeedback, endGame, advanceCrackRound, startSurvivalTimer, stopSurvivalTimer,
    loadFreshWrapperPuzzle, loadFreshCrackPair,
  ]);

  const handleSkip = useCallback(() => {
    if (gameStatus !== "playing" || crackAdvancing || isValidating || wrapperTransitioning) return;
    setInput("");
    if (variation === "crack") {
      setCrackAdvancing(true);
      advanceCrackRound(crackRound + 1, crackSeedBase);
    } else if (variation === "wrapper") {
      if (subMode === "survival") {
        stopSurvivalTimer();
        endGame(0);
      } else {
        setWrapperTransitioning(true);
        const newSeed = wrapperSeed + 1;
        foundSet.current = new Set();
        loadFreshWrapperPuzzle(newSeed).then(({ seed, puzzle }) => {
          setWrapperSeed(seed);
          setWrapperSeedHistory(prev => [...prev, seed]);
          setPuzzleMiddle(puzzle.middle);
          setPuzzleCount(puzzle.count);
          setWrapperTransitioning(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }).catch(() => {
          setFeedback({ type: "err", message: "Failed to load next puzzle" });
          setWrapperTransitioning(false);
        });
      }
    }
  }, [
    gameStatus, crackAdvancing, isValidating, wrapperTransitioning,
    variation, subMode, crackRound, crackSeedBase, wrapperSeed,
    advanceCrackRound, stopSurvivalTimer, endGame, loadFreshWrapperPuzzle,
  ]);

  const handlePrevious = useCallback(() => {
    if (gameStatus !== "playing" || crackAdvancing || isValidating || wrapperTransitioning || subMode !== "classic") return;
    setInput("");
    if (variation === "crack" && crackRound > 0) {
      setCrackAdvancing(true);
      advanceCrackRound(crackRound - 1, crackSeedBase);
    } else if (variation === "wrapper" && wrapperSeedHistory.length > 1) {
      const prevHistory = wrapperSeedHistory.slice(0, -1);
      const prevSeed = prevHistory[prevHistory.length - 1];
      setWrapperSeedHistory(prevHistory);
      setWrapperSeed(prevSeed);
      setWrapperTransitioning(true);
      foundSet.current = new Set();
      fetchWrapperPuzzle(prevSeed).then(puzzle => {
        setPuzzleMiddle(puzzle.middle);
        setPuzzleCount(puzzle.count);
        setWrapperTransitioning(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }).catch(() => {
        setFeedback({ type: "err", message: "Failed to load previous puzzle" });
        setWrapperTransitioning(false);
      });
    }
  }, [
    gameStatus, crackAdvancing, isValidating, wrapperTransitioning, subMode,
    variation, crackRound, crackSeedBase, wrapperSeedHistory,
    advanceCrackRound, fetchWrapperPuzzle,
  ]);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const classicTimerWarning = timeLeft <= 10 && gameStatus === "playing";
  const survivalWarning = survivalTime <= 3 && gameStatus === "playing";

  const isSurvival = subMode === "survival";
  const modeKey = `${variation}-${subMode}`;


  return (
    <>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Two-level mode selector */}
          {!initialMode && gameStatus === "idle" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {(["blitz", "wrapper", "crack"] as Variation[]).map(v => (
                  <Button
                    key={v}
                    variant={variation === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => switchMode(v, subMode)}
                    data-testid={`button-variation-${v}`}
                    className="flex-1"
                  >
                    {VARIATION_LABELS[v]}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                {(["classic", "survival"] as SubMode[]).map(s => (
                  <Button
                    key={s}
                    variant={subMode === s ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => switchMode(variation, s)}
                    data-testid={`button-submode-${s}`}
                    className="gap-1.5"
                  >
                    {s === "survival" && <Zap className="h-3.5 w-3.5" />}
                    <span className="capitalize">{s}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Header: timer / survival countdown / round progress */}
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              {isUntimed ? (
                <Badge variant="outline" className="gap-1 text-blue-600 border-blue-400 text-xs" data-testid="badge-untimed">
                  ∞ Untimed
                </Badge>
              ) : isSurvival && gameStatus !== "idle" ? (
                <>
                  <Timer className={`h-4 w-4 ${survivalWarning ? "text-destructive animate-pulse" : ""}`} />
                  <span
                    className={`font-mono font-bold text-lg ${survivalWarning ? "text-destructive animate-pulse" : ""}`}
                    data-testid="text-survival-timer"
                  >
                    {survivalTime}s
                  </span>
                </>
              ) : variation === "crack" && subMode === "classic" ? (
                <>
                  <Shell className="h-4 w-4" />
                  <span className="font-mono font-bold text-lg" data-testid="text-round-progress">
                    {Math.min(crackRound + 1, CRACK_ROUNDS)} / {CRACK_ROUNDS}
                  </span>
                </>
              ) : (
                <>
                  <Timer className={`h-4 w-4 ${classicTimerWarning ? "text-destructive animate-pulse" : ""}`} />
                  <span
                    className={`font-mono font-bold text-lg ${classicTimerWarning ? "text-destructive animate-pulse" : ""}`}
                    data-testid="text-timer"
                  >
                    {gameStatus === "idle"
                      ? formatTime(variation === "wrapper" ? WRAPPER_TIME : effectiveBlitzTime)
                      : formatTime(timeLeft)}
                  </span>
                </>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Score</p>
              <AnimatedNumber value={score} className="text-2xl font-bold text-primary" data-testid="text-score" />
            </div>
          </div>

          {/* Idle state */}
          {gameStatus === "idle" && (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <Shell className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-base">
                  {VARIATION_LABELS[variation]} — {subMode === "classic" ? "Classic" : "Survival"}
                </p>
                {isSurvival && (
                  <div className="flex items-center justify-center gap-1 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
                    <Zap className="h-3 w-3" />
                    8 seconds per word
                  </div>
                )}
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {MODE_DESCRIPTIONS[modeKey]}
                </p>
                <p className="text-xs text-muted-foreground">{MODE_SCORING[modeKey]}</p>
              </div>
              <Button onClick={() => startGame()} size="lg" data-testid="button-start-game">
                Start Game
              </Button>
            </div>
          )}

          {/* Playing state */}
          {gameStatus === "playing" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2.5 py-1.5 border-t border-b border-border/50" data-testid="word-count-strip">
                <motion.span
                  key={foundWords.length}
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl font-bold tabular-nums leading-none text-primary"
                  data-testid="text-live-word-count"
                >
                  {foundWords.length}
                </motion.span>
                <span className="text-sm text-muted-foreground leading-none">
                  {variation === "crack" && subMode === "classic" ? `/ ${CRACK_ROUNDS} cracked` : "found"}
                </span>
                <span className="text-muted-foreground/40 leading-none">·</span>
                <span className="text-sm text-muted-foreground leading-none">
                  PB: <span className="font-semibold text-foreground">{personalBest > 0 ? personalBest : "—"}</span>
                </span>
              </div>
              {/* Wrapper: show middle word */}
              {variation === "wrapper" && puzzleMiddle && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Enter a word that wraps:</div>
                  <div className="text-3xl font-bold tracking-widest" data-testid="text-middle-word">
                    {puzzleMiddle}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    e.g. __{puzzleMiddle}__ (add one letter on each end)
                  </div>
                  <div className="flex justify-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrevious}
                      disabled={wrapperTransitioning || isValidating || wrapperSeedHistory.length <= 1 || subMode !== "classic"}
                      className="text-muted-foreground gap-1.5"
                      data-testid="button-previous"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                      disabled={wrapperTransitioning || isValidating}
                      className="text-muted-foreground gap-1.5"
                      data-testid="button-skip"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      Skip
                    </Button>
                  </div>
                </div>
              )}

              {/* Crack: boundary letter display with input in middle */}
              {variation === "crack" && crackPair && (
                <div className="text-center p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="text-xs text-muted-foreground">Type a word that fits between these letters:</div>
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-2xl font-bold"
                      data-testid="text-crack-first"
                    >
                      {crackPair.first}
                    </div>
                    <span className="text-muted-foreground text-lg font-mono">+</span>
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && handleSubmit()}
                      placeholder="???"
                      className="w-28 text-center font-mono uppercase tracking-widest text-lg h-12"
                      disabled={isValidating || crackAdvancing}
                      data-testid="input-word"
                    />
                    <span className="text-muted-foreground text-lg font-mono">+</span>
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-2xl font-bold"
                      data-testid="text-crack-last"
                    >
                      {crackPair.last}
                    </div>
                    <Button
                      onClick={handleSubmit}
                      disabled={isValidating || !input.trim() || crackAdvancing}
                      size="icon"
                      className="h-12 w-12"
                      data-testid="button-submit"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                  {input && (
                    <div className="text-sm text-muted-foreground font-mono">
                      → <span className="text-foreground font-bold">
                        {crackPair.first}{input}{crackPair.last}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrevious}
                      disabled={crackAdvancing || isValidating || crackRound === 0 || subMode !== "classic"}
                      className="text-muted-foreground gap-1.5"
                      data-testid="button-previous"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                      disabled={crackAdvancing || isValidating}
                      className="text-muted-foreground gap-1.5"
                      data-testid="button-skip"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      Skip
                    </Button>
                  </div>
                </div>
              )}

              {/* Blitz / Wrapper: standard input */}
              {variation !== "crack" && (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder={
                      variation === "blitz"
                        ? "Type a shell word..."
                        : `Type a word wrapping "${puzzleMiddle}"...`
                    }
                    className="font-mono uppercase tracking-wider"
                    disabled={isValidating}
                    data-testid="input-word"
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={isValidating || !input.trim()}
                    data-testid="button-submit"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Feedback */}
              <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
                <AnimatePresence>
                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`text-sm font-medium text-center ${
                        feedback.type === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive"
                      }`}
                      data-testid="text-feedback"
                    >
                      {feedback.type === "ok" ? (
                        <span className="flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> {feedback.message}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <XCircle className="h-4 w-4" /> {feedback.message}
                        </span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!locked && (
                <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGameStatus("idle")}
                    data-testid="button-menu"
                  >
                    Menu
                  </Button>
                  {!isSurvival && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => endGame(timeLeftRef.current)}
                      data-testid="button-end-game"
                    >
                      End Game
                    </Button>
                  )}
                </div>
              )}

              {/* Found words list (not shown in crack classic / survival) */}
              {(variation !== "crack") && (
                <div className="h-52 overflow-y-auto space-y-2 border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Found ({foundWords.length})
                  </div>
                  {foundWords.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center pt-6">
                      Your found words will appear here
                    </p>
                  ) : (
                    <AnimatePresence initial={false}>
                      {foundWords.map((fw, i) => (
                        <motion.div
                          key={`${fw.outer}-${i}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 border"
                          data-testid={`item-found-${i}`}
                        >
                          <div className="font-mono text-sm">
                            <span className="text-muted-foreground">{fw.outer[0]}</span>
                            <span className="text-foreground font-bold">{fw.inner}</span>
                            <span className="text-muted-foreground">{fw.outer[fw.outer.length - 1]}</span>
                            <span className="text-muted-foreground ml-2">→ {fw.inner}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            +{fw.points}
                          </Badge>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              )}

              {/* Crack: compact answered list */}
              {variation === "crack" && foundWords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {foundWords.map((fw, i) => (
                    <Badge key={i} variant="secondary" className="font-mono text-xs gap-1">
                      <span className="text-muted-foreground">{fw.outer[0]}</span>
                      <span className="font-bold">{fw.inner}</span>
                      <span className="text-muted-foreground">{fw.outer[fw.outer.length - 1]}</span>
                      <span className="ml-1">+{fw.points}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ended state */}
          {gameStatus === "ended" && (
            <div className="text-center space-y-4 py-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring" }}
              >
                <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
                <h3 className="text-xl font-bold">
                  {isSurvival ? "Time's Up!" : "Game Over!"}
                </h3>
                <p className="text-muted-foreground mt-1">{completionMessage}</p>
              </motion.div>

              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold" data-testid="text-final-score">
                    {score}
                  </div>
                  <div className="text-xs text-muted-foreground">Score</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold">
                    {variation === "crack" && subMode === "classic"
                      ? `${foundWords.length}/${CRACK_ROUNDS}`
                      : foundWords.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {variation === "crack" ? "Correct" : "Words Found"}
                  </div>
                </div>
              </div>

              {foundWords.length > 0 && (
                <div className="text-left space-y-1 max-h-40 overflow-y-auto border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground font-medium mb-2">Words you found:</div>
                  {foundWords.map((fw, i) => (
                    <div key={i} className="font-mono text-sm">
                      <span className="text-muted-foreground">{fw.outer[0]}</span>
                      <span className="font-bold">{fw.inner}</span>
                      <span className="text-muted-foreground">{fw.outer[fw.outer.length - 1]}</span>
                      <span className="text-muted-foreground"> → {fw.inner}</span>
                    </div>
                  ))}
                </div>
              )}

              <ShareResults
                gameName={`Shell Words: ${VARIATION_LABELS[variation]} ${subMode === "survival" ? "Survival" : "Classic"}`}
                gameSlug={activeSlug}
                score={score}
                wordsCompleted={foundWords.length}
                isWin
              />

              {!user && (
                <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>
                    <button
                      className="underline font-medium"
                      onClick={() => setAuthOpen(true)}
                      data-testid="button-sign-in-cta"
                    >
                      Sign in
                    </button>{" "}
                    to save your score to the leaderboard!
                  </span>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  className="bg-sky-500 hover:bg-sky-600 text-white border-0"
                  onClick={() => startGame(lastWrapperSeedRef.current ?? undefined, lastCrackSeedBaseRef.current ?? undefined)}
                  data-testid="button-replay"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Replay
                </Button>
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                  onClick={() => startGame()}
                  data-testid="button-play-again"
                >
                  Play Again
                </Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-white border-0"
                  onClick={() => navigate("/games/shell-words")}
                  data-testid="button-main-menu"
                >
                  Main Menu
                </Button>
                {!locked && <TryAnotherGameButton currentSlug={activeSlug} />}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
