import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  PlusCircle,
  LogIn,
} from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { ShareResults } from "@/components/share-results";
import { getCompletionMessage } from "@/lib/completion-messages";
import { apiRequest } from "@/lib/queryClient";
import type { WordExtensionPuzzle } from "@shared/schema";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { useSound } from "@/lib/sound-provider";
import { usePuzzleHistory } from "@/hooks/use-puzzle-history";

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_TIME = 90;
const POINTS_PER_ANSWER = 10;

const VARIATIONS: { lettersToAdd: number; label: string; color: string }[] = [
  { lettersToAdd: 1, label: "Easy",   color: "bg-accent text-accent-foreground" },
  { lettersToAdd: 2, label: "Medium", color: "bg-chart-3 text-white" },
  { lettersToAdd: 3, label: "Hard",   color: "bg-orange-500 text-white" },
  { lettersToAdd: 4, label: "Expert", color: "bg-destructive text-destructive-foreground" },
];

// ── Main exported component ───────────────────────────────────────────────────

export function WordExtensionGame({
  locked,
  isUntimed,
  timeLimitSeconds,
  initialChallenge,
  groupSeed,
}: {
  locked?: boolean;
  isUntimed?: boolean;
  timeLimitSeconds?: number;
  initialChallenge?: number;
  groupSeed?: number;
} = {}) {
  const [lettersToAdd, setLettersToAdd] = useState<number | null>(initialChallenge ?? null);

  if (lettersToAdd === null) {
    return (
      <VariationSelector
        onSelect={setLettersToAdd}
        locked={locked}
      />
    );
  }

  return (
    <WordExtensionPlay
      lettersToAdd={lettersToAdd}
      locked={locked}
      isUntimed={isUntimed}
      timeLimitSeconds={timeLimitSeconds}
      groupSeed={groupSeed}
      onExit={() => setLettersToAdd(null)}
    />
  );
}

// ── Variation selector ────────────────────────────────────────────────────────

function VariationSelector({
  onSelect,
  locked,
}: {
  onSelect: (n: number) => void;
  locked?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="text-center space-y-1">
          <PlusCircle className="h-10 w-10 mx-auto text-primary" />
          <h2 className="text-xl font-bold">Word Extension</h2>
          <p className="text-sm text-muted-foreground">
            Choose how many letters you need to add to the given word.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {VARIATIONS.map(v => (
            <button
              key={v.lettersToAdd}
              onClick={() => onSelect(v.lettersToAdd)}
              className="rounded-xl border p-4 text-left hover:bg-muted/60 transition-colors space-y-1"
              data-testid={`btn-variation-${v.lettersToAdd}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-base">{v.label}</span>
                <Badge className={v.color + " text-xs"}>+{v.lettersToAdd}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Add {v.lettersToAdd} letter{v.lettersToAdd > 1 ? "s" : ""} to the shown word
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Play component ────────────────────────────────────────────────────────────

type GameStatus = "playing" | "ended";
type FeedbackType = "correct" | "wrong";

function WordExtensionPlay({
  lettersToAdd,
  locked,
  isUntimed,
  timeLimitSeconds,
  groupSeed,
  onExit,
}: {
  lettersToAdd: number;
  locked?: boolean;
  isUntimed?: boolean;
  timeLimitSeconds?: number;
  groupSeed?: number;
  onExit: () => void;
}) {
  const { user } = useAuth();
  const { playSound } = useSound();
  // All variations report under the same canonical game slug so stats/leaderboard consolidate.
  const slug = "word-extension";
  const { reportResult, resetRecorded } = useGameResult({ slug, isUntimed });
  const personalBest = usePersonalBest(slug);
  const { markSeen, filterUnseen } = usePuzzleHistory("word-extension");

  const totalTime = timeLimitSeconds ?? DEFAULT_TIME;

  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const [completionMessage, setCompletionMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Daily and group play provide a seed so every player gets the same sequence.
  const { data: puzzles, isLoading, error, refetch } = useQuery<WordExtensionPuzzle[]>({
    queryKey: ["/api/games/word-extension/puzzles", lettersToAdd, groupSeed],
    queryFn: async () => {
      const seedQuery = groupSeed === undefined ? "" : `&seed=${groupSeed}`;
      const url = `/api/games/word-extension/puzzles?lettersToAdd=${lettersToAdd}${seedQuery}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
    refetchOnMount: "always",
    gcTime: 0,
  });

  // Timer
  useEffect(() => {
    if (!puzzles || gameStatus !== "playing" || isUntimed) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          if (!endedRef.current) {
            endedRef.current = true;
            setGameStatus("ended");
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [puzzles, gameStatus, isUntimed]);

  // Report on end
  useEffect(() => {
    if (gameStatus === "ended") {
      clearInterval(timerRef.current!);
      reportResult(score, answeredCount > 0, answeredCount);
      setCompletionMessage(getCompletionMessage(answeredCount > 3));
    }
  }, [gameStatus]);

  const playablePuzzles = useMemo(() => {
    if (!puzzles) return [];
    if (groupSeed !== undefined) return puzzles;
    return filterUnseen(
      puzzles,
      (puzzle) => `${puzzle.shownWord}:${lettersToAdd}`,
      String(lettersToAdd),
    );
  }, [puzzles, filterUnseen, groupSeed, lettersToAdd]);
  const currentPuzzle = playablePuzzles[round];
  const variation = VARIATIONS.find(v => v.lettersToAdd === lettersToAdd)!;

  useEffect(() => {
    if (currentPuzzle) {
      markSeen(`${currentPuzzle.shownWord}:${lettersToAdd}`, String(lettersToAdd));
    }
  }, [currentPuzzle, lettersToAdd, markSeen]);

  const handleSubmit = useCallback(async () => {
    if (!currentPuzzle || isValidating || feedback || gameStatus !== "playing") return;
    const trimmed = userInput.trim();
    if (!trimmed) return;
    const submitted = trimmed.toUpperCase();

    // Quick client-side length check
    if (submitted.length !== currentPuzzle.shownWord.length + lettersToAdd) {
      setFeedback({ type: "wrong", message: `Must be exactly ${currentPuzzle.shownWord.length + lettersToAdd} letters` });
      playSound("wrong");
      setTimeout(() => { setFeedback(null); inputRef.current?.focus(); }, 1400);
      return;
    }

    setIsValidating(true);
    try {
      const res = await apiRequest("POST", "/api/games/word-extension/validate", {
        shownWord: currentPuzzle.shownWord,
        submittedWord: submitted,
        lettersToAdd,
      });
      const data = await res.json();

      if (!data.valid) {
        setFeedback({ type: "wrong", message: "Not a valid extension — check your letters" });
        playSound("wrong");
        setTimeout(() => { setFeedback(null); setUserInput(""); inputRef.current?.focus(); }, 1400);
      } else {
        const pts = POINTS_PER_ANSWER * lettersToAdd;
        setScore(s => s + pts);
        setAnsweredCount(n => n + 1);
        setFeedback({ type: "correct", message: `+${pts} pts — ${submitted}` });
        playSound("correct");
        setTimeout(() => {
          setFeedback(null);
          setUserInput("");
          const next = round + 1;
          if (next >= playablePuzzles.length) {
            // No more puzzles — end game
            if (!endedRef.current) {
              endedRef.current = true;
              clearInterval(timerRef.current!);
              setGameStatus("ended");
            }
          } else {
            setRound(next);
          }
          setTimeout(() => inputRef.current?.focus(), 50);
        }, 1000);
      }
    } catch {
      setFeedback({ type: "wrong", message: "Error checking word — try again" });
      setTimeout(() => { setFeedback(null); inputRef.current?.focus(); }, 1400);
    } finally {
      setIsValidating(false);
    }
  }, [currentPuzzle, isValidating, feedback, gameStatus, userInput, lettersToAdd, round, playablePuzzles.length, playSound]);

  const handleSkip = useCallback(() => {
    if (gameStatus !== "playing" || !puzzles) return;
    const next = round + 1;
    setUserInput("");
    setFeedback(null);
    if (next >= playablePuzzles.length) {
      if (!endedRef.current) {
        endedRef.current = true;
        clearInterval(timerRef.current!);
        setGameStatus("ended");
      }
    } else {
      setRound(next);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [gameStatus, round, playablePuzzles.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleRestart = () => {
    endedRef.current = false;
    resetRecorded();
    setRound(0);
    setScore(0);
    setAnsweredCount(0);
    setUserInput("");
    setFeedback(null);
    setTimeLeft(totalTime);
    setCompletionMessage("");
    setGameStatus("playing");
    refetch();
  };

  // ── Loading / error ──
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">Loading puzzles…</CardContent>
      </Card>
    );
  }
  if (error || !puzzles || puzzles.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-destructive font-medium">Failed to load puzzles</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // ── End screen ──
  if (gameStatus === "ended") {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <Trophy className="h-14 w-14 mx-auto text-[hsl(38,92%,50%)]" />
              <h3 className="text-2xl font-bold">Game Over!</h3>
              <p className="text-muted-foreground text-sm">{completionMessage}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold" data-testid="stat-answered">{answeredCount}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-[hsl(38,92%,50%)]" data-testid="stat-score">{score}</div>
                <div className="text-xs text-muted-foreground">Total pts</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="text-2xl font-bold">
                  <Badge className={variation.color}>{variation.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Mode</div>
              </div>
            </div>

            {personalBest !== null && score > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                {score >= personalBest ? "🎉 New personal best!" : `Personal best: ${personalBest} pts`}
              </p>
            )}

            <ShareResults
              gameName="Word Extension"
              gameSlug={slug}
              score={score}
              wordsCompleted={answeredCount}
              isWin={answeredCount > 0}
            />

            {!user && (
              <div className="p-3 rounded-lg bg-muted/50 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Sign in to save your score!</p>
                <Button onClick={() => setAuthOpen(true)} variant="outline" size="sm" className="gap-2" data-testid="button-signin-result">
                  <LogIn className="h-4 w-4" /> Sign In
                </Button>
              </div>
            )}

            {!locked && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={handleRestart} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Play Again
                </Button>
                <Button onClick={onExit} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-change-mode">
                  Change Mode
                </Button>
                <TryAnotherGameButton currentSlug="word-extension" />
              </div>
            )}
          </CardContent>
        </Card>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </motion.div>
    );
  }

  // ── Playing ──
  const timerPercent = (timeLeft / totalTime) * 100;
  const timerColor = timeLeft > (totalTime * 0.33) ? "bg-accent" : timeLeft > (totalTime * 0.11) ? "bg-chart-3" : "bg-destructive";
  const targetLength = (currentPuzzle?.shownWord.length ?? 5) + lettersToAdd;

  return (
    <div className="space-y-4" data-testid="word-extension-play">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isUntimed ? (
            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-400 text-xs">
              ∞ Untimed
            </Badge>
          ) : (
            <>
              <Timer className={`h-4 w-4 ${timeLeft <= 15 ? "text-destructive animate-pulse" : ""}`} />
              <span
                className={`font-mono font-bold text-lg ${timeLeft <= 15 ? "text-destructive animate-pulse" : ""}`}
                data-testid="badge-timer"
                role="timer"
              >
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Score</p>
          <AnimatedNumber value={score} className="text-2xl font-bold text-primary" data-testid="badge-score" />
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Round</p>
          <p className="text-sm font-semibold">{round + 1} / {puzzles.length}</p>
        </div>
      </div>

      {/* Timer bar */}
      {!isUntimed && (
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full transition-colors ${timerColor}`}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Puzzle card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={round}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardContent className="p-6 space-y-5">
              {/* Instruction */}
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  Extend this word by adding{" "}
                  <Badge className={variation.color + " text-xs"}>+{lettersToAdd}</Badge> letter{lettersToAdd > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your answer must contain all letters of the word below, plus {lettersToAdd} more
                </p>
              </div>

              {/* The shown word */}
              <div className="flex justify-center">
                <div className="bg-muted rounded-2xl px-8 py-5 text-center">
                  <p className="text-4xl font-bold tracking-widest font-mono text-primary" data-testid="shown-word">
                    {currentPuzzle?.shownWord ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentPuzzle?.shownWord.length} letters → find a {targetLength}-letter word
                  </p>
                </div>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <Input
                  ref={inputRef}
                  value={userInput}
                  onChange={e => setUserInput(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder={`Type a ${targetLength}-letter word…`}
                  className="text-center font-mono text-lg tracking-widest uppercase"
                  maxLength={targetLength + 2}
                  disabled={isValidating || !!feedback}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-testid="word-input"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={isValidating || !!feedback || !userInput.trim()}
                    className="flex-1"
                    data-testid="btn-submit"
                  >
                    {isValidating ? "Checking…" : "Submit"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    disabled={!!feedback}
                    data-testid="btn-skip"
                  >
                    Skip
                  </Button>
                </div>
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-center justify-center gap-2 rounded-lg p-3 text-sm font-medium ${
                      feedback.type === "correct"
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                    data-testid="feedback-message"
                  >
                    {feedback.type === "correct"
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                      : <XCircle className="h-4 w-4 shrink-0" />}
                    {feedback.message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Menu / End Game */}
              {!locked && (
                <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onExit}
                    data-testid="button-menu"
                  >
                    Menu
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!endedRef.current) {
                        endedRef.current = true;
                        clearInterval(timerRef.current!);
                        setGameStatus("ended");
                      }
                    }}
                    data-testid="button-end-game"
                  >
                    End Game
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
