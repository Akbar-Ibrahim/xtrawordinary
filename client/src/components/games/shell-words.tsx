import { useState, useEffect, useRef, useCallback } from "react";
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
  Trophy,
  Zap,
} from "lucide-react";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { AnimatedNumber } from "@/components/animated-number";
import { useGameResult } from "@/hooks/use-game-result";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { ShareResults } from "@/components/share-results";
import { getCompletionMessage } from "@/lib/completion-messages";

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
  "wrapper-classic": "Given an inner word, find all outer words that wrap around it. You have 2 minutes.",
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
}: { groupSeed?: number; locked?: boolean; initialMode?: "blitz" | "wrapper" } = {}) {
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

  const [timeLeft, setTimeLeft] = useState(BLITZ_TIME);
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME);

  const [puzzleMiddle, setPuzzleMiddle] = useState<string | null>(null);
  const [puzzleCount, setPuzzleCount] = useState(0);
  const [wrapperSeed, setWrapperSeed] = useState(0);

  const [crackPair, setCrackPair] = useState<{ first: string; last: string } | null>(null);
  const [crackRound, setCrackRound] = useState(0);
  const [crackSeedBase, setCrackSeedBase] = useState(0);
  const [crackAdvancing, setCrackAdvancing] = useState(false);

  const classicTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const survivalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foundSet = useRef<Set<string>>(new Set());
  const scoreRef = useRef(0);
  const variationRef = useRef<Variation>(variation);
  const subModeRef = useRef<SubMode>(subMode);
  const timeLeftRef = useRef(BLITZ_TIME);

  useEffect(() => { variationRef.current = variation; }, [variation]);
  useEffect(() => { subModeRef.current = subMode; }, [subMode]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const activeSlug = getSlug(variation, subMode);
  const { reportResult, resetRecorded } = useGameResult({ slug: activeSlug });

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
        finalScore = wrapperClassicScore(foundSet.current.size, tLeft);
      }
      setScore(finalScore);
      reportResult(finalScore, true, foundSet.current.size);
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

  const startSurvivalTimer = useCallback(() => {
    if (survivalTimerRef.current) clearInterval(survivalTimerRef.current);
    setSurvivalTime(SURVIVAL_TIME);
    let remaining = SURVIVAL_TIME;
    survivalTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSurvivalTime(remaining);
      if (remaining <= 0) {
        clearInterval(survivalTimerRef.current!);
        endGame(0);
      }
    }, 1000);
  }, [endGame]);

  const resetSurvivalTimer = useCallback(() => {
    if (survivalTimerRef.current) clearInterval(survivalTimerRef.current);
    setSurvivalTime(SURVIVAL_TIME);
    let remaining = SURVIVAL_TIME;
    survivalTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSurvivalTime(remaining);
      if (remaining <= 0) {
        clearInterval(survivalTimerRef.current!);
        endGame(0);
      }
    }, 1000);
  }, [endGame]);

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

  const advanceCrackRound = useCallback(
    async (nextRound: number, seedBase: number) => {
      if (nextRound >= CRACK_ROUNDS) {
        endGame(0);
        setCrackAdvancing(false);
        return;
      }
      try {
        const pair = await fetchCrackPair(seedBase + nextRound);
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
    [endGame, fetchCrackPair]
  );

  const startGame = useCallback(async () => {
    resetRecorded();
    foundSet.current = new Set();
    scoreRef.current = 0;
    setFoundWords([]);
    setScore(0);
    setInput("");
    setFeedback(null);
    setCompletionMessage("");
    setCrackAdvancing(false);

    if (variation === "wrapper" || (variation === "blitz" && subMode === "survival") || variation === "crack") {
      // no-op for blitz classic
    }

    if (variation === "wrapper") {
      const seed = groupSeed !== undefined ? groupSeed : Math.floor(Math.random() * 100000);
      setWrapperSeed(seed);
      try {
        const puzzle = await fetchWrapperPuzzle(seed);
        setPuzzleMiddle(puzzle.middle);
        setPuzzleCount(puzzle.count);
      } catch {
        setFeedback({ type: "err", message: "Failed to load puzzle" });
        return;
      }
    } else if (variation === "crack") {
      const seedBase = Math.floor(Math.random() * 100000);
      setCrackSeedBase(seedBase);
      setCrackRound(0);
      try {
        const pair = await fetchCrackPair(seedBase);
        setCrackPair(pair);
      } catch {
        setFeedback({ type: "err", message: "Failed to load puzzle" });
        return;
      }
    }

    setGameStatus("playing");

    if (subMode === "classic") {
      if (variation === "blitz") startClassicTimer(BLITZ_TIME);
      else if (variation === "wrapper") startClassicTimer(WRAPPER_TIME);
    } else {
      startSurvivalTimer();
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [
    variation, subMode, groupSeed,
    fetchWrapperPuzzle, fetchCrackPair,
    resetRecorded, startClassicTimer, startSurvivalTimer,
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
      foundSet.current = new Set();
      resetRecorded();
    },
    [clearAllTimers, resetRecorded]
  );

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isValidating || gameStatus !== "playing" || crackAdvancing) return;
    const word = input.trim().toUpperCase();

    setIsValidating(true);
    try {
      if (variation === "crack") {
        if (!crackPair) return;
        const outer = crackPair.first + word + crackPair.last;

        const res = await fetch(
          `/api/games/shell-words/validate?word=${encodeURIComponent(outer)}`,
          { credentials: "include" }
        );
        const data = (await res.json()) as { valid: boolean; innerWord: string | null };

        if (!data.valid) {
          setFeedback({ type: "err", message: `"${outer}" is not a valid shell word` });
          clearFeedback();
          setInput("");
          if (subMode === "classic") {
            setCrackAdvancing(true);
            setTimeout(() => {
              advanceCrackRound(crackRound + 1, crackSeedBase);
            }, 1500);
          }
          return;
        }

        const pts = crackScore(word.length);
        scoreRef.current += pts;
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
          resetSurvivalTimer();
          const newSeed = Math.floor(Math.random() * 100000);
          fetchCrackPair(newSeed).then(pair => {
            setCrackPair(pair);
            setTimeout(() => inputRef.current?.focus(), 50);
          }).catch(() => {
            setFeedback({ type: "err", message: "Failed to load next puzzle" });
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
      setFoundWords(prev => [{ outer: word, inner: data.innerWord!, points: pts }, ...prev]);
      setScore(scoreRef.current);
      setFeedback({
        type: "ok",
        message: variation === "blitz" ? `+${pts} pts` : `+1 found`,
      });
      setInput("");
      clearFeedback();

      if (variation === "wrapper" && subMode === "survival") {
        resetSurvivalTimer();
        const newSeed = wrapperSeed + 1;
        setWrapperSeed(newSeed);
        foundSet.current = new Set();
        fetchWrapperPuzzle(newSeed).then(puzzle => {
          setPuzzleMiddle(puzzle.middle);
          setPuzzleCount(puzzle.count);
          setTimeout(() => inputRef.current?.focus(), 50);
        }).catch(() => {
          setFeedback({ type: "err", message: "Failed to load next puzzle" });
        });
        return;
      }

      if (variation === "wrapper" && subMode === "classic" && foundSet.current.size >= puzzleCount && puzzleCount > 0) {
        endGame(timeLeftRef.current);
        return;
      }

      if (variation === "blitz" && subMode === "survival") {
        resetSurvivalTimer();
      }

    } catch {
      setFeedback({ type: "err", message: "Connection error" });
      clearFeedback();
    } finally {
      setIsValidating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [
    input, isValidating, gameStatus, crackAdvancing,
    variation, subMode, crackPair, crackRound, crackSeedBase,
    puzzleMiddle, puzzleCount, wrapperSeed,
    clearFeedback, endGame, advanceCrackRound, resetSurvivalTimer,
    fetchWrapperPuzzle, fetchCrackPair,
  ]);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const classicTimerWarning = timeLeft <= 10 && gameStatus === "playing";
  const survivalWarning = survivalTime <= 3 && gameStatus === "playing";

  const isSurvival = subMode === "survival";
  const modeKey = `${variation}-${subMode}`;

  const finalDisplayScore =
    variation === "wrapper" && subMode === "classic"
      ? wrapperClassicScore(foundWords.length, timeLeft)
      : score;

  return (
    <>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Two-level mode selector */}
          {!initialMode && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {(["blitz", "wrapper", "crack"] as Variation[]).map(v => (
                  <Button
                    key={v}
                    variant={variation === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => switchMode(v, subMode)}
                    disabled={gameStatus === "playing"}
                    data-testid={`button-variation-${v}`}
                    className="flex-1"
                  >
                    {VARIATION_LABELS[v]}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                {(["classic", "survival"] as SubMode[]).map(s => (
                  <Button
                    key={s}
                    variant={subMode === s ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => switchMode(variation, s)}
                    disabled={gameStatus === "playing"}
                    data-testid={`button-submode-${s}`}
                    className="flex-1 gap-1.5"
                  >
                    {s === "survival" && <Zap className="h-3.5 w-3.5" />}
                    <span className="capitalize">{s}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Header: timer / survival countdown / round progress */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isSurvival && gameStatus !== "idle" ? (
                <div
                  className={`flex items-center gap-1.5 text-2xl font-mono font-bold transition-colors ${
                    survivalWarning ? "text-destructive animate-pulse" : ""
                  }`}
                  data-testid="text-survival-timer"
                >
                  <Zap className={`h-5 w-5 ${survivalWarning ? "text-destructive" : "text-yellow-500"}`} />
                  {survivalTime}s
                </div>
              ) : variation === "crack" && subMode === "classic" ? (
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground" data-testid="text-round-progress">
                  <Shell className="h-4 w-4" />
                  Round {Math.min(crackRound + 1, CRACK_ROUNDS)} / {CRACK_ROUNDS}
                </div>
              ) : (
                <div
                  className={`flex items-center gap-2 text-lg font-mono font-bold ${classicTimerWarning ? "text-destructive animate-pulse" : ""}`}
                  data-testid="text-timer"
                >
                  <Timer className="h-5 w-5" />
                  {gameStatus === "idle"
                    ? formatTime(variation === "wrapper" ? WRAPPER_TIME : BLITZ_TIME)
                    : formatTime(timeLeft)}
                </div>
              )}
            </div>

            <div className="text-right">
              {variation === "wrapper" && subMode === "classic" && gameStatus !== "idle" ? (
                <>
                  <div className="text-xs text-muted-foreground">Found</div>
                  <div className="font-bold text-lg" data-testid="text-found">
                    {foundWords.length}
                    {puzzleCount > 0 && (
                      <span className="text-muted-foreground text-sm font-normal"> / {puzzleCount}</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">Score</div>
                  <div className="font-bold text-lg" data-testid="text-score">
                    <AnimatedNumber value={score} />
                  </div>
                </>
              )}
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
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  {MODE_DESCRIPTIONS[modeKey]}
                </p>
                <p className="text-xs text-muted-foreground">{MODE_SCORING[modeKey]}</p>
              </div>
              <Button onClick={startGame} size="lg" data-testid="button-start-game">
                Start Game
              </Button>
            </div>
          )}

          {/* Playing state */}
          {gameStatus === "playing" && (
            <div className="space-y-4">
              {/* Wrapper: show middle word */}
              {variation === "wrapper" && puzzleMiddle && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Find words that wrap:</div>
                  <div className="text-3xl font-bold tracking-widest" data-testid="text-middle-word">
                    {puzzleMiddle}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    e.g. __{puzzleMiddle}__ (add one letter on each end)
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

              {/* End Game button (not shown in survival or when locked) */}
              {!locked && !isSurvival && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => endGame(timeLeftRef.current)}
                    data-testid="button-end-game"
                  >
                    End Game
                  </Button>
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
              </motion.div>

              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-2xl font-bold" data-testid="text-final-score">
                    {finalDisplayScore}
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

              {completionMessage && (
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">
                  {completionMessage}
                </p>
              )}

              <ShareResults
                gameName={`Shell Words: ${VARIATION_LABELS[variation]} ${subMode === "survival" ? "Survival" : "Classic"}`}
                gameSlug={activeSlug}
                score={finalDisplayScore}
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

              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => switchMode(variation, subMode)}
                  data-testid="button-play-again"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Play Again
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
