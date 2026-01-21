import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type PositionConstraint = {
  position: number;
  letter: string;
};

// Generate random position (1-8) and random letter
function generateRandomConstraint(): PositionConstraint {
  const position = Math.floor(Math.random() * 8) + 1; // 1-8
  const letter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return { position, letter };
}

// Local constraint validation (does word have required letter at position?)
function validateConstraint(word: string, constraint: PositionConstraint): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  
  if (upperWord.length < constraint.position) {
    return { valid: false, message: `Word must have at least ${constraint.position} letters` };
  }
  if (upperWord[constraint.position - 1] !== constraint.letter) {
    return { valid: false, message: `Letter at position ${constraint.position} must be '${constraint.letter}'` };
  }
  return { valid: true, message: "" };
}

export function LetterPositionGame() {
  // Word validation via backend - no dictionary pre-fetch
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [level, setLevel] = useState(1);
  const [constraint, setConstraint] = useState<PositionConstraint | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost" | "levelComplete">("playing");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wordsPerLevel = 20;
  const timePerLevel = 120;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameStatus("lost");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Initialize game - generate random constraint locally
  const initGame = useCallback(() => {
    setLevel(1);
    setScore(0);
    setWordsCompleted(0);
    setTimeLeft(timePerLevel);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    setConstraint(generateRandomConstraint());
    setGameStatus("playing");
    startTimer();
  }, [timePerLevel, startTimer]);

  // Start next level - generate new random constraint locally
  const startNextLevel = useCallback(() => {
    setLevel(2);
    setWordsCompleted(0);
    setTimeLeft(timePerLevel);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    setConstraint(generateRandomConstraint());
    setGameStatus("playing");
    startTimer();
  }, [timePerLevel, startTimer]);

  // Auto-start game on first load
  useEffect(() => {
    if (!constraint) {
      setConstraint(generateRandomConstraint());
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const checkAnswer = async () => {
    if (!userInput.trim() || !constraint) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    const constraintCheck = validateConstraint(upperWord, constraint);
    if (!constraintCheck.valid) {
      setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(upperWord);
      if (!result.valid) {
        setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => setFeedback(null), 1500);
        return;
      }

      setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      setScore((prev) => prev + 100 + level * 30);
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsPerLevel) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (level >= 2) {
            setGameStatus("won");
          } else {
            setGameStatus("levelComplete");
          }
        } else if (level === 2) {
          // Level 2: new random constraint for each word
          setConstraint(generateRandomConstraint());
        }
      }, 500);
    } catch {
      setFeedback({ type: "invalid", message: "Error validating word" });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkAnswer();
    }
  };

  if (!constraint) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-level">
            <Zap className="h-3.5 w-3.5" />
            Level {level}/2
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
              <CardContent className="p-6 space-y-6">
                <div className="text-center space-y-4">
                  <motion.div
                    key={`${constraint.position}-${constraint.letter}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center justify-center gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-14 flex items-center justify-center text-2xl font-bold rounded-lg bg-primary text-primary-foreground">
                        {constraint.position}
                      </div>
                      <span className="text-xl font-semibold text-muted-foreground">and</span>
                      <div className="w-14 h-14 flex items-center justify-center text-2xl font-bold rounded-lg bg-primary text-primary-foreground">
                        {constraint.letter}
                      </div>
                    </div>
                  </motion.div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>Position {constraint.position} must be letter '{constraint.letter}'</span>
                  </div>
                  <Progress value={(wordsCompleted / wordsPerLevel) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {wordsCompleted} / {wordsPerLevel} words
                  </p>
                  {level === 2 && (
                    <Badge variant="secondary" className="text-xs">
                      Constraint changes after each word!
                    </Badge>
                  )}
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter a word..."
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
        ) : gameStatus === "levelComplete" ? (
          <motion.div
            key="levelComplete"
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
                  <CheckCircle className="h-16 w-16 mx-auto text-accent" />
                </motion.div>
                <h3 className="text-2xl font-bold">Level 1 Complete!</h3>
                <p className="text-muted-foreground">
                  Get ready for the next challenge!
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <p className="font-medium mb-2">Level 2 Rules:</p>
                  <p className="text-sm text-muted-foreground">
                    Same concept, but the position and letter will change after each correct word!
                  </p>
                </div>
                <Button onClick={startNextLevel} className="gap-2" data-testid="button-next-level">
                  Start Level 2
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className={gameStatus === "won" ? "border-accent" : "border-destructive"}>
              <CardContent className="p-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  {gameStatus === "won" ? (
                    <Trophy className="h-16 w-16 mx-auto text-accent" />
                  ) : (
                    <XCircle className="h-16 w-16 mx-auto text-destructive" />
                  )}
                </motion.div>
                <h3 className="text-2xl font-bold">
                  {gameStatus === "won" ? "Position Master!" : "Time's Up!"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You completed both levels!"
                    : `You reached Level ${level} with ${wordsCompleted} words`}
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{score} points</div>
                </div>
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
