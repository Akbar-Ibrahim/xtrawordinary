import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, RefreshCw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, MapPin, Menu, Flame, LogIn } from "lucide-react";
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
const POSITION_ALPHABET = ALPHABET.filter(l => !["J", "Q", "X", "V", "Z"].includes(l));

// Max sensible position per letter — rarer letters are capped lower
// so players never get near-impossible constraints like "B at position 8"
const LETTER_MAX_POSITION: Record<string, number> = {
  E: 8, S: 8, T: 8, R: 8, N: 8, L: 8,   // very common — any position
  A: 7, O: 7, I: 7, D: 7, C: 7,           // common — up to 7
  H: 6, M: 6, F: 6, P: 6, U: 6,           // moderate — up to 6
  G: 5, W: 5, B: 5, Y: 5, K: 5,           // less common — up to 5
};

// Position weights biased toward 1–5; higher positions are possible but rare
const POSITION_WEIGHTS = [5, 5, 5, 5, 4, 3, 2, 1];

type Challenge = 1 | 2;

type PositionConstraint = {
  position: number;
  letter: string;
};

const CHALLENGE_CONFIG: Record<Challenge, { name: string; description: string; changesPerWord: boolean }> = {
  1: { name: "Challenge 1", description: "Same position & letter for all words", changesPerWord: false },
  2: { name: "Challenge 2", description: "Position & letter change after each word!", changesPerWord: true },
};

function generateRandomConstraint(rng: () => number = Math.random): PositionConstraint {
  const letter = POSITION_ALPHABET[Math.floor(rng() * POSITION_ALPHABET.length)];
  const maxPos = LETTER_MAX_POSITION[letter] ?? 6;
  const weights = POSITION_WEIGHTS.slice(0, maxPos);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let pick = rng() * totalWeight;
  let position = 1;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) { position = i + 1; break; }
  }
  return { position, letter };
}

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

export function LetterPositionGame({ initialChallenge, groupSeed, locked, initialLetter, initialPosition, quizMode, customPlay, initialSurvival, initialWordCount, initialTimeLimit, onGameEnd, onPlayAgain }: { initialChallenge?: Challenge; groupSeed?: number; locked?: boolean; initialLetter?: string; initialPosition?: number; quizMode?: boolean; customPlay?: boolean; initialSurvival?: boolean; initialWordCount?: number; initialTimeLimit?: number; onGameEnd?: () => void; onPlayAgain?: () => void } = {}) {
  const { playSound } = useSound();
  const [isSurvival, setIsSurvival] = useState(initialSurvival ?? false);
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME_PER_WORD);
  const { reportResult, resetRecorded } = useGameResult({
    slug: isSurvival ? "letter-position-survival" : "letter-position",
    quizMode,
  });
  const personalBest = usePersonalBest(isSurvival ? "letter-position-survival" : "letter-position");
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
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [constraint, setConstraint] = useState<PositionConstraint | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSurvivalRef = useRef(false);
  const lastGameSeedRef = useRef<number | null>(null);
  const constraintRngRef = useRef<(() => number) | null>(null);

  const wordsPerChallenge = initialWordCount ?? 100;
  const timePerChallenge = initialTimeLimit ?? 600;

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

  const startGame = useCallback((c: Challenge, survival: boolean, seedOverride?: number) => {
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

    let constraintRng: () => number;
    if (groupSeed !== undefined) {
      constraintRng = seedRngRef.current!;
    } else {
      const seed = seedOverride ?? Math.floor(Math.random() * 1_000_000_000);
      lastGameSeedRef.current = seed;
      const rng = makeSeededRng(seed);
      constraintRngRef.current = rng;
      constraintRng = rng;
    }

    const fixedConstraint = (initialLetter && initialPosition)
      ? { letter: initialLetter.toUpperCase(), position: initialPosition }
      : null;
    setConstraint(fixedConstraint ?? generateRandomConstraint(constraintRng));
    setGameStatus("playing");
    startTimer(survival);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [startTimer, stopTimer, resetRecorded, initialLetter, initialPosition]);

  useEffect(() => {
    if (initialChallenge !== undefined) {
      startGame(initialChallenge, initialSurvival ?? false);
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
      onGameEnd?.();
    }
  }, [gameStatus, score, reportResult, wordsCompleted, survivalTime]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const checkAnswer = async () => {
    if (!userInput.trim() || !constraint) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      inputRef.current?.focus();
      return;
    }

    const constraintCheck = validateConstraint(upperWord, constraint);
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

      playSound("correct");
      setStreak(prev => prev + 1);
        setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      
      const challengeBonus = challenge * 30;
      setScore((prev) => prev + 100 + challengeBonus);
      
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");
      inputRef.current?.focus();

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsPerChallenge) {
          stopTimer();
          playSound("win");
          setCompletionMessage(getCompletionMessage(true));
          setGameStatus("won");
        } else {
          if (CHALLENGE_CONFIG[challenge].changesPerWord) {
            const rng = groupSeed !== undefined ? seedRngRef.current : constraintRngRef.current ?? undefined;
            setConstraint(generateRandomConstraint(rng));
          }
          if (isSurvivalRef.current) {
            startTimer(true);
          }
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

  const getNextChallenge = (current: Challenge): Challenge | null => {
    if (current === 2) return null;
    return 2;
  };

  if (gameStatus === "menu") {
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <MapPin className="h-12 w-12 mx-auto text-primary" />
            <h3 className="text-xl font-bold">Choose Your Challenge</h3>
            <p className="text-muted-foreground text-sm">
              Find words with the right letter at the right position!
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
            {([1, 2] as Challenge[]).map((c) => {
              const config = CHALLENGE_CONFIG[c];
              return (
                <Button
                  key={c}
                  onClick={() => startGame(c, isSurvival)}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  data-testid={`button-challenge-${c}`}
                >
                  <Badge variant="outline" className="shrink-0">
                    {c}
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
            <AnimatedNumber value={score} /> pts
          </Badge>
          <StreakIndicator streak={streak} />
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-challenge">
            <Zap className="h-3.5 w-3.5" />
            {CHALLENGE_CONFIG[challenge].name}
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
          <Button
            variant="outline"
            size="sm"
            onClick={goToMenu}
            className="gap-1.5"
            data-testid="button-menu"
          >
            <Menu className="h-4 w-4" />
            Menu
          </Button>
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
                  <Progress value={(wordsCompleted / wordsPerChallenge) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {wordsCompleted} / {wordsPerChallenge} words
                  </p>
                  {CHALLENGE_CONFIG[challenge].changesPerWord && (
                    <Badge variant="secondary" className="text-xs">
                      Constraint changes after each word!
                    </Badge>
                  )}
                  {isSurvival && (
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
                <h3 className="text-2xl font-bold">Position Master!</h3>
                {isSurvival && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Flame className="h-3 w-3" />
                    Survival Mode
                  </Badge>
                )}
                <p className="text-muted-foreground">
                  You completed {CHALLENGE_CONFIG[challenge].name}!
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
                  gameName="Position Master"
                  gameSlug={isSurvival ? "letter-position-survival" : "letter-position"}
                  score={score}
                  wordsCompleted={wordsCompleted}
                  challengeName={CHALLENGE_CONFIG[challenge].name}
                  isWin={true}
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
                      {lastGameSeedRef.current !== null && (
                        <Button onClick={() => startGame(challenge, isSurvival, lastGameSeedRef.current!)} className="bg-sky-500 hover:bg-sky-600 text-white border-0" data-testid="button-replay-same">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Replay
                        </Button>
                      )}
                      <Button onClick={() => startGame(challenge, isSurvival)} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Play Again
                      </Button>
                      <Button onClick={goToMenu} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                        Main Menu
                      </Button>
                      <TryAnotherGameButton currentSlug="letter-position" />
                    </div>
                    {getNextChallenge(challenge) && (
                      <div className="flex justify-center">
                        <Button onClick={() => startGame(getNextChallenge(challenge)!, isSurvival)} variant="outline" className="gap-2" data-testid="button-next-challenge">
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
                {isSurvival && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Flame className="h-3 w-3" />
                    Survival Mode
                  </Badge>
                )}
                <p className="text-muted-foreground">
                  You completed {wordsCompleted} words in {CHALLENGE_CONFIG[challenge].name}
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
                  gameName="Position Master"
                  gameSlug={isSurvival ? "letter-position-survival" : "letter-position"}
                  score={score}
                  wordsCompleted={wordsCompleted}
                  challengeName={CHALLENGE_CONFIG[challenge].name}
                  isWin={false}
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
                  <div className="flex flex-wrap justify-center gap-2">
                    {lastGameSeedRef.current !== null && (
                      <Button onClick={() => startGame(challenge, isSurvival, lastGameSeedRef.current!)} className="bg-sky-500 hover:bg-sky-600 text-white border-0" data-testid="button-replay-same">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Replay
                      </Button>
                    )}
                    <Button onClick={() => startGame(challenge, isSurvival)} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Play Again
                    </Button>
                    <Button onClick={goToMenu} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                      Main Menu
                    </Button>
                    <TryAnotherGameButton currentSlug="letter-position" />
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
