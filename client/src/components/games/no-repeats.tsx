import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, Fingerprint, Menu } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";

type Challenge = 3 | 4 | 5 | 6 | 7 | 8 | 9;

const CHALLENGE_CONFIG: Record<Challenge, { name: string; description: string; wordLength: number }> = {
  3: { name: "Challenge 3", description: "Find 3-letter words with all unique letters", wordLength: 3 },
  4: { name: "Challenge 4", description: "Find 4-letter words with all unique letters", wordLength: 4 },
  5: { name: "Challenge 5", description: "Find 5-letter words with all unique letters", wordLength: 5 },
  6: { name: "Challenge 6", description: "Find 6-letter words with all unique letters", wordLength: 6 },
  7: { name: "Challenge 7", description: "Find 7-letter words with all unique letters", wordLength: 7 },
  8: { name: "Challenge 8", description: "Find 8-letter words with all unique letters", wordLength: 8 },
  9: { name: "Challenge 9", description: "Find 9-letter words with all unique letters", wordLength: 9 },
};

function hasUniqueLetters(word: string): boolean {
  const upperWord = word.toUpperCase();
  const letters = new Set(upperWord.split(""));
  return letters.size === upperWord.length;
}

function getNextChallenge(current: Challenge): Challenge | null {
  if (current === 3) return 4;
  if (current === 4) return 5;
  if (current === 5) return 6;
  if (current === 6) return 7;
  if (current === 7) return 8;
  if (current === 8) return 9;
  return null;
}

export function NoRepeatsGame() {
  const { playSound } = useSound();
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [challenge, setChallenge] = useState<Challenge>(3);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [completionMessage, setCompletionMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordsPerChallenge = 15;
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
          setCompletionMessage(getCompletionMessage(false));
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
    setGameStatus("playing");
    startTimer();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [stopTimer, startTimer]);

  const returnToMenu = useCallback(() => {
    stopTimer();
    setGameStatus("menu");
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setTimeLeft(timePerChallenge);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
  }, [stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const handleSubmit = async () => {
    const word = userInput.trim().toUpperCase();
    if (!word) return;

    const config = CHALLENGE_CONFIG[challenge];

    if (word.length !== config.wordLength) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "wrong", message: `Word must be exactly ${config.wordLength} letters` });
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    if (!hasUniqueLetters(word)) {
      const letterCounts: Record<string, number> = {};
      for (const letter of word) {
        letterCounts[letter] = (letterCounts[letter] || 0) + 1;
      }
      const repeatedLetters = Object.entries(letterCounts)
        .filter(([_, count]) => count > 1)
        .map(([letter]) => letter);
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "wrong", message: `Letter${repeatedLetters.length > 1 ? "s" : ""} '${repeatedLetters.join("', '")}' repeated - all letters must be unique!` });
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    if (usedWords.has(word)) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "wrong", message: "You already used this word!" });
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(word);
      if (result.valid) {
        const wordScore = config.wordLength * 10;
        setScore((prev) => prev + wordScore);
        setStreak(prev => prev + 1);
        setWordsCompleted((prev) => prev + 1);
        setUsedWords((prev) => new Set(Array.from(prev).concat(word)));
        playSound("correct");
        setFeedback({ type: "correct", message: `+${wordScore} points!` });
        setUserInput("");

        if (wordsCompleted + 1 >= wordsPerChallenge) {
          stopTimer();
          playSound("win");
          setCompletionMessage(getCompletionMessage(true));
          setGameStatus("won");
        }
      } else {
        playSound("wrong");
        setStreak(0);
        setFeedback({ type: "invalid", message: "Not a valid word in our dictionary" });
      }
    } catch {
      playSound("wrong");
      setFeedback({ type: "invalid", message: "Error validating word" });
    }
    setTimeout(() => setFeedback(null), 2000);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const progress = (wordsCompleted / wordsPerChallenge) * 100;

  if (gameStatus === "menu") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Fingerprint className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Choose Your Challenge</h2>
              <p className="text-muted-foreground">
                Find words where every letter is unique - no repeating letters allowed!
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {([3, 4, 5, 6, 7, 8, 9] as Challenge[]).map((c) => {
            const config = CHALLENGE_CONFIG[c];
            return (
              <Card key={c} className="hover-elevate cursor-pointer" onClick={() => startGame(c)} data-testid={`card-challenge-${c}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-lg font-bold text-primary" data-testid={`text-challenge-number-${c}`}>{c}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold" data-testid={`text-challenge-name-${c}`}>{config.name}</h3>
                      <p className="text-sm text-muted-foreground">{c}-letter words</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (gameStatus === "won" || gameStatus === "lost") {
    const nextChallenge = getNextChallenge(challenge);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        <Card>
          <CardContent className="p-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              gameStatus === "won" ? "bg-accent/20" : "bg-destructive/20"
            }`}>
              {gameStatus === "won" ? (
                <Trophy className="w-10 h-10 text-accent" />
              ) : (
                <Timer className="w-10 h-10 text-destructive" />
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2" data-testid="text-game-result">
              {gameStatus === "won" ? "Challenge Complete!" : "Time's Up!"}
            </h2>
            <p className="text-muted-foreground mb-4" data-testid="text-result-summary">
              {gameStatus === "won"
                ? `You found ${wordsCompleted} unique-letter words!`
                : `You found ${wordsCompleted} words before time ran out.`}
            </p>
            <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
            <div className="flex items-center justify-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span className="text-3xl font-bold" data-testid="text-final-score"><AnimatedNumber value={score} /></span>
              <span className="text-muted-foreground">points</span>
            </div>

            <ShareResults
              gameName="No Repeats"
              gameSlug="no-repeats"
              score={score}
              wordsCompleted={wordsCompleted}
              challengeName={CHALLENGE_CONFIG[challenge].name}
              isWin={gameStatus === "won"}
            />

            {usedWords.size > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-2">Words Found:</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {Array.from(usedWords).map((word) => (
                    <Badge key={word} variant="secondary" data-testid={`badge-word-${word}`}>{word}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={returnToMenu} variant="outline" className="gap-2" data-testid="button-menu">
                <Menu className="w-4 h-4" />
                Challenge Menu
              </Button>
              {nextChallenge && gameStatus === "won" && (
                <Button onClick={() => startGame(nextChallenge)} className="gap-2" data-testid="button-next-challenge">
                  Next Challenge
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              <Button onClick={() => startGame(challenge)} variant="secondary" className="gap-2" data-testid="button-play-again">
                <RotateCcw className="w-4 h-4" />
                Play Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const config = CHALLENGE_CONFIG[challenge];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button onClick={returnToMenu} variant="ghost" size="sm" className="gap-1" data-testid="button-back-menu">
            <Menu className="w-4 h-4" />
            Menu
          </Button>
          <Badge variant="secondary" data-testid="badge-current-challenge">{config.name}</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="font-bold" data-testid="text-score"><AnimatedNumber value={score} /></span>
          </div>
          <StreakIndicator streak={streak} />
          <div className="flex items-center gap-2">
            <Timer className={`w-4 h-4 ${timeLeft <= 30 ? "text-destructive" : "text-muted-foreground"}`} />
            <span className={`font-mono ${timeLeft <= 30 ? "text-destructive font-bold" : ""}`} data-testid="text-timer" role="timer" aria-label={`${Math.floor(timeLeft / 60)} minutes ${timeLeft % 60} seconds remaining`}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Find {config.wordLength}-letter words</h2>
              <p className="text-muted-foreground">All letters must be unique - no repeats!</p>
            </div>

            <div className="flex justify-center gap-2">
              {Array.from({ length: config.wordLength }).map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 border-2 border-primary/30 rounded flex items-center justify-center text-xl font-bold bg-primary/5"
                >
                  {userInput[i]?.toUpperCase() || ""}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="flex gap-2 max-w-md mx-auto"
            >
              <Input
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                placeholder={`Enter a ${config.wordLength}-letter word...`}
                aria-label="Enter your word"
                className="text-center text-lg uppercase"
                maxLength={config.wordLength}
                disabled={validateMutation.isPending}
                data-testid="input-word"
              />
              <Button type="submit" disabled={validateMutation.isPending} data-testid="button-submit">
                {validateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </Button>
            </form>

            <div aria-live="polite">
              <AnimatePresence mode="wait">
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`flex items-center justify-center gap-2 ${
                      feedback.type === "correct"
                        ? "text-accent"
                        : feedback.type === "wrong"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {feedback.type === "correct" ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    <span className="font-medium" data-testid="text-feedback">{feedback.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <span>Progress</span>
          <span data-testid="text-progress">{wordsCompleted} / {wordsPerChallenge} words</span>
        </div>
        <Progress value={progress} className="h-2" data-testid="progress-bar" />
      </div>

      {usedWords.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Words Found:</h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(usedWords).map((word) => (
                <Badge key={word} variant="outline" data-testid={`badge-found-word-${word}`}>{word}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
