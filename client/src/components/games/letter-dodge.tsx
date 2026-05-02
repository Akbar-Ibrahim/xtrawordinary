import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, Timer, Loader2, Ban, LogIn } from "lucide-react";
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

// Common English letters as the forbidden pool — rare letters would make the game too easy
const DODGE_LETTER_POOL = ["E", "T", "A", "O", "I", "N", "S", "R", "H", "L", "D", "C", "U", "M", "F", "P", "G", "W", "Y", "B"];

const GAME_TIME = 90;

type DodgeDifficulty = 1 | 2 | 3 | 4 | 5 | "advanced";

const DIFFICULTY_CONFIG: Record<DodgeDifficulty, { name: string; description: string; count: number | "random"; stars: string }> = {
  1:        { name: "Easy",     description: "Avoid 1 forbidden letter",              count: 1,        stars: "★" },
  2:        { name: "Medium",   description: "Avoid 2 forbidden letters",             count: 2,        stars: "★★" },
  3:        { name: "Hard",     description: "Avoid 3 forbidden letters",             count: 3,        stars: "★★★" },
  4:        { name: "Expert",   description: "Avoid 4 forbidden letters",             count: 4,        stars: "★★★★" },
  5:        { name: "Master",   description: "Avoid 5 forbidden letters",             count: 5,        stars: "★★★★★" },
  advanced: { name: "Advanced", description: "Random forbidden letters each game!",  count: "random", stars: "?" },
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
}: { groupSeed?: number; locked?: boolean; quizMode?: boolean } = {}) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded } = useGameResult({ slug: "letter-dodge", quizMode });
  const personalBest = usePersonalBest("letter-dodge");
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

  const startGame = useCallback(
    (d: DodgeDifficulty) => {
      resetRecorded();
      stopTimer();
      setDifficulty(d);
      setScore(0);
      scoreRef.current = 0;
      setFoundWords([]);
      foundWordsRef.current = [];
      setUsedWords(new Set());
      setUserInput("");
      setFeedback(null);
      setTimeLeft(GAME_TIME);

      const rng = seedRngRef.current ?? Math.random;
      const config = DIFFICULTY_CONFIG[d];
      const count = config.count === "random" ? Math.floor(rng() * 5) + 1 : config.count;
      const letters = pickForbiddenLetters(count, rng);
      setForbiddenLetters(letters);

      setGameStatus("playing");

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

      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [stopTimer, resetRecorded, playSound]
  );

  // Report result once game finishes
  useEffect(() => {
    if (gameStatus === "finished") {
      reportResult(scoreRef.current, scoreRef.current > 0, foundWordsRef.current.length);
    }
  }, [gameStatus]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // Auto-start if groupSeed provided (seeded / quiz / challenge mode)
  // Re-derive RNG and restart whenever groupSeed changes so challenge/group-round
  // play always uses the correct deterministic constraint.
  useEffect(() => {
    if (groupSeed !== undefined) {
      seedRngRef.current = makeSeededRng(groupSeed);
      startGame(3); // default to "Hard" for seeded play
    }
  }, [groupSeed, startGame]);

  const checkAnswer = async () => {
    if (!userInput.trim() || gameStatus !== "playing") return;

    const upper = userInput.toUpperCase().trim();

    if (upper.length < 3) {
      setFeedback({ type: "invalid", message: "Word must be at least 3 letters!" });
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

  // ─── MENU ────────────────────────────────────────────────────────────────────
  if (gameStatus === "menu") {
    return (
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <Ban className="h-12 w-12 mx-auto text-destructive" />
            <h3 className="text-xl font-bold">Choose Your Challenge</h3>
            <p className="text-muted-foreground text-sm">
              Type valid words that avoid the forbidden letters — 90 seconds on the clock!
            </p>
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
                    <div className="text-xs text-muted-foreground font-normal">{config.description}</div>
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
    return (
      <div className="space-y-4">
        {/* Timer + Score header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span
              className={`font-mono font-bold text-lg ${timeLeft <= 10 ? "text-destructive animate-pulse" : ""}`}
            >
              {timeLeft}s
            </span>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Score</p>
            <AnimatedNumber value={score} className="text-2xl font-bold text-primary" />
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {foundWords.length} word{foundWords.length !== 1 ? "s" : ""}
          </div>
        </div>

        <Progress value={(timeLeft / GAME_TIME) * 100} className="h-1.5" />

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
            {/*
              Mirror-div pattern: a transparent native input sits on top of a highlight
              layer that renders colored backgrounds under each forbidden character.
              Both use identical font/size/padding so characters line up precisely.
            */}
            <div
              className={`relative flex-1 flex items-center rounded-md border bg-background transition-colors ${
                typedOffenders.length > 0
                  ? "border-destructive ring-1 ring-destructive"
                  : "border-input focus-within:ring-1 focus-within:ring-ring focus-within:border-ring"
              }`}
            >
              {/* Highlight layer — transparent text, coloured bg on forbidden chars */}
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
              {/* Actual editable input — bg transparent so highlight shows through */}
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
            className="flex-1 gap-2"
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
          gameSlug="letter-dodge"
          wordsCompleted={foundWords.length}
          isWin={score > 0}
        />

        <TryAnotherGameButton currentSlug="letter-dodge" />

        {authOpen && <AuthModal open={authOpen} onOpenChange={setAuthOpen} />}
      </CardContent>
    </Card>
  );
}
