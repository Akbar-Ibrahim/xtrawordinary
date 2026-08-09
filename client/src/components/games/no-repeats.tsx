import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw, CheckCircle, XCircle, Timer, Loader2, RefreshCw,
} from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { makeSeededRng } from "@/lib/seeded-rng";
import { useAuth } from "@/lib/auth-context";
import {
  type Challenge,
  CHALLENGE_CONFIG,
  SURVIVAL_TIME_PER_WORD,
  SURVIVAL_TIME_OPTIONS,
  hasUniqueLetters,
  getNextChallenge,
  generateRequiredLetters,
  validateRequiredLetters,
} from "./no-repeats-helpers";
import { NoRepeatsMenu }   from "./no-repeats-menu";
import { NoRepeatsResult } from "./no-repeats-result";

const DEFAULT_WORDS_PER_CHALLENGE = 15;
const timePerChallenge  = 600;

export function NoRepeatsGame({
  initialChallenge,
  locked,
  groupSeed,
  isUntimed,
  initialRequiredLetters,
  initialTimeLimit,
  wordTarget,
  customPlay,
  quizMode,
}: {
  initialChallenge?: Challenge;
  locked?: boolean;
  groupSeed?: number;
  isUntimed?: boolean;
  initialRequiredLetters?: string[];
  initialTimeLimit?: number;
  wordTarget?: number;
  initialSurvival?: boolean;
  customPlay?: boolean;
  quizMode?: boolean;
} = {}) {
  const { playSound }                       = useSound();
  const { user }                            = useAuth();
  const [, navigate]                        = useLocation();
  const [authOpen, setAuthOpen]             = useState(false);

  const [isSurvival, setIsSurvival]         = useState(false);
  const [survivalTime, setSurvivalTime]     = useState(SURVIVAL_TIME_PER_WORD);
  const isSurvivalRef                       = useRef(false);

  const { reportResult, resetRecorded } = useGameResult({
    slug: isSurvival ? "no-repeats-survival" : "no-repeats",
    isUntimed,
  });
  const personalBest = usePersonalBest(isSurvival ? "no-repeats-survival" : "no-repeats");

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const res = await apiRequest("POST", "/api/games/validate-word", { word });
      return res.json() as Promise<WordValidationResponse>;
    },
  });

  // ── Core game state ────────────────────────────────────────────────────────
  const [challenge, setChallenge]           = useState<Challenge>(initialChallenge ?? 3);
  const [gameStatus, setGameStatus]         = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [userInput, setUserInput]           = useState("");
  const [score, setScore]                   = useState(0);
  const [streak, setStreak]                 = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft]             = useState(timePerChallenge);
  const [feedback, setFeedback]             = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords]           = useState<Set<string>>(new Set());
  const [completionMessage, setCompletionMessage] = useState("");

  // ── Required letters state ─────────────────────────────────────────────────
  const [requiredLetters, setRequiredLetters] = useState<string[]>([]);
  const [rerollsUsed, setRerollsUsed]         = useState(0);
  const [playMode, setPlayMode]               = useState<"free" | "restricted">("restricted");
  const rngRef                                = useRef<(() => number) | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Timer helpers ──────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (survivalMode: boolean) => {
      stopTimer();
      const initial = survivalMode ? survivalTime : (initialTimeLimit ?? timePerChallenge);
      setTimeLeft(initial);
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
    },
    [stopTimer, survivalTime, playSound],
  );

  // ── Start game ─────────────────────────────────────────────────────────────
  const startGame = useCallback(
    (c: Challenge, survival: boolean) => {
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
      setRerollsUsed(0);

      // Build the RNG — seeded in group/locked contexts so all players see the same letters
      let rng: () => number;
      if (groupSeed !== undefined) {
        rng = makeSeededRng(groupSeed + c);
      } else {
        const seed = Math.floor(Math.random() * 1_000_000_000);
        rng = makeSeededRng(seed);
      }
      rngRef.current = rng;
      // If pinned required letters were passed, overlay them on top of the seeded base
      if (initialRequiredLetters && initialRequiredLetters.length > 0) {
        const base = generateRequiredLetters(c, rng);
        const resolved = base.map((b, i) => {
          const pinned = initialRequiredLetters[i];
          return (pinned && pinned !== "any") ? pinned.toUpperCase() : b;
        });
        setRequiredLetters(resolved);
      } else if (playMode === "free" && groupSeed === undefined) {
        setRequiredLetters([]);
      } else {
        setRequiredLetters(generateRequiredLetters(c, rng));
      }

      setGameStatus("playing");
      if (!isUntimed) startTimer(survival);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [stopTimer, startTimer, resetRecorded, groupSeed, isUntimed, playMode],
  );

  // ── Reroll required letters (1 use per session, disabled when locked/seeded) ─
  const handleReroll = useCallback(() => {
    if (rerollsUsed >= 1 || locked || groupSeed !== undefined) return;
    setRequiredLetters(generateRequiredLetters(challenge));
    setRerollsUsed((prev) => prev + 1);
  }, [rerollsUsed, locked, groupSeed, challenge]);

  // ── Return to menu ─────────────────────────────────────────────────────────
  const returnToMenu = useCallback(() => {
    stopTimer();
    setGameStatus("menu");
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    setRequiredLetters([]);
    setRerollsUsed(0);
  }, [stopTimer]);

  // ── Auto-start when initialChallenge / groupSeed provided ─────────────────
  useEffect(() => {
    if (groupSeed !== undefined) {
      // initialChallenge takes priority; fall back to seed-derived level
      const level = initialChallenge ?? ((3 + (groupSeed % 7)) as Challenge);
      startGame(level, initialSurvival ?? false);
    } else if (initialChallenge !== undefined) {
      startGame(initialChallenge, initialSurvival ?? false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Report result on game end ──────────────────────────────────────────────
  useEffect(() => {
    if (gameStatus === "won" || gameStatus === "lost") {
      const isCompetitive = !isSurvivalRef.current || survivalTime === SURVIVAL_TIME_PER_WORD;
      if (isCompetitive) reportResult(score, gameStatus === "won", wordsCompleted);
    }
  }, [gameStatus, score, reportResult, wordsCompleted, survivalTime]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (validateMutation.isPending) return;
    const word   = userInput.trim().toUpperCase();
    const config = CHALLENGE_CONFIG[challenge];
    if (!word) return;

    // 1. Length
    if (word.length !== config.wordLength) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "wrong", message: `Word must be exactly ${config.wordLength} letters` });
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    // 2. Isogram check
    if (!hasUniqueLetters(word)) {
      const counts: Record<string, number> = {};
      for (const l of word) counts[l] = (counts[l] || 0) + 1;
      const repeated = Object.entries(counts).filter(([, n]) => n > 1).map(([l]) => l);
      playSound("wrong");
      setStreak(0);
      setFeedback({
        type: "wrong",
        message: `Letter${repeated.length > 1 ? "s" : ""} '${repeated.join("', '")}' repeated — all letters must be unique!`,
      });
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    // 3. Required-letters check
    if (requiredLetters.length > 0) {
      const reqCheck = validateRequiredLetters(word, requiredLetters);
      if (!reqCheck.valid) {
        playSound("wrong");
        setStreak(0);
        setFeedback({ type: "wrong", message: reqCheck.message });
        setTimeout(() => setFeedback(null), 2000);
        return;
      }
    }

    // 4. Already used
    if (usedWords.has(word)) {
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "wrong", message: "You already used this word!" });
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    // 5. Dictionary check
    try {
      const result = await validateMutation.mutateAsync(word);
      if (result.valid) {
        const wordScore     = config.wordLength * 10;
        const newCompleted  = wordsCompleted + 1;
        setScore((prev) => prev + wordScore);
        setStreak((prev) => prev + 1);
        setWordsCompleted(newCompleted);
        setUsedWords((prev) => new Set([...prev, word]));
        playSound("correct");
        setFeedback({ type: "correct", message: `+${wordScore} points!` });
        setUserInput("");
        inputRef.current?.focus();

        if (newCompleted >= (wordTarget ?? DEFAULT_WORDS_PER_CHALLENGE)) {
          stopTimer();
          playSound("win");
          setCompletionMessage(getCompletionMessage(true));
          setGameStatus("won");
        } else if (isSurvivalRef.current && !isUntimed) {
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

  // ── Render: menu ───────────────────────────────────────────────────────────
  if (gameStatus === "menu") {
    return (
      <>
        <NoRepeatsMenu
          isSurvival={isSurvival}
          setIsSurvival={setIsSurvival}
          survivalTime={survivalTime}
          setSurvivalTime={setSurvivalTime}
          isUntimed={isUntimed}
          onStartGame={(c) => startGame(c, isSurvival)}
          playMode={playMode}
          onPlayModeChange={setPlayMode}
          showModeToggle={!locked && groupSeed === undefined}
        />
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  // ── Render: result ─────────────────────────────────────────────────────────
  if (gameStatus === "won" || gameStatus === "lost") {
    const next = getNextChallenge(challenge);
    return (
      <>
        <NoRepeatsResult
          gameStatus={gameStatus}
          isSurvival={isSurvival}
          wordsCompleted={wordsCompleted}
          score={score}
          personalBest={personalBest}
          usedWords={usedWords}
          completionMessage={completionMessage}
          challenge={challenge}
          nextChallenge={next}
          requiredLetters={requiredLetters}
          locked={locked}
          isSignedIn={!!user}
          onPlayAgain={() => startGame(challenge, isSurvival)}
          onMenu={returnToMenu}
          onNextChallenge={() => next && startGame(next, isSurvival)}
          onSignIn={() => setAuthOpen(true)}
        />
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  // ── Render: playing screen ─────────────────────────────────────────────────
  const config   = CHALLENGE_CONFIG[challenge];
  const progress = (wordsCompleted / (wordTarget ?? DEFAULT_WORDS_PER_CHALLENGE)) * 100;
  const canReroll = rerollsUsed < 1 && !locked && groupSeed === undefined && playMode === "restricted";

  return (
    <div className="space-y-6">
      {/* Timer / score strip */}
      <div className="flex items-center justify-center gap-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isUntimed ? (
            <Badge variant="outline" className="gap-1 text-blue-600 border-blue-400 text-xs" data-testid="badge-untimed">
              ∞ Untimed
            </Badge>
          ) : (
            <>
              <Timer
                className={`h-4 w-4 ${timeLeft <= (isSurvival ? 3 : 30) ? "text-destructive animate-pulse" : ""}`}
              />
              <span
                className={`font-mono font-bold text-lg ${timeLeft <= (isSurvival ? 3 : 30) ? "text-destructive animate-pulse" : ""}`}
                data-testid="badge-timer"
                role="timer"
                aria-label={`Time remaining: ${isSurvival ? timeLeft + "s" : Math.floor(timeLeft / 60) + ":" + (timeLeft % 60).toString().padStart(2, "0")}`}
              >
                {isSurvival
                  ? `${timeLeft}s`
                  : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
              </span>
              {isSurvival && (
                <Badge variant="outline" className="gap-1 text-destructive border-destructive/50 text-xs" data-testid="badge-survival">
                  ∞
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
        <CardContent className="p-6 space-y-5">
          {/* Challenge label */}
          <div className="text-center">
            <Badge variant="secondary" className="text-xs" data-testid="badge-current-challenge">
              {config.name}
            </Badge>
          </div>

          {/* Required letters */}
          <div className="text-center space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Must contain
            </p>
            <div className="flex items-center justify-center gap-3">
              <motion.div
                key={requiredLetters.join("")}
                className="flex justify-center gap-2"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {requiredLetters.map((letter, idx) => (
                  <motion.div
                    key={`${letter}-${idx}`}
                    initial={{ opacity: 0, rotateY: 90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="w-12 h-12 flex items-center justify-center text-xl font-bold rounded-lg bg-primary text-primary-foreground shadow-sm select-none"
                    data-testid={`required-letter-${idx}`}
                  >
                    {letter}
                  </motion.div>
                ))}
              </motion.div>

              {/* Reroll button — hidden when locked or already used */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReroll}
                disabled={!canReroll}
                title={canReroll ? "Reroll required letters (1 use)" : "Reroll already used"}
                className="gap-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                data-testid="button-reroll"
              >
                <RefreshCw className="h-4 w-4" />
                {rerollsUsed >= 1 ? "Used" : "Reroll"}
              </Button>
            </div>
          </div>

          {/* Word-length slots */}
          <div className="space-y-1 text-center">
            <p className="text-sm text-muted-foreground">
              Find a <strong>{config.wordLength}-letter</strong> isogram containing all required letters
            </p>
            {isSurvival && (
              <p className="text-xs text-muted-foreground">
                Correct answer resets the {survivalTime}s timer!
              </p>
            )}
            <div className="flex justify-center gap-1.5 pt-1">
              {Array.from({ length: config.wordLength }).map((_, i) => {
                const typedLetter = userInput[i]?.toUpperCase() || "";
                const isRequired  = requiredLetters.includes(typedLetter);
                return (
                  <div
                    key={i}
                    className={`w-10 h-10 border-2 rounded flex items-center justify-center text-lg font-bold transition-colors
                      ${typedLetter
                        ? isRequired
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-primary/40 bg-primary/5"
                        : "border-border/50 bg-muted/30"}`}
                  >
                    {typedLetter}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Word-count strip */}
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
              Goal:{" "}
              <span className="font-semibold text-foreground">{wordTarget ?? DEFAULT_WORDS_PER_CHALLENGE}</span>
            </span>
            <span className="text-muted-foreground/40 leading-none">·</span>
            <span className="text-sm text-muted-foreground leading-none">
              PB:{" "}
              <span className="font-semibold text-foreground" data-testid="text-personal-best">
                {personalBest > 0 ? personalBest : "—"}
              </span>
            </span>
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
            className="flex gap-2 max-w-md mx-auto"
          >
            <Input
              ref={inputRef}
              value={userInput}
              onChange={(e) =>
                setUserInput(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
              }
              placeholder={`Enter a ${config.wordLength}-letter isogram…`}
              aria-label="Enter your word"
              className="text-center text-lg uppercase"
              maxLength={config.wordLength}
              data-testid="input-word"
            />
            <Button type="submit" disabled={validateMutation.isPending} data-testid="button-submit">
              {validateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
            </Button>
          </form>

          {/* Feedback */}
          <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
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
                  <span className="font-medium text-sm" data-testid="text-feedback">
                    {feedback.message}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Menu / End Game */}
          <div className="flex items-center justify-center gap-3 pt-1 border-t border-border/40">
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
                onClick={() => {
                  stopTimer();
                  setCompletionMessage(getCompletionMessage(false));
                  setGameStatus("lost");
                }}
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

      {/* Words found */}
      {usedWords.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Words Found:</h3>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {Array.from(usedWords).map((word) => (
                <Badge key={word} variant="outline" data-testid={`badge-found-word-${word}`}>
                  {word}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
