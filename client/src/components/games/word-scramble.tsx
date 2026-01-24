import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, ArrowRight, Heart, Loader2 } from "lucide-react";
import type { ScrambleWord } from "@shared/schema";

export function WordScrambleGame() {
  const { data: words = [], isLoading, error, refetch } = useQuery<ScrambleWord[]>({
    queryKey: ["/api/games/word-scramble/words"],
    refetchOnMount: "always",
  });

  const [activeWords, setActiveWords] = useState<ScrambleWord[]>([]);
  const [currentWord, setCurrentWord] = useState<ScrambleWord | null>(null);
  const [scrambledWord, setScrambledWord] = useState("");
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const scrambleWord = (word: string): string => {
    const letters = word.split("");
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const scrambled = letters.join("");
    if (scrambled === word) return scrambleWord(word);
    return scrambled;
  };

  const selectNewWord = useCallback(() => {
    const availableWords = activeWords.filter((w) => !usedWords.has(w.word));
    if (availableWords.length === 0) {
      setGameStatus("won");
      return;
    }
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    setCurrentWord(randomWord);
    setScrambledWord(scrambleWord(randomWord.word));
    setUserInput("");
    setUsedWords((prev) => new Set(Array.from(prev).concat(randomWord.word)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedWords, activeWords]);

  const initGame = useCallback(async () => {
    const result = await refetch();
    const freshWords = result.data || [];
    if (freshWords.length === 0) return;
    setActiveWords(freshWords);
    setScore(0);
    setLevel(1);
    setLives(3);
    setGameStatus("playing");
    setWordsCompleted(0);
    setUsedWords(new Set());
    const randomWord = freshWords[Math.floor(Math.random() * freshWords.length)];
    setCurrentWord(randomWord);
    setScrambledWord(scrambleWord(randomWord.word));
    setUserInput("");
    setUsedWords(new Set([randomWord.word]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [refetch]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  const checkAnswer = () => {
    if (!currentWord) return;
    if (userInput.toUpperCase() === currentWord.word) {
      setFeedback("correct");
      const points = 100 + level * 20;
      setScore((prev) => prev + points);
      setWordsCompleted((prev) => prev + 1);

      if ((wordsCompleted + 1) % 3 === 0) {
        setLevel((prev) => prev + 1);
      }

      setTimeout(() => {
        setFeedback(null);
        selectNewWord();
      }, 800);
    } else {
      setFeedback("wrong");
      setLives((prev) => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setTimeout(() => setGameStatus("lost"), 800);
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
        setGameStatus("lost");
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            {score} pts
          </Badge>
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-level">
            <Zap className="h-3.5 w-3.5" />
            Level {level}
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
                      {letter}
                    </motion.div>
                  ))}
                </motion.div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your answer..."
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

                <div className="text-center text-sm text-muted-foreground">
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
                  {gameStatus === "won" ? "Champion!" : "Game Over"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You unscrambled all the words!"
                    : `The word was "${currentWord.word}"`}
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{score} points</div>
                  <div className="text-sm text-muted-foreground">
                    Level {level} • {wordsCompleted} words completed
                  </div>
                </div>
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
