import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, Lightbulb, Heart, Loader2 } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { LetterPoolWord } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";

export function LetterPoolGame() {
  const { playSound } = useSound();
  const { data: words = [], isLoading, error, refetch } = useQuery<LetterPoolWord[]>({
    queryKey: ["/api/games/letter-pool/words"],
    refetchOnMount: "always",
  });

  const [activeWords, setActiveWords] = useState<LetterPoolWord[]>([]);
  const [currentWord, setCurrentWord] = useState<LetterPoolWord | null>(null);
  const [filledLetters, setFilledLetters] = useState<(string | null)[]>([]);
  const [poolLetters, setPoolLetters] = useState<{ letter: string; used: boolean; id: number }[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");

  const setupWord = useCallback((word: LetterPoolWord) => {
    const middleCount = word.word.length - 2;
    setFilledLetters(new Array(middleCount).fill(null));
    setPoolLetters(word.letterPool.map((l, i) => ({ letter: l, used: false, id: i })));
    setShowHint(false);
    setFeedback(null);
  }, []);

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

  const initGame = useCallback(async () => {
    const result = await refetch();
    const freshWords = result.data || [];
    if (freshWords.length === 0) return;
    setActiveWords(freshWords);
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
  }, [refetch, setupWord]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  const handlePoolClick = useCallback((poolId: number) => {
    if (!currentWord || feedback) return;

    const clickedItem = poolLetters.find(p => p.id === poolId);
    if (!clickedItem || clickedItem.used) return;

    playSound("click");

    const middleLetters = currentWord.word.slice(1, -1);
    const clickedLetter = clickedItem.letter;

    const matchIndex = middleLetters.split("").findIndex(
      (ch, i) => ch === clickedLetter && filledLetters[i] === null
    );

    if (matchIndex === -1) {
      playSound("wrong");
      setFeedback("wrong");
      setStreak(0);

      const newPool = poolLetters.map(p =>
        p.id === poolId ? { ...p, used: true } : p
      );
      setPoolLetters(newPool);

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

      setTimeout(() => setFeedback(null), 800);
      return;
    }

    const newFilled = [...filledLetters];
    newFilled[matchIndex] = clickedLetter;

    const newPool = poolLetters.map(p =>
      p.id === poolId ? { ...p, used: true } : p
    );

    setFilledLetters(newFilled);
    setPoolLetters(newPool);

    const allFilled = newFilled.every(l => l !== null);
    if (allFilled) {
      playSound("correct");
      setFeedback("correct");
      setStreak(prev => prev + 1);
      const points = showHint ? 50 : 100;
      setScore(prev => prev + points);
      setWordsCompleted(prev => prev + 1);
      setTimeout(() => {
        setFeedback(null);
        selectNewWord();
      }, 1200);
    }
  }, [currentWord, filledLetters, poolLetters, feedback, showHint, playSound, selectNewWord, lives]);

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

  if (!currentWord) {
    return null;
  }

  const middleLength = currentWord.word.length - 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            <AnimatedNumber value={score} /> pts
          </Badge>
          <StreakIndicator streak={streak} />
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
            onClick={initGame}
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
                  <Badge variant="secondary" data-testid="badge-category">
                    {currentWord.category}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Tap letters from the pool — correct ones snap into place, wrong ones cost a life
                  </p>
                </div>

                <motion.div
                  key={currentWord.word}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center gap-1.5 sm:gap-2 flex-wrap"
                >
                  <motion.div
                    initial={{ opacity: 0, rotateY: 90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    transition={{ delay: 0 }}
                    className="w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md bg-primary text-primary-foreground"
                    data-testid="letter-first"
                  >
                    {currentWord.word[0]}
                  </motion.div>

                  {filledLetters.map((letter, index) => {
                    const isEmpty = !letter;

                    return (
                      <motion.div
                        key={`slot-${index}`}
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{
                          opacity: 1,
                          rotateY: 0,
                          scale: letter ? [1, 1.15, 1] : 1,
                        }}
                        transition={{ delay: isEmpty ? (index + 1) * 0.05 : 0, duration: 0.3 }}
                        className={`w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md transition-colors ${
                          isEmpty
                            ? "bg-muted border-2 border-dashed border-muted-foreground/30"
                            : feedback === "correct"
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                        data-testid={`slot-${index}`}
                      >
                        {letter || ""}
                      </motion.div>
                    );
                  })}

                  <motion.div
                    initial={{ opacity: 0, rotateY: 90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    transition={{ delay: (filledLetters.length + 1) * 0.05 }}
                    className="w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md bg-primary text-primary-foreground"
                    data-testid="letter-last"
                  >
                    {currentWord.word[currentWord.word.length - 1]}
                  </motion.div>
                </motion.div>

                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    <p className="text-sm text-primary font-medium flex items-center justify-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      {currentWord.hint}
                    </p>
                  </motion.div>
                )}

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

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowHint(true)}
                    disabled={showHint}
                    className="gap-1.5"
                    data-testid="button-hint"
                  >
                    <Lightbulb className="h-4 w-4" />
                    Hint (-50pts)
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground" data-testid="text-progress">
                  Words completed: {wordsCompleted} / {words.length}
                </div>
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
                <ShareResults
                  gameName="Letter Pool"
                  gameSlug="letter-pool"
                  score={score}
                  wordsCompleted={wordsCompleted}
                  isWin={gameStatus === "won"}
                />
                <Button onClick={initGame} data-testid="button-play-again">
                  Play Again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
