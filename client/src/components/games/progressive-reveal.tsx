import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, XCircle, Heart, Loader2, Eye, Send } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { ProgressiveRevealWord } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";

const BASE_POINTS = 200;
const REVEAL_COST = 30;

export function ProgressiveRevealGame() {
  const { playSound } = useSound();
  const { reportResult, resetRecorded, personalBest } = useGameResult({ slug: "progressive-reveal" });
  const { data: words = [], isLoading, error, refetch } = useQuery<ProgressiveRevealWord[]>({
    queryKey: ["/api/games/progressive-reveal/words"],
    refetchOnMount: "always",
  });

  const [activeWords, setActiveWords] = useState<ProgressiveRevealWord[]>([]);
  const [currentWord, setCurrentWord] = useState<ProgressiveRevealWord | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [revealCount, setRevealCount] = useState(0);
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [completionMessage, setCompletionMessage] = useState("");
  const [lastRevealedIndex, setLastRevealedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setupWord = useCallback((word: ProgressiveRevealWord) => {
    setRevealed(new Array(word.word.length).fill(false));
    setRevealCount(0);
    setGuess("");
    setFeedback(null);
    setLastRevealedIndex(null);
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
    resetRecorded();
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
  }, [refetch, setupWord, resetRecorded]);

  useEffect(() => {
    if (gameStatus === "won" || gameStatus === "lost") {
      reportResult(score, gameStatus === "won");
    }
  }, [gameStatus, score, reportResult]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  const handleTileClick = useCallback((index: number) => {
    if (!currentWord || feedback || revealed[index]) return;

    playSound("click");

    const newRevealed = [...revealed];
    newRevealed[index] = true;
    setRevealed(newRevealed);
    setRevealCount(prev => prev + 1);
    setLastRevealedIndex(index);
  }, [currentWord, feedback, revealed, playSound]);

  const potentialPoints = currentWord
    ? Math.max(0, BASE_POINTS - revealCount * REVEAL_COST)
    : BASE_POINTS;

  const handleGuess = useCallback(() => {
    if (!currentWord || feedback || !guess.trim()) return;

    const upperGuess = guess.trim().toUpperCase();

    if (upperGuess === currentWord.word) {
      playSound("correct");
      setFeedback("correct");
      setRevealed(new Array(currentWord.word.length).fill(true));
      setStreak(prev => prev + 1);
      const points = Math.max(10, BASE_POINTS - revealCount * REVEAL_COST);
      setScore(prev => prev + points);
      setWordsCompleted(prev => prev + 1);
      setTimeout(() => {
        setFeedback(null);
        selectNewWord();
      }, 1500);
    } else {
      playSound("wrong");
      setFeedback("wrong");
      setStreak(0);
      setGuess("");
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
      setTimeout(() => {
        setFeedback(null);
        inputRef.current?.focus();
      }, 1000);
    }
  }, [currentWord, feedback, guess, revealCount, playSound, selectNewWord]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleGuess();
    }
  }, [handleGuess]);

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

  const allRevealed = revealed.every(r => r);

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
                  <Badge variant="secondary" data-testid="badge-subcategory">
                    {currentWord.subcategory}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {currentWord.word.length} letters — tap tiles to reveal, then guess the word
                  </p>
                </div>

                <motion.div
                  key={currentWord.word}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center gap-1.5 sm:gap-2 flex-wrap"
                >
                  {currentWord.word.split("").map((letter, index) => (
                    <motion.button
                      key={`tile-${index}`}
                      initial={{ opacity: 0, rotateY: 180 }}
                      animate={{
                        opacity: 1,
                        rotateY: revealed[index] ? 0 : 180,
                        scale: lastRevealedIndex === index ? [1, 1.15, 1] : 1,
                      }}
                      transition={{
                        delay: revealed[index] ? 0 : index * 0.05,
                        duration: 0.4,
                        type: "spring",
                        stiffness: 200,
                      }}
                      onClick={() => handleTileClick(index)}
                      disabled={revealed[index] || !!feedback}
                      className={`w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md transition-colors ${
                        revealed[index]
                          ? feedback === "correct"
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground"
                          : "bg-primary text-primary-foreground cursor-pointer hover-elevate"
                      }`}
                      style={{ perspective: "600px" }}
                      data-testid={`tile-${index}`}
                    >
                      <span style={{ transform: revealed[index] ? "rotateY(0deg)" : "rotateY(180deg)", display: "inline-block" }}>
                        {revealed[index] ? letter : "?"}
                      </span>
                    </motion.button>
                  ))}
                </motion.div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {revealCount} revealed
                    </span>
                    <span className="text-muted-foreground">—</span>
                    <span className={`font-semibold ${potentialPoints > 100 ? "text-accent" : potentialPoints > 50 ? "text-chart-3" : "text-destructive"}`}>
                      {potentialPoints} pts available
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {feedback === "wrong" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      <p className="text-sm text-destructive font-medium">
                        Not quite — try again!
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2 max-w-sm mx-auto">
                  <Input
                    ref={inputRef}
                    value={guess}
                    onChange={(e) => setGuess(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your guess..."
                    disabled={!!feedback}
                    className="text-center font-semibold uppercase tracking-wider"
                    data-testid="input-guess"
                  />
                  <Button
                    onClick={handleGuess}
                    disabled={!guess.trim() || !!feedback}
                    data-testid="button-guess"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                {allRevealed && !feedback && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    <p className="text-sm text-muted-foreground">
                      All letters revealed — type the word to continue
                    </p>
                  </motion.div>
                )}

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
                  {gameStatus === "won" ? "Master Revealer!" : "Game Over"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You revealed and guessed all the words!"
                    : `The word was "${currentWord.word}"`}
                </p>
                <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary"><AnimatedNumber value={score} /> points</div>
                  <div className="text-sm text-muted-foreground">
                    {wordsCompleted} words completed
                  </div>
                  {personalBest > 0 && (
                    <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                      Personal Best: {personalBest} pts
                    </p>
                  )}
                </div>
                <ShareResults
                  gameName="Progressive Reveal"
                  gameSlug="progressive-reveal"
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
