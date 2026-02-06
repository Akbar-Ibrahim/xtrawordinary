import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, Hash, Menu } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";

const LETTER_MAX_FREQUENCIES: Record<string, number> = {
  A: 5, B: 3, C: 4, D: 4, E: 5, F: 3, G: 4, H: 4, I: 5, J: 2, K: 3, L: 4, M: 4,
  N: 5, O: 5, P: 4, Q: 2, R: 4, S: 6, T: 5, U: 4, V: 3, W: 3, X: 2, Y: 3, Z: 2
};

const MULTI_LETTER_POOL = "ABCDEFGHILMNOPRSTUWY".split("");

type Challenge = 1 | 2 | 3 | 4 | "random" | "multi";

type FrequencyConstraint = {
  letter: string;
  count: number;
};

type MultiLetterConstraint = {
  letters: string[];
  minCount: number;
};

const CHALLENGE_CONFIG: Record<Challenge, { name: string; description: string; minCount: number; maxCount: number; changesPerWord: boolean }> = {
  1: { name: "Challenge 1", description: "Find words with exactly 2 of a letter", minCount: 2, maxCount: 2, changesPerWord: false },
  2: { name: "Challenge 2", description: "Find words with exactly 3 of a letter", minCount: 3, maxCount: 3, changesPerWord: false },
  3: { name: "Challenge 3", description: "Find words with exactly 4 of a letter", minCount: 4, maxCount: 4, changesPerWord: false },
  4: { name: "Challenge 4", description: "Find words with 5+ of a letter", minCount: 5, maxCount: 6, changesPerWord: false },
  "random": { name: "Challenge Random", description: "Frequency changes after each word!", minCount: 2, maxCount: 5, changesPerWord: true },
  "multi": { name: "Multi-Letter", description: "Each letter must appear at least 2 times", minCount: 2, maxCount: 2, changesPerWord: false },
};

function getLettersForCount(count: number): string[] {
  return Object.entries(LETTER_MAX_FREQUENCIES)
    .filter(([_, maxFreq]) => maxFreq >= count)
    .map(([letter]) => letter);
}

function generateConstraint(challenge: Challenge): FrequencyConstraint {
  const config = CHALLENGE_CONFIG[challenge];
  const countRange = config.maxCount - config.minCount + 1;
  const count = Math.floor(Math.random() * countRange) + config.minCount;
  
  const validLetters = getLettersForCount(count);
  const letter = validLetters[Math.floor(Math.random() * validLetters.length)];
  
  return { letter, count };
}

function generateMultiLetterConstraint(): MultiLetterConstraint {
  const letterCount = Math.random() < 0.5 ? 2 : 3;
  const shuffled = [...MULTI_LETTER_POOL].sort(() => Math.random() - 0.5);
  const letters = shuffled.slice(0, letterCount);
  return { letters, minCount: 2 };
}

function validateMultiLetterConstraint(word: string, constraint: MultiLetterConstraint): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  for (const letter of constraint.letters) {
    const occurrences = countLetterOccurrences(upperWord, letter);
    if (occurrences < constraint.minCount) {
      return { valid: false, message: `'${letter}' must appear at least ${constraint.minCount} times (found ${occurrences})` };
    }
  }
  return { valid: true, message: "" };
}

function countLetterOccurrences(word: string, letter: string): number {
  return word.toUpperCase().split("").filter(c => c === letter).length;
}

function validateConstraint(word: string, constraint: FrequencyConstraint): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  const occurrences = countLetterOccurrences(upperWord, constraint.letter);
  
  if (occurrences !== constraint.count) {
    return { valid: false, message: `Word must have exactly ${constraint.count} '${constraint.letter}'${constraint.count > 1 ? "s" : ""} (found ${occurrences})` };
  }
  return { valid: true, message: "" };
}

function getNextChallenge(current: Challenge): Challenge | null {
  if (current === 1) return 2;
  if (current === 2) return 3;
  if (current === 3) return 4;
  return null;
}

export function LetterFrequencyGame() {
  const { playSound } = useSound();
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [challenge, setChallenge] = useState<Challenge>(1);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [constraint, setConstraint] = useState<FrequencyConstraint | null>(null);
  const [multiConstraint, setMultiConstraint] = useState<MultiLetterConstraint | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordsPerChallenge = 20;
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
          playSound("lose");
          setGameStatus("lost");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  const startGame = useCallback((c: Challenge) => {
    stopTimer();
    setChallenge(c);
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setTimeLeft(timePerChallenge);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    if (c === "multi") {
      setConstraint(null);
      setMultiConstraint(generateMultiLetterConstraint());
    } else {
      setMultiConstraint(null);
      setConstraint(generateConstraint(c));
    }
    setGameStatus("playing");
    startTimer();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [startTimer, stopTimer]);

  const goToMenu = useCallback(() => {
    stopTimer();
    setGameStatus("menu");
  }, [stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const checkAnswer = async () => {
    if (!userInput.trim()) return;
    if (challenge === "multi" ? !multiConstraint : !constraint) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    const constraintCheck = challenge === "multi" && multiConstraint
      ? validateMultiLetterConstraint(upperWord, multiConstraint)
      : constraint
        ? validateConstraint(upperWord, constraint)
        : { valid: false, message: "No constraint" };
    
    if (!constraintCheck.valid) {
      playSound("wrong");
      setStreak(0);
        setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(upperWord);
      if (!result.valid) {
        playSound("wrong");
        setStreak(0);
          setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => setFeedback(null), 1500);
        return;
      }

      playSound("correct");
      setStreak(prev => prev + 1);
        setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      
      const countBonus = challenge === "multi" && multiConstraint
        ? multiConstraint.letters.length * 30
        : constraint ? constraint.count * 20 : 0;
      setScore((prev) => prev + 100 + countBonus);
      
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);

      if (newWordsCompleted >= wordsPerChallenge) {
        stopTimer();
        playSound("win");
        setGameStatus("won");
      } else if (CHALLENGE_CONFIG[challenge].changesPerWord) {
        if (challenge === "multi") {
          setMultiConstraint(generateMultiLetterConstraint());
        } else {
          setConstraint(generateConstraint(challenge));
        }
      }

      setUserInput("");
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 500);
    } catch {
      playSound("wrong");
      setFeedback({ type: "invalid", message: "Error validating word" });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !validateMutation.isPending) {
      checkAnswer();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {gameStatus === "menu" ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="text-center space-y-2">
                  <Hash className="h-12 w-12 mx-auto text-primary" />
                  <h3 className="text-2xl font-bold">Choose Your Challenge</h3>
                  <p className="text-muted-foreground">
                    Select a challenge to start playing
                  </p>
                </div>

                <div className="grid gap-3">
                  {([1, 2, 3, 4, "random", "multi"] as Challenge[]).map((c) => (
                    <Card
                      key={c}
                      className="cursor-pointer hover-elevate"
                      onClick={() => startGame(c)}
                      data-testid={`button-challenge-${c}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4 w-full">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                            {c === "random" ? (
                              <Zap className="h-5 w-5 text-muted-foreground" />
                            ) : c === "multi" ? (
                              <Hash className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <span className="font-bold text-muted-foreground">{c}</span>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold" data-testid={`text-challenge-name-${c}`}>{CHALLENGE_CONFIG[c].name}</div>
                            <div className="text-sm text-muted-foreground">
                              {CHALLENGE_CONFIG[c].description}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : gameStatus === "playing" ? (
          <motion.div
            key="playing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={goToMenu} data-testid="button-menu">
                    <Menu className="h-4 w-4 mr-2" />
                    Menu
                  </Button>
                  <Badge variant="secondary" data-testid="badge-challenge">
                    {CHALLENGE_CONFIG[challenge].name}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm" role="timer" aria-label={`Time remaining: ${formatTime(timeLeft)}`}>
                    <Timer className={`h-4 w-4 ${timeLeft <= 10 ? "text-destructive" : ""}`} />
                    <span className={timeLeft <= 10 ? "text-destructive font-bold" : ""}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span data-testid="text-progress">{wordsCompleted} / {wordsPerChallenge} words</span>
                  </div>
                  <Progress value={(wordsCompleted / wordsPerChallenge) * 100} data-testid="progress-bar" />
                </div>

                <div className="text-center space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {challenge === "multi" ? "Find a word where each letter appears at least 2 times" : "Find a word with"}
                    </p>
                    {challenge === "multi" && multiConstraint ? (
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {multiConstraint.letters.map((letter, idx) => (
                          <Badge key={idx} variant="default" className="text-2xl px-4 py-2" data-testid={`badge-constraint-${idx}`}>
                            {letter}
                          </Badge>
                        ))}
                      </div>
                    ) : constraint && (
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="default" className="text-2xl px-4 py-2" data-testid="badge-constraint">
                          {constraint.count}× {constraint.letter}
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  {CHALLENGE_CONFIG[challenge].changesPerWord && (
                    <Badge variant="outline" className="text-xs">
                      Constraint changes after each word!
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
                      placeholder="Enter a word..."
                      aria-label="Enter your word"
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

                <div className="text-center">
                  <div className="text-2xl font-bold" data-testid="text-score"><AnimatedNumber value={score} /></div>
                  <div className="text-sm text-muted-foreground">Score</div>
                  <StreakIndicator streak={streak} className="justify-center mt-1" />
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
                <h3 className="text-2xl font-bold">Frequency Master!</h3>
                <p className="text-muted-foreground">
                  You completed {CHALLENGE_CONFIG[challenge].name}!
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                </div>
                <ShareResults
                  gameName="Letter Frequency"
                  gameSlug="letter-frequency"
                  score={score}
                  wordsCompleted={wordsCompleted}
                  challengeName={CHALLENGE_CONFIG[challenge].name}
                  isWin={true}
                />
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button onClick={() => startGame(challenge)} variant={challenge === 4 || challenge === "random" ? "default" : "outline"} data-testid="button-play-again">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Play Again
                  </Button>
                  {getNextChallenge(challenge) && (
                    <Button onClick={() => startGame(getNextChallenge(challenge)!)} data-testid="button-next-challenge">
                      Next Challenge
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                  {challenge !== 4 && challenge !== "random" && (
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
                  You found {wordsCompleted} words
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                </div>
                <ShareResults
                  gameName="Letter Frequency"
                  gameSlug="letter-frequency"
                  score={score}
                  wordsCompleted={wordsCompleted}
                  challengeName={CHALLENGE_CONFIG[challenge].name}
                  isWin={false}
                />
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button onClick={() => startGame(challenge)} data-testid="button-try-again">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button onClick={goToMenu} variant="secondary" data-testid="button-back-menu">
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
