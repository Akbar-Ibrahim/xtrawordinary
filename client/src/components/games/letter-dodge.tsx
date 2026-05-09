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

const DODGE_LETTER_POOL = ["E", "T", "A", "O", "I", "N", "S", "R", "H", "L", "D", "C", "U", "M", "F", "P", "G", "W", "Y", "B"];

const GAME_TIME = 90;
const SURVIVAL_TIME = 8;
const MIN_WORD_LENGTH = 4;

type DodgeDifficulty = 1 | 2 | 3 | 4 | 5 | "advanced";

const DIFFICULTY_CONFIG: Record<DodgeDifficulty, { name: string; description: string; count: number | "random"; stars: string }> = {
  1:        { name: "Easy",     description: "Avoid 1 forbidden letter",             count: 1,        stars: "★" },
  2:        { name: "Medium",   description: "Avoid 2 forbidden letters",            count: 2,        stars: "★★" },
  3:        { name: "Hard",     description: "Avoid 3 forbidden letters",            count: 3,        stars: "★★★" },
  4:        { name: "Expert",   description: "Avoid 4 forbidden letters",            count: 4,        stars: "★★★★" },
  5:        { name: "Master",   description: "Avoid 5 forbidden letters",            count: 5,        stars: "★★★★★" },
  advanced: { name: "Advanced", description: "Random forbidden letters each game!", count: "random", stars: "?" },
};

function pickForbiddenLetters(count: number, rng: () => number): string[] {
  const pool = [...DODGE_LETTER_POOL];
  const chosen: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return chosen.sort();
}

function resolveForbiddenLetters(template: string[], rng: () => number): string[] {
  const pinned = template.filter(l => l !== "any");
  const available = [...DODGE_LETTER_POOL].filter(l => !pinned.includes(l));
  return template.map(l => {
    if (l !== "any") return l;
    if (available.length === 0) return null;
    const idx = Math.floor(rng() * available.length);
    return available.splice(idx, 1)[0];
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
  onGameEnd,
  initialDifficulty,
  initialSurvival,
  initialWordCount,
  initialTimeLimit,
  initialForbiddenLetters,
}: {
  groupSeed?: number;
  locked?: boolean;
  quizMode?: boolean;
  onGameEnd?: () => void;
  initialDifficulty?: DodgeDifficulty;
  initialSurvival?: boolean;
  initialWordCount?: number;
  initialTimeLimit?: number;
  initialForbiddenLetters?: string[];
} = {}) {
  const { playSound } = useSound();
  const [isSurvival, setIsSurvival] = useState(initialSurvival ?? false);
  const isSurvivalRef = useRef(false);

  const { reportResult, resetRecorded } = useGameResult({
    slug: isSurvival ? "letter-dodge-survival" : "letter-dodge",
    quizMode,
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

  const startGame = useCallback(
    (d: DodgeDifficulty) => {
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

      if (groupSeed !== undefined) {
        seedRngRef.current = makeSeededRng(groupSeed);
      }
      const rng = seedRngRef.current ?? Math.random;

      if (initialForbiddenLetters && initialForbiddenLetters.length > 0) {
        setForbiddenLetters(resolveForbiddenLetters(initialForbiddenLetters, rng));
      } else {
        const config = DIFFICULTY_CONFIG[d];
        const count = config.count === "random" ? Math.floor(rng() * 5) + 1 : config.count;
        setForbiddenLetters(pickForbiddenLetters(count, rng));
      }

      setGameStatus("playing");
      startCountdown(isSurvival ? SURVIVAL_TIME : (initialTimeLimit ?? GAME_TIME));
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [stopTimer, startCountdown, resetRecorded, playSound, isSurvival, groupSeed, initialForbiddenLetters, initialTimeLimit]
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
      if (!isSurvivalRef.current && initialWordCount && foundWordsRef.current.length >= initialWordCount) {
        stopTimer();
        setCompletionMessage(getCompletionMessage(true));
        setGameStatus("finished");
        return;
      }

      // Reset survival timer on correct word
      if (isSurvivalRef.current) {
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
            {([1, 2, 3, 4, 5, "advanced"] as DodgeDifficulty[]).map((d) => {
              const config = DIFFICULTY_CONFIG[d];
              return (
                <Button
                  key={d}
                  onClick={() => startGame(d)}
                  variant={d === "advanced" ? "default" : "outline"}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {isSurvivalActive ? (
              <Flame className="h-4 w-4 text-orange-500" />
            ) : (
              <Timer className="h-4 w-4" />
            )}
            <span
              className={`font-mono font-bold text-lg ${timeLeft <= (isSurvivalActive ? 3 : 10) ? "text-destructive animate-pulse" : ""}`}
            >
              {timeLeft}s
            </span>
            {isSurvivalActive && (
              <Badge variant="outline" className="gap-1 text-orange-600 border-orange-400/50 text-xs" data-testid="badge-survival">
                <Flame className="h-3 w-3" />
                Survival
              </Badge>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Score</p>
            <AnimatedNumber value={score} className="text-2xl font-bold text-primary" />
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {foundWords.length} word{foundWords.length !== 1 ? "s" : ""}
          </div>
        </div>

        {isSurvivalActive ? (
          <Progress
            value={(timeLeft / SURVIVAL_TIME) * 100}
            className={`h-2 ${timeLeft <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-orange-500"}`}
          />
        ) : (
          <Progress value={(timeLeft / (initialTimeLimit ?? GAME_TIME)) * 100} className="h-1.5" />
        )}

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

        <div className="flex gap-2">
          <Button
            onClick={() => startGame(difficulty)}
            className="flex-1 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-0"
            data-testid="button-play-again"
          >
            <RotateCcw className="h-4 w-4" />
            Play Again
          </Button>
          <Button
            onClick={() => setGameStatus("menu")}
            variant="outline"
            className="flex-1"
            data-testid="button-change-difficulty"
          >
            Change Difficulty
          </Button>
        </div>

        <ShareResults
          score={score}
          gameName="Letter Dodge"
          gameSlug={currentSlug}
          wordsCompleted={foundWords.length}
          isWin={score > 0}
        />

        <TryAnotherGameButton currentSlug="letter-dodge" />

        {authOpen && <AuthModal open={authOpen} onOpenChange={setAuthOpen} />}
      </CardContent>
    </Card>
  );
}
