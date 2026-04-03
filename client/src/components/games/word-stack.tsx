import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, Lightbulb, Loader2, Layers, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { WordStackPuzzle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";

type WordValidationResponse = { valid: boolean; message?: string };
type ChallengeType = "build-up" | "break-down" | null;

const challenges = [
  {
    id: "build-up" as const,
    title: "Build Up",
    description: "Start with a 2-letter word and add letters to reach the target",
    icon: ArrowUp,
  },
  {
    id: "break-down" as const,
    title: "Break Down",
    description: "Start with the target word and remove letters to reach 2 letters",
    icon: ArrowDown,
  },
];

export function WordStackGame({ locked }: { locked?: boolean } = {}) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded, personalBest } = useGameResult({ slug: "word-stack" });
  const { data: puzzles = [], isLoading, error } = useQuery<WordStackPuzzle[]>({
    queryKey: ["/api/games/word-stack/puzzles"],
    refetchOnMount: "always",
    gcTime: 0,
  });

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeType>(null);
  const [activePuzzles, setActivePuzzles] = useState<WordStackPuzzle[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState<WordStackPuzzle | null>(null);
  const [stack, setStack] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [puzzlesCompleted, setPuzzlesCompleted] = useState(0);
  const [gameStatus, setGameStatus] = useState<"selecting" | "playing" | "complete">("selecting");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedPuzzles, setUsedPuzzles] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isBuildUp = selectedChallenge === "build-up";

  const getRequiredLength = useCallback(() => {
    if (stack.length === 0) return isBuildUp ? 2 : (currentPuzzle?.targetWord.length || 7) - 1;
    const lastWord = stack[stack.length - 1];
    return isBuildUp ? lastWord.length + 1 : lastWord.length - 1;
  }, [stack, isBuildUp, currentPuzzle]);

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

  const isValidLetterRemoval = (newWord: string, previousWord: string): boolean => {
    const newLetters = newWord.toUpperCase().split("");
    const prevLetters = previousWord.toUpperCase().split("");
    
    for (const letter of newLetters) {
      const idx = prevLetters.indexOf(letter);
      if (idx === -1) return false;
      prevLetters.splice(idx, 1);
    }
    return prevLetters.length === 1;
  };

  const selectNewPuzzle = useCallback(() => {
    const availablePuzzles = activePuzzles.filter((p) => !usedPuzzles.has(p.targetWord));
    if (availablePuzzles.length === 0) {
      setCompletionMessage(getCompletionMessage(true));
      setGameStatus("complete");
      return;
    }
    const randomPuzzle = availablePuzzles[Math.floor(Math.random() * availablePuzzles.length)];
    setCurrentPuzzle(randomPuzzle);
    if (isBuildUp) {
      setStack([]);
    } else {
      setStack([randomPuzzle.targetWord.toUpperCase()]);
    }
    setUserInput("");
    setShowHint(false);
    setUsedPuzzles((prev) => new Set(Array.from(prev).concat(randomPuzzle.targetWord)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedPuzzles, activePuzzles, isBuildUp]);

  const initGame = useCallback((challenge: ChallengeType) => {
    if (!challenge || puzzles.length === 0) return;
    resetRecorded();
    setSelectedChallenge(challenge);
    setActivePuzzles(puzzles);
    setScore(0);
    setStreak(0);
    setPuzzlesCompleted(0);
    setGameStatus("playing");
    setUsedPuzzles(new Set());
    setShowHint(false);
    const randomPuzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
    setCurrentPuzzle(randomPuzzle);
    if (challenge === "build-up") {
      setStack([]);
    } else {
      setStack([randomPuzzle.targetWord.toUpperCase()]);
    }
    setUserInput("");
    setUsedPuzzles(new Set([randomPuzzle.targetWord]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [puzzles, resetRecorded]);

  useEffect(() => {
    if (gameStatus === "complete") {
      reportResult(score, true);
    }
  }, [gameStatus, score, reportResult]);

  const backToSelection = () => {
    setSelectedChallenge(null);
    setGameStatus("selecting");
    setCurrentPuzzle(null);
    setStack([]);
    setScore(0);
    setStreak(0);
    setPuzzlesCompleted(0);
  };

  const editLevel = (levelIndex: number) => {
    if (!isBuildUp && levelIndex === 0) return;
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
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "wrong", message: `Word must be ${requiredLength} letters` });
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 1500);
      return;
    }

    if (isBuildUp) {
      if (previousWord && !containsAllLetters(upperInput, previousWord)) {
        playSound("wrong");
        setStreak(0);
        setFeedback({ type: "wrong", message: `Must contain all letters from "${previousWord}"` });
        setTimeout(() => {
          setFeedback(null);
          inputRef.current?.focus();
        }, 1500);
        return;
      }
    } else {
      if (!isValidLetterRemoval(upperInput, previousWord)) {
        playSound("wrong");
        setStreak(0);
        setFeedback({ type: "wrong", message: `Must be "${previousWord}" with one letter removed` });
        setTimeout(() => {
          setFeedback(null);
          inputRef.current?.focus();
        }, 1500);
        return;
      }
    }

    try {
      const result = await validateMutation.mutateAsync(upperInput);
      if (!result.valid) {
        playSound("wrong");
        setStreak(0);
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
      setStreak(prev => prev + 1);
      
      const points = showHint ? 25 : 50;
      setScore((prev) => prev + points);

      const isComplete = isBuildUp 
        ? upperInput.length === targetLength
        : upperInput.length === 2;

      if (isComplete) {
        playSound("win");
        setFeedback({ type: "correct", message: "Stack Complete!" });
        setPuzzlesCompleted((prev) => prev + 1);
        const bonusPoints = showHint ? 50 : 100;
        setScore((prev) => prev + bonusPoints);
        setTimeout(() => {
          setFeedback(null);
          selectNewPuzzle();
        }, 1500);
      } else {
        playSound("correct");
        setFeedback({ type: "correct", message: isBuildUp ? "Added to stack!" : "Removed a letter!" });
        setTimeout(() => {
          setFeedback(null);
          inputRef.current?.focus();
        }, 800);
      }
    } catch {
      playSound("wrong");
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

  if (gameStatus === "selecting" || !selectedChallenge) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <Layers className="h-12 w-12 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Choose Your Challenge</h2>
            <p className="text-muted-foreground">Select how you want to build your word stack</p>
          </div>
          <div className="grid gap-4 max-w-md mx-auto">
            {challenges.map((challenge) => (
              <motion.div
                key={challenge.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant="outline"
                  className="w-full h-auto p-6 flex flex-col items-center gap-3 hover-elevate"
                  onClick={() => initGame(challenge.id)}
                  data-testid={`button-challenge-${challenge.id}`}
                >
                  <challenge.icon className="h-8 w-8 text-primary" />
                  <div className="text-center">
                    <p className="text-lg font-semibold">{challenge.title}</p>
                    <p className="text-sm text-muted-foreground">{challenge.description}</p>
                  </div>
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (gameStatus === "complete") {
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
              <p className="text-xl">Final Score: <span className="font-bold text-primary"><AnimatedNumber value={score} /></span></p>
              <p className="text-muted-foreground">Puzzles Completed: {puzzlesCompleted}</p>
              {personalBest > 0 && (
                <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                  Personal Best: {personalBest} pts
                </p>
              )}
              <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
            </div>
            <ShareResults
              gameName="Word Stack"
              gameSlug="word-stack"
              score={score}
              challengeName={selectedChallenge === "build-up" ? "Build Up" : "Break Down"}
              isWin={true}
            />
            {!locked && (
              <div className="flex gap-4 justify-center">
                <Button onClick={() => initGame(selectedChallenge)} size="lg" data-testid="button-play-again">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Play Again
                </Button>
                <Button variant="outline" onClick={backToSelection} size="lg" data-testid="button-change-challenge">
                  Change Challenge
                </Button>
              </div>
            )}
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
  const lastWord = stack[stack.length - 1];
  const levelsRemaining = isBuildUp 
    ? targetLength - (lastWord?.length || 2)
    : (lastWord?.length || targetLength) - 2;
  const isStackComplete = isBuildUp 
    ? lastWord?.length === targetLength
    : lastWord?.length === 2;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-lg px-4 py-2" data-testid="badge-score">
            Score: <AnimatedNumber value={score} />
          </Badge>
          <StreakIndicator streak={streak} />
          <Badge variant="outline" className="text-lg px-4 py-2" data-testid="badge-puzzles">
            Puzzles: {puzzlesCompleted}
          </Badge>
        </div>
        {!locked && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={backToSelection} data-testid="button-back">
              Change Challenge
            </Button>
            <Button variant="outline" onClick={() => initGame(selectedChallenge)} data-testid="button-restart">
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              {isBuildUp ? <ArrowUp className="h-5 w-5 text-primary" /> : <ArrowDown className="h-5 w-5 text-primary" />}
              <span className="text-sm text-muted-foreground" data-testid="text-progress">
                {isBuildUp ? "Build Up" : "Break Down"}: <span className="font-bold text-primary">{targetWord}</span> • {levelsRemaining} level{levelsRemaining !== 1 ? "s" : ""} remaining
              </span>
            </div>
            {showHint && (
              <p className="text-sm text-muted-foreground italic" data-testid="text-hint">
                Hint: {currentPuzzle.hint}
              </p>
            )}
          </div>

          {isBuildUp ? (
            <BuildUpPyramid
              targetWord={targetWord}
              targetLength={targetLength}
              stack={stack}
              requiredLength={requiredLength}
              editLevel={editLevel}
            />
          ) : (
            <BreakDownPyramid
              targetWord={targetWord}
              targetLength={targetLength}
              stack={stack}
              requiredLength={requiredLength}
              editLevel={editLevel}
            />
          )}

          <div aria-live="polite">
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
          </div>

          {!isStackComplete && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {isBuildUp ? (
                    <>Enter a <span className="font-bold text-foreground">{requiredLength}-letter word</span> containing all letters from "<span className="font-bold text-primary">{lastWord}</span>"</>
                  ) : (
                    <>Enter a <span className="font-bold text-foreground">{requiredLength}-letter word</span> by removing one letter from "<span className="font-bold text-primary">{lastWord}</span>"</>
                  )}
                </p>
              </div>

              <div className="flex gap-2 max-w-md mx-auto">
                <Input
                  ref={inputRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder={`${requiredLength}-letter word...`}
                  aria-label="Enter your word"
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
                    isBuildUp ? "Add" : "Remove"
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

function BuildUpPyramid({
  targetWord,
  targetLength,
  stack,
  requiredLength,
  editLevel,
}: {
  targetWord: string;
  targetLength: number;
  stack: string[];
  requiredLength: number;
  editLevel: (index: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center"
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

      <AnimatePresence>
        {Array.from({ length: targetLength - 2 }, (_, i) => {
          const wordLength = targetLength - 1 - i;
          const stackIndex = wordLength - 2;
          const word = stack[stackIndex];
          const isCurrent = wordLength === requiredLength && !word;
          const isCompleted = word !== undefined;
          const isFuture = !isCompleted && !isCurrent;
          const canEdit = isCompleted;

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
                      {isCompleted ? letter : ""}
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
                  aria-label={`Edit level ${wordLength}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function BreakDownPyramid({
  targetWord,
  targetLength,
  stack,
  requiredLength,
  editLevel,
}: {
  targetWord: string;
  targetLength: number;
  stack: string[];
  requiredLength: number;
  editLevel: (index: number) => void;
}) {
  const finalWordIndex = targetLength - 2;
  const finalWord = stack[finalWordIndex];
  const isComplete = finalWord !== undefined && finalWord.length === 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center"
      >
        <div className="flex gap-1" data-testid="end-word-row">
          {Array.from({ length: 2 }, (_, j) => {
            const letter = finalWord?.[j] || "";
            return (
              <div
                key={j}
                data-testid={`end-letter-${j}`}
                className={`w-10 h-10 flex items-center justify-center text-lg font-bold rounded-md border-2 ${
                  isComplete 
                    ? "bg-green-500 text-white border-green-500" 
                    : "bg-muted/30 border-muted-foreground/20 text-muted-foreground/40"
                }`}
              >
                {isComplete ? letter : ""}
              </div>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence>
        {Array.from({ length: targetLength - 3 }, (_, i) => {
          const wordLength = 3 + i;
          const stackIndex = targetLength - wordLength;
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
                      {isCompleted ? letter : ""}
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
                  aria-label={`Edit level ${wordLength}`}
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
    </div>
  );
}
