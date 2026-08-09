import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, ArrowRight, Heart, Loader2, LogIn } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { ScrambleWord } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { makeSeededRng } from "@/lib/seeded-rng";
import { usePuzzleHistory } from "@/hooks/use-puzzle-history";
import { TryAnotherGameButton } from "@/components/try-another-game-button";
import { useLocation } from "wouter";

export function WordScrambleGame({ groupSeed, locked, quizMode, customWords, isUntimed, livesCount }: { groupSeed?: number; locked?: boolean; quizMode?: boolean; customWords?: ScrambleWord[]; isUntimed?: boolean; livesCount?: number } = {}) {
  const { playSound } = useSound();
  const [, navigate] = useLocation();
  const { reportResult, resetRecorded } = useGameResult({ slug: "word-scramble", quizMode, isUntimed });
  const personalBest = usePersonalBest("word-scramble");
  const seeded = groupSeed !== undefined;
  const hasCustomWords = customWords && customWords.length > 0;
  const { markSeen, filterUnseen } = usePuzzleHistory("word-scramble");
  const seedRngRef = useRef<(() => number) | undefined>(
    seeded ? makeSeededRng(groupSeed!) : undefined
  );
  const { data: fetchedWords = [], isLoading, error } = useQuery<ScrambleWord[]>({
    queryKey: seeded ? ["/api/games/word-scramble/words", groupSeed] : ["/api/games/word-scramble/words"],
    ...(seeded ? { queryFn: async () => { const r = await fetch(`/api/games/word-scramble/words?seed=${groupSeed}`, { credentials: "include" }); return r.json(); } } : {}),
    enabled: !hasCustomWords,
    refetchOnMount: seeded ? false : "always",
    gcTime: 0,
  });
  const words = hasCustomWords ? customWords! : fetchedWords;

  const [activeWords, setActiveWords] = useState<ScrambleWord[]>([]);
  const [currentWord, setCurrentWord] = useState<ScrambleWord | null>(null);
  const [scrambledWord, setScrambledWord] = useState("");
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(livesCount ?? 3);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [completionMessage, setCompletionMessage] = useState("");
  const [alsoCorrect, setAlsoCorrect] = useState<string[]>([]);
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrambleWord = (word: string, rng: () => number = Math.random): string => {
    const letters = word.split("");
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const scrambled = letters.join("");
    if (scrambled === word) return scrambleWord(word, rng);
    return scrambled;
  };

  const selectNewWord = useCallback(() => {
    const availableWords = activeWords.filter((w) => !usedWords.has(w.word));
    if (availableWords.length === 0) {
      playSound("win");
      setGameStatus("won");
      setCompletionMessage(getCompletionMessage(true));
      return;
    }
    const rng = seedRngRef.current ?? Math.random;
    const randomWord = availableWords[Math.floor(rng() * availableWords.length)];
    setCurrentWord(randomWord);
    setScrambledWord(scrambleWord(randomWord.word, rng));
    setUserInput("");
    setUsedWords((prev) => new Set(Array.from(prev).concat(randomWord.word)));
    if (!seeded && !hasCustomWords) markSeen(randomWord.word);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedWords, activeWords, seeded, hasCustomWords, markSeen]);

  const lastWordRef = useRef<(typeof words)[0] | null>(null);

  const initGame = useCallback((overrideWord?: (typeof words)[0]) => {
    if (words.length === 0) return;
    resetRecorded();
    const wordPool = seeded || hasCustomWords || overrideWord ? words : filterUnseen(words, (w) => w.word);
    setActiveWords(wordPool);
    setScore(0);
    setStreak(0);
    setLevel(1);
    setLives(livesCount ?? 3);
    setGameStatus("playing");
    setWordsCompleted(0);
    setUsedWords(new Set());
    const rng = seedRngRef.current ?? Math.random;
    const randomWord = overrideWord ?? wordPool[Math.floor(rng() * wordPool.length)];
    lastWordRef.current = randomWord;
    setCurrentWord(randomWord);
    setScrambledWord(scrambleWord(randomWord.word, rng));
    setUserInput("");
    setUsedWords(new Set([randomWord.word]));
    if (!seeded && !hasCustomWords) markSeen(randomWord.word);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [words, resetRecorded, seeded, hasCustomWords, filterUnseen, markSeen]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  useEffect(() => {
    if (gameStatus === "won") {
      reportResult(score, true);
    } else if (gameStatus === "lost") {
      reportResult(score, false);
    }
  }, [gameStatus, score, reportResult]);

  const checkAnswer = () => {
    if (!currentWord) return;
    const allValid = [currentWord.word, ...(currentWord.validAnswers ?? [])];
    if (allValid.includes(userInput.toUpperCase())) {
      playSound("correct");
      setFeedback("correct");
      const others = allValid.filter(a => a !== userInput.toUpperCase()).slice(0, 3);
      setAlsoCorrect(others);
      setStreak(prev => prev + 1);
      const points = 100 + level * 20;
      setScore((prev) => prev + points);
      setWordsCompleted((prev) => prev + 1);

      if ((wordsCompleted + 1) % 3 === 0) {
        setLevel((prev) => prev + 1);
      }

      setTimeout(() => {
        setFeedback(null);
        setAlsoCorrect([]);
        selectNewWord();
      }, 1200);
    } else {
      playSound("wrong");
      setFeedback("wrong");
      setStreak(0);
      setLives((prev) => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setTimeout(() => {
            playSound("lose");
            setGameStatus("lost");
            setCompletionMessage(getCompletionMessage(false));
          }, 800);
        }
        return newLives;
      });
      setTimeout(() => setFeedback(null), 800);
    }
  };

  const skipWord = () => {
    setLives((prev) => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        playSound("lose");
        setGameStatus("lost");
        setCompletionMessage(getCompletionMessage(false));
      } else {
        selectNewWord();
      }
      return newLives;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkAnswer();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-8">
        <div className="flex items-center gap-2">
          <div className="flex gap-1" data-testid="lives-display">
            {Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 1 }}
                animate={{ scale: i < lives ? 1 : 0.8, opacity: i < lives ? 1 : 0.3 }}
              >
                <Heart
                  className={`h-5 w-5 ${
                    i < lives
                      ? "fill-destructive text-destructive"
                      : "fill-muted text-muted-foreground"
                  }`}
                />
              </motion.div>
            ))}
          </div>
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
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="secondary" data-testid="badge-category">
                      {currentWord.category}
                    </Badge>
                    <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-level">
                      <Zap className="h-3.5 w-3.5" />
                      Level {level}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Unscramble the word below
                  </p>
                </div>

                <motion.div
                  key={scrambledWord}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center gap-2 flex-wrap"
                >
                  {scrambledWord.split("").map((letter, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, rotateY: 90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md bg-primary text-primary-foreground"
                      data-testid={`scrambled-letter-${index}`}
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
                      placeholder="Type your answer..."
                      aria-label="Enter your word"
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback === "wrong"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
                      maxLength={currentWord.word.length}
                      data-testid="input-answer"
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
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {feedback === "correct" && alsoCorrect.length > 0 && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-center text-xs text-muted-foreground"
                        data-testid="text-also-correct"
                      >
                        Also correct: {alsoCorrect.join(", ")}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={skipWord}
                      className="gap-1.5"
                      data-testid="button-skip"
                    >
                      Skip
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={checkAnswer}
                      disabled={userInput.length !== currentWord.word.length}
                      data-testid="button-submit"
                    >
                      Submit
                    </Button>
                  </div>
                </div>

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
                  <span className="text-sm text-muted-foreground leading-none">/ {words.length} words</span>
                  <span className="text-muted-foreground/40 leading-none">·</span>
                  <span className="text-sm text-muted-foreground leading-none">
                    PB: <span className="font-semibold text-foreground">{personalBest > 0 ? personalBest : "—"}</span>
                  </span>
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
                      onClick={() => { setGameStatus("lost"); setCompletionMessage(getCompletionMessage(false)); }}
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
                  {gameStatus === "won" ? "Champion!" : "Game Over"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You unscrambled all the words!"
                    : `The word was "${currentWord.word}"${(currentWord.validAnswers ?? []).length > 0 ? ` · also: ${(currentWord.validAnswers ?? []).join(", ")}` : ""}`}
                </p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                  <div className="text-sm text-muted-foreground">
                    Level {level} • {wordsCompleted} words completed
                  </div>
                </div>
                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}
                <ShareResults
                  gameName="Word Scramble"
                  gameSlug="word-scramble"
                  score={score}
                  wordsCompleted={wordsCompleted}
                  isWin={gameStatus === "won"}
                />
                {usedWords.size > 0 && (
                  <div className="text-left">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Words used ({usedWords.size}):</p>
                    <div className="flex flex-wrap gap-1.5 justify-center max-h-48 overflow-y-auto">
                      {Array.from(usedWords).map((word) => (
                        <Badge key={word} variant="secondary" className="text-sm">{word}</Badge>
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
                    <Button onClick={() => initGame(lastWordRef.current ?? undefined)} className="bg-sky-500 hover:bg-sky-600 text-white border-0" data-testid="button-replay">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Replay
                    </Button>
                    <Button onClick={() => initGame()} className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" data-testid="button-play-again">
                      Play Again
                    </Button>
                    <Button onClick={() => navigate("/games/word-scramble")} className="bg-amber-500 hover:bg-amber-600 text-white border-0" data-testid="button-main-menu">
                      Main Menu
                    </Button>
                    <TryAnotherGameButton currentSlug="word-scramble" />
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
