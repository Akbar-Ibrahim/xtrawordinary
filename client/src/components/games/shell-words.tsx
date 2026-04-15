import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Timer,
  RotateCcw,
  CheckCircle2,
  XCircle,
  LogIn,
  Shell,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { AnimatedNumber } from "@/components/animated-number";
import { useGameResult } from "@/hooks/use-game-result";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { ShareResults } from "@/components/share-results";
import { getCompletionMessage } from "@/lib/completion-messages";

const BLITZ_TIME = 90;
const WRAPPER_TIME = 120;
const BLITZ_SLUG = "shell-words";
const WRAPPER_SLUG = "shell-words-guided";

type Mode = "blitz" | "wrapper";
type GameStatus = "idle" | "playing" | "ended";

interface FoundWord {
  outer: string;
  inner: string;
  points: number;
}

function blitzScore(outerLen: number): number {
  return 10 + outerLen * 2;
}

function wrapperScore(found: number, timeLeft: number): number {
  return found * 15 + timeLeft * 2;
}

export function ShellWordsGame({
  groupSeed,
  locked,
  initialMode,
}: { groupSeed?: number; locked?: boolean; initialMode?: Mode } = {}) {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const [mode, setMode] = useState<Mode>(initialMode ?? "blitz");
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [timeLeft, setTimeLeft] = useState(BLITZ_TIME);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [foundWords, setFoundWords] = useState<FoundWord[]>([]);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; message: string } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");

  const [puzzleMiddle, setPuzzleMiddle] = useState<string | null>(null);
  const [puzzleCount, setPuzzleCount] = useState<number>(0);
  const [puzzleSeed, setPuzzleSeed] = useState<number>(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSlug = mode === "blitz" ? BLITZ_SLUG : WRAPPER_SLUG;
  const { reportResult, resetRecorded } = useGameResult({ slug: activeSlug });

  const foundSet = useRef<Set<string>>(new Set());

  const clearFeedback = useCallback(() => {
    if (feedbackRef.current) clearTimeout(feedbackRef.current);
    feedbackRef.current = setTimeout(() => setFeedback(null), 1400);
  }, []);

  const endGame = useCallback(
    (finalScore: number, finalTimeLeft: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setGameStatus("ended");
      setCompletionMessage(getCompletionMessage(true));
      const actualScore =
        mode === "blitz" ? finalScore : wrapperScore(foundSet.current.size, finalTimeLeft);
      reportResult(actualScore, true, foundSet.current.size);
    },
    [mode, reportResult]
  );

  const startTimer = useCallback(
    (duration: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      let remaining = duration;
      setTimeLeft(remaining);
      timerRef.current = setInterval(() => {
        remaining -= 1;
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current!);
          setGameStatus((prev) => {
            if (prev === "playing") {
              setScore((s) => {
                endGame(s, 0);
                return s;
              });
            }
            return "ended";
          });
        }
      }, 1000);
    },
    [endGame]
  );

  const fetchPuzzle = useCallback(
    async (seed: number) => {
      const res = await fetch(`/api/games/shell-words/puzzle?seed=${seed}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch puzzle");
      return (await res.json()) as { middle: string; count: number };
    },
    []
  );

  const startGame = useCallback(async () => {
    resetRecorded();
    foundSet.current = new Set();
    setFoundWords([]);
    setScore(0);
    setInput("");
    setFeedback(null);
    setCompletionMessage("");

    if (mode === "wrapper") {
      const seed = groupSeed !== undefined ? groupSeed : Math.floor(Math.random() * 100000);
      setPuzzleSeed(seed);
      try {
        const puzzle = await fetchPuzzle(seed);
        setPuzzleMiddle(puzzle.middle);
        setPuzzleCount(puzzle.count);
      } catch {
        setFeedback({ type: "err", message: "Failed to load puzzle" });
        return;
      }
    }

    setGameStatus("playing");
    startTimer(mode === "blitz" ? BLITZ_TIME : WRAPPER_TIME);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [mode, groupSeed, fetchPuzzle, resetRecorded, startTimer]);

  const switchMode = useCallback(
    (m: Mode) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setMode(m);
      setGameStatus("idle");
      setScore(0);
      setFoundWords([]);
      setInput("");
      setFeedback(null);
      setCompletionMessage("");
      setPuzzleMiddle(null);
      foundSet.current = new Set();
      resetRecorded();
    },
    [resetRecorded]
  );

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isValidating || gameStatus !== "playing") return;
    const word = input.trim().toUpperCase();

    if (foundSet.current.has(word)) {
      setFeedback({ type: "err", message: "Already found!" });
      setInput("");
      clearFeedback();
      return;
    }

    setIsValidating(true);
    try {
      const res = await fetch(
        `/api/games/shell-words/validate?word=${encodeURIComponent(word)}`,
        { credentials: "include" }
      );
      const data = (await res.json()) as { valid: boolean; innerWord: string | null };

      if (!data.valid) {
        setFeedback({ type: "err", message: `${word} is not a valid shell word` });
        setInput("");
        clearFeedback();
        return;
      }

      if (mode === "wrapper") {
        if (data.innerWord !== puzzleMiddle) {
          setFeedback({
            type: "err",
            message: `${word} doesn't wrap "${puzzleMiddle}"`,
          });
          setInput("");
          clearFeedback();
          return;
        }
      }

      foundSet.current.add(word);
      const pts = mode === "blitz" ? blitzScore(word.length) : 0;

      setFoundWords((prev) => [
        { outer: word, inner: data.innerWord!, points: pts },
        ...prev,
      ]);
      setScore((s) => s + pts);
      setFeedback({ type: "ok", message: `+${mode === "blitz" ? pts : 1} ${mode === "blitz" ? "pts" : "found"}` });
      setInput("");
      clearFeedback();

      if (mode === "wrapper" && foundSet.current.size >= puzzleCount && puzzleCount > 0) {
        endGame(0, timeLeft);
      }
    } catch {
      setFeedback({ type: "err", message: "Connection error" });
      clearFeedback();
    } finally {
      setIsValidating(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [
    input,
    isValidating,
    gameStatus,
    mode,
    puzzleMiddle,
    puzzleCount,
    timeLeft,
    clearFeedback,
    endGame,
  ]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackRef.current) clearTimeout(feedbackRef.current);
    };
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const timerWarning = timeLeft <= 10 && gameStatus === "playing";

  return (
    <>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Mode tabs — hidden when mode is pre-selected by daily/group context */}
          {!initialMode && (
            <div className="flex gap-2">
              {(["blitz", "wrapper"] as Mode[]).map((m) => (
                <Button
                  key={m}
                  variant={mode === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchMode(m)}
                  disabled={gameStatus === "playing"}
                  data-testid={`button-mode-${m}`}
                  className="capitalize"
                >
                  {m === "blitz" ? "Blitz (90s)" : "Wrapper (2min)"}
                </Button>
              ))}
            </div>
          )}

          {/* Header: timer + score */}
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center gap-2 text-lg font-mono font-bold ${timerWarning ? "text-destructive animate-pulse" : ""}`}
              data-testid="text-timer"
            >
              <Timer className="h-5 w-5" />
              {gameStatus === "idle"
                ? formatTime(mode === "blitz" ? BLITZ_TIME : WRAPPER_TIME)
                : formatTime(timeLeft)}
            </div>
            <div className="flex items-center gap-2">
              {mode === "blitz" ? (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Score</div>
                  <div className="font-bold text-lg" data-testid="text-score">
                    <AnimatedNumber value={score} />
                  </div>
                </div>
              ) : (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Found</div>
                  <div className="font-bold text-lg" data-testid="text-found">
                    {foundWords.length}
                    {puzzleCount > 0 && (
                      <span className="text-muted-foreground text-sm font-normal">
                        {" "}/ {puzzleCount}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Idle state */}
          {gameStatus === "idle" && (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <Shell className="h-12 w-12 text-muted-foreground" />
              </div>
              {mode === "blitz" ? (
                <div className="space-y-1">
                  <p className="font-medium">Blitz Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Enter shell words — words where removing the first and last letter reveals
                    another valid word. You have 90 seconds!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Score: 10 + (word length × 2) per word
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-medium">Wrapper Mode</p>
                  <p className="text-sm text-muted-foreground">
                    You'll be given an inner word. Find all outer words that wrap around it by
                    adding one letter to each end. You have 2 minutes!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Score: 15 per wrapper + 2 per second remaining
                  </p>
                </div>
              )}
              <Button onClick={startGame} size="lg" data-testid="button-start-game">
                Start Game
              </Button>
            </div>
          )}

          {/* Playing state */}
          {gameStatus === "playing" && (
            <div className="space-y-4">
              {/* Wrapper: show middle word */}
              {mode === "wrapper" && puzzleMiddle && (
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Find words that wrap:</div>
                  <div
                    className="text-3xl font-bold tracking-widest"
                    data-testid="text-middle-word"
                  >
                    {puzzleMiddle}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    e.g. __{puzzleMiddle}__ (add one letter on each end)
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder={
                    mode === "blitz"
                      ? "Type a shell word..."
                      : `Type a word wrapping "${puzzleMiddle}"...`
                  }
                  className="font-mono uppercase tracking-wider"
                  disabled={isValidating}
                  data-testid="input-word"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={isValidating || !input.trim()}
                  data-testid="button-submit"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Feedback */}
              <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`text-sm font-medium text-center ${
                      feedback.type === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive"
                    }`}
                    data-testid="text-feedback"
                  >
                    {feedback.type === "ok" ? (
                      <span className="flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> {feedback.message}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1">
                        <XCircle className="h-4 w-4" /> {feedback.message}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              </div>

              {/* End Game button */}
              {!locked && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => endGame(score, timeLeft)}
                    data-testid="button-end-game"
                  >
                    End Game
                  </Button>
                </div>
              )}

              {/* Found words list */}
              <div className="h-52 overflow-y-auto space-y-2 border rounded-lg p-3">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Found ({foundWords.length})
                </div>
                {foundWords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center pt-6">
                    Your found words will appear here
                  </p>
                ) : (
                  <AnimatePresence initial={false}>
                    {foundWords.map((fw, i) => (
                      <motion.div
                        key={fw.outer}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 border"
                        data-testid={`item-found-${i}`}
                      >
                        <div className="font-mono text-sm">
                          <span className="text-muted-foreground">{fw.outer[0]}</span>
                          <span className="text-foreground font-bold">{fw.inner}</span>
                          <span className="text-muted-foreground">{fw.outer[fw.outer.length - 1]}</span>
                          <span className="text-muted-foreground ml-2">→ {fw.inner}</span>
                        </div>
                        {mode === "blitz" && (
                          <Badge variant="secondary" className="text-xs">
                            +{fw.points}
                          </Badge>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          )}

          {/* Ended state */}
          {gameStatus === "ended" && (
            <div className="text-center space-y-4 py-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring" }}
              >
                <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
                <h3 className="text-xl font-bold">Game Over!</h3>
              </motion.div>

              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                {mode === "blitz" ? (
                  <>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <div className="text-2xl font-bold" data-testid="text-final-score">
                        {score}
                      </div>
                      <div className="text-xs text-muted-foreground">Score</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <div className="text-2xl font-bold">{foundWords.length}</div>
                      <div className="text-xs text-muted-foreground">Words Found</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <div className="text-2xl font-bold" data-testid="text-final-score">
                        {wrapperScore(foundWords.length, timeLeft)}
                      </div>
                      <div className="text-xs text-muted-foreground">Score</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <div className="text-2xl font-bold">
                        {foundWords.length}/{puzzleCount}
                      </div>
                      <div className="text-xs text-muted-foreground">Wrappers Found</div>
                    </div>
                  </>
                )}
              </div>

              {/* Found words recap */}
              {foundWords.length > 0 && (
                <div className="text-left space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground font-medium mb-2">
                    Words you found:
                  </div>
                  {foundWords.map((fw) => (
                    <div key={fw.outer} className="font-mono text-sm">
                      <span className="text-muted-foreground">{fw.outer[0]}</span>
                      <span className="font-bold">{fw.inner}</span>
                      <span className="text-muted-foreground">{fw.outer[fw.outer.length - 1]}</span>
                      <span className="text-muted-foreground"> → {fw.inner}</span>
                    </div>
                  ))}
                </div>
              )}

              {completionMessage && (
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">
                  {completionMessage}
                </p>
              )}

              <ShareResults
                gameName={mode === "blitz" ? "Shell Words" : "Shell Words: Wrapper"}
                gameSlug={activeSlug}
                score={mode === "blitz" ? score : wrapperScore(foundWords.length, timeLeft)}
                wordsCompleted={foundWords.length}
                isWin
              />

              {!user && (
                <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>
                    <button
                      className="underline font-medium"
                      onClick={() => setAuthOpen(true)}
                      data-testid="button-sign-in-cta"
                    >
                      Sign in
                    </button>{" "}
                    to save your score to the leaderboard!
                  </span>
                </div>
              )}

              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => switchMode(mode)}
                  data-testid="button-play-again"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Play Again
                </Button>
                {!locked && <TryAnotherGameButton currentSlug={activeSlug} />}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
