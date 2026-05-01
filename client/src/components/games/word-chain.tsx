import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, Link, Flame, LogIn } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
const SURVIVAL_TIME_PER_WORD = 10;
const SURVIVAL_TIME_OPTIONS = [
  { label: "Easy",   seconds: 20 },
  { label: "Normal", seconds: 10 },
  { label: "Hard",   seconds: 6  },
] as const;

type Variation = 1 | 2;
type Level = 1 | 2;

export function WordChainGame({ initialChallenge = {} as { variation?: Variation; level?: Level }, locked }: { initialChallenge?: { variation?: Variation; level?: Level }; locked?: boolean } = {}) {
  const { playSound } = useSound();
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME_PER_WORD);
  const { reportResult, resetRecorded } = useGameResult({
    slug: "word-chain-survival",
  });
  const personalBest = usePersonalBest("word-chain-survival");

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const startWordMutation = useMutation({
    mutationFn: async ({ variation, level }: { variation: number; level: number }) => {
      const response = await apiRequest("POST", "/api/games/word-chain/start", { variation, level });
      return response.json() as Promise<{ word: string | null }>;
    },
  });

  const computerWordMutation = useMutation({
    mutationFn: async ({ playerWord, variation, level, usedWords }: { playerWord: string; variation: number; level: number; usedWords: string[] }) => {
      const response = await apiRequest("POST", "/api/games/word-chain/computer-word", { playerWord, variation, level, usedWords });
      return response.json() as Promise<{ word: string | null }>;
    },
  });

  const [variation, setVariation] = useState<Variation>(1);
  const [level, setLevel] = useState<Level>(1);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SURVIVAL_TIME_PER_WORD);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost" | "levelComplete">("menu");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [chainHistory, setChainHistory] = useState<{ word: string; isPlayer: boolean }[]>([]);
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const wordsPerLevel = 100;
  
  const [timerRunning, setTimerRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getConstraint = useCallback(() => {
    if (!currentWord) return null;
    if (variation === 1) {
      return { startsWith: currentWord[currentWord.length - 1] };
    } else {
      return { startsWith: currentWord.slice(-2) };
    }
  }, [currentWord, variation]);

  const validateUserWord = useCallback((word: string): { valid: boolean; message: string } => {
    const upperWord = word.toUpperCase();
    const constraint = getConstraint();
    
    if (!constraint) return { valid: false, message: "No active word" };
    
    if (!upperWord.startsWith(constraint.startsWith!)) {
      return { valid: false, message: `Word must start with '${constraint.startsWith}'` };
    }
    
    if (level === 2 && upperWord.length !== currentWord.length) {
      return { valid: false, message: `Word must be ${currentWord.length} letters long` };
    }
    
    return { valid: true, message: "" };
  }, [getConstraint, level, currentWord]);

  useEffect(() => {
    if (!timerRunning || gameStatus !== "playing") return;
    if (timeLeft <= 0) return;
    
    const timeoutId = setTimeout(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimerRunning(false);
          playSound("lose");
          setCompletionMessage(getCompletionMessage(false));
          setGameStatus("lost");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [timerRunning, timeLeft, gameStatus]);

  useEffect(() => {
    if (gameStatus === "won" || gameStatus === "lost") {
      const isCompetitive = survivalTime === SURVIVAL_TIME_PER_WORD;
      if (isCompetitive) {
        reportResult(score, gameStatus === "won", wordsCompleted);
      }
    }
  }, [gameStatus, score, reportResult, wordsCompleted, survivalTime]);

  const startTimer = useCallback(() => {
    setTimerRunning(false);
    setTimeLeft(survivalTime);
    requestAnimationFrame(() => {
      setTimerRunning(true);
    });
  }, [survivalTime]);

  const stopTimer = useCallback(() => {
    setTimerRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setTimerRunning(false);
    setTimeLeft(survivalTime);
    requestAnimationFrame(() => {
      setTimerRunning(true);
    });
  }, [survivalTime]);

  const startGame = useCallback(async (v: Variation, l: Level) => {
    resetRecorded();
    stopTimer();

    setVariation(v);
    setLevel(l);
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setUsedWords(new Set());
    setChainHistory([]);
    setUserInput("");
    setFeedback(null);
    setTimeLeft(survivalTime);
    
    try {
      const result = await startWordMutation.mutateAsync({ variation: v, level: l });
      if (!result.word) {
        playSound("wrong");
        setFeedback({ type: "invalid", message: "Could not start game" });
        return;
      }
      
      setCurrentWord(result.word);
      setUsedWords(new Set([result.word]));
      setChainHistory([{ word: result.word, isPlayer: false }]);
      setGameStatus("playing");
      
      startTimer();
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch {
      playSound("wrong");
      setFeedback({ type: "invalid", message: "Error starting game" });
    }
  }, [startWordMutation, stopTimer, startTimer, resetRecorded, survivalTime]);

  useEffect(() => {
    if (initialChallenge.variation && initialChallenge.level) {
      startGame(initialChallenge.variation, initialChallenge.level);
    }
  }, []);

  const startNextLevel = useCallback(() => {
    if (level === 1) {
      startGame(variation, 2);
    }
  }, [level, variation, startGame]);

  const checkAnswer = async () => {
    if (!userInput.trim()) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      inputRef.current?.focus();
      return;
    }

    const constraintCheck = validateUserWord(upperWord);
    if (!constraintCheck.valid) {
      playSound("wrong");
      setStreak(0);
        setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => setFeedback(null), 1500);
      inputRef.current?.focus();
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(upperWord);
      if (!result.valid) {
        playSound("wrong");
        setStreak(0);
        setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => setFeedback(null), 1500);
        inputRef.current?.focus();
        return;
      }

      stopTimer();
      
      playSound("correct");
      setStreak(prev => prev + 1);
      setFeedback({ type: "correct", message: "Correct!" });
      const newUsedWordsArray = Array.from(usedWords).concat(upperWord);
      const newUsedWords = new Set(newUsedWordsArray);
      setUsedWords(newUsedWords);
      setChainHistory(prev => [...prev, { word: upperWord, isPlayer: true }]);
      setScore((prev) => prev + 50 + level * 25 + variation * 10);
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");
      inputRef.current?.focus();

      setTimeout(async () => {
        setFeedback(null);
        
        if (newWordsCompleted >= wordsPerLevel) {
          if (level >= 2) {
            playSound("win");
            setCompletionMessage(getCompletionMessage(true));
            setGameStatus("won");
          } else {
            playSound("correct");
            setGameStatus("levelComplete");
          }
          return;
        }

        try {
          const computerResult = await computerWordMutation.mutateAsync({
            playerWord: upperWord,
            variation,
            level,
            usedWords: newUsedWordsArray
          });
          
          if (!computerResult.word) {
            playSound("win");
            setCompletionMessage(getCompletionMessage(true));
            setGameStatus("won");
            return;
          }
          
          setCurrentWord(computerResult.word);
          setUsedWords(prev => new Set(Array.from(prev).concat(computerResult.word!)));
          setChainHistory(prev => [...prev, { word: computerResult.word!, isPlayer: false }]);
          resetTimer();
        } catch {
          playSound("win");
          setCompletionMessage(getCompletionMessage(true));
          setGameStatus("won");
        }
      }, 500);
    } catch {
      playSound("wrong");
      setFeedback({ type: "invalid", message: "Error validating word" });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkAnswer();
    }
  };

  const timerPercent = (timeLeft / survivalTime) * 100;

  if (gameStatus === "menu") {
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <Link className="h-12 w-12 mx-auto text-primary" />
            <h3 className="text-xl font-bold">Choose Your Challenge</h3>
            <p className="text-muted-foreground text-sm">
              Select a difficulty and variation to start the word chain!
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              {SURVIVAL_TIME_OPTIONS.map(opt => (
                <Button
                  key={opt.seconds}
                  variant={survivalTime === opt.seconds ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSurvivalTime(opt.seconds)}
                  data-testid={`button-survival-time-${opt.label.toLowerCase()}`}
                >
                  {opt.label} ({opt.seconds}s)
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{survivalTime}s per word — timer resets on each correct answer!</p>
          </div>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Variation 1: Last Letter</h4>
              <p className="text-sm text-muted-foreground">Use the last letter of our word to form yours</p>
              <div className="flex gap-2">
                <Button onClick={() => startGame(1, 1)} className="flex-1" data-testid="button-v1-l1">
                  Level 1
                </Button>
                <Button onClick={() => startGame(1, 2)} variant="secondary" className="flex-1" data-testid="button-v1-l2">
                  Level 2 (Match Length)
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Variation 2: Last Two Letters</h4>
              <p className="text-sm text-muted-foreground">Use the last two letters of our word to form yours</p>
              <div className="flex gap-2">
                <Button onClick={() => startGame(2, 1)} className="flex-1" data-testid="button-v2-l1">
                  Level 1
                </Button>
                <Button onClick={() => startGame(2, 2)} variant="secondary" className="flex-1" data-testid="button-v2-l2">
                  Level 2 (Match Length)
                </Button>
              </div>
            </div>
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
            <AnimatedNumber value={score} /> pts
          </Badge>
          <StreakIndicator streak={streak} />
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-progress">
            <Zap className="h-3.5 w-3.5" />
            {wordsCompleted}/{wordsPerLevel}
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/50" data-testid="badge-survival">
            <Flame className="h-3.5 w-3.5" />
            Survival
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={timeLeft <= 3 ? "destructive" : "secondary"} className="gap-1.5 min-w-[60px] justify-center" data-testid="badge-timer" role="timer" aria-label={`Time remaining: ${timeLeft} seconds`}>
            <Timer className="h-3.5 w-3.5" />
            {timeLeft}s
          </Badge>
          {!locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGameStatus("menu")}
              className="gap-1.5"
              data-testid="button-restart"
            >
              <RotateCcw className="h-4 w-4" />
              Menu
            </Button>
          )}
          {!locked && gameStatus === "playing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { stopTimer(); setCompletionMessage(getCompletionMessage(false)); setGameStatus("lost"); }}
              className="gap-1.5"
              data-testid="button-end-game"
            >
              End Game
            </Button>
          )}
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
                  <Badge variant="secondary" className="text-xs">
                    Variation {variation} - Level {level}
                    {level === 2 && " (Match Length)"}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {variation === 1 
                      ? `Start with '${currentWord[currentWord.length - 1]}'`
                      : `Start with '${currentWord.slice(-2)}'`}
                    {level === 2 && ` (${currentWord.length} letters)`}
                  </p>
                  <p className="text-xs text-muted-foreground">Correct answer resets the {survivalTime}s timer!</p>
                </div>

                <motion.div
                  key={currentWord}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex justify-center"
                >
                  <div className="flex gap-1">
                    {currentWord.split("").map((letter, idx) => (
                      <div
                        key={idx}
                        className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg font-bold rounded-lg ${
                          variation === 1 && idx === currentWord.length - 1
                            ? "bg-primary text-primary-foreground"
                            : variation === 2 && idx >= currentWord.length - 2
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                </motion.div>

                <Progress value={timerPercent} className="h-2" />

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter your word..."
                      aria-label="Enter your word"
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback?.type === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback?.type === "wrong" || feedback?.type === "invalid"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
                      autoFocus
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

                  <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
                    {feedback && feedback.type !== "correct" && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center text-sm text-destructive"
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

                <div className="flex flex-wrap gap-1 justify-center max-h-20 overflow-y-auto">
                  {chainHistory.slice(-10).map((item, idx) => (
                    <Badge 
                      key={idx} 
                      variant={item.isPlayer ? "default" : "outline"} 
                      className="text-xs"
                    >
                      {item.word}
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
                    Same as before, but now your word must also match the length of our word!
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
                  {gameStatus === "won" ? "Chain Master!" : "Time's Up!"}
                </h3>
                <Badge variant="secondary" className="gap-1.5">
                  <Flame className="h-3 w-3" />
                  Survival Mode
                </Badge>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You completed the word chain!"
                    : `You chained ${wordsCompleted} words`}
                </p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                  {personalBest > 0 && (
                    <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                      Personal Best: {personalBest} pts
                    </p>
                  )}
                </div>
                <ShareResults
                  gameName="Word Chain"
                  gameSlug="word-chain-survival"
                  score={score}
                  wordsCompleted={wordsCompleted}
                  isWin={gameStatus === "won"}
                />
                {!user && (
                  <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                    <LogIn className="h-4 w-4 shrink-0" />
                    <span>
                      <button className="underline font-medium" onClick={() => setAuthOpen(true)} data-testid="button-sign-in-cta">Sign in</button>{" "}
                      to save your score to the leaderboard!
                    </span>
                  </div>
                )}
                {!locked && (
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button onClick={() => setGameStatus("menu")} data-testid="button-play-again">
                      Play Again
                    </Button>
                    <TryAnotherGameButton currentSlug="word-chain" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
