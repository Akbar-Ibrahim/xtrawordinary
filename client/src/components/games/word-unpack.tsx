import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Check, Send, Undo2, Loader2, Sparkles, PackageOpen } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";
import type { WordUnpackPuzzle } from "@shared/schema";

interface GridCell {
  letter: string;
  id: number;
  selected: boolean;
  selectionOrder: number;
  cleared: boolean;
}

export function WordUnpackGame({ groupSeed, locked }: { groupSeed?: number; locked?: boolean } = {}) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded, personalBest } = useGameResult({ slug: "word-unpack" });
  const seeded = groupSeed !== undefined;

  const { data: puzzleData, isLoading, error, refetch } = useQuery<WordUnpackPuzzle>({
    queryKey: seeded ? ["/api/games/word-unpack/puzzle", groupSeed] : ["/api/games/word-unpack/puzzle"],
    ...(seeded ? {
      queryFn: async () => {
        const r = await fetch(`/api/games/word-unpack/puzzle?seed=${groupSeed}`, { credentials: "include" });
        return r.json();
      }
    } : {}),
    refetchOnMount: seeded ? false : "always",
  });

  const [grid, setGrid] = useState<GridCell[]>([]);
  const [puzzleWords, setPuzzleWords] = useState<string[]>([]);
  const [wordsFound, setWordsFound] = useState<string[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<"loading" | "playing" | "ended">("loading");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong"; message: string } | null>(null);
  const [completionMessage, setCompletionMessage] = useState("");

  const selectedCells = grid
    .filter(c => c.selected && !c.cleared)
    .sort((a, b) => a.selectionOrder - b.selectionOrder);
  const currentWord = selectedCells.map(c => c.letter).join("");
  const remainingWords = puzzleWords.filter(w => !wordsFound.includes(w));

  const buildPuzzle = useCallback((data: WordUnpackPuzzle) => {
    const cells: GridCell[] = [];
    let id = 0;
    for (let row = 0; row < data.size; row++) {
      for (let col = 0; col < data.size; col++) {
        cells.push({
          letter: data.grid[row][col],
          id: id++,
          selected: false,
          selectionOrder: 0,
          cleared: false,
        });
      }
    }
    setGrid(cells);
    setPuzzleWords(data.words);
    setWordsFound([]);
    setWrongAttempts(0);
    setScore(0);
    setGameStatus("playing");
    setFeedback(null);
    setCompletionMessage("");
  }, []);

  useEffect(() => {
    if (puzzleData && gameStatus === "loading") {
      buildPuzzle(puzzleData);
    }
  }, [puzzleData, gameStatus, buildPuzzle]);

  const initGame = useCallback(async () => {
    resetRecorded();
    setGameStatus("loading");
    const result = await refetch();
    if (result.data) {
      buildPuzzle(result.data);
    }
  }, [refetch, buildPuzzle, resetRecorded]);

  useEffect(() => {
    if (gameStatus === "ended") {
      reportResult(score, wordsFound.length === puzzleWords.length, wordsFound.length);
    }
  }, [gameStatus]);

  const handleCellClick = useCallback((cellId: number) => {
    if (gameStatus !== "playing") return;

    setGrid(prev => {
      const cell = prev.find(c => c.id === cellId);
      if (!cell || cell.cleared) return prev;

      if (cell.selected) {
        const removedOrder = cell.selectionOrder;
        return prev.map(c => {
          if (c.id === cellId) return { ...c, selected: false, selectionOrder: 0 };
          if (c.selected && c.selectionOrder > removedOrder) return { ...c, selectionOrder: c.selectionOrder - 1 };
          return c;
        });
      }

      const maxOrder = prev.reduce((max, c) => (c.selected && !c.cleared ? Math.max(max, c.selectionOrder) : max), 0);
      return prev.map(c =>
        c.id === cellId ? { ...c, selected: true, selectionOrder: maxOrder + 1 } : c
      );
    });

    setFeedback(null);
    playSound("click");
  }, [gameStatus, playSound]);

  const clearSelection = useCallback(() => {
    setGrid(prev => prev.map(c => ({ ...c, selected: false, selectionOrder: 0 })));
    setFeedback(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (currentWord.length === 0) return;

    const matchedWord = remainingWords.find(w => w === currentWord);

    if (matchedWord) {
      playSound("correct");
      const wordScore = 10 * matchedWord.length;
      const newWordsFound = [...wordsFound, matchedWord];
      setWordsFound(newWordsFound);
      setScore(prev => prev + wordScore);
      setFeedback({ type: "correct", message: `+${wordScore} pts — ${matchedWord}!` });

      setGrid(prev => prev.map(c =>
        c.selected ? { ...c, cleared: true, selected: false, selectionOrder: 0 } : c
      ));

      if (newWordsFound.length === puzzleWords.length) {
        setTimeout(() => {
          const completionBonus = 50;
          const precisionBonus = wrongAttempts === 0 ? 30 : 0;
          const totalBonus = completionBonus + precisionBonus;
          setScore(s => s + totalBonus);
          playSound("win");
          setCompletionMessage(getCompletionMessage(true));
          setGameStatus("ended");
        }, 600);
      }
    } else {
      playSound("wrong");
      const isAlreadyFound = wordsFound.includes(currentWord);
      setFeedback({
        type: "wrong",
        message: isAlreadyFound ? "Already found!" : "Not in the word list",
      });
      setWrongAttempts(prev => prev + 1);
      clearSelection();
    }

    setTimeout(() => setFeedback(null), 1800);
  }, [currentWord, remainingWords, wordsFound, puzzleWords.length, wrongAttempts, playSound, clearSelection]);

  const handleGiveUp = useCallback(() => {
    setCompletionMessage(getCompletionMessage(false));
    setGameStatus("ended");
    playSound("lose");
  }, [playSound]);

  if (isLoading || gameStatus === "loading") {
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
          <p className="text-destructive">Failed to load puzzle</p>
          <Button onClick={() => initGame()} className="mt-4" data-testid="button-retry">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isPerfectClear = wordsFound.length === puzzleWords.length;

  if (gameStatus === "ended") {
    return (
      <motion.div
        key="result"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className={isPerfectClear ? "border-accent" : ""}>
          <CardContent className="p-6 text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
            >
              {isPerfectClear ? (
                <Sparkles className="h-16 w-16 mx-auto text-accent" />
              ) : (
                <Trophy className="h-16 w-16 mx-auto text-chart-3" />
              )}
            </motion.div>

            <div>
              <h2 className="text-2xl font-bold">
                {isPerfectClear ? "Puzzle Cleared!" : "Game Over"}
              </h2>
              <p className="text-muted-foreground mt-1">{completionMessage}</p>
            </div>

            <div className="flex justify-center gap-4 flex-wrap">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary" data-testid="text-final-score">
                  <AnimatedNumber value={score} />
                </div>
                <div className="text-sm text-muted-foreground">points</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold" data-testid="text-words-found">
                  {wordsFound.length}/{puzzleWords.length}
                </div>
                <div className="text-sm text-muted-foreground">words</div>
              </div>
              {wrongAttempts === 0 && (
                <div className="text-center">
                  <div className="text-3xl font-bold text-accent">+30</div>
                  <div className="text-sm text-muted-foreground">precision</div>
                </div>
              )}
            </div>

            {personalBest !== null && (
              <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                Personal best: {personalBest} pts
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Words</p>
              <div className="flex flex-wrap justify-center gap-2">
                {puzzleWords.map(word => (
                  <Badge
                    key={word}
                    variant={wordsFound.includes(word) ? "default" : "outline"}
                    className="text-sm"
                    data-testid={`badge-result-word-${word}`}
                  >
                    {wordsFound.includes(word) && <Check className="h-3 w-3 mr-1" />}
                    {word}
                  </Badge>
                ))}
              </div>
            </div>

            <ShareResults
              gameName="Word Unpack"
              gameSlug="word-unpack"
              score={score}
              wordsCompleted={wordsFound.length}
              isWin={isPerfectClear}
            />

            {!locked && (
              <Button onClick={initGame} className="gap-1.5" data-testid="button-play-again">
                <RotateCcw className="h-4 w-4" />
                Play Again
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            <AnimatedNumber value={score} /> pts
          </Badge>
          <Badge variant="secondary" data-testid="badge-words-remaining">
            {wordsFound.length}/{puzzleWords.length} words
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {wrongAttempts > 0 && (
            <Badge variant="outline" className="text-destructive gap-1" data-testid="badge-wrong-attempts">
              {wrongAttempts} {wrongAttempts === 1 ? "miss" : "misses"}
            </Badge>
          )}
          {!locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={initGame}
              className="gap-1.5"
              data-testid="button-restart"
            >
              <RotateCcw className="h-4 w-4" />
              New Puzzle
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Tap letters in order to spell each word, then submit
          </p>

          {/* Grid */}
          <div
            className="grid gap-1.5 sm:gap-2 mx-auto"
            style={{
              gridTemplateColumns: `repeat(5, 1fr)`,
              maxWidth: "300px",
            }}
            data-testid="grid-container"
          >
            {grid.map((cell) => {
              const isSelected = cell.selected && !cell.cleared;
              const isCleared = cell.cleared;

              return (
                <motion.button
                  key={cell.id}
                  onClick={() => handleCellClick(cell.id)}
                  disabled={isCleared}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: isCleared ? 0 : 1,
                    scale: isCleared ? 0.5 : 1,
                  }}
                  whileTap={!isCleared ? { scale: 0.88 } : undefined}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`relative aspect-square flex items-center justify-center text-base sm:text-lg font-bold rounded-md transition-colors ${
                    isCleared
                      ? "invisible pointer-events-none"
                      : isSelected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                      : "bg-primary/15 text-foreground hover-elevate cursor-pointer"
                  }`}
                  data-testid={`grid-cell-${cell.id}`}
                >
                  {!isCleared && (
                    <>
                      {cell.letter}
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-accent-foreground text-[9px] flex items-center justify-center font-medium">
                          {cell.selectionOrder}
                        </span>
                      )}
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Current selection */}
          <div className="space-y-2">
            <div
              className={`h-11 flex items-center justify-center rounded-md border-2 border-dashed text-lg font-bold tracking-widest mx-auto max-w-[280px] ${
                currentWord.length > 0
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-muted-foreground/30 text-muted-foreground"
              }`}
              data-testid="text-current-word"
            >
              {currentWord || "Select letters..."}
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`text-center text-sm font-medium ${
                    feedback.type === "correct" ? "text-accent" : "text-destructive"
                  }`}
                  data-testid="text-feedback"
                >
                  {feedback.message}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={selectedCells.length === 0}
                className="gap-1.5"
                data-testid="button-clear"
              >
                <Undo2 className="h-4 w-4" />
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={currentWord.length === 0}
                className="gap-1.5"
                data-testid="button-submit"
              >
                <Send className="h-4 w-4" />
                Submit
              </Button>
            </div>
          </div>

          {/* Word list */}
          <div className="space-y-2 pt-1">
            <p className="text-xs text-center text-muted-foreground uppercase tracking-wider font-medium">
              Words to find
            </p>
            <div className="flex flex-wrap justify-center gap-2" data-testid="word-list">
              {puzzleWords.map((word) => {
                const found = wordsFound.includes(word);
                return (
                  <div
                    key={word}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                      found
                        ? "bg-accent/20 border-accent text-accent line-through"
                        : "bg-muted border-border text-foreground"
                    }`}
                    data-testid={`word-target-${word}`}
                  >
                    {found && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {word}
                    {!found && (
                      <span className="text-xs text-muted-foreground ml-1">({word.length})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGiveUp}
              data-testid="button-give-up"
            >
              Give Up
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
