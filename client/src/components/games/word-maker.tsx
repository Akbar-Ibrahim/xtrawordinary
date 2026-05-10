import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, Sparkles, Loader2, LogIn } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { MakerWord } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { makeSeededRng } from "@/lib/seeded-rng";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { useLocation } from "wouter";
export function WordMakerGame({ groupSeed, locked }: { groupSeed?: number; locked?: boolean } = {}) {
  const { playSound } = useSound();
  const [, navigate] = useLocation();
  const { reportResult, resetRecorded } = useGameResult({ slug: "word-maker" });
  const personalBest = usePersonalBest("word-maker");
  const seeded = groupSeed !== undefined;
  const seedRngRef = useRef<(() => number) | undefined>(
    seeded ? makeSeededRng(groupSeed!) : undefined
  );
  const { data: words = [], isLoading, error } = useQuery<MakerWord[]>({
    queryKey: seeded ? ["/api/games/word-maker/words", groupSeed] : ["/api/games/word-maker/words"],
    ...(seeded ? { queryFn: async () => { const r = await fetch(`/api/games/word-maker/words?seed=${groupSeed}`, { credentials: "include" }); return r.json(); } } : {}),
    refetchOnMount: seeded ? false : "always",
    gcTime: 0,
  });

  const [activeWords, setActiveWords] = useState<MakerWord[]>([]);
  const [currentWord, setCurrentWord] = useState<MakerWord | null>(null);
  const [userInput, setUserInput] = useState("");
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | "duplicate" | null>(null);
  const [usedBaseWords, setUsedBaseWords] = useState<Set<string>>(new Set());
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canFormWord = (word: string, baseWord: string): boolean => {
    const baseCounts: Record<string, number> = {};
    for (const char of baseWord.toUpperCase()) {
      baseCounts[char] = (baseCounts[char] || 0) + 1;
    }
    for (const char of word.toUpperCase()) {
      if (!baseCounts[char] || baseCounts[char] === 0) {
        return false;
      }
      baseCounts[char]--;
    }
    return true;
  };

  const selectNewWord = useCallback(() => {
    const availableWords = activeWords.filter((w) => !usedBaseWords.has(w.baseWord));
    if (availableWords.length === 0) {
      playSound("win");
      setCompletionMessage(getCompletionMessage(true));
      setGameStatus("won");
      return;
    }
    const rng = seedRngRef.current ?? Math.random;
    const randomWord = availableWords[Math.floor(rng() * availableWords.length)];
    setCurrentWord(randomWord);
    setFoundWords(new Set());
    setUserInput("");
    setUsedBaseWords((prev) => new Set(Array.from(prev).concat(randomWord.baseWord)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedBaseWords, activeWords]);

  const lastWordRef = useRef<(typeof words)[0] | null>(null);

  const initGame = useCallback((overrideWord?: (typeof words)[0]) => {
    if (words.length === 0) return;
    resetRecorded();
    setActiveWords(words);
    setScore(0);
    setStreak(0);
    setRoundsCompleted(0);
    setGameStatus("playing");
    setUsedBaseWords(new Set());
    setFoundWords(new Set());
    const rng = seedRngRef.current ?? Math.random;
    const randomWord = overrideWord ?? words[Math.floor(rng() * words.length)];
    lastWordRef.current = randomWord;
    setCurrentWord(randomWord);
    setUserInput("");
    setUsedBaseWords(new Set([randomWord.baseWord]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [words, resetRecorded]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  useEffect(() => {
    if (gameStatus === "won") {
      reportResult(score, true, foundWords.size);
    } else if (gameStatus === "lost") {
      reportResult(score, false, foundWords.size);
    }
  }, [gameStatus, score, reportResult, foundWords.size]);

  const checkWord = () => {
    if (!currentWord) return;
    const word = userInput.toUpperCase().trim();
    
    if (word.length < 3) {
      playSound("wrong");
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => setFeedback(null), 800);
      return;
    }

    if (foundWords.has(word)) {
      playSound("wrong");
      setFeedback("duplicate");
      setStreak(0);
      setTimeout(() => setFeedback(null), 800);
      return;
    }

    if (!canFormWord(word, currentWord.baseWord)) {
      playSound("wrong");
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => setFeedback(null), 800);
      return;
    }

    const isValidDerivative = currentWord.derivatives
      .map((d) => d.toUpperCase())
      .includes(word);

    if (isValidDerivative) {
      playSound("correct");
      setFeedback("correct");
      setStreak(prev => prev + 1);
      const newFoundWords = new Set(foundWords).add(word);
      setFoundWords(newFoundWords);
      setScore((prev) => prev + word.length * 10);
      setUserInput("");

      if (newFoundWords.size >= currentWord.maxWords) {
        setRoundsCompleted((prev) => prev + 1);
        setTimeout(() => {
          setFeedback(null);
          selectNewWord();
        }, 1000);
      } else {
        setTimeout(() => setFeedback(null), 500);
      }
    } else {
      playSound("wrong");
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => setFeedback(null), 800);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkWord();
    }
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

  if (!currentWord) {
    return null;
  }

  const progress = (foundWords.size / currentWord.maxWords) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            <AnimatedNumber value={score} /> pts
          </Badge>
          <StreakIndicator streak={streak} />
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-rounds">
            <Sparkles className="h-3.5 w-3.5" />
            {roundsCompleted} rounds
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => initGame()}
              className="gap-1.5"
              data-testid="button-restart"
            >
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
          )}
          {!locked && gameStatus === "playing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCompletionMessage(getCompletionMessage(false)); setGameStatus("lost"); }}
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
                  <p className="text-sm text-muted-foreground">
                    Create words using the letters from:
                  </p>
                </div>

                <motion.div
                  key={currentWord.baseWord}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center gap-1.5 sm:gap-2 flex-wrap"
                >
                  {currentWord.baseWord.split("").map((letter, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.5, rotateY: 90 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md bg-primary text-primary-foreground"
                      data-testid={`base-letter-${index}`}
                    >
                      {letter}
                    </motion.div>
                  ))}
                </motion.div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {foundWords.size} / {currentWord.maxWords} words
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {foundWords.size > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Array.from(foundWords).map((word) => (
                      <motion.div
                        key={word}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Badge variant="secondary" className="text-sm">
                          {word}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a word (3+ letters)..."
                      aria-label="Enter your word"
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback === "wrong"
                          ? "border-destructive bg-destructive/10"
                          : feedback === "duplicate"
                          ? "border-chart-3 bg-chart-3/10"
                          : ""
                      }`}
                      data-testid="input-word"
                    />
                    <div aria-live="polite">
                      {feedback && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {feedback === "correct" ? (
                            <CheckCircle className="h-5 w-5 text-accent" />
                          ) : feedback === "duplicate" ? (
                            <span className="text-xs text-chart-3 font-medium">Already found!</span>
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={checkWord}
                      disabled={userInput.length < 3}
                      data-testid="button-submit"
                    >
                      Add Word
                    </Button>
                  </div>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Words must be at least 3 letters and use only letters from the base word
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : gameStatus === "won" ? (
          <motion.div
            key="result"
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
                <h3 className="text-2xl font-bold">Word Maker Champion!</h3>
                <p className="text-muted-foreground">
                  You completed all the word challenges!
                </p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                  <div className="text-sm text-muted-foreground">
                    {roundsCompleted} rounds completed
                  </div>
                </div>
                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}
                <ShareResults
                  gameName="Word Maker"
                  gameSlug="word-maker"
                  score={score}
                  wordsCompleted={roundsCompleted}
                  isWin={true}
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
                {!locked && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => initGame(lastWordRef.current ?? undefined)} className="bg-sky-500 hover:bg-sky-600 text-white border-0" data-testid="button-replay">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Replay
                    </Button>
                    <Button onClick={() => initGame()} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                      Play Again
                    </Button>
                    <Button onClick={() => navigate("/games/word-maker")} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                      Main Menu
                    </Button>
                    <TryAnotherGameButton currentSlug="word-maker" />
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
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <XCircle className="h-16 w-16 mx-auto text-destructive" />
                </motion.div>
                <h3 className="text-2xl font-bold">Game Over</h3>
                <p className="text-muted-foreground">You ended the game early.</p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                  <div className="text-sm text-muted-foreground">
                    {roundsCompleted} rounds completed
                  </div>
                </div>
                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}
                <ShareResults
                  gameName="Word Maker"
                  gameSlug="word-maker"
                  score={score}
                  wordsCompleted={roundsCompleted}
                  isWin={false}
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
                {!locked && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => initGame(lastWordRef.current ?? undefined)} className="bg-sky-500 hover:bg-sky-600 text-white border-0" data-testid="button-replay">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Replay
                    </Button>
                    <Button onClick={() => initGame()} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                      Play Again
                    </Button>
                    <Button onClick={() => navigate("/games/word-maker")} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                      Main Menu
                    </Button>
                    <TryAnotherGameButton currentSlug="word-maker" />
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
