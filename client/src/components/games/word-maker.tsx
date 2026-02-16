import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, Sparkles, Loader2 } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import type { MakerWord } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult } from "@/hooks/use-game-result";

export function WordMakerGame() {
  const { playSound } = useSound();
  const { reportResult, resetRecorded, personalBest } = useGameResult({ slug: "word-maker" });
  const { data: words = [], isLoading, error, refetch } = useQuery<MakerWord[]>({
    queryKey: ["/api/games/word-maker/words"],
    refetchOnMount: "always",
  });

  const [activeWords, setActiveWords] = useState<MakerWord[]>([]);
  const [currentWord, setCurrentWord] = useState<MakerWord | null>(null);
  const [userInput, setUserInput] = useState("");
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won">("playing");
  const [completionMessage, setCompletionMessage] = useState("");
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
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    setCurrentWord(randomWord);
    setFoundWords(new Set());
    setUserInput("");
    setUsedBaseWords((prev) => new Set(Array.from(prev).concat(randomWord.baseWord)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedBaseWords, activeWords]);

  const initGame = useCallback(async () => {
    resetRecorded();
    const result = await refetch();
    const freshWords = result.data || [];
    if (freshWords.length === 0) return;
    setActiveWords(freshWords);
    setScore(0);
    setStreak(0);
    setRoundsCompleted(0);
    setGameStatus("playing");
    setUsedBaseWords(new Set());
    setFoundWords(new Set());
    const randomWord = freshWords[Math.floor(Math.random() * freshWords.length)];
    setCurrentWord(randomWord);
    setUserInput("");
    setUsedBaseWords(new Set([randomWord.baseWord]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [refetch, resetRecorded]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  useEffect(() => {
    if (gameStatus === "won") {
      reportResult(score, true, foundWords.size);
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
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
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
        ) : (
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
