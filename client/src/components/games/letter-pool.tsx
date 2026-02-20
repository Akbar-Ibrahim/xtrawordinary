import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, XCircle, Lightbulb, Heart, Loader2, Eye, EyeOff } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { LetterPoolWord } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";

type Variation = "with-pool" | "without-pool";

interface LetterPoolGameProps {
  initialChallenge?: Variation;
}

export function LetterPoolGame({ initialChallenge }: LetterPoolGameProps) {
  const { playSound } = useSound();
  const { reportResult, resetRecorded, personalBest } = useGameResult({ slug: "letter-pool" });
  const { data: words = [], isLoading, error, refetch } = useQuery<LetterPoolWord[]>({
    queryKey: ["/api/games/letter-pool/words"],
    refetchOnMount: "always",
  });

  const [variation, setVariation] = useState<Variation | null>(initialChallenge || null);
  const [activeWords, setActiveWords] = useState<LetterPoolWord[]>([]);
  const [currentWord, setCurrentWord] = useState<LetterPoolWord | null>(null);
  const [filledLetters, setFilledLetters] = useState<(string | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [poolLetters, setPoolLetters] = useState<{ letter: string; used: boolean; id: number }[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialChallenge) {
      setVariation(initialChallenge);
      setGameStatus("playing");
    }
  }, [initialChallenge]);

  const buildPool = useCallback((word: LetterPoolWord) => {
    const allLetters = word.word.split("");
    const extraLetters = word.letterPool.filter(l => !allLetters.includes(l));
    const combined = [...allLetters];
    const decoyCount = Math.min(extraLetters.length, Math.max(2, Math.floor(allLetters.length * 0.4)));
    for (let i = 0; i < decoyCount; i++) {
      if (extraLetters[i]) combined.push(extraLetters[i]);
    }
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined.map((l, i) => ({ letter: l, used: false, id: i }));
  }, []);

  const setupWord = useCallback((word: LetterPoolWord) => {
    setFilledLetters(new Array(word.word.length).fill(null));
    setCurrentIndex(0);
    setPoolLetters(buildPool(word));
    setShowHint(false);
    setHintUsed(false);
    setFeedback(null);
    setWrongGuesses(0);
  }, [buildPool]);

  const selectNewWord = useCallback(() => {
    const availableWords = activeWords.filter((w) => !usedWords.has(w.word));
    if (availableWords.length === 0) {
      playSound("win");
      setGameStatus("won");
      setCompletionMessage(getCompletionMessage(true));
      return;
    }
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    setCurrentWord(randomWord);
    setupWord(randomWord);
    setUsedWords((prev) => new Set(Array.from(prev).concat(randomWord.word)));
  }, [usedWords, activeWords, setupWord, playSound]);

  const initGame = useCallback(async (v: Variation) => {
    resetRecorded();
    const result = await refetch();
    const freshWords = result.data || [];
    if (freshWords.length === 0) return;
    setActiveWords(freshWords);
    setVariation(v);
    setScore(0);
    setStreak(0);
    setLives(3);
    setWordsCompleted(0);
    setGameStatus("playing");
    setFeedback(null);
    setCompletionMessage("");
    const randomWord = freshWords[Math.floor(Math.random() * freshWords.length)];
    setCurrentWord(randomWord);
    setupWord(randomWord);
    setUsedWords(new Set([randomWord.word]));
    setTimeout(() => gameAreaRef.current?.focus(), 100);
  }, [refetch, setupWord, resetRecorded]);

  useEffect(() => {
    if (initialChallenge && words.length > 0 && !currentWord) {
      initGame(initialChallenge);
    }
  }, [words, currentWord, initialChallenge, initGame]);

  useEffect(() => {
    if (gameStatus === "won") {
      reportResult(score, true, wordsCompleted);
    } else if (gameStatus === "lost") {
      reportResult(score, false, wordsCompleted);
    }
  }, [gameStatus, score, reportResult, wordsCompleted]);

  const processLetter = useCallback((letter: string, poolId?: number) => {
    if (!currentWord || feedback || gameStatus !== "playing") return;
    if (currentIndex >= currentWord.word.length) return;

    const expectedLetter = currentWord.word[currentIndex].toUpperCase();
    const inputLetter = letter.toUpperCase();

    if (inputLetter === expectedLetter) {
      playSound("correct");
      const newFilled = [...filledLetters];
      newFilled[currentIndex] = currentWord.word[currentIndex];
      setFilledLetters(newFilled);
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);

      if (poolId !== undefined) {
        setPoolLetters(prev => prev.map(p => p.id === poolId ? { ...p, used: true } : p));
      } else if (variation === "with-pool") {
        setPoolLetters(prev => {
          const match = prev.find(p => !p.used && p.letter.toUpperCase() === inputLetter);
          if (match) return prev.map(p => p.id === match.id ? { ...p, used: true } : p);
          return prev;
        });
      }

      if (nextIndex >= currentWord.word.length) {
        setFeedback("correct");
        setStreak(prev => prev + 1);
        const basePoints = currentWord.word.length * 20;
        const wrongPenalty = wrongGuesses * 10;
        const hintPenalty = hintUsed ? Math.floor(basePoints * 0.2) : 0;
        const streakBonus = streak * 5;
        const points = Math.max(10, basePoints - wrongPenalty - hintPenalty + streakBonus);
        setScore(prev => prev + points);
        setWordsCompleted(prev => prev + 1);
        setTimeout(() => {
          setFeedback(null);
          selectNewWord();
        }, 1200);
      }
    } else {
      playSound("wrong");
      setFeedback("wrong");
      setShakeKey(prev => prev + 1);
      setStreak(0);
      setWrongGuesses(prev => prev + 1);

      setLives(prev => {
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

      setTimeout(() => setFeedback(null), 500);
    }
  }, [currentWord, filledLetters, currentIndex, feedback, gameStatus, playSound, selectNewWord, streak, wrongGuesses, hintUsed, variation]);

  const handlePoolClick = useCallback((poolId: number) => {
    if (!currentWord || feedback || gameStatus !== "playing") return;
    const clickedItem = poolLetters.find(p => p.id === poolId);
    if (!clickedItem || clickedItem.used) return;
    playSound("click");
    processLetter(clickedItem.letter, poolId);
  }, [currentWord, poolLetters, feedback, gameStatus, playSound, processLetter]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (gameStatus !== "playing" || feedback === "correct") return;
    const key = e.key;
    if (/^[a-zA-Z]$/.test(key)) {
      e.preventDefault();
      processLetter(key);
    }
  }, [gameStatus, feedback, processLetter]);

  useEffect(() => {
    if (gameStatus === "playing" && gameAreaRef.current) {
      gameAreaRef.current.focus();
    }
  }, [gameStatus, currentWord]);

  const handleHint = useCallback(() => {
    if (showHint || !currentWord) return;
    setShowHint(true);
    setHintUsed(true);
    playSound("click");
  }, [showHint, currentWord, playSound]);

  const restartGame = useCallback(() => {
    if (variation) initGame(variation);
  }, [variation, initGame]);

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
          <Button onClick={() => window.location.reload()} className="mt-4" data-testid="button-retry">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gameStatus === "menu") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold">Choose Your Challenge</h3>
          <p className="text-sm text-muted-foreground">
            Spell out words letter by letter. Each correct letter fills in, each wrong one costs a life.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              className="cursor-pointer hover-elevate h-full"
              onClick={() => initGame("with-pool")}
              data-testid="card-with-pool"
            >
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Eye className="h-7 w-7 text-primary" />
                </div>
                <h4 className="font-semibold text-lg">With Letter Pool</h4>
                <p className="text-sm text-muted-foreground">
                  See scrambled letters as a reference. Click them or type your answer.
                </p>
                <Badge variant="secondary">Easier</Badge>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              className="cursor-pointer hover-elevate h-full"
              onClick={() => initGame("without-pool")}
              data-testid="card-without-pool"
            >
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <EyeOff className="h-7 w-7 text-primary" />
                </div>
                <h4 className="font-semibold text-lg">Without Letter Pool</h4>
                <p className="text-sm text-muted-foreground">
                  No clues — just blank spaces. Type each letter from memory.
                </p>
                <Badge variant="secondary">Harder</Badge>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!currentWord) return null;

  return (
    <div
      className="space-y-6 outline-none"
      ref={gameAreaRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="letter-pool-game-area"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            <AnimatedNumber value={score} /> pts
          </Badge>
          <StreakIndicator streak={streak} />
          <Badge variant="outline" className="text-xs">
            {variation === "with-pool" ? "Pool" : "Blind"}
          </Badge>
        </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={restartGame}
            className="gap-1.5"
            data-testid="button-restart"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
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
                    {variation === "with-pool"
                      ? "Type or click the correct letter — fill each blank from left to right"
                      : "Type the correct letter — fill each blank from left to right"}
                  </p>
                </div>

                <motion.div
                  key={`word-${currentWord.word}-${shakeKey}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={feedback === "wrong" ? {
                    opacity: 1, y: 0,
                    x: [0, -8, 8, -6, 6, -3, 3, 0],
                    transition: { x: { duration: 0.4 } }
                  } : { opacity: 1, y: 0 }}
                  className="flex justify-center gap-1.5 sm:gap-2 flex-wrap"
                >
                  {currentWord.word.split("").map((char, index) => {
                    const isFilled = filledLetters[index] !== null;
                    const isCurrent = index === currentIndex;

                    return (
                      <motion.div
                        key={`slot-${index}`}
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{
                          opacity: 1,
                          rotateY: 0,
                          scale: isFilled ? [1, 1.15, 1] : 1,
                        }}
                        transition={{ delay: index * 0.04, duration: 0.3 }}
                        className={`w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md transition-colors ${
                          isFilled
                            ? feedback === "correct" && index >= currentIndex - 1
                              ? "bg-accent text-accent-foreground"
                              : "bg-secondary text-secondary-foreground"
                            : isCurrent
                            ? "bg-primary/10 border-2 border-primary"
                            : "bg-muted border-2 border-dashed border-muted-foreground/30"
                        }`}
                        data-testid={`slot-${index}`}
                      >
                        {filledLetters[index] || ""}
                      </motion.div>
                    );
                  })}
                </motion.div>

                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    <p className="text-sm text-primary font-medium flex items-center justify-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Category: {currentWord.category}
                    </p>
                  </motion.div>
                )}

                {variation === "with-pool" && (
                  <div className="space-y-4">
                    <p className="text-xs text-center text-muted-foreground uppercase tracking-wider font-medium">Letter Pool</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      {poolLetters.map((item) => (
                        <motion.button
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{
                            opacity: item.used ? 0.3 : 1,
                            scale: item.used ? 0.9 : 1,
                          }}
                          whileTap={!item.used && !feedback ? { scale: 0.95 } : undefined}
                          onClick={() => handlePoolClick(item.id)}
                          disabled={item.used || !!feedback}
                          className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-lg font-bold rounded-md transition-colors ${
                            item.used
                              ? "bg-muted text-muted-foreground/30 cursor-default"
                              : "bg-card border border-border text-foreground cursor-pointer hover-elevate"
                          }`}
                          data-testid={`pool-letter-${item.id}`}
                        >
                          {item.letter}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleHint}
                    disabled={showHint}
                    className="gap-1.5"
                    data-testid="button-hint"
                  >
                    <Lightbulb className="h-4 w-4" />
                    {showHint ? "Hint Used" : "Hint (-20% pts)"}
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground" data-testid="text-progress">
                  Words completed: {wordsCompleted} / {activeWords.length}
                </div>

                {variation === "without-pool" && (
                  <p className="text-xs text-center text-muted-foreground italic">
                    Start typing — each letter is checked automatically
                  </p>
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
                  {gameStatus === "won" ? "Letter Pool Master!" : "Game Over"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You completed all the words!"
                    : `The word was "${currentWord.word}"`}
                </p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                  <div className="text-sm text-muted-foreground">
                    {wordsCompleted} words completed
                  </div>
                </div>
                {personalBest > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                    Personal Best: {personalBest} pts
                  </p>
                )}
                <ShareResults
                  gameName="Letter Pool"
                  gameSlug="letter-pool"
                  score={score}
                  wordsCompleted={wordsCompleted}
                  isWin={gameStatus === "won"}
                />
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={restartGame} data-testid="button-play-again">
                    Play Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGameStatus("menu");
                      setCurrentWord(null);
                    }}
                    data-testid="button-change-mode"
                  >
                    Change Mode
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
