import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Combine,
  Eraser,
  Keyboard,
  LogIn,
  RefreshCw,
  RotateCcw,
  Timer,
  Trophy,
  Undo2,
} from "lucide-react";
import type { WordFusionPuzzle, WordFusionValidationResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatedNumber } from "@/components/animated-number";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { ShareResults } from "@/components/share-results";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/lib/auth-context";
import {
  AnswerTiles,
  ComponentTileGroups,
  makeFusionTiles,
  type FusionTile,
} from "./word-fusion-tiles";
import {
  switchToTappedFusionAnswer,
  switchToTypedFusionAnswer,
} from "./word-fusion-input";

const DEFAULT_TIME = 90;
const TARGET_ROUNDS = 5;

type Feedback = { type: "correct" | "wrong"; message: string } | null;
type RoundResult = { answer: string; canonicalWord: string; points: number; exact: boolean };

export function WordFusionGame({
  groupSeed,
  locked,
  isUntimed,
  timeLimitSeconds,
}: {
  groupSeed?: number;
  locked?: boolean;
  isUntimed?: boolean;
  timeLimitSeconds?: number;
} = {}) {
  const { user } = useAuth();
  const { playSound } = useSound();
  const { reportResult, resetRecorded } = useGameResult({ slug: "word-fusion", isUntimed });
  const personalBest = usePersonalBest("word-fusion");
  const totalTime = timeLimitSeconds ?? DEFAULT_TIME;

  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(totalTime);
  const [status, setStatus] = useState<"playing" | "ended">("playing");
  const [selectedTiles, setSelectedTiles] = useState<FusionTile[]>([]);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [validating, setValidating] = useState(false);
  const [alternateIndex, setAlternateIndex] = useState(-1);
  const [refreshUsed, setRefreshUsed] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [completionMessage, setCompletionMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const gameActiveRef = useRef(true);
  const roundRef = useRef(0);

  const { data: puzzles, isLoading, isError, refetch } = useQuery<WordFusionPuzzle[]>({
    queryKey: ["/api/games/word-fusion/puzzles", groupSeed],
    queryFn: async () => {
      const query = groupSeed === undefined ? "" : `?seed=${groupSeed}`;
      const response = await fetch(`/api/games/word-fusion/puzzles${query}`);
      if (!response.ok) throw new Error("Failed to load Word Fusion puzzles");
      return response.json();
    },
  });

  const basePuzzle = puzzles?.[round];
  const activeCombination = useMemo(() => {
    if (!basePuzzle || alternateIndex < 0) return basePuzzle;
    const alternate = basePuzzle.alternates[alternateIndex];
    return alternate ? { ...basePuzzle, id: alternate.id, components: alternate.components } : basePuzzle;
  }, [basePuzzle, alternateIndex]);
  const answer = typedAnswer || selectedTiles.map(tile => tile.letter).join("");
  const totalLetters = activeCombination?.components.reduce((sum, component) => sum + component.length, 0) ?? 0;
  const selectedIds = useMemo(() => new Set(selectedTiles.map(tile => tile.id)), [selectedTiles]);

  useEffect(() => {
    if (!puzzles || status !== "playing" || isUntimed) return;
    const interval = setInterval(() => {
      setTimeLeft(value => {
        if (value <= 1) {
          clearInterval(interval);
          gameActiveRef.current = false;
          setStatus("ended");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [puzzles, status, isUntimed]);

  useEffect(() => {
    if (status !== "ended") return;
    const won = results.length >= Math.min(TARGET_ROUNDS, puzzles?.length ?? TARGET_ROUNDS);
    reportResult(score, won, results.length);
    setCompletionMessage(getCompletionMessage(won));
    playSound(won ? "win" : "lose");
  }, [status]);

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  const clearAnswer = useCallback(() => {
    setSelectedTiles([]);
    setTypedAnswer("");
  }, []);

  const focusAnswerInput = useCallback(() => {
    setTimeout(() => answerInputRef.current?.focus(), 50);
  }, []);

  const selectTile = (tile: FusionTile) => {
    if (feedback || validating) return;
    setSelectedTiles(current => switchToTappedFusionAnswer(tile, current).selectedTiles);
    setTypedAnswer("");
    playSound("click");
  };

  const resetRound = () => {
    clearAnswer();
    setFeedback(null);
  };

  const moveToNextRound = () => {
    const nextRound = round + 1;
    setFeedback(null);
    clearAnswer();
    setAlternateIndex(-1);
    setRefreshUsed(false);
    if (nextRound >= Math.min(TARGET_ROUNDS, puzzles?.length ?? 0)) {
      gameActiveRef.current = false;
      setStatus("ended");
    } else {
      roundRef.current = nextRound;
      setRound(nextRound);
      focusAnswerInput();
    }
  };

  const submitAnswer = useCallback(async () => {
    if (!activeCombination || !answer || feedback || validating || status !== "playing") return;
    if (answer.length !== totalLetters) {
      setFeedback({ type: "wrong", message: `Use all ${totalLetters} letter tiles` });
      playSound("wrong");
      setTimeout(() => {
        setFeedback(null);
        focusAnswerInput();
      }, 1200);
      return;
    }

    const submittedRound = roundRef.current;
    const submittedCombinationId = activeCombination.id;
    setValidating(true);
    try {
      const response = await apiRequest("POST", "/api/games/word-fusion/validate", {
        combinationId: submittedCombinationId,
        answer,
      });
      const result = await response.json() as WordFusionValidationResponse;
      if (
        !gameActiveRef.current ||
        roundRef.current !== submittedRound ||
        activeCombination.id !== submittedCombinationId
      ) return;
      if (!result.valid || !result.canonicalWord) {
        setStreak(0);
        setFeedback({ type: "wrong", message: "Those letters do not form this answer. Try another order." });
        playSound("wrong");
        setTimeout(() => {
          setFeedback(null);
          clearAnswer();
          focusAnswerInput();
        }, 1500);
        return;
      }

      const streakBonus = Math.min(streak * 2, 10);
      const points = (result.points ?? 10) + streakBonus;
      setScore(current => current + points);
      setStreak(current => current + 1);
      setResults(current => [...current, {
        answer: answer.toUpperCase(),
        canonicalWord: result.canonicalWord!,
        points,
        exact: !!result.exact,
      }]);
      setFeedback({
        type: "correct",
        message: `${result.exact ? "Base word found" : "Anagram accepted"} · +${points} pts${streakBonus ? ` (${streakBonus} streak bonus)` : ""}`,
      });
      playSound("correct");
      advanceTimerRef.current = setTimeout(moveToNextRound, 1300);
    } catch {
      if (!gameActiveRef.current || roundRef.current !== submittedRound) return;
      setFeedback({ type: "wrong", message: "Could not check that answer. Please try again." });
      playSound("wrong");
      setTimeout(() => {
        setFeedback(null);
        focusAnswerInput();
      }, 1400);
    } finally {
      setValidating(false);
    }
  }, [activeCombination, answer, feedback, validating, status, totalLetters, streak, round, puzzles, focusAnswerInput]);

  const useAlternate = () => {
    if (!basePuzzle?.alternates.length || refreshUsed) return;
    setAlternateIndex(0);
    setRefreshUsed(true);
    resetRound();
    playSound("click");
  };

  const restart = () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    resetRecorded();
    gameActiveRef.current = true;
    roundRef.current = 0;
    setRound(0);
    setScore(0);
    setStreak(0);
    setTimeLeft(totalTime);
    setStatus("playing");
    setResults([]);
    setCompletionMessage("");
    setAlternateIndex(-1);
    setRefreshUsed(false);
    resetRound();
    refetch();
  };

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading letter combinations…</CardContent></Card>;
  }
  if (isError || !puzzles?.length || !activeCombination) {
    return (
      <Card><CardContent className="space-y-3 p-8 text-center">
        <p className="font-medium text-destructive">Word Fusion puzzles are unavailable.</p>
        <Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  if (status === "ended") {
    const won = results.length >= Math.min(TARGET_ROUNDS, puzzles.length);
    return (
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="space-y-2 text-center">
              <Trophy className={`mx-auto h-12 w-12 ${won ? "text-amber-500" : "text-muted-foreground"}`} />
              <h2 className="text-3xl font-black">{won ? "Fusion complete!" : "Time's up!"}</h2>
              <p className="text-2xl font-bold text-primary">{score} pts</p>
              <p className="text-sm italic text-muted-foreground">{completionMessage}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-2xl font-bold">{results.length}</div><div className="text-xs text-muted-foreground">Words fused</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-2xl font-bold">{results.filter(result => result.exact).length}</div><div className="text-xs text-muted-foreground">Base words</div></div>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-2xl font-bold">{score}</div><div className="text-xs text-muted-foreground">Points</div></div>
            </div>
            {results.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Your answers</p>
                {results.map((result, index) => (
                  <div key={`${result.answer}-${index}`} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-mono font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{result.answer}</span>
                    <span className="text-muted-foreground">+{result.points}</span>
                  </div>
                ))}
              </div>
            )}
            <ShareResults gameName="Word Fusion" gameSlug="word-fusion" score={score} wordsCompleted={results.length} isWin={won} />
            {!locked && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Play Again</Button>
                <TryAnotherGameButton currentSlug="word-fusion" />
              </div>
            )}
            {!user && (
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="mb-2 text-sm text-muted-foreground">Sign in to save scores and appear on the leaderboard.</p>
                <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)}><LogIn className="mr-2 h-4 w-4" />Sign In</Button>
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
      <div className="flex flex-wrap items-center justify-center gap-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isUntimed ? <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300">∞ Untimed</Badge> : (
            <><Timer className={`h-4 w-4 ${timeLeft <= 15 ? "text-destructive" : ""}`} /><span className={`font-mono text-lg font-bold ${timeLeft <= 15 ? "text-destructive" : ""}`} role="timer">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</span></>
          )}
        </div>
        <div className="text-center"><p className="text-xs text-muted-foreground">Score</p><AnimatedNumber value={score} className="text-2xl font-bold text-primary" /></div>
        <div className="text-center"><p className="text-xs text-muted-foreground">Streak</p><div className="text-xl font-bold">{streak}</div></div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={`${round}-${activeCombination.id}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
          <Card>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary">Round {round + 1}/{Math.min(TARGET_ROUNDS, puzzles.length)}</Badge>
                <span className="text-sm text-muted-foreground">PB: <strong className="text-foreground">{personalBest || "—"}</strong></span>
              </div>
              <div className="space-y-1 text-center">
                <Combine className="mx-auto h-7 w-7 text-primary" />
                <h3 className="text-lg font-bold">Fuse every letter into one word</h3>
                <p className="text-sm text-muted-foreground">Tap tiles in answer order. Colours, labels, and borders identify each source component.</p>
              </div>

              <AnswerTiles tiles={typedAnswer ? makeFusionTiles([typedAnswer]).map((tile, index) => ({ ...tile, id: `typed-${index}` })) : selectedTiles} onRemove={index => {
                if (typedAnswer) setTypedAnswer(value => value.slice(0, index) + value.slice(index + 1));
                else setSelectedTiles(current => current.filter((_, tileIndex) => tileIndex !== index));
              }} />

              <div aria-live="polite" className="min-h-10">
                {feedback && <div className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${feedback.type === "correct" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`}>{feedback.message}</div>}
              </div>

              <ComponentTileGroups components={activeCombination.components} selectedIds={selectedIds} disabled={!!feedback || validating} onSelect={selectTile} />

              <div className="space-y-2">
                <label htmlFor="word-fusion-answer" className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <Keyboard className="h-4 w-4 text-primary" />
                  Type your answer or tap the tiles
                </label>
                <Input
                  ref={answerInputRef}
                  id="word-fusion-answer"
                  value={typedAnswer}
                  onChange={event => {
                    const next = switchToTypedFusionAnswer(event.target.value, totalLetters);
                    setSelectedTiles(next.selectedTiles);
                    setTypedAnswer(next.typedAnswer);
                  }}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitAnswer();
                    }
                  }}
                  placeholder={`${totalLetters}-letter answer`}
                  aria-label={`Type your ${totalLetters}-letter Word Fusion answer`}
                  className="text-center font-mono text-lg uppercase tracking-widest"
                  disabled={!!feedback || validating}
                  autoComplete="off"
                  data-testid="input-word-fusion"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="outline" onClick={() => setSelectedTiles(current => current.slice(0, -1))} disabled={selectedTiles.length === 0 || !!typedAnswer || validating}><Undo2 className="mr-2 h-4 w-4" />Undo</Button>
                <Button variant="outline" onClick={resetRound} disabled={!answer || validating}><Eraser className="mr-2 h-4 w-4" />Reset</Button>
                <Button variant="outline" onClick={useAlternate} disabled={refreshUsed || !(basePuzzle?.alternates.length) || validating}><RefreshCw className="mr-2 h-4 w-4" />Alternate</Button>
                <Button onClick={submitAnswer} disabled={!answer || validating || !!feedback}>{validating ? "Checking…" : "Fuse word"}</Button>
              </div>

              {!locked && <div className="flex justify-center border-t pt-3"><Button variant="ghost" size="sm" onClick={() => { gameActiveRef.current = false; setStatus("ended"); }}>End game</Button></div>}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}