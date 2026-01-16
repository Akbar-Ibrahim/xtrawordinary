import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { WordLengthConfig, WordValidationResponse } from "@shared/schema";

type LevelConstraint = {
  length: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

const levelDescriptions = [
  "Form {length}-letter words",
  "Form {length}-letter words starting with '{startsWith}'",
  "Form {length}-letter words ending with '{endsWith}'",
  "Form {length}-letter words starting with '{startsWith}' containing '{contains}'",
  "Form {length}-letter words ending with '{endsWith}' containing '{contains}'"
];

function generateConstraintFromDictionary(level: number, dictionary: string[], minWords: number = 10): LevelConstraint {
  const lengths = [5, 6, 7, 8];
  
  for (const length of lengths) {
    const wordsOfLength = dictionary.filter(w => w.length === length);
    if (wordsOfLength.length < minWords) continue;
    
    switch (level) {
      case 1:
        if (wordsOfLength.length >= minWords) {
          return { length };
        }
        break;
      case 2: {
        const startLetters = Array.from(new Set(wordsOfLength.map(w => w[0])));
        for (const letter of startLetters.sort(() => Math.random() - 0.5)) {
          if (wordsOfLength.filter(w => w.startsWith(letter)).length >= minWords) {
            return { length, startsWith: letter };
          }
        }
        break;
      }
      case 3: {
        const endLetters = Array.from(new Set(wordsOfLength.map(w => w[w.length - 1])));
        for (const letter of endLetters.sort(() => Math.random() - 0.5)) {
          if (wordsOfLength.filter(w => w.endsWith(letter)).length >= minWords) {
            return { length, endsWith: letter };
          }
        }
        break;
      }
      case 4: {
        const startLetters = Array.from(new Set(wordsOfLength.map(w => w[0])));
        for (const startLetter of startLetters.sort(() => Math.random() - 0.5)) {
          const matching = wordsOfLength.filter(w => w.startsWith(startLetter));
          if (matching.length >= minWords) {
            const containsLetters = Array.from(new Set(matching.flatMap(w => w.slice(1).split(""))));
            for (const containsLetter of containsLetters.sort(() => Math.random() - 0.5)) {
              if (matching.filter(w => w.slice(1).includes(containsLetter)).length >= minWords) {
                return { length, startsWith: startLetter, contains: containsLetter };
              }
            }
            return { length, startsWith: startLetter };
          }
        }
        break;
      }
      case 5: {
        const endLetters = Array.from(new Set(wordsOfLength.map(w => w[w.length - 1])));
        for (const endLetter of endLetters.sort(() => Math.random() - 0.5)) {
          const matching = wordsOfLength.filter(w => w.endsWith(endLetter));
          if (matching.length >= minWords) {
            const containsLetters = Array.from(new Set(matching.flatMap(w => w.slice(0, -1).split(""))));
            for (const containsLetter of containsLetters.sort(() => Math.random() - 0.5)) {
              if (matching.filter(w => w.slice(0, -1).includes(containsLetter)).length >= minWords) {
                return { length, endsWith: endLetter, contains: containsLetter };
              }
            }
            return { length, endsWith: endLetter };
          }
        }
        break;
      }
    }
  }
  return { length: 5 };
}

function formatConstraint(level: number, constraint: LevelConstraint): string {
  let desc = levelDescriptions[level - 1];
  desc = desc.replace("{length}", String(constraint.length));
  if (constraint.startsWith) desc = desc.replace("{startsWith}", constraint.startsWith);
  if (constraint.endsWith) desc = desc.replace("{endsWith}", constraint.endsWith);
  if (constraint.contains) desc = desc.replace("{contains}", constraint.contains);
  return desc;
}

function validateConstraint(word: string, constraint: LevelConstraint): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  
  if (upperWord.length !== constraint.length) {
    return { valid: false, message: `Word must be ${constraint.length} letters` };
  }
  if (constraint.startsWith && !upperWord.startsWith(constraint.startsWith)) {
    return { valid: false, message: `Word must start with '${constraint.startsWith}'` };
  }
  if (constraint.endsWith && !upperWord.endsWith(constraint.endsWith)) {
    return { valid: false, message: `Word must end with '${constraint.endsWith}'` };
  }
  if (constraint.contains && !upperWord.includes(constraint.contains)) {
    return { valid: false, message: `Word must contain '${constraint.contains}'` };
  }
  return { valid: true, message: "" };
}

export function WordLengthGame() {
  const { data: config, isLoading: configLoading } = useQuery<WordLengthConfig>({
    queryKey: ["/api/games/word-length/config"],
  });

  const { data: dictionary = [], isLoading: dictLoading } = useQuery<string[]>({
    queryKey: ["/api/games/word-dictionary"],
  });

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [level, setLevel] = useState(1);
  const [constraint, setConstraint] = useState<LevelConstraint | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost" | "levelComplete">("playing");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wordsPerLevel = config?.wordsPerLevel || 20;
  const timePerLevel = config?.timePerLevel || 120;
  const isLoading = configLoading || dictLoading;

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

  const initGame = useCallback(() => {
    if (dictionary.length === 0) return;
    setLevel(1);
    setConstraint(generateConstraintFromDictionary(1, dictionary, 10));
    setScore(0);
    setWordsCompleted(0);
    setTimeLeft(timePerLevel);
    setGameStatus("playing");
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    startTimer();
  }, [dictionary, timePerLevel, startTimer]);

  const startNextLevel = useCallback(() => {
    if (dictionary.length === 0) return;
    const newLevel = level + 1;
    setLevel(newLevel);
    setConstraint(generateConstraintFromDictionary(newLevel, dictionary, 10));
    setWordsCompleted(0);
    setTimeLeft(timePerLevel);
    setGameStatus("playing");
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    startTimer();
  }, [dictionary, level, timePerLevel, startTimer]);

  useEffect(() => {
    if (dictionary.length > 0 && !constraint) {
      setConstraint(generateConstraintFromDictionary(1, dictionary, 10));
    }
  }, [dictionary, constraint]);

  useEffect(() => {
    if (dictionary.length > 0 && gameStatus === "playing" && timerRef.current === null && constraint) {
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dictionary, gameStatus, startTimer, constraint]);

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
      setScore((prev) => prev + 100 + level * 20);
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsPerLevel) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (level >= 5) {
            setGameStatus("won");
          } else {
            setGameStatus("levelComplete");
          }
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

  if (isLoading || !constraint) {
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
            Level {level}/5
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
                <div className="text-center space-y-2">
                  <Badge variant="secondary" className="text-sm" data-testid="badge-constraint">
                    {formatConstraint(level, constraint)}
                  </Badge>
                  <Progress value={(wordsCompleted / wordsPerLevel) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {wordsCompleted} / {wordsPerLevel} words
                  </p>
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder={`Enter a ${constraint.length}-letter word...`}
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
                <h3 className="text-2xl font-bold">Level {level} Complete!</h3>
                <p className="text-muted-foreground">
                  Get ready for the next challenge!
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <p className="font-medium mb-2">Level {level + 1} Rules:</p>
                  <p className="text-sm text-muted-foreground">
                    {levelDescriptions[level].replace("{length}", "N").replace("{startsWith}", "X").replace("{endsWith}", "X").replace("{contains}", "Y")}
                  </p>
                </div>
                <Button onClick={startNextLevel} className="gap-2" data-testid="button-next-level">
                  Start Level {level + 1}
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
                  {gameStatus === "won" ? "Champion!" : "Time's Up!"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You completed all 5 levels!"
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
