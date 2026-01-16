import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ContainsConfig, WordValidationResponse } from "@shared/schema";

function generateLettersFromDictionary(dictionary: string[], minWords: number = 10): string[] {
  const letterCounts: Record<string, number> = {};
  
  for (const word of dictionary) {
    const letters = Array.from(new Set(word.split("")));
    for (const letter of letters) {
      letterCounts[letter] = (letterCounts[letter] || 0) + 1;
    }
  }
  
  const sortedLetters = Object.entries(letterCounts)
    .filter(([_, count]) => count >= minWords)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(([letter]) => letter);
  
  if (sortedLetters.length < 3) {
    return ["E", "A", "T"];
  }
  
  const matchingWords = dictionary.filter(w => 
    sortedLetters.every(letter => w.includes(letter))
  );
  
  if (matchingWords.length < minWords) {
    const commonLetters = Object.entries(letterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([letter]) => letter);
    
    for (let i = 0; i < commonLetters.length - 2; i++) {
      for (let j = i + 1; j < commonLetters.length - 1; j++) {
        for (let k = j + 1; k < commonLetters.length; k++) {
          const combo = [commonLetters[i], commonLetters[j], commonLetters[k]];
          const matches = dictionary.filter(w => combo.every(l => w.includes(l)));
          if (matches.length >= minWords) {
            return combo;
          }
        }
      }
    }
    return [commonLetters[0], commonLetters[1]];
  }
  
  return sortedLetters;
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

export function ContainsLettersGame() {
  const { data: config, isLoading: configLoading } = useQuery<ContainsConfig>({
    queryKey: ["/api/games/contains-letters/config"],
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
  const [currentLetters, setCurrentLetters] = useState<string[]>([]);
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
    setCurrentLetters(generateLettersFromDictionary(dictionary, 10));
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
    setLevel(2);
    setCurrentLetters(generateLettersFromDictionary(dictionary, 10));
    setWordsCompleted(0);
    setTimeLeft(timePerLevel);
    setGameStatus("playing");
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    startTimer();
  }, [dictionary, timePerLevel, startTimer]);

  useEffect(() => {
    if (dictionary.length > 0 && currentLetters.length === 0) {
      setCurrentLetters(generateLettersFromDictionary(dictionary, 10));
    }
  }, [dictionary, currentLetters.length]);

  useEffect(() => {
    if (dictionary.length > 0 && gameStatus === "playing" && timerRef.current === null && currentLetters.length > 0) {
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dictionary, gameStatus, startTimer, currentLetters.length]);

  const checkAnswer = async () => {
    if (!userInput.trim()) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    const constraintCheck = validateContainsLetters(upperWord, currentLetters);
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
      setScore((prev) => prev + 100 + level * 25);
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
          setCurrentLetters(generateLettersFromDictionary(dictionary, 10));
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

  if (isLoading || currentLetters.length === 0) {
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
                  <Progress value={(wordsCompleted / wordsPerLevel) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {wordsCompleted} / {wordsPerLevel} words
                  </p>
                  {level === 2 && (
                    <Badge variant="secondary" className="text-xs">
                      Letters change after each word!
                    </Badge>
                  )}
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
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
                    Same concept, but you'll get a new group of required letters after each correct word!
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
                  {gameStatus === "won" ? "Letter Hunter!" : "Time's Up!"}
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
