import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Timer, CheckCircle, XCircle, Loader2, LogIn } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { AnagramWordSet } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { makeSeededRng } from "@/lib/seeded-rng";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { useLocation } from "wouter";

export function AnagramSolverGame({ groupSeed, locked, quizMode, customWords }: { groupSeed?: number; locked?: boolean; quizMode?: boolean; customWords?: AnagramWordSet[] } = {}) {
  const { playSound } = useSound();
  const [, navigate] = useLocation();
  const { reportResult, resetRecorded } = useGameResult({ slug: "anagram-solver", quizMode });
  const personalBest = usePersonalBest("anagram-solver");
  const seeded = groupSeed !== undefined;
  const hasCustomWords = customWords && customWords.length > 0;
  const seedRngRef = useRef<(() => number) | undefined>(
    seeded ? makeSeededRng(groupSeed!) : undefined
  );
  const { data: fetchedWordSets = [], isLoading, error } = useQuery<AnagramWordSet[]>({
    queryKey: seeded ? ["/api/games/anagram-solver/words", groupSeed] : ["/api/games/anagram-solver/words"],
    ...(seeded ? { queryFn: async () => { const r = await fetch(`/api/games/anagram-solver/words?seed=${groupSeed}`, { credentials: "include" }); return r.json(); } } : {}),
    enabled: !hasCustomWords,
    refetchOnMount: seeded ? false : "always",
    gcTime: 0,
  });
  const wordSets = hasCustomWords ? customWords! : fetchedWordSets;

  const [activeWordSets, setActiveWordSets] = useState<AnagramWordSet[]>([]);
  const [currentSet, setCurrentSet] = useState<AnagramWordSet | null>(null);
  const [userInput, setUserInput] = useState("");
  const [wordsSolved, setWordsSolved] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "timeup">("playing");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong"; message: string } | null>(null);
  const [usedSets, setUsedSets] = useState<Set<number>>(new Set());
  const [completionMessage, setCompletionMessage] = useState("");
  const [solvedWords, setSolvedWords] = useState<string[]>([]);
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectNewWord = useCallback(() => {
    const availableIndices = activeWordSets.map((_, i) => i).filter(i => !usedSets.has(i));
    if (availableIndices.length === 0) {
      playSound("win");
      setGameStatus("won");
      setCompletionMessage(getCompletionMessage(true));
      return;
    }
    const rng = seedRngRef.current ?? Math.random;
    const randomIndex = availableIndices[Math.floor(rng() * availableIndices.length)];
    const newSet = activeWordSets[randomIndex];
    setCurrentSet(newSet);
    setUserInput("");
    setUsedSets(prev => new Set(Array.from(prev).concat(randomIndex)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedSets, activeWordSets]);

  const lastSetRef = useRef<(typeof wordSets)[0] | null>(null);

  const initGame = useCallback((overrideSet?: (typeof wordSets)[0]) => {
    if (wordSets.length === 0) return;
    resetRecorded();
    setActiveWordSets(wordSets);
    setScore(0);
    setStreak(0);
    setTimeLeft(90);
    setGameStatus("playing");
    setUsedSets(new Set());
    setWordsSolved(0);
    setSolvedWords([]);
    const rng = seedRngRef.current ?? Math.random;
    const randomIndex = Math.floor(rng() * wordSets.length);
    const newSet = overrideSet ?? wordSets[randomIndex];
    lastSetRef.current = newSet;
    setCurrentSet(newSet);
    setUserInput("");
    const idx = overrideSet ? wordSets.findIndex(s => s === overrideSet) : randomIndex;
    setUsedSets(new Set([idx >= 0 ? idx : 0]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [wordSets, resetRecorded]);

  useEffect(() => {
    if (wordSets.length > 0 && !currentSet) {
      initGame();
    }
  }, [wordSets, currentSet, initGame]);

  useEffect(() => {
    if (gameStatus === "won") {
      reportResult(score, true, wordsSolved);
    } else if (gameStatus === "timeup") {
      reportResult(score, false, wordsSolved);
    }
  }, [gameStatus, score, reportResult, wordsSolved]);

  useEffect(() => {
    if (gameStatus !== "playing") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameStatus("timeup");
          setCompletionMessage(getCompletionMessage(false));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameStatus]);

  const checkAnswer = () => {
    if (!currentSet || !userInput.trim()) return;
    
    const upperInput = userInput.toUpperCase().trim();
    
    if (currentSet.anagrams.includes(upperInput)) {
      playSound("correct");
      setFeedback({ type: "correct", message: "Correct!" });
      setWordsSolved(prev => prev + 1);
      setSolvedWords(prev => [...prev, currentSet.original]);
      setScore(prev => prev + 100 + (streak * 10));
      setStreak(prev => prev + 1);
      setUserInput("");
      
      setTimeout(() => {
        setFeedback(null);
        selectNewWord();
      }, 500);
    } else {
      playSound("wrong");
      setFeedback({ type: "wrong", message: "Not a valid anagram!" });
      setStreak(0);
      setTimeout(() => setFeedback(null), 1000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkAnswer();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-destructive">Failed to load game data</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!currentSet) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Timer className={`h-4 w-4 ${timeLeft <= 10 ? "text-destructive animate-pulse" : ""}`} />
          <span
            className={`font-mono font-bold text-lg ${timeLeft <= 10 ? "text-destructive animate-pulse" : ""}`}
            data-testid="badge-timer"
            role="timer"
            aria-label={`Time remaining: ${formatTime(timeLeft)}`}
          >
            {formatTime(timeLeft)}
          </span>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Score</p>
          <div className="flex items-center justify-center gap-1.5">
            <AnimatedNumber value={score} className="text-2xl font-bold text-primary" data-testid="badge-score" />
            <StreakIndicator streak={streak} />
          </div>
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
                  <p className="text-sm text-muted-foreground">
                    Enter any anagram of this word to advance
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2.5 py-1.5 border-t border-b border-border/50" data-testid="word-count-strip">
                  <motion.span
                    key={wordsSolved}
                    initial={{ scale: 1.4 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-2xl font-bold tabular-nums leading-none text-primary"
                    data-testid="text-live-word-count"
                  >
                    {wordsSolved}
                  </motion.span>
                  <span className="text-sm text-muted-foreground leading-none">
                    / {activeWordSets.length} solved
                  </span>
                  <span className="text-muted-foreground/40 leading-none">·</span>
                  <span className="text-sm text-muted-foreground leading-none">
                    PB: <span className="font-semibold text-foreground">{personalBest > 0 ? personalBest : "—"}</span>
                  </span>
                </div>

                <motion.div
                  key={currentSet.original}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex justify-center gap-2 flex-wrap"
                >
                  {currentSet.original.split("").map((letter, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, rotateY: 90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="w-12 h-14 sm:w-14 sm:h-16 flex items-center justify-center text-2xl font-bold rounded-md bg-primary text-primary-foreground"
                      data-testid={`letter-${index}`}
                    >
                      {letter.toUpperCase()}
                    </motion.div>
                  ))}
                </motion.div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Type an anagram..."
                      aria-label="Type an anagram"
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback?.type === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback?.type === "wrong"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
                      data-testid="input-anagram"
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
                    disabled={!userInput.trim()}
                    className="w-full"
                    data-testid="button-submit"
                  >
                    Submit
                  </Button>
                </div>
                {!locked && (
                  <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => initGame()}
                      data-testid="button-menu"
                    >
                      Menu
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setGameStatus("timeup"); setCompletionMessage(getCompletionMessage(false)); }}
                      data-testid="button-end-game"
                    >
                      End Game
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className={gameStatus === "won" ? "border-accent" : "border-chart-3"}>
              <CardContent className="p-6 text-center space-y-4">
                <Trophy className={`h-16 w-16 mx-auto ${gameStatus === "won" ? "text-accent" : "text-chart-3"}`} />
                <h3 className="text-2xl font-bold">
                  {gameStatus === "won" ? "Amazing!" : "Time's Up!"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? `You solved all ${wordsSolved} words!`
                    : `You solved ${wordsSolved} word${wordsSolved !== 1 ? "s" : ""}!`}
                </p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}
                <ShareResults
                  gameName="Anagram Solver"
                  gameSlug="anagram-solver"
                  score={score}
                  isWin={gameStatus === "won"}
                />
                {solvedWords.length > 0 && (
                  <div className="text-left">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Words solved ({solvedWords.length}):</p>
                    <div className="flex flex-wrap gap-1.5 justify-center max-h-48 overflow-y-auto">
                      {solvedWords.map((word, i) => (
                        <Badge key={i} variant="secondary" className="text-sm">{word}</Badge>
                      ))}
                    </div>
                  </div>
                )}
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
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => initGame(lastSetRef.current ?? undefined)} className="bg-sky-500 hover:bg-sky-600 text-white border-0" data-testid="button-replay">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Replay
                    </Button>
                    <Button onClick={() => initGame()} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                      Play Again
                    </Button>
                    <Button onClick={() => navigate("/games/anagram-solver")} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                      Main Menu
                    </Button>
                    <TryAnotherGameButton currentSlug="anagram-solver" />
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
