import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Challenge = 1 | 2 | 3 | 4 | 5 | "advanced";

const CHALLENGE_CONFIG: Record<Challenge, { name: string; description: string; letterCount: number | "random" }> = {
  1: { name: "Challenge 1", description: "Find words containing 2 letters", letterCount: 2 },
  2: { name: "Challenge 2", description: "Find words containing 3 letters", letterCount: 3 },
  3: { name: "Challenge 3", description: "Find words containing 4 letters", letterCount: 4 },
  4: { name: "Challenge 4", description: "Find words containing 5 letters", letterCount: 5 },
  5: { name: "Challenge 5", description: "Find words containing 6 letters", letterCount: 6 },
  advanced: { name: "Challenge Advanced", description: "Random letter count for each word!", letterCount: "random" },
};

function generateRandomLetters(count: number): string[] {
  const shuffled = [...ALPHABET].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getRandomLetterCount(): number {
  return Math.floor(Math.random() * 5) + 2;
}

function validateContainsLetters(word: string, letters: string[]): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  
  for (const letter of letters) {
    if (!upperWord.includes(letter)) {
      return { valid: false, message: `Word must contain the letter '${letter}'` };
    }
  }
  return { valid: true, message: "" };
}

function getNextChallenge(current: Challenge): Challenge | null {
  if (current === "advanced") return null;
  if (current === 5) return null;
  return (current + 1) as Challenge;
}

export function ContainsLettersGame() {
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [challenge, setChallenge] = useState<Challenge>(1);
  const [currentLetters, setCurrentLetters] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordsToComplete = 20;
  const timePerChallenge = 120;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          setGameStatus("lost");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  const generateLettersForChallenge = useCallback((c: Challenge): string[] => {
    const config = CHALLENGE_CONFIG[c];
    const count = config.letterCount === "random" ? getRandomLetterCount() : config.letterCount;
    return generateRandomLetters(count);
  }, []);

  const startGame = useCallback((c: Challenge) => {
    stopTimer();
    setChallenge(c);
    setScore(0);
    setWordsCompleted(0);
    setTimeLeft(timePerChallenge);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    setCurrentLetters(generateLettersForChallenge(c));
    setGameStatus("playing");
    startTimer();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [generateLettersForChallenge, startTimer, stopTimer, timePerChallenge]);

  const goToMenu = useCallback(() => {
    stopTimer();
    setGameStatus("menu");
  }, [stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const checkAnswer = async () => {
    if (!userInput.trim()) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => {
        setFeedback(null);
      }, 1500);
      return;
    }

    const constraintCheck = validateContainsLetters(upperWord, currentLetters);
    if (!constraintCheck.valid) {
      setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => {
        setFeedback(null);
      }, 1500);
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(upperWord);
      if (!result.valid) {
        setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => {
          setFeedback(null);
        }, 1500);
        return;
      }

      setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      
      const challengeBonus = challenge === "advanced" ? 50 : (challenge as number) * 25;
      setScore((prev) => prev + 100 + challengeBonus);
      
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsToComplete) {
          stopTimer();
          setGameStatus("won");
        } else if (challenge === "advanced") {
          setCurrentLetters(generateLettersForChallenge("advanced"));
        }
      }, 500);
    } catch {
      setFeedback({ type: "invalid", message: "Error validating word" });
      setTimeout(() => {
        setFeedback(null);
      }, 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkAnswer();
    }
  };

  if (gameStatus === "menu") {
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <Search className="h-12 w-12 mx-auto text-primary" />
            <h3 className="text-xl font-bold">Choose Your Challenge</h3>
            <p className="text-muted-foreground text-sm">
              Find words containing the required letters!
            </p>
          </div>
          
          <div className="grid gap-3">
            {([1, 2, 3, 4, 5, "advanced"] as Challenge[]).map((c) => {
              const config = CHALLENGE_CONFIG[c];
              return (
                <Button
                  key={c}
                  onClick={() => startGame(c)}
                  variant={c === "advanced" ? "default" : "outline"}
                  className="w-full justify-start gap-3 h-auto py-3"
                  data-testid={`button-challenge-${c}`}
                >
                  <Badge variant={c === "advanced" ? "secondary" : "outline"} className="shrink-0">
                    {c === "advanced" ? "ADV" : c}
                  </Badge>
                  <div className="text-left">
                    <div className="font-semibold">{config.name}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {config.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            {score} pts
          </Badge>
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-challenge">
            <Zap className="h-3.5 w-3.5" />
            {CHALLENGE_CONFIG[challenge].name}
          </Badge>
          <Badge variant="secondary" className="gap-1.5" data-testid="badge-progress">
            {wordsCompleted}/{wordsToComplete}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={timeLeft <= 30 ? "destructive" : "secondary"} className="gap-1.5" data-testid="badge-timer">
            <Timer className="h-3.5 w-3.5" />
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={goToMenu}
            className="gap-1.5"
            data-testid="button-menu"
          >
            <RotateCcw className="h-4 w-4" />
            Menu
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
              <CardContent className="p-6 space-y-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Search className="h-4 w-4" />
                    <span>Form words containing these letters:</span>
                  </div>
                  <motion.div
                    key={currentLetters.join("")}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex justify-center gap-2"
                  >
                    {currentLetters.map((letter, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-xl font-bold rounded-lg bg-primary text-primary-foreground"
                        data-testid={`required-letter-${index}`}
                      >
                        {letter}
                      </motion.div>
                    ))}
                  </motion.div>
                  <Progress value={(wordsCompleted / wordsToComplete) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {wordsCompleted} / {wordsToComplete} words
                  </p>
                  {challenge === "advanced" && (
                    <Badge variant="secondary" className="text-xs">
                      Letters change after each word!
                    </Badge>
                  )}
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter a word containing those letters..."
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback?.type === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback?.type === "wrong" || feedback?.type === "invalid"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
                      data-testid="input-word"
                    />
                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {feedback.type === "correct" ? (
                          <CheckCircle className="h-5 w-5 text-accent" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </motion.div>
                    )}
                  </div>

                  {feedback && feedback.type !== "correct" && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-sm text-destructive"
                    >
                      {feedback.message}
                    </motion.p>
                  )}

                  <Button
                    onClick={checkAnswer}
                    disabled={!userInput.trim() || validateMutation.isPending}
                    className="w-full"
                    data-testid="button-submit"
                  >
                    {validateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1 justify-center">
                  {Array.from(usedWords).slice(-10).map((word) => (
                    <Badge key={word} variant="outline" className="text-xs">
                      {word}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : gameStatus === "won" ? (
          <motion.div
            key="won"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="border-accent">
              <CardContent className="p-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <Trophy className="h-16 w-16 mx-auto text-accent" />
                </motion.div>
                <h3 className="text-2xl font-bold">{CHALLENGE_CONFIG[challenge].name} Complete!</h3>
                <p className="text-muted-foreground">
                  You found {wordsCompleted} words!
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{score} points</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button onClick={() => startGame(challenge)} variant={challenge === "advanced" ? "default" : "outline"} data-testid="button-play-again">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Play Again
                  </Button>
                  {challenge !== "advanced" && getNextChallenge(challenge) && (
                    <Button onClick={() => startGame(getNextChallenge(challenge)!)} data-testid="button-next-challenge">
                      Next Challenge
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                  {challenge !== "advanced" && (
                    <Button onClick={goToMenu} variant="secondary" data-testid="button-back-menu">
                      Back to Menu
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="lost"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="border-destructive">
              <CardContent className="p-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <XCircle className="h-16 w-16 mx-auto text-destructive" />
                </motion.div>
                <h3 className="text-2xl font-bold">Time's Up!</h3>
                <p className="text-muted-foreground">
                  You found {wordsCompleted} words in {CHALLENGE_CONFIG[challenge].name}
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{score} points</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button onClick={() => startGame(challenge)} data-testid="button-play-again">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Play Again
                  </Button>
                  <Button onClick={goToMenu} variant="outline" data-testid="button-back-menu">
                    Back to Menu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
