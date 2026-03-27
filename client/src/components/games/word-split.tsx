import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw,
  Trophy,
  CheckCircle,
  XCircle,
  Scissors,
  Loader2,
  Sparkles,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { WordSplitPuzzle } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { apiRequest } from "@/lib/queryClient";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";

type Difficulty = "short" | "medium" | "long";
type GameState = "menu" | "playing" | "completed" | "failed";

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; description: string; minLength: number; maxLength: number }> = {
  short: { label: "Short Words", description: "5-6 letter target words", minLength: 5, maxLength: 6 },
  medium: { label: "Medium Words", description: "7-8 letter target words", minLength: 7, maxLength: 8 },
  long: { label: "Long Words", description: "9+ letter target words", minLength: 9, maxLength: 99 },
};

function getLetterCounts(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of word.toUpperCase()) {
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  return counts;
}

function subtractLetterCounts(pool: Map<string, number>, word: string): Map<string, number> | null {
  const newPool = new Map(pool);
  for (const ch of word.toUpperCase()) {
    const count = newPool.get(ch);
    if (!count || count <= 0) return null;
    if (count === 1) newPool.delete(ch);
    else newPool.set(ch, count - 1);
  }
  return newPool;
}

function fitsWithinPool(word: string, pool: Map<string, number>): boolean {
  const wordCounts = getLetterCounts(word);
  const entries = Array.from(wordCounts.entries());
  for (let i = 0; i < entries.length; i++) {
    const [letter, count] = entries[i];
    if ((pool.get(letter) || 0) < count) return false;
  }
  return true;
}

function getRemainingLettersString(pool: Map<string, number>): string {
  const letters: string[] = [];
  const entries = Array.from(pool.entries());
  for (let i = 0; i < entries.length; i++) {
    const [letter, count] = entries[i];
    for (let j = 0; j < count; j++) {
      letters.push(letter);
    }
  }
  return letters.sort().join("");
}

function getTotalRemaining(pool: Map<string, number>): number {
  let total = 0;
  const values = Array.from(pool.values());
  for (let i = 0; i < values.length; i++) {
    total += values[i];
  }
  return total;
}

export function WordSplitGame({ initialChallenge = "" as Difficulty | "" }) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded, personalBest } = useGameResult({ slug: "word-split" });
  const { data: puzzles = [], isLoading, error, refetch } = useQuery<WordSplitPuzzle[]>({
    queryKey: ["/api/games/word-split/puzzles"],
    refetchOnMount: "always",
    gcTime: 0,
  });

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const res = await apiRequest("POST", "/api/games/validate-word", { word });
      return res.json() as Promise<{ valid: boolean; message?: string }>;
    },
  });

  const [activePuzzles, setActivePuzzles] = useState<WordSplitPuzzle[]>([]);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [currentPuzzle, setCurrentPuzzle] = useState<WordSplitPuzzle | null>(null);
  const [userInput, setUserInput] = useState("");
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);
  const [remainingPool, setRemainingPool] = useState<Map<string, number>>(new Map());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [puzzlesCompleted, setPuzzlesCompleted] = useState(0);
  const [puzzlesSkipped, setPuzzlesSkipped] = useState(0);
  const [usedPuzzles, setUsedPuzzles] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid" | "doesnt-fit"; message: string } | null>(null);
  const [completionMessage, setCompletionMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectPuzzle = useCallback((puzzleList: WordSplitPuzzle[], used: Set<string>) => {
    const available = puzzleList.filter(p => !used.has(p.targetWord));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }, []);

  const startPuzzle = useCallback((puzzle: WordSplitPuzzle) => {
    setCurrentPuzzle(puzzle);
    setSubmittedWords([]);
    setRemainingPool(getLetterCounts(puzzle.targetWord));
    setUserInput("");
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const startGame = useCallback(async (diff: Difficulty) => {
    const result = await refetch();
    const freshPuzzles = result.data || [];
    if (freshPuzzles.length === 0) return;

    const config = DIFFICULTY_CONFIG[diff];
    const filtered = freshPuzzles.filter(
      p => p.targetWord.length >= config.minLength && p.targetWord.length <= config.maxLength
    );

    if (filtered.length === 0) {
      setActivePuzzles(freshPuzzles);
    } else {
      setActivePuzzles(filtered);
    }

    setDifficulty(diff);
    setScore(0);
    setStreak(0);
    setPuzzlesCompleted(0);
    setPuzzlesSkipped(0);
    setUsedPuzzles(new Set());
    setGameState("playing");
    resetRecorded();

    const puzzleList = filtered.length > 0 ? filtered : freshPuzzles;
    const puzzle = puzzleList[Math.floor(Math.random() * puzzleList.length)];
    if (puzzle) {
      setUsedPuzzles(new Set<string>([puzzle.targetWord]));
      startPuzzle(puzzle);
    }
  }, [refetch, startPuzzle, resetRecorded]);

  useEffect(() => {
    if (initialChallenge) {
      startGame(initialChallenge as Difficulty);
    }
  }, []);

  const nextPuzzle = useCallback(() => {
    const puzzle = selectPuzzle(activePuzzles, usedPuzzles);
    if (!puzzle) {
      setGameState("completed");
      return;
    }
    setUsedPuzzles(prev => new Set([...Array.from(prev), puzzle.targetWord]));
    startPuzzle(puzzle);
  }, [activePuzzles, usedPuzzles, selectPuzzle, startPuzzle]);

  useEffect(() => {
    if (puzzles.length > 0 && gameState === "menu" && activePuzzles.length === 0) {
      setActivePuzzles(puzzles);
    }
  }, [puzzles, gameState, activePuzzles.length]);

  const submitWord = useCallback(async () => {
    if (!currentPuzzle || validateMutation.isPending) return;
    const word = userInput.trim().toUpperCase();

    if (word.length < 2) {
      playSound("wrong");
      setFeedback({ type: "wrong", message: "Words must be at least 2 letters" });
      setStreak(0);
      setUserInput("");
      setTimeout(() => setFeedback(null), 1200);
      return;
    }

    if (currentPuzzle && word === currentPuzzle.targetWord.toUpperCase() && submittedWords.length === 0) {
      playSound("wrong");
      setFeedback({ type: "wrong", message: "You need to split the word, not use it whole!" });
      setStreak(0);
      setUserInput("");
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    if (submittedWords.includes(word)) {
      playSound("wrong");
      setFeedback({ type: "wrong", message: "Already submitted!" });
      setStreak(0);
      setUserInput("");
      setTimeout(() => setFeedback(null), 1200);
      return;
    }

    if (!fitsWithinPool(word, remainingPool)) {
      playSound("wrong");
      setFeedback({ type: "doesnt-fit", message: "Letters don't fit the remaining pool" });
      setStreak(0);
      setUserInput("");
      setTimeout(() => setFeedback(null), 1200);
      return;
    }

    const result = await validateMutation.mutateAsync(word);
    if (!result.valid) {
      playSound("wrong");
      setFeedback({ type: "invalid", message: "Not a valid word" });
      setStreak(0);
      setTimeout(() => setFeedback(null), 1200);
      setUserInput("");
      return;
    }

    const newPool = subtractLetterCounts(remainingPool, word);
    if (!newPool) {
      playSound("wrong");
      setFeedback({ type: "doesnt-fit", message: "Letters don't fit" });
      setStreak(0);
      setUserInput("");
      setTimeout(() => setFeedback(null), 1200);
      return;
    }

    playSound("correct");
    setFeedback({ type: "correct", message: "Valid word!" });
    setStreak(prev => prev + 1);
    const newSubmitted = [...submittedWords, word];
    setSubmittedWords(newSubmitted);
    setRemainingPool(newPool);
    setScore(prev => prev + word.length * 10);
    setUserInput("");

    const totalRemaining = getTotalRemaining(newPool);

    if (totalRemaining === 0 && newSubmitted.length >= 2) {
      const bonusPoints = 50;
      setScore(prev => prev + bonusPoints);
      setPuzzlesCompleted(prev => prev + 1);
      playSound("win");
      setTimeout(() => {
        setFeedback(null);
        nextPuzzle();
      }, 1500);
    } else {
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 600);
    }
  }, [currentPuzzle, userInput, submittedWords, remainingPool, validateMutation, playSound, nextPuzzle]);

  const undoLastWord = useCallback(() => {
    if (submittedWords.length === 0 || !currentPuzzle) return;
    const lastWord = submittedWords[submittedWords.length - 1];
    const newSubmitted = submittedWords.slice(0, -1);
    setSubmittedWords(newSubmitted);

    const newPool = new Map(remainingPool);
    for (const ch of lastWord.toUpperCase()) {
      newPool.set(ch, (newPool.get(ch) || 0) + 1);
    }
    setRemainingPool(newPool);
    setScore(prev => Math.max(0, prev - lastWord.length * 10));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [submittedWords, currentPuzzle, remainingPool]);

  const skipPuzzle = useCallback(() => {
    setStreak(0);
    setPuzzlesSkipped(prev => prev + 1);
    nextPuzzle();
  }, [nextPuzzle]);

  useEffect(() => {
    if (gameState === "completed") {
      const allSolved = puzzlesSkipped === 0 && puzzlesCompleted > 0;
      setCompletionMessage(getCompletionMessage(allSolved));
      reportResult(score, true, puzzlesCompleted);
    }
  }, [gameState, puzzlesSkipped, puzzlesCompleted, score, reportResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      submitWord();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-destructive">Failed to load game data</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gameState === "menu") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-center mb-6" data-testid="text-choose-difficulty">Choose Your Difficulty</h3>
            <div className="grid gap-3">
              {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(([key, config]) => (
                <motion.div
                  key={key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 px-6 flex items-center gap-4 text-left"
                    onClick={() => startGame(key)}
                    data-testid={`button-difficulty-${key}`}
                  >
                    <div className="flex-shrink-0">
                      <Scissors className={`h-6 w-6 ${key === "short" ? "text-accent" : key === "medium" ? "text-primary" : "text-destructive"}`} />
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-semibold">{config.label}</span>
                      <span className="text-sm text-muted-foreground font-normal">
                        {config.description}
                      </span>
                    </div>
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState === "completed") {
    const totalPuzzles = puzzlesCompleted + puzzlesSkipped;
    const allSolved = puzzlesSkipped === 0 && puzzlesCompleted > 0;

    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className={allSolved ? "border-accent" : ""}>
            <CardContent className="p-6 text-center space-y-4">
              <div aria-live="polite">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  {allSolved ? (
                    <Trophy className="h-16 w-16 mx-auto text-accent" />
                  ) : (
                    <Sparkles className="h-16 w-16 mx-auto text-primary" />
                  )}
                </motion.div>
                <h3 className="text-2xl font-bold">
                  {allSolved ? "Word Split Champion!" : "Session Complete"}
                </h3>
                <p className="text-muted-foreground">
                  {allSolved
                    ? "You solved every puzzle!"
                    : puzzlesCompleted === 0
                      ? "You skipped all the puzzles. Give it another try!"
                      : `You solved ${puzzlesCompleted} of ${totalPuzzles} puzzles.`}
                </p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary" data-testid="text-final-score">
                    <AnimatedNumber value={score} /> points
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="text-puzzles-completed">
                    {puzzlesCompleted} of {totalPuzzles} puzzles solved
                  </div>
                  {personalBest > 0 && (
                    <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                      Personal Best: {personalBest} pts
                    </p>
                  )}
                </div>
              </div>
              <ShareResults
                gameName="Word Split"
                gameSlug="word-split"
                score={score}
                wordsCompleted={puzzlesCompleted}
                challengeName={difficulty ? DIFFICULTY_CONFIG[difficulty].label : undefined}
                isWin={allSolved}
              />
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => setGameState("menu")} data-testid="button-main-menu">
                  Main Menu
                </Button>
                <Button variant="outline" onClick={() => difficulty && startGame(difficulty)} data-testid="button-play-again">
                  Play Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!currentPuzzle) return null;

  const totalLetters = currentPuzzle.targetWord.length;
  const remaining = getTotalRemaining(remainingPool);
  const covered = totalLetters - remaining;
  const progressPercent = (covered / totalLetters) * 100;
  const remainingLettersStr = getRemainingLettersString(remainingPool);

  const coveredLetters = new Map<string, number>();
  for (const word of submittedWords) {
    for (const ch of word.toUpperCase()) {
      coveredLetters.set(ch, (coveredLetters.get(ch) || 0) + 1);
    }
  }

  const letterStatuses: { letter: string; covered: boolean }[] = [];
  const tempCovered = new Map(coveredLetters);
  for (const letter of currentPuzzle.targetWord.toUpperCase()) {
    const count = tempCovered.get(letter);
    if (count && count > 0) {
      letterStatuses.push({ letter, covered: true });
      tempCovered.set(letter, count - 1);
    } else {
      letterStatuses.push({ letter, covered: false });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            <AnimatedNumber value={score} /> pts
          </Badge>
          <StreakIndicator streak={streak} />
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-puzzles">
            <Sparkles className="h-3.5 w-3.5" />
            {puzzlesCompleted} solved
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGameState("menu")}
            className="gap-1.5"
            data-testid="button-menu"
          >
            <RotateCcw className="h-4 w-4" />
            Menu
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPuzzle.targetWord}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Split this word into smaller words:
                </p>
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  <span data-testid="text-hint">{currentPuzzle.hint}</span>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center gap-1 sm:gap-1.5 flex-wrap"
                role="group"
                aria-label={`Target word: ${currentPuzzle.targetWord}`}
              >
                {letterStatuses.map((ls, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.5, rotateY: 90 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      rotateY: 0,
                      backgroundColor: ls.covered ? undefined : undefined,
                    }}
                    transition={{ delay: index * 0.04 }}
                    className={`w-9 h-11 sm:w-11 sm:h-13 flex items-center justify-center text-lg sm:text-xl font-bold rounded-md transition-colors duration-300 ${
                      ls.covered
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`target-letter-${index}`}
                    aria-label={`Letter ${ls.letter}, ${ls.covered ? "covered" : "not covered"}`}
                  >
                    {ls.letter}
                  </motion.div>
                ))}
              </motion.div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Letters covered</span>
                  <span className="font-medium" data-testid="text-progress">
                    {covered} / {totalLetters}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {remainingLettersStr && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1.5">Remaining letters:</p>
                  <div className="flex justify-center gap-1 flex-wrap">
                    {remainingLettersStr.split("").map((letter, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center justify-center w-7 h-8 text-sm font-semibold rounded bg-muted text-muted-foreground"
                        data-testid={`remaining-letter-${i}`}
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {submittedWords.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {submittedWords.map((word, i) => (
                    <motion.div
                      key={`${word}-${i}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Badge variant="secondary" className="text-sm" data-testid={`badge-word-${i}`}>
                        {word}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="max-w-sm mx-auto space-y-4">
                <div className="relative">
                  <Input
                    ref={inputRef}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a word (2+ letters)..."
                    aria-label="Enter a word to split from the target"
                    className={`text-center text-lg font-semibold tracking-wider uppercase ${
                      feedback?.type === "correct"
                        ? "border-accent bg-accent/10"
                        : feedback
                        ? "border-destructive bg-destructive/10"
                        : ""
                    }`}
                    data-testid="input-word"
                  />
                  <div aria-live="polite">
                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {feedback.type === "correct" ? (
                          <CheckCircle className="h-5 w-5 text-accent" aria-label="Correct" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" aria-label="Incorrect" />
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>

                <div aria-live="polite">
                  {feedback && feedback.type !== "correct" && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-sm text-destructive"
                      data-testid="text-feedback"
                    >
                      {feedback.message}
                    </motion.p>
                  )}
                </div>

                <div className="flex gap-2 justify-center flex-wrap">
                  <Button
                    onClick={submitWord}
                    disabled={!userInput.trim() || validateMutation.isPending}
                    data-testid="button-submit"
                  >
                    {validateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Submit"
                    )}
                  </Button>
                  {submittedWords.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={undoLastWord}
                      data-testid="button-undo"
                    >
                      Undo
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={skipPuzzle}
                    className="gap-1.5"
                    data-testid="button-skip"
                  >
                    Skip
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Find words whose letters combine to spell the target word exactly
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
