import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, Lightbulb, Loader2, Layers, Pencil } from "lucide-react";
import type { WordStackPuzzle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type WordValidationResponse = { valid: boolean; message?: string };

export function WordStackGame() {
  const { data: puzzles = [], isLoading, error, refetch } = useQuery<WordStackPuzzle[]>({
    queryKey: ["/api/games/word-stack/puzzles"],
    refetchOnMount: "always",
  });

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [activePuzzles, setActivePuzzles] = useState<WordStackPuzzle[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState<WordStackPuzzle | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [puzzlesCompleted, setPuzzlesCompleted] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "complete">("playing");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedPuzzles, setUsedPuzzles] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getRequiredLength = useCallback(() => {
    if (stack.length === 0) return 2;
    return stack[stack.length - 1].length + 1;
  }, [stack]);

  const containsAllLetters = (word: string, previousWord: string): boolean => {
    const wordLetters = word.toUpperCase().split("");
    const prevLetters = previousWord.toUpperCase().split("");
    
    for (const letter of prevLetters) {
      const idx = wordLetters.indexOf(letter);
      if (idx === -1) return false;
      wordLetters.splice(idx, 1);
    }
    return true;
  };

  const selectNewPuzzle = useCallback(() => {
    const availablePuzzles = activePuzzles.filter((p) => !usedPuzzles.has(p.targetWord));
    if (availablePuzzles.length === 0) {
      setGameStatus("complete");
      return;
    }
    const randomPuzzle = availablePuzzles[Math.floor(Math.random() * availablePuzzles.length)];
    setCurrentPuzzle(randomPuzzle);
    setStack([randomPuzzle.startWord]);
    setUserInput("");
    setShowHint(false);
    setUsedPuzzles((prev) => new Set(Array.from(prev).concat(randomPuzzle.targetWord)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedPuzzles, activePuzzles]);

  const initGame = useCallback(async () => {
    const result = await refetch();
    const freshPuzzles = result.data || [];
    if (freshPuzzles.length === 0) return;
    setActivePuzzles(freshPuzzles);
    setScore(0);
    setPuzzlesCompleted(0);
    setGameStatus("playing");
    setUsedPuzzles(new Set());
    setShowHint(false);
    const randomPuzzle = freshPuzzles[Math.floor(Math.random() * freshPuzzles.length)];
    setCurrentPuzzle(randomPuzzle);
    setStack([randomPuzzle.startWord]);
    setUserInput("");
    setUsedPuzzles(new Set([randomPuzzle.targetWord]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [refetch]);

  useEffect(() => {
    if (puzzles.length > 0 && !currentPuzzle) {
      initGame();
    }
  }, [puzzles, currentPuzzle, initGame]);

  const editLevel = (levelIndex: number) => {
    if (levelIndex === 0) return;
    setStack(stack.slice(0, levelIndex));
    setUserInput("");
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const checkAnswer = async () => {
    if (!currentPuzzle || !userInput.trim() || validateMutation.isPending) return;
    
    const upperInput = userInput.toUpperCase().trim();
    const previousWord = stack[stack.length - 1];
    const requiredLength = getRequiredLength();
    const targetLength = currentPuzzle.targetWord.length;

    if (upperInput.length !== requiredLength) {
      setFeedback({ type: "wrong", message: `Word must be ${requiredLength} letters` });
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 1500);
      return;
    }

    if (!containsAllLetters(upperInput, previousWord)) {
      setFeedback({ type: "wrong", message: `Must contain all letters from "${previousWord}"` });
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 1500);
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(upperInput);
      if (!result.valid) {
        setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => {
          setFeedback(null);
          inputRef.current?.focus();
        }, 1500);
        return;
      }

      const newStack = [...stack, upperInput];
      setStack(newStack);
      setUserInput("");
      
      const points = showHint ? 25 : 50;
      setScore((prev) => prev + points);

      if (upperInput.length === targetLength) {
        setFeedback({ type: "correct", message: "Stack Complete!" });
        setPuzzlesCompleted((prev) => prev + 1);
        const bonusPoints = showHint ? 50 : 100;
        setScore((prev) => prev + bonusPoints);
        setTimeout(() => {
          setFeedback(null);
          selectNewPuzzle();
        }, 1500);
      } else {
        setFeedback({ type: "correct", message: "Added to stack!" });
        setTimeout(() => {
          setFeedback(null);
          inputRef.current?.focus();
        }, 800);
      }
    } catch {
      setFeedback({ type: "invalid", message: "Validation failed" });
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkAnswer();
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
          <Button onClick={() => window.location.reload()} className="mt-4" data-testid="button-retry">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gameStatus === "complete" || gameStatus === "won") {
    return (
      <Card>
        <CardContent className="p-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-6"
          >
            <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
            <h2 className="text-3xl font-bold">All Puzzles Complete!</h2>
            <div className="space-y-2">
              <p className="text-xl">Final Score: <span className="font-bold text-primary">{score}</span></p>
              <p className="text-muted-foreground">Puzzles Completed: {puzzlesCompleted}</p>
            </div>
            <Button onClick={initGame} size="lg" data-testid="button-play-again">
              <RotateCcw className="mr-2 h-4 w-4" />
              Play Again
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  if (!currentPuzzle) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const targetWord = currentPuzzle.targetWord.toUpperCase();
  const targetLength = targetWord.length;
  const requiredLength = getRequiredLength();
  const levelsRemaining = targetLength - (stack[stack.length - 1]?.length || 2);
  const isStackComplete = stack.length > 0 && stack[stack.length - 1].length === targetLength;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-lg px-4 py-2" data-testid="badge-score">
            Score: {score}
          </Badge>
          <Badge variant="outline" className="text-lg px-4 py-2" data-testid="badge-puzzles">
            Puzzles: {puzzlesCompleted}
          </Badge>
        </div>
        <Button variant="outline" onClick={initGame} data-testid="button-restart">
          <RotateCcw className="mr-2 h-4 w-4" />
          Restart
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground" data-testid="text-progress">
                Build to: <span className="font-bold text-primary">{targetWord}</span> • {levelsRemaining} level{levelsRemaining !== 1 ? "s" : ""} remaining
              </span>
            </div>
            {showHint && (
              <p className="text-sm text-muted-foreground italic" data-testid="text-hint">
                Hint: {currentPuzzle.hint}
              </p>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mb-2"
            >
              <div className="flex gap-1" data-testid="target-word-row">
                {targetWord.split("").map((letter, j) => (
                  <div
                    key={j}
                    data-testid={`target-letter-${j}`}
                    className="w-10 h-10 flex items-center justify-center text-lg font-bold rounded-md border-2 bg-primary text-primary-foreground border-primary"
                  >
                    {letter}
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="w-full border-t border-muted-foreground/20 my-2" />

            <AnimatePresence>
              {Array.from({ length: targetLength - 3 }, (_, i) => {
                const wordLength = targetLength - 1 - i;
                const stackIndex = wordLength - 2;
                const word = stack[stackIndex];
                const isCurrent = wordLength === requiredLength && !word;
                const isCompleted = word !== undefined;
                const isFuture = !isCompleted && !isCurrent;
                const canEdit = isCompleted && stackIndex > 0;

                return (
                  <motion.div
                    key={wordLength}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex justify-center items-center gap-2"
                  >
                    <div 
                      className={`flex gap-1 ${canEdit ? "cursor-pointer hover-elevate rounded-lg p-1 -m-1" : ""}`}
                      onClick={() => canEdit && editLevel(stackIndex)}
                      data-testid={`level-row-${wordLength}`}
                    >
                      {Array.from({ length: wordLength }, (_, j) => {
                        const letter = word?.[j] || "";
                        return (
                          <div
                            key={j}
                            data-testid={`letter-box-${wordLength}-${j}`}
                            className={`
                              w-10 h-10 flex items-center justify-center text-lg font-bold rounded-md border-2
                              ${isCompleted 
                                ? "bg-primary/20 border-primary text-primary" 
                                : isCurrent 
                                  ? "bg-accent border-accent-foreground/50 animate-pulse" 
                                  : "bg-muted/30 border-muted-foreground/20 text-muted-foreground/40"}
                            `}
                          >
                            {isCompleted ? letter : isFuture ? "?" : ""}
                          </div>
                        );
                      })}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => editLevel(stackIndex)}
                        data-testid={`button-edit-${wordLength}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mt-1"
            >
              <div className="flex gap-1" data-testid="start-word-row">
                {stack[0]?.split("").map((letter, j) => (
                  <div
                    key={j}
                    data-testid={`start-letter-${j}`}
                    className="w-10 h-10 flex items-center justify-center text-lg font-bold rounded-md border-2 bg-secondary text-secondary-foreground border-secondary"
                  >
                    {letter}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                data-testid={`feedback-${feedback.type}`}
                className={`text-center p-3 rounded-lg ${
                  feedback.type === "correct"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : feedback.type === "wrong"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {feedback.type === "correct" ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <span className="font-medium" data-testid="text-feedback-message">{feedback.message}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isStackComplete && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Enter a <span className="font-bold text-foreground">{requiredLength}-letter word</span> containing all letters from "<span className="font-bold text-primary">{stack[stack.length - 1]}</span>"
                </p>
              </div>

              <div className="flex gap-2 max-w-md mx-auto">
                <Input
                  ref={inputRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder={`${requiredLength}-letter word...`}
                  maxLength={requiredLength}
                  className="text-center text-lg font-bold uppercase"
                  disabled={validateMutation.isPending}
                  data-testid="input-word"
                />
                <Button 
                  onClick={checkAnswer} 
                  disabled={!userInput.trim() || validateMutation.isPending}
                  data-testid="button-submit"
                >
                  {validateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>

              {!showHint && (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHint(true)}
                    className="text-muted-foreground"
                    data-testid="button-hint"
                  >
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Show Hint (reduced points)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
