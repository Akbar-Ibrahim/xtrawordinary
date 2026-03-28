import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Trophy,
  Timer,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Star,
  TreePine,
  ArrowRight,
  LogIn,
} from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import { useGameResult } from "@/hooks/use-game-result";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { apiRequest } from "@/lib/queryClient";
import type { WordRootsPuzzle } from "@shared/schema";

const TOTAL_ROUNDS = 5;
const TOTAL_TIME = 180;
const BASE_POINTS = 100;
const BONUS_POINTS = 50;

function letterMultisetCheck(word: string, derivative: string): boolean {
  const freq: Record<string, number> = {};
  for (const ch of word.toUpperCase()) {
    freq[ch] = (freq[ch] ?? 0) + 1;
  }
  for (const ch of derivative.toUpperCase()) {
    if (!freq[ch]) return false;
    freq[ch]--;
  }
  return true;
}

type GameStatus = "playing" | "won" | "lost";
type RoundResult = { word: string; canonical: boolean; points: number };

export function WordRootsGame({ groupSeed }: { groupSeed?: number } = {}) {
  const { user } = useAuth();
  const { reportResult, resetRecorded } = useGameResult({ slug: "word-roots" });
  const seeded = groupSeed !== undefined;
  const [authOpen, setAuthOpen] = useState(false);

  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [feedback, setFeedback] = useState<{ type: "bonus" | "correct" | "invalid"; message: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: puzzles, isLoading, error, refetch } = useQuery<WordRootsPuzzle[]>({
    queryKey: seeded ? ["/api/games/word-roots/puzzles", groupSeed] : ["/api/games/word-roots/puzzles"],
    ...(seeded ? { queryFn: async () => { const r = await fetch(`/api/games/word-roots/puzzles?seed=${groupSeed}`, { credentials: "include" }); return r.json(); } } : {}),
    refetchOnMount: seeded ? false : "always",
    gcTime: 0,
  });

  useEffect(() => {
    if (!puzzles || gameStatus !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setGameStatus("lost");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [puzzles, gameStatus]);

  useEffect(() => {
    if (gameStatus === "won" || gameStatus === "lost") {
      clearInterval(timerRef.current!);
      reportResult(score, gameStatus === "won");
    }
  }, [gameStatus, score, reportResult]);

  const currentPuzzle = puzzles?.[round];

  const derivativeStatuses = currentPuzzle
    ? currentPuzzle.derivatives.map(d => letterMultisetCheck(userInput, d))
    : [];
  const allFit = userInput.length >= 3 && derivativeStatuses.length > 0 && derivativeStatuses.every(Boolean);

  const handleSubmit = useCallback(async () => {
    if (!currentPuzzle || !allFit || isValidating || feedback) return;
    const upperWord = userInput.toUpperCase();
    setIsValidating(true);
    try {
      const res = await apiRequest("POST", "/api/games/validate-word", { word: upperWord });
      const data = await res.json();
      if (!data.valid) {
        setFeedback({ type: "invalid", message: "Not a valid dictionary word" });
        setTimeout(() => { setFeedback(null); inputRef.current?.focus(); }, 1500);
        setIsValidating(false);
        return;
      }
      const isCanonical = upperWord === currentPuzzle.canonicalWord.toUpperCase();
      const pts = BASE_POINTS + (isCanonical ? BONUS_POINTS : 0);
      setScore(s => s + pts);
      setRoundResults(prev => [...prev, { word: upperWord, canonical: isCanonical, points: pts }]);
      setFeedback({ type: isCanonical ? "bonus" : "correct", message: isCanonical ? `Exact match! +${pts} pts` : `Valid word! +${pts} pts` });
      setTimeout(() => {
        setFeedback(null);
        setUserInput("");
        const next = round + 1;
        if (next >= TOTAL_ROUNDS) {
          setGameStatus("won");
        } else {
          setRound(next);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }, 1500);
    } catch {
      setFeedback({ type: "invalid", message: "Error checking word" });
      setTimeout(() => { setFeedback(null); inputRef.current?.focus(); }, 1500);
    } finally {
      setIsValidating(false);
    }
  }, [currentPuzzle, allFit, isValidating, feedback, userInput, round]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleRestart = () => {
    resetRecorded();
    setRound(0);
    setScore(0);
    setUserInput("");
    setRoundResults([]);
    setFeedback(null);
    setTimeLeft(TOTAL_TIME);
    setGameStatus("playing");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading puzzles…
        </CardContent>
      </Card>
    );
  }

  if (error || !puzzles) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-destructive font-medium">Failed to load puzzles</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (gameStatus === "won" || gameStatus === "lost") {
    const canonicalCount = roundResults.filter(r => r.canonical).length;
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <div className={`text-4xl font-bold ${gameStatus === "won" ? "text-primary" : "text-muted-foreground"}`}>
                {gameStatus === "won" ? "Well Done!" : "Time's Up!"}
              </div>
              <div className="text-2xl font-semibold">{score} pts</div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">{roundResults.length}</div>
                <div className="text-xs text-muted-foreground">Rounds won</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-yellow-500">{canonicalCount}</div>
                <div className="text-xs text-muted-foreground">Exact matches</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">{score}</div>
                <div className="text-xs text-muted-foreground">Total score</div>
              </div>
            </div>

            {roundResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Your answers</p>
                {roundResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      {r.canonical
                        ? <Star className="h-4 w-4 text-yellow-500" />
                        : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      <span className="font-mono font-semibold">{r.word}</span>
                      {r.canonical && <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">exact</Badge>}
                    </div>
                    <span className="text-muted-foreground">+{r.points}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-center">
              <Button onClick={handleRestart} data-testid="button-play-again">
                <RotateCcw className="h-4 w-4 mr-2" />
                Play Again
              </Button>
            </div>

            {!user && (
              <div className="mt-2 p-3 rounded-lg bg-muted/50 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Sign in to save your scores and appear on the leaderboard!</p>
                <Button onClick={() => setAuthOpen(true)} variant="outline" size="sm" className="gap-2" data-testid="button-signin-result">
                  <LogIn className="h-4 w-4" /> Sign In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            <AnimatedNumber value={score} /> pts
          </Badge>
          <Badge variant="secondary" className="gap-1.5" data-testid="badge-round">
            Round {round + 1}/{TOTAL_ROUNDS}
          </Badge>
        </div>
        <Badge variant={timeLeft <= 30 ? "destructive" : "secondary"} className="gap-1.5" data-testid="badge-timer" role="timer">
          <Timer className="h-3.5 w-3.5" />
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
        </Badge>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={round}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
        >
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <TreePine className="h-4 w-4" />
                  <span>Find a word whose letters can form all of these:</span>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {currentPuzzle?.derivatives.map((d, i) => {
                    const checked = userInput.length >= 1;
                    const fits = checked && letterMultisetCheck(userInput, d);
                    return (
                      <motion.div
                        key={d}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <Badge
                          variant="outline"
                          className={`text-base px-4 py-2 font-mono font-semibold transition-colors ${
                            checked
                              ? fits
                                ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-950"
                                : "border-red-400 text-red-500 bg-red-50 dark:bg-red-950"
                              : "border-muted-foreground/40"
                          }`}
                          data-testid={`badge-derivative-${i}`}
                        >
                          {checked ? (fits
                            ? <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 inline" />
                            : <XCircle className="h-3.5 w-3.5 mr-1.5 inline" />) : null}
                          {d}
                        </Badge>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={`text-center text-sm font-semibold py-2 rounded-md ${
                      feedback.type === "bonus"
                        ? "text-yellow-600 bg-yellow-50 dark:bg-yellow-950"
                        : feedback.type === "correct"
                        ? "text-green-600 bg-green-50 dark:bg-green-950"
                        : "text-red-500 bg-red-50 dark:bg-red-950"
                    }`}
                    data-testid="feedback-message"
                  >
                    {feedback.type === "bonus" && <Star className="h-4 w-4 inline mr-1.5" />}
                    {feedback.message}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  value={userInput}
                  onChange={e => setUserInput(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your parent word..."
                  className="text-center font-mono text-lg uppercase tracking-widest"
                  disabled={!!feedback || isValidating}
                  autoFocus
                  data-testid="input-word"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!allFit || !!feedback || isValidating}
                  className="w-full gap-2"
                  data-testid="button-submit"
                >
                  <ArrowRight className="h-4 w-4" />
                  {isValidating ? "Checking…" : "Submit"}
                </Button>
                {userInput.length >= 3 && !allFit && (
                  <p className="text-xs text-center text-muted-foreground">
                    Not all derivatives can be formed from this word yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
