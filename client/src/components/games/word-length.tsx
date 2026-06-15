import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, Loader2, ArrowRight, Menu, Flame, LogIn } from "lucide-react";
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
import { makeSeededRng } from "@/lib/seeded-rng";
import { TryAnotherGameButton } from "@/components/try-another-game-button";

const SURVIVAL_TIME_PER_WORD = 8;
const SURVIVAL_TIME_OPTIONS = [
  { label: "Easy",   seconds: 15 },
  { label: "Normal", seconds: 8  },
  { label: "Hard",   seconds: 5  },
] as const;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ENDS_WITH_ALPHABET = ALPHABET.filter(l => !["J", "Q", "X", "V", "Z"].includes(l));
const COMMON_START_ALPHABET = ALPHABET.filter(l => !["Q", "X", "Z"].includes(l));
const COMMON_INTERIOR_ALPHABET = ALPHABET.filter(l => !["J", "Q", "X", "Z"].includes(l));

type LevelConstraint = {
  length: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

function pickFrom(pool: string[], rng: () => number): string {
  return pool[Math.floor(rng() * pool.length)];
}

function pickFromExcluding(pool: string[], exclude: string, rng: () => number): string {
  const filtered = pool.filter(l => l !== exclude);
  return filtered[Math.floor(rng() * filtered.length)];
}

function generateConstraint(variation: number, rng: () => number = Math.random): LevelConstraint {
  switch (variation) {
    case 1: {
      const length = Math.floor(rng() * 6) + 3;
      return { length };
    }
    case 2: {
      const length = Math.floor(rng() * 6) + 3;
      const startPool = length <= 4 ? COMMON_START_ALPHABET : ALPHABET;
      return { length, startsWith: pickFrom(startPool, rng) };
    }
    case 3: {
      const length = Math.floor(rng() * 6) + 3;
      return { length, endsWith: pickFrom(ENDS_WITH_ALPHABET, rng) };
    }
    case 4: {
      const length = Math.floor(rng() * 5) + 4;
      const startsWith = pickFrom(COMMON_START_ALPHABET, rng);
      const contains = pickFromExcluding(COMMON_INTERIOR_ALPHABET, startsWith, rng);
      return { length, startsWith, contains };
    }
    case 5: {
      const length = Math.floor(rng() * 5) + 4;
      const endsWith = pickFrom(ENDS_WITH_ALPHABET, rng);
      const contains = pickFromExcluding(COMMON_INTERIOR_ALPHABET, endsWith, rng);
      return { length, endsWith, contains };
    }
    default: {
      const length = Math.floor(rng() * 6) + 3;
      return { length };
    }
  }
}

const variationDescriptions = [
  "Form {length}-letter words",
  "Form {length}-letter words starting with '{startsWith}'",
  "Form {length}-letter words ending with '{endsWith}'",
  "Form {length}-letter words starting with '{startsWith}' with '{contains}' inside (not at end)",
  "Form {length}-letter words ending with '{endsWith}' with '{contains}' inside (not at start)"
];

const variationOptions = [
  { id: 1, name: "Length Only", description: "Form words of a specific length" },
  { id: 2, name: "Starts With", description: "Same length + must start with a specific letter" },
  { id: 3, name: "Ends With", description: "Same length + must end with a specific letter" },
  { id: 4, name: "Starts & Contains", description: "Same length + starts with letter + contains letter" },
  { id: 5, name: "Ends & Contains", description: "Same length + ends with letter + contains letter" },
];

function formatConstraint(variation: number, constraint: LevelConstraint): string {
  let desc = variationDescriptions[variation - 1];
  desc = desc.replace("{length}", String(constraint.length));
  if (constraint.startsWith) desc = desc.replace("{startsWith}", constraint.startsWith);
  if (constraint.endsWith) desc = desc.replace("{endsWith}", constraint.endsWith);
  if (constraint.contains) desc = desc.replace("{contains}", constraint.contains);
  return desc;
}

function formatCustomConstraint(constraint: LevelConstraint): string {
  const parts: string[] = [`${constraint.length}-letter words`];
  if (constraint.startsWith) parts.push(`starting with '${constraint.startsWith}'`);
  if (constraint.endsWith) parts.push(`ending with '${constraint.endsWith}'`);
  if (constraint.contains) parts.push(`containing '${constraint.contains}'`);
  return parts.join(", ");
}

function validateConstraint(word: string, constraint: LevelConstraint, variation: number): { valid: boolean; message: string } {
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
  if (constraint.contains) {
    const containsLetter = constraint.contains;
    const middlePart = variation === 4 
      ? upperWord.slice(0, -1)
      : variation === 5 
        ? upperWord.slice(1)
        : upperWord;
    
    if (!middlePart.includes(containsLetter)) {
      const positionHint = variation === 4 ? " (not just at the end)" : variation === 5 ? " (not just at the start)" : "";
      return { valid: false, message: `Word must contain '${containsLetter}'${positionHint}` };
    }
  }
  return { valid: true, message: "" };
}

export function WordLengthGame({ initialChallenge, initialVariation, customConstraint, groupSeed, locked, quizMode, customPlay, initialSurvival, initialWordCount, initialTimeLimit, onGameEnd, onPlayAgain }: { initialChallenge?: number; initialVariation?: 1 | 2 | 3 | 4 | 5; customConstraint?: LevelConstraint; groupSeed?: number; locked?: boolean; quizMode?: boolean; customPlay?: boolean; initialSurvival?: boolean; initialWordCount?: number; initialTimeLimit?: number; onGameEnd?: () => void; onPlayAgain?: () => void } = {}) {
  const resolvedInitialChallenge = initialVariation ?? initialChallenge;
  const { playSound } = useSound();
  const [isSurvival, setIsSurvival] = useState(initialSurvival ?? false);
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME_PER_WORD);
  const { reportResult, resetRecorded } = useGameResult({
    slug: isSurvival ? "word-length-survival" : "word-length",
    quizMode,
  });
  const personalBest = usePersonalBest(isSurvival ? "word-length-survival" : "word-length");
  const seedRngRef = useRef<(() => number) | undefined>(
    groupSeed !== undefined ? makeSeededRng(groupSeed) : undefined
  );
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [variation, setVariation] = useState<number>(1);
  const [constraint, setConstraint] = useState<LevelConstraint | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSurvivalRef = useRef(false);

  const wordsPerVariation = initialWordCount ?? 100;
  const timePerVariation = initialTimeLimit ?? 600;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((survivalMode: boolean) => {
    stopTimer();
    const initialTime = survivalMode ? survivalTime : timePerVariation;
    setTimeLeft(initialTime);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          playSound("lose");
          setCompletionMessage(getCompletionMessage(false));
          setGameStatus("lost");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer, timePerVariation, survivalTime]);

  const lastConstraintRef = useRef<LevelConstraint | null>(null);

  const startGame = useCallback((varId: number, survival: boolean, pinnedConstraint?: LevelConstraint) => {
    resetRecorded();
    stopTimer();
    isSurvivalRef.current = survival;
    setIsSurvival(survival);
    setVariation(varId);
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    const chosenConstraint = pinnedConstraint ?? generateConstraint(varId, seedRngRef.current);
    lastConstraintRef.current = chosenConstraint;
    setConstraint(chosenConstraint);
    setGameStatus("playing");
    startTimer(survival);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [stopTimer, startTimer, resetRecorded]);

  useEffect(() => {
    if (customConstraint) {
      startGame(1, initialSurvival ?? false, customConstraint);
    } else if (resolvedInitialChallenge !== undefined) {
      startGame(resolvedInitialChallenge, initialSurvival ?? false);
    }
  }, []);

  useEffect(() => {
    if (gameStatus === "won" || gameStatus === "lost") {
      const isCompetitive = !isSurvivalRef.current || survivalTime === SURVIVAL_TIME_PER_WORD;
      if (isCompetitive) {
        reportResult(score, gameStatus === "won", wordsCompleted);
      }
      onGameEnd?.();
    }
  }, [gameStatus, score, reportResult, wordsCompleted, survivalTime]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const checkAnswer = async () => {
    if (!userInput.trim() || !constraint) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 1500);
      return;
    }

    const constraintCheck = validateConstraint(upperWord, constraint, variation);
    if (!constraintCheck.valid) {
      playSound("wrong");
      setStreak(0);
        setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 1500);
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(upperWord);
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

      playSound("correct");
      setStreak(prev => prev + 1);
        setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      setScore((prev) => prev + 100 + variation * 20);
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");
      inputRef.current?.focus();

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsPerVariation) {
          stopTimer();
          playSound("win");
          setCompletionMessage(getCompletionMessage(true));
          setGameStatus("won");
        } else {
          if (isSurvivalRef.current) {
            startTimer(true);
          }
          inputRef.current?.focus();
        }
      }, 500);
    } catch {
      playSound("wrong");
      setFeedback({ type: "invalid", message: "Error validating word" });
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 1500);
    }
  };

  if (gameStatus === "menu") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-center mb-4">Choose Your Challenge</h3>
            {!groupSeed && (
              <div className="flex items-center justify-center gap-2 mb-6">
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
                <div className="flex items-center justify-center gap-2 mb-2">
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
                <p className="text-xs text-center text-muted-foreground mb-4">
                  {survivalTime}s per word — timer resets on each correct answer!
                </p>
              </>
            )}
            <div className="grid gap-3">
              {variationOptions.map((option) => (
                <motion.div
                  key={option.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 px-6 flex flex-col items-start text-left gap-1"
                    onClick={() => startGame(option.id, isSurvival)}
                    data-testid={`button-var-${option.id}`}
                  >
                    <span className="font-semibold">Variation {option.id}: {option.name}</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      {option.description}
                    </span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
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
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-variation">
            <Zap className="h-3.5 w-3.5" />
            {customConstraint ? "Custom" : `Variation ${variation}`}
          </Badge>
          {isSurvival && (
            <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/50" data-testid="badge-survival">
              <Flame className="h-3.5 w-3.5" />
              Survival
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={timeLeft <= (isSurvival ? 3 : 30) ? "destructive" : "secondary"} className="gap-1.5" data-testid="badge-timer" role="timer" aria-label={`Time remaining: ${isSurvival ? timeLeft + "s" : Math.floor(timeLeft / 60) + ":" + (timeLeft % 60).toString().padStart(2, "0")}`}>
            <Timer className="h-3.5 w-3.5" />
            {isSurvival ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
          </Badge>
          {!locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { stopTimer(); setGameStatus("menu"); }}
              className="gap-1.5"
              data-testid="button-restart"
            >
              <RotateCcw className="h-4 w-4" />
              Back to Menu
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
                  <Badge variant="secondary" className="text-sm" data-testid="badge-constraint">
                    {constraint && (customConstraint ? formatCustomConstraint(constraint) : formatConstraint(variation, constraint))}
                  </Badge>
                  <Progress value={(wordsCompleted / wordsPerVariation) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {wordsCompleted} / {wordsPerVariation} words
                  </p>
                  {isSurvival && (
                    <p className="text-xs text-muted-foreground">Correct answer resets the {survivalTime}s timer!</p>
                  )}
                </div>

                <div className="max-w-md mx-auto space-y-4">
                  <div className="flex justify-center gap-2">
                    {constraint && Array.from({ length: constraint.length }).map((_, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 border-2 border-primary/30 rounded flex items-center justify-center text-xl font-bold bg-primary/5"
                        data-testid={`letter-box-${i}`}
                      >
                        {userInput[i]?.toUpperCase() || ""}
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      checkAnswer();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                      placeholder={`Enter a ${constraint?.length || 5}-letter word...`}
                      aria-label="Enter your word"
                      className="text-center text-lg uppercase"
                      maxLength={constraint?.length || 8}
                      disabled={validateMutation.isPending}
                      data-testid="input-word"
                    />
                    <Button
                      type="submit"
                      disabled={!userInput.trim() || validateMutation.isPending}
                      data-testid="button-submit"
                    >
                      {validateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Submit"
                      )}
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
                              : "text-destructive"
                          }`}
                        >
                          {feedback.type === "correct" ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                          <span className="font-medium" data-testid="text-feedback">{feedback.message}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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
                {isSurvival && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Flame className="h-3 w-3" />
                    Survival Mode
                  </Badge>
                )}
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? (customConstraint ? "You completed the custom challenge!" : `You completed Variation ${variation}!`)
                    : `You completed ${wordsCompleted} words`}
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
                  gameName="Length Challenge"
                  gameSlug={isSurvival ? "word-length-survival" : "word-length"}
                  score={score}
                  wordsCompleted={wordsCompleted}
                  isWin={gameStatus === "won"}
                  customPlay={customPlay}
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
                {customPlay && (
                  <div className="flex justify-center">
                    <Button onClick={() => onPlayAgain?.()} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Play Again
                    </Button>
                  </div>
                )}
                {!locked && !customPlay && (
                  <>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button 
                        onClick={() => startGame(variation, isSurvival, lastConstraintRef.current ?? undefined)} 
                        className="bg-sky-500 hover:bg-sky-600 text-white border-0"
                        data-testid="button-replay"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Replay
                      </Button>
                      <Button 
                        onClick={() => startGame(variation, isSurvival)} 
                        className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                        data-testid="button-play-again"
                      >
                        Play Again
                      </Button>
                      <Button 
                        onClick={() => { stopTimer(); setGameStatus("menu"); }} 
                        className="bg-amber-500 hover:bg-amber-600 text-white border-0"
                        data-testid="button-main-menu"
                      >
                        Main Menu
                      </Button>
                      <TryAnotherGameButton currentSlug="word-length" />
                    </div>
                    {gameStatus === "won" && variation < 5 && (
                      <div className="flex justify-center">
                        <Button 
                          onClick={() => startGame(variation + 1, isSurvival)} 
                          variant="outline"
                          className="gap-1.5"
                          data-testid="button-next-challenge"
                        >
                          Next Challenge
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
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
