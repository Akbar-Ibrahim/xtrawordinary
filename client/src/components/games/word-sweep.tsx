import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, XCircle, Shuffle, Send, Undo2, Loader2, Sparkles } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse, WordSweepGrid } from "@shared/schema";

interface GridCell {
  letter: string;
  id: number;
  selected: boolean;
  selectionOrder: number;
  cleared: boolean;
}

function calculateWordScore(wordLength: number): number {
  return Math.round(10 * Math.pow(2, wordLength - 3));
}

export function WordSweepGame() {
  const { playSound } = useSound();
  const GRID_SIZE = 6;
  const MAX_SHUFFLES = 3;

  const { data: gridData, isLoading, error, refetch } = useQuery<WordSweepGrid>({
    queryKey: ["/api/games/word-sweep/grid"],
    refetchOnMount: "always",
  });

  const [grid, setGrid] = useState<GridCell[]>([]);
  const [score, setScore] = useState(0);
  const [wordsFound, setWordsFound] = useState<string[]>([]);
  const [shufflesLeft, setShufflesLeft] = useState(MAX_SHUFFLES);
  const [gameStatus, setGameStatus] = useState<"loading" | "playing" | "ended">("loading");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid" | "short"; message: string } | null>(null);
  const [completionMessage, setCompletionMessage] = useState("");
  const [totalLetters, setTotalLetters] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCells = grid
    .filter(c => c.selected && !c.cleared)
    .sort((a, b) => a.selectionOrder - b.selectionOrder);
  const currentWord = selectedCells.map(c => c.letter).join("");
  const remainingLetters = grid.filter(c => !c.cleared).length;
  const isPerfectClear = remainingLetters === 0 && gameStatus === "ended";

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const buildGrid = useCallback((data: WordSweepGrid) => {
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
    setTotalLetters(cells.length);
    setGameStatus("playing");
  }, []);

  useEffect(() => {
    if (gridData && gameStatus === "loading") {
      buildGrid(gridData);
    }
  }, [gridData, gameStatus, buildGrid]);

  const initGame = useCallback(async () => {
    setScore(0);
    setWordsFound([]);
    setShufflesLeft(MAX_SHUFFLES);
    setGameStatus("loading");
    setFeedback(null);
    setCompletionMessage("");
    setIsSubmitting(false);
    const result = await refetch();
    if (result.data) {
      buildGrid(result.data);
    }
  }, [refetch, buildGrid]);

  const handleCellClick = useCallback((cellId: number) => {
    if (gameStatus !== "playing" || isSubmitting) return;

    setGrid(prev => {
      const cell = prev.find(c => c.id === cellId);
      if (!cell || cell.cleared) return prev;

      if (cell.selected) {
        const removedOrder = cell.selectionOrder;
        return prev.map(c => {
          if (c.id === cellId) {
            return { ...c, selected: false, selectionOrder: 0 };
          }
          if (c.selected && c.selectionOrder > removedOrder) {
            return { ...c, selectionOrder: c.selectionOrder - 1 };
          }
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
  }, [gameStatus, isSubmitting, playSound]);

  const clearSelection = useCallback(() => {
    setGrid(prev => prev.map(c => ({ ...c, selected: false, selectionOrder: 0 })));
    setFeedback(null);
  }, []);

  const applyGravity = useCallback((cells: GridCell[]): GridCell[] => {
    const result = [...cells];
    for (let col = 0; col < GRID_SIZE; col++) {
      const columnCells: GridCell[] = [];
      for (let row = 0; row < GRID_SIZE; row++) {
        columnCells.push(result[row * GRID_SIZE + col]);
      }

      const activeCells = columnCells.filter(c => !c.cleared);
      const clearedCount = GRID_SIZE - activeCells.length;

      for (let row = 0; row < GRID_SIZE; row++) {
        const idx = row * GRID_SIZE + col;
        if (row < clearedCount) {
          result[idx] = { ...result[idx], cleared: true, selected: false, selectionOrder: 0 };
        } else {
          const sourceCell = activeCells[row - clearedCount];
          result[idx] = {
            ...result[idx],
            letter: sourceCell.letter,
            cleared: false,
            selected: false,
            selectionOrder: 0,
          };
        }
      }
    }
    return result;
  }, [GRID_SIZE]);

  const handleSubmit = useCallback(async () => {
    if (currentWord.length < 3) {
      setFeedback({ type: "short", message: "Words must be at least 3 letters" });
      playSound("wrong");
      return;
    }

    if (wordsFound.includes(currentWord)) {
      setFeedback({ type: "invalid", message: "Already found that word!" });
      playSound("wrong");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await validateMutation.mutateAsync(currentWord);

      if (result.valid) {
        playSound("correct");
        const wordScore = calculateWordScore(currentWord.length);
        setScore(prev => prev + wordScore);
        setWordsFound(prev => [...prev, currentWord]);
        setFeedback({ type: "correct", message: `+${wordScore} points!` });

        setGrid(prev => {
          const afterClear = prev.map(c =>
            c.selected ? { ...c, cleared: true, selected: false, selectionOrder: 0 } : c
          );
          const afterGravity = applyGravity(afterClear);

          const remaining = afterGravity.filter(c => !c.cleared).length;
          if (remaining === 0) {
            setTimeout(() => {
              const bonus = 500;
              setScore(s => s + bonus);
              playSound("win");
              setCompletionMessage(getCompletionMessage(true));
              setGameStatus("ended");
            }, 600);
          }

          return afterGravity;
        });
      } else {
        playSound("wrong");
        setFeedback({ type: "wrong", message: "Not a valid word" });
        clearSelection();
      }
    } catch {
      setFeedback({ type: "wrong", message: "Validation failed" });
      clearSelection();
    }

    setIsSubmitting(false);
    setTimeout(() => setFeedback(null), 1500);
  }, [currentWord, wordsFound, validateMutation, playSound, applyGravity, clearSelection]);

  const handleShuffle = useCallback(() => {
    if (shufflesLeft <= 0) return;
    setShufflesLeft(prev => prev - 1);
    playSound("click");

    setGrid(prev => {
      const activeLetters = prev.filter(c => !c.cleared).map(c => c.letter);
      for (let i = activeLetters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [activeLetters[i], activeLetters[j]] = [activeLetters[j], activeLetters[i]];
      }

      let letterIdx = 0;
      return prev.map(c => {
        if (c.cleared) return c;
        return { ...c, letter: activeLetters[letterIdx++], selected: false, selectionOrder: 0 };
      });
    });
    setFeedback(null);
  }, [shufflesLeft, playSound]);

  const handleGiveUp = useCallback(() => {
    const isWin = remainingLetters === 0;
    setCompletionMessage(getCompletionMessage(isWin));
    setGameStatus("ended");
    if (!isWin) {
      playSound("lose");
    }
  }, [remainingLetters, playSound]);

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
          <p className="text-destructive">Failed to load game data</p>
          <Button onClick={() => initGame()} className="mt-4" data-testid="button-retry">
            Retry
          </Button>
        </CardContent>
      </Card>
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
          <Badge variant="secondary" data-testid="badge-words-found">
            {wordsFound.length} words
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-remaining">
            {remainingLetters} / {totalLetters} left
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={initGame}
            className="gap-1.5"
            data-testid="button-restart"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {gameStatus === "playing" ? (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Click letters to form a word, then submit
                  </p>
                </div>

                <div
                  className="grid gap-1.5 sm:gap-2 mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                    maxWidth: "340px",
                  }}
                  data-testid="grid-container"
                >
                  {grid.map((cell) => {
                    const isSelected = cell.selected && !cell.cleared;
                    const isCleared = cell.cleared;

                    return (
                      <motion.button
                        key={cell.id}
                        layout
                        onClick={() => handleCellClick(cell.id)}
                        disabled={isCleared || isSubmitting}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                          opacity: isCleared ? 0 : 1,
                          scale: isCleared ? 0.5 : 1,
                        }}
                        whileTap={!isCleared && !isSubmitting ? { scale: 0.9 } : undefined}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={`aspect-square flex items-center justify-center text-lg sm:text-xl font-bold rounded-md transition-colors ${
                          isCleared
                            ? "invisible"
                            : isSelected
                            ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                            : "bg-card border border-border text-foreground hover-elevate cursor-pointer"
                        }`}
                        data-testid={`grid-cell-${cell.id}`}
                      >
                        {!isCleared && (
                          <>
                            {cell.letter}
                            {isSelected && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-medium">
                                {cell.selectionOrder}
                              </span>
                            )}
                          </>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 min-h-[44px]">
                    <div
                      className={`flex-1 max-w-[280px] h-11 flex items-center justify-center rounded-md border-2 border-dashed text-lg font-bold tracking-widest ${
                        currentWord.length > 0
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-muted-foreground/30 text-muted-foreground"
                      }`}
                      data-testid="text-current-word"
                    >
                      {currentWord || "Select letters..."}
                    </div>
                  </div>

                  <AnimatePresence>
                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`text-center text-sm font-medium ${
                          feedback.type === "correct"
                            ? "text-accent"
                            : "text-destructive"
                        }`}
                        data-testid="text-feedback"
                      >
                        {feedback.message}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      disabled={selectedCells.length === 0 || isSubmitting}
                      className="gap-1.5"
                      data-testid="button-clear"
                    >
                      <Undo2 className="h-4 w-4" />
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={currentWord.length < 3 || isSubmitting}
                      className="gap-1.5"
                      data-testid="button-submit"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Submit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShuffle}
                      disabled={shufflesLeft <= 0 || isSubmitting}
                      className="gap-1.5"
                      data-testid="button-shuffle"
                    >
                      <Shuffle className="h-4 w-4" />
                      Shuffle ({shufflesLeft})
                    </Button>
                  </div>

                  {wordsFound.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-center text-muted-foreground uppercase tracking-wider font-medium">
                        Words found
                      </p>
                      <div className="flex flex-wrap justify-center gap-1" data-testid="words-found-list">
                        {wordsFound.map((word, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {word}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGiveUp}
                      data-testid="button-give-up"
                    >
                      End Game
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
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
                  ) : wordsFound.length > 0 ? (
                    <Trophy className="h-16 w-16 mx-auto text-chart-3" />
                  ) : (
                    <XCircle className="h-16 w-16 mx-auto text-destructive" />
                  )}
                </motion.div>
                <h3 className="text-2xl font-bold" data-testid="text-result-title">
                  {isPerfectClear
                    ? "Perfect Clear!"
                    : wordsFound.length > 0
                    ? "Great Job!"
                    : "Game Over"}
                </h3>
                <p className="text-muted-foreground" data-testid="text-result-detail">
                  {isPerfectClear
                    ? "You cleared every letter from the grid!"
                    : `You cleared ${totalLetters - remainingLetters} of ${totalLetters} letters`}
                </p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">
                  {completionMessage}
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary" data-testid="text-final-score">
                    <AnimatedNumber value={score} /> points
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {wordsFound.length} words found
                  </div>
                  {isPerfectClear && (
                    <div className="text-sm text-accent font-medium">
                      Includes +500 perfect clear bonus!
                    </div>
                  )}
                </div>
                {wordsFound.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1" data-testid="result-words-list">
                    {wordsFound.map((word, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {word}
                      </Badge>
                    ))}
                  </div>
                )}
                <ShareResults
                  gameName="Word Sweep"
                  gameSlug="word-sweep"
                  score={score}
                  wordsCompleted={wordsFound.length}
                  isWin={wordsFound.length > 0}
                />
                <Button onClick={initGame} data-testid="button-play-again">
                  Play Again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
