import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, Timer, Loader2, Ban, LogIn, Flame } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { makeSeededRng } from "@/lib/seeded-rng";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { WordExamplesPanel } from "@/components/word-examples-panel";

const DODGE_EXAMPLES_THRESHOLD = 3;
const DODGE_LETTER_POOL = ["E", "T", "A", "O", "I", "N", "S", "R", "H", "L", "D", "C", "U", "M", "F", "P", "G", "W", "Y", "B"];
const VOWELS_SET = new Set(["A", "E", "I", "O", "U"]);
const MAX_VOWELS = 3;

const GAME_TIME = 600;
const SURVIVAL_TIME = 8;
const MIN_WORD_LENGTH = 4;

type DodgeDifficulty = 1 | 2 | 3 | 4 | 5 | "savant" | "advanced";

const DIFFICULTY_CONFIG: Record<DodgeDifficulty, { name: string; description: string; count: number | "random"; stars: string }> = {
  1:        { name: "Easy",     description: "Avoid 1 forbidden letter",             count: 1,        stars: "★" },
  2:        { name: "Medium",   description: "Avoid 2 forbidden letters",            count: 2,        stars: "★★" },
  3:        { name: "Hard",     description: "Avoid 3 forbidden letters",            count: 3,        stars: "★★★" },
  4:        { name: "Expert",   description: "Avoid 4 forbidden letters",            count: 4,        stars: "★★★★" },
  5:        { name: "Master",   description: "Avoid 5 forbidden letters",            count: 5,        stars: "★★★★★" },
  savant:   { name: "Savant",   description: "Avoid 6–12 forbidden letters",         count: "random", stars: "★★★★★★" },
  advanced: { name: "Advanced", description: "Random forbidden letters each game!", count: "random", stars: "?" },
};

function pickForbiddenLetters(count: number, rng: () => number): string[] {
  const pool = [...DODGE_LETTER_POOL];
  const chosen: string[] = [];
  let vowelCount = 0;
  for (let i = 0; i < count && pool.length > 0; i++) {
    const available = vowelCount >= MAX_VOWELS ? pool.filter(l => !VOWELS_SET.has(l)) : pool;
    if (available.length === 0) break;
    const idx = Math.floor(rng() * available.length);
    const letter = available[idx];
    chosen.push(letter);
    if (VOWELS_SET.has(letter)) vowelCount++;
    pool.splice(pool.indexOf(letter), 1);
  }
  return chosen.sort();
}

function resolveForbiddenLetters(template: string[], rng: () => number): string[] {
  const pinned = template.filter(l => l !== "any");
  let vowelCount = pinned.filter(l => VOWELS_SET.has(l)).length;
  const available = [...DODGE_LETTER_POOL].filter(l => !pinned.includes(l));
  return template.map(l => {
    if (l !== "any") return l;
    const pool = vowelCount >= MAX_VOWELS ? available.filter(x => !VOWELS_SET.has(x)) : available;
    if (pool.length === 0) return null;
    const idx = Math.floor(rng() * pool.length);
    const picked = pool[idx];
    if (VOWELS_SET.has(picked)) vowelCount++;
    available.splice(available.indexOf(picked), 1);
    return picked;
  }).filter((l): l is string => l !== null).sort();
}

function getForbiddenInWord(word: string, forbidden: string[]): string[] {
  const upper = word.toUpperCase();
  return forbidden.filter((l) => upper.includes(l));
}

function scoreWord(word: string): number {
  const len = word.length;
  return len * 10 + (len >= 7 ? 20 : 0);
}

interface FoundWord {
  word: string;
  score: number;
}

export function LetterDodgeGame({
  groupSeed,
  locked,
  quizMode,
  customPlay,
  onGameEnd,
  onPlayAgain,
  initialDifficulty,
  initialSurvival,
  initialWordCount,
  initialTimeLimit,
  initialForbiddenLetters,
  isUntimed,
}: {
  groupSeed?: number;
  locked?: boolean;
  quizMode?: boolean;
  customPlay?: boolean;
  onGameEnd?: () => void;
  onPlayAgain?: () => void;
  initialDifficulty?: DodgeDifficulty;
  initialSurvival?: boolean;
  initialWordCount?: number;
  initialTimeLimit?: number;
  initialForbiddenLetters?: string[];
  isUntimed?: boolean;
} = {}) {
  const { playSound } = useSound();
  const [isSurvival, setIsSurvival] = useState(initialSurvival ?? false);
  const isSurvivalRef = useRef(false);

  const { reportResult, resetRecorded } = useGameResult({
    slug: isSurvival ? "letter-dodge-survival" : "letter-dodge",
    quizMode,
    isUntimed,
  });
  const personalBest = usePersonalBest(isSurvival ? "letter-dodge-survival" : "letter-dodge");
  const seedRngRef = useRef<(() => number) | undefined>(
    groupSeed !== undefined ? makeSeededRng(groupSeed) : undefined
  );

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [difficulty, setDifficulty] = useState<DodgeDifficulty>(1);
  const [forbiddenLetters, setForbiddenLetters] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [foundWords, setFoundWords] = useState<FoundWord[]>([]);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "finished">("menu");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [completionMessage, setCompletionMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef(0);
  const foundWordsRef = useRef<FoundWord[]>([]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((initialTime: number) => {
    stopTimer();
    setTimeLeft(initialTime);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          playSound("lose");
          setCompletionMessage(getCompletionMessage(scoreRef.current > 0));
          setGameStatus("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer, playSound]);

  const lastForbiddenLettersRef = useRef<string[]>([]);

  const startGame = useCallback(
    (d: DodgeDifficulty, overrideLetters?: string[]) => {
      resetRecorded();
      stopTimer();
      isSurvivalRef.current = isSurvival;
      setDifficulty(d);
      setScore(0);
      scoreRef.current = 0;
      setFoundWords([]);
      foundWordsRef.current = [];
      setUsedWords(new Set());
      setUserInput("");
      setFeedback(null);

      if (overrideLetters) {
        setForbiddenLetters(overrideLetters);
      } else {
        if (groupSeed !== undefined) {
          seedRngRef.current = makeSeededRng(groupSeed);
        }
        const rng = seedRngRef.current ?? Math.random;

        let chosen: string[];
        if (initialForbiddenLetters && initialForbiddenLetters.length > 0) {
          chosen = resolveForbiddenLetters(initialForbiddenLetters, rng);
        } else {
          const config = DIFFICULTY_CONFIG[d];
          let count: number;
          if (config.count === "random") {
            count = d === "savant" ? Math.floor(rng() * 7) + 6 : Math.floor(rng() * 5) + 1;
          } else {
            count = config.count;
          }
          chosen = pickForbiddenLetters(count, rng);
        }
        lastForbiddenLettersRef.current = chosen;
        setForbiddenLetters(chosen);
      }

      setGameStatus("playing");
      if (!isUntimed) startCountdown(isSurvival ? SURVIVAL_TIME : (initialTimeLimit ?? GAME_TIME));
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [stopTimer, startCountdown, resetRecorded, playSound, isSurvival, groupSeed, initialForbiddenLetters, initialTimeLimit, isUntimed]
  );

  useEffect(() => {
    if (gameStatus === "finished") {
      reportResult(scoreRef.current, scoreRef.current > 0, foundWordsRef.current.length);
      onGameEnd?.();
    }
  }, [gameStatus]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  useEffect(() => {
    if (groupSeed !== undefined) {
      seedRngRef.current = makeSeededRng(groupSeed);
      startGame(initialDifficulty ?? "advanced");
    } else if (locked) {
      startGame(initialDifficulty ?? "advanced");
    }
  }, [groupSeed, locked, initialDifficulty, startGame]);

  const checkAnswer = async () => {
    if (!userInput.trim() || gameStatus !== "playing") return;

    const upper = userInput.toUpperCase().trim();

    if (upper.length < MIN_WORD_LENGTH) {
      setFeedback({ type: "invalid", message: `Word must be at least ${MIN_WORD_LENGTH} letters!` });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    if (usedWords.has(upper)) {
      playSound("wrong");
      setFeedback({ type: "invalid", message: "Already used that word!" });
      setTimeout(() => setFeedback(null), 1500);
      inputRef.current?.focus();
      return;
    }

    const offenders = getForbiddenInWord(upper, forbiddenLetters);
    if (offenders.length > 0) {
      playSound("wrong");
      setFeedback({
        type: "wrong",
        message: `Contains forbidden letter${offenders.length > 1 ? "s" : ""}: ${offenders.join(", ")}`,
      });
      setTimeout(() => setFeedback(null), 1500);
      inputRef.current?.focus();
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(upper);
      if (!result.valid) {
        playSound("wrong");
        setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => setFeedback(null), 1500);
        inputRef.current?.focus();
        return;
      }

      const pts = scoreWord(upper);
      playSound("correct");
      const newWord: FoundWord = { word: upper, score: pts };
      setScore((prev) => {
        scoreRef.current = prev + pts;
        return prev + pts;
      });
      setFoundWords((prev) => {
        foundWordsRef.current = [newWord, ...prev];
        return foundWordsRef.current;
      });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upper)));
      setUserInput("");
      setFeedback({ type: "correct", message: `+${pts} pts!` });
      setTimeout(() => setFeedback(null), 800);

      // End game when word count target is reached (classic mode only)
      const wordsToComplete = initialWordCount ?? 100;
      if (!isSurvivalRef.current && foundWordsRef.current.length >= wordsToComplete) {
        stopTimer();
        setCompletionMessage(getCompletionMessage(true));
        setGameStatus("finished");
        return;
      }

      // Reset survival timer on correct word
      if (isSurvivalRef.current && !isUntimed) {
        startCountdown(SURVIVAL_TIME);
      }

      inputRef.current?.focus();
    } catch {
      setFeedback({ type: "invalid", message: "Error validating word" });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") checkAnswer();
  };

  const typedOffenders = getForbiddenInWord(userInput, forbiddenLetters);
  const currentSlug = isSurvivalRef.current ? "letter-dodge-survival" : "letter-dodge";

  // ─── MENU ────────────────────────────────────────────────────────────────────
  if (gameStatus === "menu") {
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <Ban className="h-12 w-12 mx-auto text-destructive" />
            <h3 className="text-xl font-bold">Choose Your Challenge</h3>
            <p className="text-muted-foreground text-sm">
              {isSurvival
                ? `${SURVIVAL_TIME}s per word — timer resets on each correct answer!`
                : "Type valid words that avoid the forbidden letters — 90 seconds on the clock!"}
            </p>

            {/* Classic / Survival toggle — hidden in seeded/locked/quiz/challenge sessions */}
            {!locked && groupSeed === undefined && (
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
                  Survival
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {([1, 2, 3, 4, 5, "savant", "advanced"] as DodgeDifficulty[]).map((d) => {
              const config = DIFFICULTY_CONFIG[d];
              return (
                <Button
                  key={d}
                  onClick={() => startGame(d)}
                  variant={d === "savant" || d === "advanced" ? "default" : "outline"}
                  className="w-full justify-start gap-3 h-auto py-3"
                  data-testid={`button-difficulty-${d}`}
                >
                  <Badge
                    variant={d === "advanced" ? "secondary" : "outline"}
                    className="shrink-0 min-w-[52px] justify-center font-mono"
                  >
                    {config.stars}
                  </Badge>
                  <div className="text-left">
                    <div className="font-semibold">{config.name}</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      {isSurvival
                        ? `${config.description} · ${SURVIVAL_TIME}s/word`
                        : config.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>

          {personalBest > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Personal best:{" "}
              <span className="font-semibold text-foreground">{personalBest} pts</span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ─── PLAYING ─────────────────────────────────────────────────────────────────
  if (gameStatus === "playing") {
    const isSurvivalActive = isSurvivalRef.current;
    return (
      <div className="space-y-4">
        {/* Timer + Score header */}
        <div className="flex items-center justify-center gap-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            {isUntimed ? (
              <Badge variant="outline" className="gap-1 text-blue-600 border-blue-400 text-xs" data-testid="badge-untimed">
                ∞ Untimed
              </Badge>
            ) : (
              <>
                {isSurvivalActive ? (
                  <Flame className="h-4 w-4 text-orange-500" />
                ) : (
                  <Timer className="h-4 w-4" />
                )}
                <span
                  className={`font-mono font-bold text-lg ${timeLeft <= (isSurvivalActive ? 3 : 10) ? "text-destructive animate-pulse" : ""}`}
                  data-testid="badge-timer"
                  role="timer"
                  aria-label={`Time remaining: ${isSurvivalActive ? timeLeft + "s" : Math.floor(timeLeft / 60) + ":" + (timeLeft % 60).toString().padStart(2, "0")}`}
                >
                  {isSurvivalActive ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
                </span>
                {isSurvivalActive && (
                  <Badge variant="outline" className="gap-1 text-orange-600 border-orange-400/50 text-xs" data-testid="badge-survival">
                    <Flame className="h-3 w-3" />
                    Survival
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Score</p>
            <AnimatedNumber value={score} className="text-2xl font-bold text-primary" data-testid="badge-score" />
          </div>
        </div>

        {!isUntimed && (isSurvivalActive ? (
          <Progress
            value={(timeLeft / SURVIVAL_TIME) * 100}
            className={`h-2 ${timeLeft <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-orange-500"}`}
          />
        ) : (
          <Progress value={(timeLeft / (initialTimeLimit ?? GAME_TIME)) * 100} className="h-1.5" />
        ))}

        {/* Forbidden letters */}
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-xs text-center font-semibold text-destructive mb-3 uppercase tracking-widest">
              Forbidden Letters — Do Not Use
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {forbiddenLetters.map((l) => (
                <motion.span
                  key={l}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-destructive text-destructive-foreground font-bold text-3xl shadow-md select-none"
                  data-testid={`badge-forbidden-${l}`}
                >
                  {l}
                </motion.span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Live word count strip */}
        <div className="flex items-center justify-center gap-2.5 py-1.5 border-t border-b border-border/50" data-testid="word-count-strip">
          <motion.span
            key={foundWords.length}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-2xl font-bold tabular-nums leading-none text-primary"
            data-testid="text-live-word-count"
          >
            {foundWords.length}
          </motion.span>
          <span className="text-sm text-muted-foreground leading-none">
            word{foundWords.length !== 1 ? "s" : ""} found
          </span>
          {personalBest > 0 && (
            <>
              <span className="text-muted-foreground/40 leading-none">·</span>
              <span className="text-sm text-muted-foreground leading-none">
                PB: <span className="font-semibold text-foreground" data-testid="text-personal-best">{personalBest}</span>
              </span>
            </>
          )}
        </div>

        {/* Input with per-character forbidden-letter highlighting */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div
              className={`relative flex-1 flex items-center rounded-md border bg-background transition-colors ${
                typedOffenders.length > 0
                  ? "border-destructive ring-1 ring-destructive"
                  : "border-input focus-within:ring-1 focus-within:ring-ring focus-within:border-ring"
              }`}
            >
              {/* Highlight layer */}
              <div
                aria-hidden
                className="absolute inset-0 flex items-center px-3 overflow-hidden pointer-events-none"
              >
                <span className="text-[1.125rem] font-mono uppercase leading-none whitespace-pre tracking-normal select-none">
                  {userInput.split("").map((char, i) => (
                    <span
                      key={i}
                      className={
                        forbiddenLetters.includes(char.toUpperCase())
                          ? "bg-destructive/25 text-transparent rounded-sm"
                          : "text-transparent"
                      }
                    >
                      {char}
                    </span>
                  ))}
                </span>
              </div>
              {/* Editable input */}
              <input
                ref={inputRef}
                value={userInput}
                onChange={(e) =>
                  setUserInput(e.target.value.replace(/[^a-zA-Z]/g, ""))
                }
                onKeyDown={handleKeyDown}
                placeholder="Type a word and press Enter…"
                className="relative w-full h-10 bg-transparent px-3 text-[1.125rem] uppercase font-mono outline-none placeholder:text-muted-foreground"
                maxLength={20}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-testid="input-word"
              />
            </div>
            <Button
              onClick={checkAnswer}
              disabled={!userInput.trim() || validateMutation.isPending}
              data-testid="button-submit"
            >
              {validateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Go"
              )}
            </Button>
          </div>

          {/* Live forbidden-letter warning */}
          <AnimatePresence>
            {typedOffenders.length > 0 && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-destructive flex items-center gap-1"
                data-testid="text-forbidden-warning"
              >
                <XCircle className="h-3 w-3 shrink-0" />
                Contains forbidden: {typedOffenders.join(", ")}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submission feedback */}
          <AnimatePresence>
            {feedback && (
              <motion.p
                key={feedback.message}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-sm font-medium flex items-center gap-1 ${
                  feedback.type === "correct"
                    ? "text-green-600 dark:text-green-400"
                    : "text-destructive"
                }`}
              >
                {feedback.type === "correct" ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                {feedback.message}
              </motion.p>
            )}
          </AnimatePresence>

          {isSurvivalActive && (
            <p className="text-xs text-muted-foreground text-center">
              Correct answer resets the {SURVIVAL_TIME}s timer!
            </p>
          )}
        </div>

        {/* Found words */}
        {foundWords.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Found words</p>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                <AnimatePresence>
                  {foundWords.map((fw, i) => (
                    <motion.div
                      key={`${fw.word}-${i}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1 bg-muted rounded-md px-2 py-0.5"
                      data-testid={`badge-word-${fw.word}`}
                    >
                      <span className="text-sm font-mono font-medium">{fw.word}</span>
                      <span className="text-xs text-muted-foreground">+{fw.score}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ─── FINISHED ────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="text-center space-y-2">
          <Trophy className="h-12 w-12 mx-auto text-primary" />
          <h3 className="text-2xl font-bold">{score} pts</h3>
          <p className="text-muted-foreground">{completionMessage}</p>
          {personalBest > 0 && score > personalBest && (
            <Badge className="bg-amber-500 text-white">New Personal Best!</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Words found</p>
            <p className="text-2xl font-bold">{foundWords.length}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Forbidden</p>
            <p className="text-lg font-bold font-mono tracking-widest text-destructive">
              {forbiddenLetters.join(" ")}
            </p>
          </div>
        </div>

        {foundWords.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Your words</p>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {foundWords.map((fw, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 bg-muted rounded-md px-2 py-0.5"
                >
                  <span className="text-sm font-mono font-medium">{fw.word}</span>
                  <span className="text-xs text-muted-foreground">+{fw.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {foundWords.length < DODGE_EXAMPLES_THRESHOLD && (
          <WordExamplesPanel
            game="letter-dodge"
            letters={forbiddenLetters}
          />
        )}

        {!user && (
          <div className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground space-y-2">
            <p>
              <LogIn className="h-4 w-4 inline mr-1" />
              Sign in to save your score to the leaderboard
            </p>
            <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)} data-testid="button-signin-prompt">
              Sign In
            </Button>
          </div>
        )}

        <ShareResults
          score={score}
          gameName="Letter Dodge"
          gameSlug={currentSlug}
          wordsCompleted={foundWords.length}
          isWin={score > 0}
          customPlay={customPlay}
        />

        {customPlay ? (
          <div className="flex justify-center">
            <Button
              onClick={() => onPlayAgain?.()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
              data-testid="button-play-again"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Play Again
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={() => startGame(difficulty, lastForbiddenLettersRef.current.length > 0 ? lastForbiddenLettersRef.current : undefined)}
              className="bg-sky-500 hover:bg-sky-600 text-white border-0"
              data-testid="button-replay"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Replay
            </Button>
            <Button
              onClick={() => startGame(difficulty)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white border-0"
              data-testid="button-play-again"
            >
              Play Again
            </Button>
            <Button
              onClick={() => setGameStatus("menu")}
              className="bg-amber-500 hover:bg-amber-600 text-white border-0"
              data-testid="button-main-menu"
            >
              Main Menu
            </Button>
            <TryAnotherGameButton currentSlug="letter-dodge" />
          </div>
        )}

        {authOpen && <AuthModal open={authOpen} onOpenChange={setAuthOpen} />}
      </CardContent>
    </Card>
  );
}
