import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, Fingerprint, Menu, Flame, LogIn } from "lucide-react";
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
const SURVIVAL_TIME_PER_WORD = 8;
const SURVIVAL_TIME_OPTIONS = [
  { label: "Easy",   seconds: 15 },
  { label: "Normal", seconds: 8  },
  { label: "Hard",   seconds: 5  },
] as const;

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

export function NoRepeatsGame({ initialChallenge, locked, groupSeed, isUntimed }: { initialChallenge?: Challenge; locked?: boolean; groupSeed?: number; isUntimed?: boolean } = {}) {
  const { playSound } = useSound();
  const [isSurvival, setIsSurvival] = useState(false);
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME_PER_WORD);
  const { reportResult, resetRecorded } = useGameResult({
    slug: isSurvival ? "no-repeats-survival" : "no-repeats",
    isUntimed,
  });
  const personalBest = usePersonalBest(isSurvival ? "no-repeats-survival" : "no-repeats");
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [challenge, setChallenge] = useState<Challenge>(initialChallenge ?? 3);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSurvivalRef = useRef(false);

  const wordsPerChallenge = 15;
  const timePerChallenge = 600;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((survivalMode: boolean) => {
    stopTimer();
    const initialTime = survivalMode ? survivalTime : timePerChallenge;
    setTimeLeft(initialTime);
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
  }, [stopTimer, timePerChallenge, survivalTime]);

  const startGame = useCallback((c: Challenge, survival: boolean) => {
    resetRecorded();
    stopTimer();
    isSurvivalRef.current = survival;
    setIsSurvival(survival);
    setChallenge(c);
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    setGameStatus("playing");
    if (!isUntimed) startTimer(survival);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [stopTimer, startTimer, resetRecorded, isUntimed]);

  useEffect(() => {
    if (groupSeed !== undefined) {
      const level = (3 + (groupSeed % 7)) as Challenge;
      startGame(level, false);
    } else if (initialChallenge !== undefined) {
      startGame(initialChallenge, false);
    }
  }, []);

  const [, navigate] = useLocation();

  const returnToMenu = useCallback(() => {
    stopTimer();
    setGameStatus("menu");
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
  }, [stopTimer]);

  useEffect(() => {
    if (gameStatus === "won" || gameStatus === "lost") {
      const isCompetitive = !isSurvivalRef.current || survivalTime === SURVIVAL_TIME_PER_WORD;
      if (isCompetitive) {
        reportResult(score, gameStatus === "won", wordsCompleted);
      }
    }
  }, [gameStatus, score, reportResult, wordsCompleted, survivalTime]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const handleSubmit = async () => {
    if (validateMutation.isPending) return;
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
        const newWordsCompleted = wordsCompleted + 1;
        setWordsCompleted(newWordsCompleted);
        setUsedWords((prev) => new Set(Array.from(prev).concat(word)));
        playSound("correct");
        setFeedback({ type: "correct", message: `+${wordScore} points!` });
        setUserInput("");
        inputRef.current?.focus();

        if (newWordsCompleted >= wordsPerChallenge) {
          stopTimer();
          playSound("win");
          setCompletionMessage(getCompletionMessage(true));
          setGameStatus("won");
        } else if (isSurvivalRef.current) {
          startTimer(true);
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
              {isUntimed ? (
                <Badge variant="outline" className="gap-1 text-blue-600 border-blue-400 text-xs self-center" data-testid="badge-untimed-menu">
                  ∞ Untimed Mode — no timer pressure!
                </Badge>
              ) : (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant={!isSurvival ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsSurvival(false)}
                    className="gap-1.5"
                    data-testid="button-mode-classic"
                  >
                    <Timer className="h-3.5 w-3.5" />
                    Classic
                  </Button>
                  <Button
                    variant={isSurvival ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsSurvival(true)}
                    className="gap-1.5"
                    data-testid="button-mode-survival"
                  >
                    <Flame className="h-3.5 w-3.5" />
                    {isSurvival ? `Survival (${survivalTime}s/word)` : "Survival"}
                  </Button>
                </div>
              )}
              {!isUntimed && isSurvival && (
                <>
                  <div className="flex items-center justify-center gap-2 pt-1">
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
                  <p className="text-xs text-muted-foreground">
                    {survivalTime}s per word — timer resets on each correct answer!
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          {([3, 4, 5, 6, 7, 8, 9] as Challenge[]).map((c) => {
            const config = CHALLENGE_CONFIG[c];
            return (
              <Card key={c} className="hover-elevate cursor-pointer" onClick={() => startGame(c, isSurvival)} data-testid={`card-challenge-${c}`}>
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
            {isSurvival && (
              <Badge variant="secondary" className="mb-2 gap-1.5">
                <Flame className="h-3 w-3" />
                Survival Mode
              </Badge>
            )}
            <p className="text-muted-foreground mb-4" data-testid="text-result-summary">
              {gameStatus === "won"
                ? `You found ${wordsCompleted} unique-letter words!`
                : `You found ${wordsCompleted} words before time ran out.`}
            </p>
            <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span className="text-3xl font-bold" data-testid="text-final-score"><AnimatedNumber value={score} /></span>
              <span className="text-muted-foreground">points</span>
            </div>
            {personalBest > 0 && (
              <p className="text-sm text-muted-foreground mb-6" data-testid="text-personal-best">
                Personal Best: {personalBest} pts
              </p>
            )}

            <ShareResults
              gameName="No Repeats: Isogram"
              gameSlug={isSurvival ? "no-repeats-survival" : "no-repeats"}
              score={score}
              wordsCompleted={wordsCompleted}
              challengeName={CHALLENGE_CONFIG[challenge].name}
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

            {usedWords.size > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-2">Words Found:</h3>
                <div className="flex flex-wrap gap-2 justify-center max-h-48 overflow-y-auto">
                  {Array.from(usedWords).map((word) => (
                    <Badge key={word} variant="secondary" data-testid={`badge-word-${word}`}>{word}</Badge>
                  ))}
                </div>
              </div>
            )}

            {!locked && (
              <>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => startGame(challenge, isSurvival)} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                    Play Again
                  </Button>
                  <Button onClick={() => navigate("/games/no-repeats")} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                    Main Menu
                  </Button>
                  <TryAnotherGameButton currentSlug="no-repeats" />
                </div>
                {nextChallenge && gameStatus === "won" && (
                  <div className="flex justify-center">
                    <Button onClick={() => startGame(nextChallenge, isSurvival)} className="gap-2" variant="outline" data-testid="button-next-challenge">
                      Next Challenge
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const config = CHALLENGE_CONFIG[challenge];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isUntimed ? (
            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-400 text-xs" data-testid="badge-untimed">
              ∞ Untimed
            </Badge>
          ) : (
            <>
              <Timer className={`h-4 w-4 ${timeLeft <= (isSurvival ? 3 : 30) ? "text-destructive animate-pulse" : ""}`} />
              <span
                className={`font-mono font-bold text-lg ${timeLeft <= (isSurvival ? 3 : 30) ? "text-destructive animate-pulse" : ""}`}
                data-testid="badge-timer"
                role="timer"
                aria-label={`Time remaining: ${isSurvival ? timeLeft + "s" : Math.floor(timeLeft / 60) + ":" + (timeLeft % 60).toString().padStart(2, "0")}`}
              >
                {isSurvival ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
              </span>
              {isSurvival && (
                <Badge variant="outline" className="gap-1 text-destructive border-destructive/50 text-xs" data-testid="badge-survival">
                  <Flame className="h-3 w-3" />
                  Survival
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Score</p>
          <div className="flex items-center justify-center gap-1.5">
            <AnimatedNumber value={score} className="text-2xl font-bold text-primary" data-testid="badge-score" />
            <StreakIndicator streak={streak} />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <Badge variant="secondary" className="text-xs" data-testid="badge-current-challenge">{config.name}</Badge>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Find {config.wordLength}-letter words</h2>
              <p className="text-muted-foreground">All letters must be unique - no repeats!</p>
              {isSurvival && (
                <p className="text-xs text-muted-foreground">Correct answer resets the {survivalTime}s timer!</p>
              )}
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

            <div className="flex items-center justify-center gap-2.5 py-1.5 border-t border-b border-border/50" data-testid="word-count-strip">
              <motion.span
                key={wordsCompleted}
                initial={{ scale: 1.4 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-2xl font-bold tabular-nums leading-none text-primary"
                data-testid="text-live-word-count"
              >
                {wordsCompleted}
              </motion.span>
              <span className="text-sm text-muted-foreground leading-none">
                word{wordsCompleted !== 1 ? "s" : ""} found
              </span>
              <span className="text-muted-foreground/40 leading-none">·</span>
              <span className="text-sm text-muted-foreground leading-none">
                PB: <span className="font-semibold text-foreground" data-testid="text-personal-best">{personalBest > 0 ? personalBest : "—"}</span>
              </span>
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
                onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                placeholder={`Enter a ${config.wordLength}-letter word...`}
                aria-label="Enter your word"
                className="text-center text-lg uppercase"
                maxLength={config.wordLength}
                data-testid="input-word"
              />
              <Button type="submit" disabled={validateMutation.isPending} data-testid="button-submit">
                {validateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </Button>
            </form>

            <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
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

          <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={returnToMenu}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              data-testid="button-menu"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Menu
            </Button>
            {!locked && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { stopTimer(); setCompletionMessage(getCompletionMessage(false)); setGameStatus("lost"); }}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                data-testid="button-end-game"
              >
                End Game
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Progress value={progress} className="h-2" data-testid="progress-bar" />

      {usedWords.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Words Found:</h3>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {Array.from(usedWords).map((word) => (
                <Badge key={word} variant="outline" data-testid={`badge-found-word-${word}`}>{word}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
