import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw, Trophy, XCircle, Shuffle, Send, Undo2, Loader2,
  Sparkles, Check, Timer, Grid3X3, PackageOpen,
} from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse, WordSweepGrid, WordUnpackPuzzle } from "@shared/schema";

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

function WordSweepClassic({ groupSeed, locked }: { groupSeed?: number; locked?: boolean }) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded } = useGameResult({ slug: "word-sweep" });
  const personalBest = usePersonalBest("word-sweep");
  const GRID_SIZE = 6;
  const MAX_SHUFFLES = 3;
  const seeded = groupSeed !== undefined;

  const { data: gridData, isLoading, error, refetch } = useQuery<WordSweepGrid>({
    queryKey: seeded ? ["/api/games/word-sweep/grid", groupSeed] : ["/api/games/word-sweep/grid"],
    ...(seeded ? {
      queryFn: async () => {
        const r = await fetch(`/api/games/word-sweep/grid?seed=${groupSeed}`, { credentials: "include" });
        return r.json();
      },
    } : {}),
    refetchOnMount: seeded ? false : "always",
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

  const selectedCells = grid.filter(c => c.selected && !c.cleared).sort((a, b) => a.selectionOrder - b.selectionOrder);
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
        cells.push({ letter: data.grid[row][col], id: id++, selected: false, selectionOrder: 0, cleared: false });
      }
    }
    setGrid(cells);
    setTotalLetters(cells.length);
    setGameStatus("playing");
  }, []);

  useEffect(() => {
    if (gridData && gameStatus === "loading") buildGrid(gridData);
  }, [gridData, gameStatus, buildGrid]);

  const initGame = useCallback(async () => {
    resetRecorded();
    setScore(0);
    setWordsFound([]);
    setShufflesLeft(MAX_SHUFFLES);
    setGameStatus("loading");
    setFeedback(null);
    setCompletionMessage("");
    setIsSubmitting(false);
    const result = await refetch();
    if (result.data) buildGrid(result.data);
  }, [refetch, buildGrid, resetRecorded]);

  useEffect(() => {
    if (gameStatus === "ended") reportResult(score, remainingLetters === 0, wordsFound.length);
  }, [gameStatus, score, reportResult, remainingLetters, wordsFound.length]);

  const handleCellClick = useCallback((cellId: number) => {
    if (gameStatus !== "playing" || isSubmitting) return;
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
      return prev.map(c => c.id === cellId ? { ...c, selected: true, selectionOrder: maxOrder + 1 } : c);
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
      for (let row = 0; row < GRID_SIZE; row++) columnCells.push(result[row * GRID_SIZE + col]);
      const activeCells = columnCells.filter(c => !c.cleared);
      const clearedCount = GRID_SIZE - activeCells.length;
      for (let row = 0; row < GRID_SIZE; row++) {
        const idx = row * GRID_SIZE + col;
        if (row < clearedCount) {
          result[idx] = { ...result[idx], cleared: true, selected: false, selectionOrder: 0 };
        } else {
          const sourceCell = activeCells[row - clearedCount];
          result[idx] = { ...result[idx], letter: sourceCell.letter, cleared: false, selected: false, selectionOrder: 0 };
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
          const afterClear = prev.map(c => c.selected ? { ...c, cleared: true, selected: false, selectionOrder: 0 } : c);
          const afterGravity = applyGravity(afterClear);
          const remaining = afterGravity.filter(c => !c.cleared).length;
          if (remaining === 0) {
            setTimeout(() => {
              setScore(s => s + 500);
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
      return prev.map(c => c.cleared ? c : { ...c, letter: activeLetters[letterIdx++], selected: false, selectionOrder: 0 });
    });
    setFeedback(null);
  }, [shufflesLeft, playSound]);

  const handleGiveUp = useCallback(() => {
    const isWin = remainingLetters === 0;
    setCompletionMessage(getCompletionMessage(isWin));
    setGameStatus("ended");
    if (!isWin) playSound("lose");
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
          <Button onClick={() => initGame()} className="mt-4" data-testid="button-retry">Retry</Button>
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
          <Badge variant="secondary" data-testid="badge-words-found">{wordsFound.length} words</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-remaining">
            {remainingLetters} / {totalLetters} left
          </Badge>
          {!locked && (
            <Button variant="outline" size="sm" onClick={initGame} className="gap-1.5" data-testid="button-restart">
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {gameStatus === "playing" ? (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Click letters to form a word, then submit</p>
                </div>
                <div
                  className="grid gap-1.5 sm:gap-2 mx-auto"
                  style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, maxWidth: "340px" }}
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
                        animate={{ opacity: isCleared ? 0 : 1, scale: isCleared ? 0.5 : 1 }}
                        whileTap={!isCleared && !isSubmitting ? { scale: 0.9 } : undefined}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={`aspect-square flex items-center justify-center text-lg sm:text-xl font-bold rounded-md transition-colors ${
                          isCleared ? "invisible" : isSelected
                            ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                            : "bg-primary/15 text-foreground hover-elevate cursor-pointer"
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
                        currentWord.length > 0 ? "border-primary bg-primary/5 text-foreground" : "border-muted-foreground/30 text-muted-foreground"
                      }`}
                      data-testid="text-current-word"
                    >
                      {currentWord || "Select letters..."}
                    </div>
                  </div>

                  <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
                  <AnimatePresence>
                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`text-center text-sm font-medium ${feedback.type === "correct" ? "text-accent" : "text-destructive"}`}
                        data-testid="text-feedback"
                      >
                        {feedback.message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  </div>

                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedCells.length === 0 || isSubmitting} className="gap-1.5" data-testid="button-clear">
                      <Undo2 className="h-4 w-4" />Clear
                    </Button>
                    <Button size="sm" onClick={handleSubmit} disabled={currentWord.length < 3 || isSubmitting} className="gap-1.5" data-testid="button-submit">
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Submit
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleShuffle} disabled={shufflesLeft <= 0 || isSubmitting} className="gap-1.5" data-testid="button-shuffle">
                      <Shuffle className="h-4 w-4" />
                      Shuffle ({shufflesLeft})
                    </Button>
                  </div>

                  {wordsFound.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-center text-muted-foreground uppercase tracking-wider font-medium">Words found</p>
                      <div className="flex flex-wrap justify-center gap-1 max-h-40 overflow-y-auto" data-testid="words-found-list">
                        {wordsFound.map((word, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{word}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center pt-2">
                    <Button variant="outline" size="sm" onClick={handleGiveUp} data-testid="button-give-up">End Game</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className={isPerfectClear ? "border-accent" : ""}>
              <CardContent className="p-6 text-center space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                  {isPerfectClear ? (
                    <Sparkles className="h-16 w-16 mx-auto text-accent" />
                  ) : wordsFound.length > 0 ? (
                    <Trophy className="h-16 w-16 mx-auto text-chart-3" />
                  ) : (
                    <XCircle className="h-16 w-16 mx-auto text-destructive" />
                  )}
                </motion.div>
                <h3 className="text-2xl font-bold" data-testid="text-result-title">
                  {isPerfectClear ? "Perfect Clear!" : wordsFound.length > 0 ? "Great Job!" : "Game Over"}
                </h3>
                <p className="text-muted-foreground" data-testid="text-result-detail">
                  {isPerfectClear
                    ? "You cleared every letter from the grid!"
                    : `You cleared ${totalLetters - remainingLetters} of ${totalLetters} letters`}
                </p>
                <p className="text-sm italic text-muted-foreground" data-testid="text-completion-message">{completionMessage}</p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary" data-testid="text-final-score">
                    <AnimatedNumber value={score} /> points
                  </div>
                  <div className="text-sm text-muted-foreground">{wordsFound.length} words found</div>
                  {personalBest > 0 && (
                    <p className="text-sm text-muted-foreground" data-testid="text-personal-best">Personal Best: {personalBest} pts</p>
                  )}
                  {isPerfectClear && (
                    <div className="text-sm text-accent font-medium">Includes +500 perfect clear bonus!</div>
                  )}
                </div>
                {wordsFound.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 max-h-48 overflow-y-auto" data-testid="result-words-list">
                    {wordsFound.map((word, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{word}</Badge>
                    ))}
                  </div>
                )}
                <ShareResults gameName="Word Sweep" gameSlug="word-sweep" score={score} wordsCompleted={wordsFound.length} isWin={wordsFound.length > 0} />
                {!locked && (
                  <Button onClick={initGame} data-testid="button-play-again">Play Again</Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WordSweepGuided({ groupSeed, locked, overrideSlug }: { groupSeed?: number; locked?: boolean; overrideSlug?: string }) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded } = useGameResult({ slug: "word-unpack" });
  const personalBest = usePersonalBest("word-unpack");
  const seeded = groupSeed !== undefined;

  const { data: puzzleData, isLoading, error, refetch } = useQuery<WordUnpackPuzzle>({
    queryKey: seeded ? ["/api/games/word-unpack/puzzle", groupSeed] : ["/api/games/word-unpack/puzzle"],
    ...(seeded ? {
      queryFn: async () => {
        const r = await fetch(`/api/games/word-unpack/puzzle?seed=${groupSeed}`, { credentials: "include" });
        return r.json();
      },
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const wrongAttemptsRef = useRef(0);

  const selectedCells = grid.filter(c => c.selected && !c.cleared).sort((a, b) => a.selectionOrder - b.selectionOrder);
  const currentWord = selectedCells.map(c => c.letter).join("");
  const remainingWords = puzzleWords.filter(w => !wordsFound.includes(w));
  const GRID_SIZE = puzzleData?.size ?? 6;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    elapsedRef.current = 0;
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSeconds(s => s + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const buildPuzzle = useCallback((data: WordUnpackPuzzle) => {
    const cells: GridCell[] = [];
    let id = 0;
    for (let row = 0; row < data.size; row++) {
      for (let col = 0; col < data.size; col++) {
        cells.push({ letter: data.grid[row][col], id: id++, selected: false, selectionOrder: 0, cleared: false });
      }
    }
    setGrid(cells);
    setPuzzleWords(data.words);
    setWordsFound([]);
    setWrongAttempts(0);
    wrongAttemptsRef.current = 0;
    setScore(0);
    setElapsedSeconds(0);
    setGaveUp(false);
    setGameStatus("playing");
    setFeedback(null);
    setCompletionMessage("");
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    if (puzzleData && gameStatus === "loading") buildPuzzle(puzzleData);
  }, [puzzleData, gameStatus, buildPuzzle]);

  const initGame = useCallback(async () => {
    resetRecorded();
    stopTimer();
    setGameStatus("loading");
    const result = await refetch();
    if (result.data) buildPuzzle(result.data);
  }, [refetch, buildPuzzle, resetRecorded, stopTimer]);

  useEffect(() => {
    if (gameStatus === "ended") {
      stopTimer();
      reportResult(score, wordsFound.length === puzzleWords.length, wordsFound.length);
      if (overrideSlug) {
        window.dispatchEvent(
          new CustomEvent("wordplay-game-result", {
            detail: { slug: overrideSlug, score, won: wordsFound.length === puzzleWords.length },
          })
        );
      }
    }
  }, [gameStatus]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

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
      return prev.map(c => c.id === cellId ? { ...c, selected: true, selectionOrder: maxOrder + 1 } : c);
    });
    setFeedback(null);
    playSound("click");
  }, [gameStatus, playSound]);

  const clearSelectionOnly = useCallback(() => {
    setGrid(prev => prev.map(c => ({ ...c, selected: false, selectionOrder: 0 })));
  }, []);

  const clearSelection = useCallback(() => {
    setGrid(prev => prev.map(c => ({ ...c, selected: false, selectionOrder: 0 })));
    setFeedback(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (currentWord.length === 0) return;
    const matchedWord = remainingWords.find(w => w === currentWord);
    if (matchedWord) {
      playSound("correct");
      const newWordsFound = [...wordsFound, matchedWord];
      setWordsFound(newWordsFound);
      setFeedback({ type: "correct", message: `Found: ${matchedWord}!` });
      setGrid(prev => prev.map(c => c.selected ? { ...c, cleared: true, selected: false, selectionOrder: 0 } : c));
      if (newWordsFound.length === puzzleWords.length) {
        setTimeout(() => {
          stopTimer();
          const finalScore = Math.max(50, 1000 - elapsedRef.current * 5 - wrongAttemptsRef.current * 50);
          setScore(finalScore);
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
      wrongAttemptsRef.current += 1;
      setWrongAttempts(wrongAttemptsRef.current);
      setPenaltyFlash(true);
      setTimeout(() => setPenaltyFlash(false), 1000);
      clearSelectionOnly();
    }
    setTimeout(() => setFeedback(null), 1800);
  }, [currentWord, remainingWords, wordsFound, puzzleWords.length, wrongAttempts, playSound, clearSelectionOnly, stopTimer]);

  const handleGiveUp = useCallback(() => {
    stopTimer();
    setGaveUp(true);
    setScore(0);
    setCompletionMessage(getCompletionMessage(false));
    setGameStatus("ended");
    playSound("lose");
  }, [playSound, stopTimer]);

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
          <Button onClick={() => initGame()} className="mt-4" data-testid="button-retry">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const isPerfectClear = wordsFound.length === puzzleWords.length;

  if (gameStatus === "ended") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className={isPerfectClear ? "border-accent" : ""}>
          <CardContent className="p-6 text-center space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
              {isPerfectClear ? (
                <Sparkles className="h-16 w-16 mx-auto text-accent" />
              ) : (
                <Trophy className="h-16 w-16 mx-auto text-chart-3" />
              )}
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold" data-testid="text-result-title">
                {isPerfectClear ? "Puzzle Cleared!" : "Game Over"}
              </h2>
              <p className="text-muted-foreground mt-1">{completionMessage}</p>
            </div>
            <div className="flex justify-center gap-6 flex-wrap">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary" data-testid="text-final-score">
                  <AnimatedNumber value={score} />
                </div>
                <div className="text-sm text-muted-foreground">points</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold" data-testid="text-words-found">{wordsFound.length}/{puzzleWords.length}</div>
                <div className="text-sm text-muted-foreground">words</div>
              </div>
              {!gaveUp && (
                <div className="text-center">
                  <div className="text-3xl font-bold text-muted-foreground">{formatTime(elapsedSeconds)}</div>
                  <div className="text-sm text-muted-foreground">time</div>
                </div>
              )}
            </div>
            {personalBest !== null && personalBest > 0 && (
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
            <ShareResults gameName="Word Sweep (Guided)" gameSlug="word-unpack" score={score} wordsCompleted={wordsFound.length} isWin={isPerfectClear} />
            {!locked && (
              <Button onClick={initGame} className="gap-1.5" data-testid="button-play-again">
                <RotateCcw className="h-4 w-4" />
                New Puzzle
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
          <Badge variant="outline" className="gap-1.5 relative" data-testid="badge-timer">
            <Timer className="h-3.5 w-3.5" />
            {formatTime(elapsedSeconds)}
            <AnimatePresence>
              {penaltyFlash && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: -10 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-destructive whitespace-nowrap pointer-events-none"
                  data-testid="text-penalty-flash"
                >
                  +10s
                </motion.span>
              )}
            </AnimatePresence>
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
            <Button variant="outline" size="sm" onClick={initGame} className="gap-1.5" data-testid="button-restart">
              <RotateCcw className="h-4 w-4" />
              New Puzzle
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Tap letters to spell each target word, then submit
          </p>

          <div
            className="grid gap-1.5 sm:gap-2 mx-auto"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, maxWidth: "340px" }}
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
                  animate={{ opacity: isCleared ? 0 : 1, scale: isCleared ? 0.5 : 1 }}
                  whileTap={!isCleared ? { scale: 0.88 } : undefined}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`relative aspect-square flex items-center justify-center text-base sm:text-lg font-bold rounded-md transition-colors ${
                    isCleared ? "invisible pointer-events-none" : isSelected
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

          <div className="space-y-2">
            <div
              className={`h-11 flex items-center justify-center rounded-md border-2 border-dashed text-lg font-bold tracking-widest mx-auto max-w-[280px] ${
                currentWord.length > 0 ? "border-primary bg-primary/5 text-foreground" : "border-muted-foreground/30 text-muted-foreground"
              }`}
              data-testid="text-current-word"
            >
              {currentWord || "Select letters..."}
            </div>

            <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`text-center text-sm font-medium ${feedback.type === "correct" ? "text-accent" : "text-destructive"}`}
                  data-testid="text-feedback"
                >
                  {feedback.message}
                </motion.div>
              )}
            </AnimatePresence>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedCells.length === 0} className="gap-1.5" data-testid="button-clear">
                <Undo2 className="h-4 w-4" />Clear
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={currentWord.length === 0} className="gap-1.5" data-testid="button-submit">
                <Send className="h-4 w-4" />Submit
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs text-center text-muted-foreground uppercase tracking-wider font-medium">Words to find</p>
            <div className="flex flex-wrap justify-center gap-2" data-testid="word-list">
              {puzzleWords.map((word) => {
                const found = wordsFound.includes(word);
                return (
                  <div
                    key={word}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                      found ? "bg-accent/20 border-accent text-accent line-through" : "bg-muted border-border text-foreground"
                    }`}
                    data-testid={`word-target-${word}`}
                  >
                    {found && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {word}
                    {!found && <span className="text-xs text-muted-foreground ml-1">({word.length})</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center pt-1">
            <Button variant="outline" size="sm" onClick={handleGiveUp} data-testid="button-give-up">Give Up</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ModeSelector({ onSelect }: { onSelect: (mode: "classic" | "guided") => void }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold">Choose Your Mode</h3>
          <p className="text-sm text-muted-foreground">Two ways to play Word Sweep</p>
        </div>
        <div className="grid gap-3">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              className="w-full h-auto py-4 px-6 flex items-center gap-4 text-left"
              onClick={() => onSelect("classic")}
              data-testid="button-mode-classic"
            >
              <Grid3X3 className="h-6 w-6 text-primary flex-shrink-0" />
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">Classic</span>
                <span className="text-sm text-muted-foreground font-normal">
                  Free-form — pick any letters from the 6×6 grid to spell valid words. Clear as much of the grid as you can!
                </span>
              </div>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              className="w-full h-auto py-4 px-6 flex items-center gap-4 text-left"
              onClick={() => onSelect("guided")}
              data-testid="button-mode-guided"
            >
              <PackageOpen className="h-6 w-6 text-primary flex-shrink-0" />
              <div className="flex flex-col items-start gap-1">
                <span className="font-semibold">Guided</span>
                <span className="text-sm text-muted-foreground font-normal">
                  Timed challenge — find specific words hidden in the grid. Every letter belongs to a word. Race the clock!
                </span>
              </div>
            </Button>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WordSweepGame({
  groupSeed,
  locked,
  mode: modeProp,
}: {
  groupSeed?: number;
  locked?: boolean;
  mode?: "classic" | "guided";
} = {}) {
  const [selectedMode, setSelectedMode] = useState<"classic" | "guided" | null>(modeProp ?? null);

  if (selectedMode === null) {
    return <ModeSelector onSelect={setSelectedMode} />;
  }

  if (selectedMode === "guided") {
    return <WordSweepGuided groupSeed={groupSeed} locked={locked} overrideSlug={locked ? "word-sweep" : undefined} />;
  }

  return <WordSweepClassic groupSeed={groupSeed} locked={locked} />;
}
