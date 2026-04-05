import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, RefreshCw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, Search, ArrowUpDown, AlignLeft, Flame } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";
import { makeSeededRng } from "@/lib/seeded-rng";

const SURVIVAL_TIME_PER_WORD = 8;
const SURVIVAL_TIME_OPTIONS = [
  { label: "Easy",   seconds: 15 },
  { label: "Normal", seconds: 8  },
  { label: "Hard",   seconds: 5  },
] as const;

const EXCLUDED_LETTERS = new Set(["J", "Q", "V", "X", "Z"]);
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(l => !EXCLUDED_LETTERS.has(l));

type Challenge = 1 | 2 | 3 | 4 | 5 | "advanced";

const CHALLENGE_CONFIG: Record<Challenge, { name: string; description: string; letterCount: number | "random" }> = {
  1: { name: "Challenge 1", description: "Find words containing 2 letters", letterCount: 2 },
  2: { name: "Challenge 2", description: "Find words containing 3 letters", letterCount: 3 },
  3: { name: "Challenge 3", description: "Find words containing 4 letters", letterCount: 4 },
  4: { name: "Challenge 4", description: "Find words containing 5 letters", letterCount: 5 },
  5: { name: "Challenge 5", description: "Find words containing 6 letters", letterCount: 6 },
  advanced: { name: "Challenge Advanced", description: "Random letter count for each word!", letterCount: "random" },
};

function generateRandomLetters(count: number, rng: () => number = Math.random): string[] {
  const letters: string[] = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(rng() * ALPHABET.length);
    letters.push(ALPHABET[randomIndex]);
  }
  return letters;
}

function getRandomLetterCount(rng: () => number = Math.random): number {
  return Math.floor(rng() * 5) + 2;
}

function validateOrderedSubsequence(word: string, requiredLetters: string[]): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  let searchFrom = 0;
  for (const letter of requiredLetters) {
    const idx = upperWord.indexOf(letter, searchFrom);
    if (idx === -1) {
      return { valid: false, message: `Letters must appear in order: "${requiredLetters.join(" → ")}" — "${letter}" not found in sequence` };
    }
    searchFrom = idx + 1;
  }
  return { valid: true, message: "" };
}

function validateLetterHunt(word: string, requiredLetters: string[]): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  
  const requiredCounts: Record<string, number> = {};
  for (const letter of requiredLetters) {
    requiredCounts[letter] = (requiredCounts[letter] || 0) + 1;
  }
  
  const wordCounts: Record<string, number> = {};
  for (const char of upperWord) {
    wordCounts[char] = (wordCounts[char] || 0) + 1;
  }
  
  for (const [letter, requiredCount] of Object.entries(requiredCounts)) {
    const wordCount = wordCounts[letter] || 0;
    if (wordCount !== requiredCount) {
      if (wordCount < requiredCount) {
        if (requiredCount === 1) {
          return { valid: false, message: `Word must contain the letter "${letter}"` };
        } else {
          return { valid: false, message: `Word must contain "${letter}" exactly ${requiredCount} times (has ${wordCount})` };
        }
      } else {
        return { valid: false, message: `Word has too many "${letter}"s (need ${requiredCount}, has ${wordCount})` };
      }
    }
  }
  return { valid: true, message: "" };
}

function getNextChallenge(current: Challenge): Challenge | null {
  if (current === "advanced") return null;
  if (current === 5) return null;
  return (current + 1) as Challenge;
}

export function LetterHuntGame({ initialChallenge, groupSeed, locked }: { initialChallenge?: Challenge; groupSeed?: number; locked?: boolean } = {}) {
  const { playSound } = useSound();
  const [isSurvival, setIsSurvival] = useState(false);
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME_PER_WORD);
  const { reportResult, resetRecorded, personalBest } = useGameResult({
    slug: isSurvival ? "letter-hunt-survival" : "letter-hunt",
  });
  const seedRngRef = useRef<(() => number) | undefined>(
    groupSeed !== undefined ? makeSeededRng(groupSeed) : undefined
  );
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [challenge, setChallenge] = useState<Challenge>(initialChallenge ?? 1);
  const [ordered, setOrdered] = useState(false);
  const [pendingChallenge, setPendingChallenge] = useState<Challenge | null>(null);
  const [currentLetters, setCurrentLetters] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameStatus, setGameStatus] = useState<"menu" | "mode-select" | "playing" | "won" | "lost">("menu");
  const [completionMessage, setCompletionMessage] = useState("");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSurvivalRef = useRef(false);
  const lastGameSeedRef = useRef<number | null>(null);
  const constraintRngRef = useRef<(() => number) | null>(null);

  const wordsToComplete = 20;
  const timePerChallenge = 120;

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

  const generateLettersForChallenge = useCallback((c: Challenge, rng?: () => number): string[] => {
    const config = CHALLENGE_CONFIG[c];
    const count = config.letterCount === "random" ? getRandomLetterCount(rng) : config.letterCount;
    return generateRandomLetters(count, rng);
  }, []);

  const selectChallenge = useCallback((c: Challenge) => {
    setPendingChallenge(c);
    setGameStatus("mode-select");
  }, []);

  const startGame = useCallback((c: Challenge, isOrdered: boolean, seedOverride?: number) => {
    resetRecorded();
    stopTimer();
    isSurvivalRef.current = isSurvival;
    setChallenge(c);
    setOrdered(isOrdered);
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);

    let constraintRng: (() => number) | undefined;
    if (groupSeed !== undefined) {
      constraintRng = seedRngRef.current;
    } else {
      const seed = seedOverride ?? Math.floor(Math.random() * 1_000_000_000);
      lastGameSeedRef.current = seed;
      const rng = makeSeededRng(seed);
      constraintRngRef.current = rng;
      constraintRng = rng;
    }

    setCurrentLetters(generateLettersForChallenge(c, constraintRng));
    setGameStatus("playing");
    startTimer(isSurvival);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [generateLettersForChallenge, startTimer, stopTimer, resetRecorded, isSurvival]);

  useEffect(() => {
    if (initialChallenge !== undefined) {
      selectChallenge(initialChallenge);
    }
  }, []);

  const goToMenu = useCallback(() => {
    stopTimer();
    setGameStatus("menu");
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

  const checkAnswer = async () => {
    if (!userInput.trim()) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => {
        setFeedback(null);
      }, 1500);
      inputRef.current?.focus();
      return;
    }

    const constraintCheck = validateLetterHunt(upperWord, currentLetters);
    if (!constraintCheck.valid) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => {
        setFeedback(null);
      }, 1500);
      inputRef.current?.focus();
      return;
    }

    if (ordered) {
      const orderCheck = validateOrderedSubsequence(upperWord, currentLetters);
      if (!orderCheck.valid) {
        playSound("wrong");
        setStreak(0);
        setFeedback({ type: "wrong", message: orderCheck.message });
        setTimeout(() => {
          setFeedback(null);
        }, 1500);
        inputRef.current?.focus();
        return;
      }
    }

    try {
      const result = await validateMutation.mutateAsync(upperWord);
      if (!result.valid) {
        playSound("wrong");
        setStreak(0);
          setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => {
          setFeedback(null);
        }, 1500);
        inputRef.current?.focus();
        return;
      }

      playSound("correct");
        setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      setStreak(prev => prev + 1);
      
      const challengeBonus = challenge === "advanced" ? 50 : (challenge as number) * 25;
      setScore((prev) => prev + 100 + challengeBonus);
      
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");
      inputRef.current?.focus();

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsToComplete) {
          stopTimer();
          playSound("win");
          setCompletionMessage(getCompletionMessage(true));
          setGameStatus("won");
        } else {
          if (challenge === "advanced") {
            const rng = groupSeed !== undefined ? seedRngRef.current : constraintRngRef.current ?? undefined;
            setCurrentLetters(generateLettersForChallenge("advanced", rng));
            setUsedWords(new Set());
          }
          if (isSurvivalRef.current) {
            startTimer(true);
          }
        }
      }, 500);
    } catch {
      playSound("wrong");
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
            {!groupSeed && (
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
            {isSurvival && (
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
          
          <div className="grid gap-3">
            {([1, 2, 3, 4, 5, "advanced"] as Challenge[]).map((c) => {
              const config = CHALLENGE_CONFIG[c];
              return (
                <Button
                  key={c}
                  onClick={() => selectChallenge(c)}
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

  if (gameStatus === "mode-select" && pendingChallenge !== null) {
    const config = CHALLENGE_CONFIG[pendingChallenge];
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {config.name}
            </Badge>
            <h3 className="text-xl font-bold">Choose Your Mode</h3>
            <p className="text-muted-foreground text-sm">
              How strict should the letter order be?
            </p>
          </div>

          <div className="grid gap-3">
            <Button
              onClick={() => startGame(pendingChallenge, false)}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
              data-testid="button-mode-unordered"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Unordered</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Letters can appear anywhere in the word — order doesn't matter
                </div>
              </div>
            </Button>

            <Button
              onClick={() => startGame(pendingChallenge, true)}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4 border-primary/50 hover:border-primary"
              data-testid="button-mode-ordered"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <AlignLeft className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-primary">Ordered</div>
                <div className="text-xs text-muted-foreground font-normal">
                  Letters must appear in the given order as a sequence
                </div>
              </div>
            </Button>
          </div>

          {initialChallenge === undefined && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goToMenu}
              className="w-full text-muted-foreground"
              data-testid="button-back-challenge-select"
            >
              ← Back to challenges
            </Button>
          )}
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
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-challenge">
            <Zap className="h-3.5 w-3.5" />
            {CHALLENGE_CONFIG[challenge].name}
          </Badge>
          <Badge variant={ordered ? "default" : "secondary"} className="gap-1.5" data-testid="badge-mode">
            {ordered ? <AlignLeft className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
            {ordered ? "Ordered" : "Unordered"}
          </Badge>
          <Badge variant="secondary" className="gap-1.5" data-testid="badge-progress">
            {wordsCompleted}/{wordsToComplete}
          </Badge>
          {isSurvivalRef.current && (
            <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/50" data-testid="badge-survival">
              <Flame className="h-3.5 w-3.5" />
              Survival
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={timeLeft <= (isSurvivalRef.current ? 3 : 30) ? "destructive" : "secondary"} className="gap-1.5" data-testid="badge-timer" role="timer" aria-label={`Time remaining: ${isSurvivalRef.current ? timeLeft + "s" : Math.floor(timeLeft / 60) + ":" + (timeLeft % 60).toString().padStart(2, "0")}`}>
            <Timer className="h-3.5 w-3.5" />
            {isSurvivalRef.current ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
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
                    <span>
                      {ordered
                        ? "Form words where these letters appear in order:"
                        : "Form words containing these letters:"}
                    </span>
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
                  {isSurvivalRef.current && (
                    <p className="text-xs text-muted-foreground">Correct answer resets the {survivalTime}s timer!</p>
                  )}
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter a word containing those letters..."
                      aria-label="Enter a word containing the required letters"
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
                {isSurvivalRef.current && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Flame className="h-3 w-3" />
                    Survival Mode
                  </Badge>
                )}
                <p className="text-muted-foreground">
                  You found {wordsCompleted} words!
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
                  gameName="Letter Hunt"
                  gameSlug={isSurvivalRef.current ? "letter-hunt-survival" : "letter-hunt"}
                  score={score}
                  wordsCompleted={wordsCompleted}
                  challengeName={CHALLENGE_CONFIG[challenge].name}
                  isWin={true}
                />
                {usedWords.size > 0 && (
                  <div className="text-left space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Words found</p>
                    <div className="flex flex-wrap gap-1.5 justify-center max-h-48 overflow-y-auto">
                      {Array.from(usedWords).map((word) => (
                        <Badge key={word} variant="secondary" className="font-mono text-xs" data-testid={`badge-word-${word}`}>
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!locked && (
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button onClick={() => startGame(challenge, ordered)} variant={challenge === "advanced" ? "default" : "outline"} data-testid="button-play-again">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Play Again
                    </Button>
                    {lastGameSeedRef.current !== null && (
                      <Button onClick={() => startGame(challenge, ordered, lastGameSeedRef.current!)} variant="outline" data-testid="button-replay-same">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Replay
                      </Button>
                    )}
                    {challenge !== "advanced" && getNextChallenge(challenge) && (
                      <Button onClick={() => selectChallenge(getNextChallenge(challenge)!)} data-testid="button-next-challenge">
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
                )}
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
                {isSurvivalRef.current && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Flame className="h-3 w-3" />
                    Survival Mode
                  </Badge>
                )}
                <p className="text-muted-foreground">
                  You found {wordsCompleted} words in {CHALLENGE_CONFIG[challenge].name}
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
                  gameName="Letter Hunt"
                  gameSlug={isSurvivalRef.current ? "letter-hunt-survival" : "letter-hunt"}
                  score={score}
                  wordsCompleted={wordsCompleted}
                  challengeName={CHALLENGE_CONFIG[challenge].name}
                  isWin={false}
                />
                {usedWords.size > 0 && (
                  <div className="text-left space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Words found</p>
                    <div className="flex flex-wrap gap-1.5 justify-center max-h-48 overflow-y-auto">
                      {Array.from(usedWords).map((word) => (
                        <Badge key={word} variant="secondary" className="font-mono text-xs" data-testid={`badge-word-${word}`}>
                          {word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!locked && (
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button onClick={() => startGame(challenge, ordered)} data-testid="button-play-again">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Play Again
                    </Button>
                    {lastGameSeedRef.current !== null && (
                      <Button onClick={() => startGame(challenge, ordered, lastGameSeedRef.current!)} variant="outline" data-testid="button-replay-same">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Replay
                      </Button>
                    )}
                    <Button onClick={goToMenu} variant="outline" data-testid="button-back-menu">
                      Back to Menu
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
