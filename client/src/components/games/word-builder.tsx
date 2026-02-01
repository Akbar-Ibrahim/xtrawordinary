import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, Lightbulb, Heart, Loader2 } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import type { BuilderWord } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useSound } from "@/lib/sound-provider";

type WordValidationResponse = { valid: boolean; message?: string };

export function WordBuilderGame() {
  const { playSound } = useSound();
  const { data: words = [], isLoading, error, refetch } = useQuery<BuilderWord[]>({
    queryKey: ["/api/games/word-builder/words"],
    refetchOnMount: "always",
  });

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [activeWords, setActiveWords] = useState<BuilderWord[]>([]);
  const [currentWord, setCurrentWord] = useState<BuilderWord | null>(null);
  const [userInput, setUserInput] = useState("");
  const [displayedLetters, setDisplayedLetters] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getDisplayWord = (word: string): string[] => {
    if (word.length <= 2) return word.split("");
    const result: string[] = [];
    result.push(word[0]);
    for (let i = 1; i < word.length - 1; i++) {
      result.push("_");
    }
    result.push(word[word.length - 1]);
    return result;
  };

  const selectNewWord = useCallback(() => {
    const availableWords = activeWords.filter((w) => !usedWords.has(w.word));
    if (availableWords.length === 0) {
      playSound("win");
      setGameStatus("won");
      return;
    }
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    setCurrentWord(randomWord);
    setDisplayedLetters(getDisplayWord(randomWord.word));
    setUserInput("");
    setShowHint(false);
    setUsedWords((prev) => new Set(Array.from(prev).concat(randomWord.word)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedWords, activeWords]);

  const initGame = useCallback(async () => {
    const result = await refetch();
    const freshWords = result.data || [];
    if (freshWords.length === 0) return;
    setActiveWords(freshWords);
    setScore(0);
    setLives(3);
    setWordsCompleted(0);
    setGameStatus("playing");
    setUsedWords(new Set());
    setShowHint(false);
    const randomWord = freshWords[Math.floor(Math.random() * freshWords.length)];
    setCurrentWord(randomWord);
    setDisplayedLetters(getDisplayWord(randomWord.word));
    setUserInput("");
    setUsedWords(new Set([randomWord.word]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [refetch]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  const checkAnswer = async () => {
    if (!currentWord || !userInput.trim()) return;
    
    const upperInput = userInput.toUpperCase().trim();
    
    const newDisplayedLetters = upperInput.split("");
    setDisplayedLetters(newDisplayedLetters);

    if (upperInput === currentWord.word.toUpperCase()) {
      playSound("correct");
      setFeedback("correct");
      const points = showHint ? 50 : 100;
      setScore((prev) => prev + points);
      setWordsCompleted((prev) => prev + 1);
      setTimeout(() => {
        setFeedback(null);
        selectNewWord();
      }, 1000);
    } else {
      playSound("wrong");
      setFeedback("wrong");
      setLives((prev) => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          setTimeout(() => {
            playSound("lose");
            setGameStatus("lost");
          }, 800);
        }
        return newLives;
      });
      setTimeout(() => {
        setFeedback(null);
        if (currentWord) {
          setDisplayedLetters(getDisplayWord(currentWord.word));
        }
      }, 1500);
    }
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

  const middleLength = currentWord.word.length - 2;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            {score} pts
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
                    Fill in the missing {middleLength} letter{middleLength > 1 ? "s" : ""}
                  </p>
                </div>

                <motion.div
                  key={currentWord.word}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center gap-1.5 sm:gap-2 flex-wrap"
                >
                  {displayedLetters.map((char, index) => (
                    <motion.div
                      key={`${currentWord.word}-${index}`}
                      initial={{ opacity: 0, rotateY: 90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md ${
                        char === "_"
                          ? "bg-muted border-2 border-dashed border-primary/50"
                          : index === 0 || index === displayedLetters.length - 1
                          ? "bg-primary text-primary-foreground"
                          : feedback === "correct"
                          ? "bg-accent text-accent-foreground"
                          : feedback === "wrong"
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                      data-testid={`letter-${index}`}
                    >
                      {char === "_" ? "" : char}
                    </motion.div>
                  ))}
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

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Type the complete word..."
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback === "wrong"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
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
                      onClick={() => setShowHint(true)}
                      disabled={showHint}
                      className="gap-1.5"
                      data-testid="button-hint"
                    >
                      <Lightbulb className="h-4 w-4" />
                      Hint (-50pts)
                    </Button>
                    <Button
                      onClick={checkAnswer}
                      disabled={userInput.length !== currentWord.word.length || validateMutation.isPending}
                      data-testid="button-submit"
                    >
                      {validateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Submit"
                      )}
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
                  {gameStatus === "won" ? "Word Builder!" : "Game Over"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You completed all the words!"
                    : `The word was "${currentWord.word}"`}
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{score} points</div>
                  <div className="text-sm text-muted-foreground">
                    {wordsCompleted} words completed
                  </div>
                </div>
                <ShareResults
                  gameName="Word Builder"
                  gameSlug="word-builder"
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
