import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, CheckCircle, XCircle, BookOpen, Loader2 } from "lucide-react";
import type { DefinitionWord } from "@shared/schema";

export function DefinitionMatchGame() {
  const { data: words = [], isLoading, error } = useQuery<DefinitionWord[]>({
    queryKey: ["/api/games/definition-match/words"],
  });

  const [currentWord, setCurrentWord] = useState<DefinitionWord | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won">("playing");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [showAnswer, setShowAnswer] = useState(false);

  const selectNewWord = useCallback(() => {
    const availableWords = words.filter((w) => !usedWords.has(w.word));
    if (availableWords.length === 0) {
      setGameStatus("won");
      return;
    }
    const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    setCurrentWord(randomWord);
    setUserInput("");
    setShowAnswer(false);
    setUsedWords((prev) => new Set(Array.from(prev).concat(randomWord.word)));
  }, [usedWords, words]);

  const initGame = useCallback(() => {
    if (words.length === 0) return;
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setGameStatus("playing");
    setUsedWords(new Set());
    setShowAnswer(false);
    const randomWord = words[Math.floor(Math.random() * words.length)];
    setCurrentWord(randomWord);
    setUserInput("");
    setUsedWords(new Set([randomWord.word]));
  }, [words]);

  useEffect(() => {
    if (words.length > 0 && !currentWord) {
      initGame();
    }
  }, [words, currentWord, initGame]);

  const checkAnswer = () => {
    if (!currentWord) return;
    if (userInput.toUpperCase().trim() === currentWord.word.toUpperCase()) {
      setFeedback("correct");
      const points = 100 + streak * 20;
      setScore((prev) => prev + points);
      setStreak((prev) => prev + 1);
      setWordsCompleted((prev) => prev + 1);
      setTimeout(() => {
        setFeedback(null);
        selectNewWord();
      }, 1000);
    } else {
      setFeedback("wrong");
      setStreak(0);
      setTimeout(() => setFeedback(null), 1000);
    }
  };

  const skipWord = () => {
    setShowAnswer(true);
    setStreak(0);
    setTimeout(() => {
      selectNewWord();
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !showAnswer) {
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
          {streak > 1 && (
            <Badge className="bg-accent text-accent-foreground" data-testid="badge-streak">
              {streak}x streak
            </Badge>
          )}
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
                <div className="text-center space-y-4">
                  <Badge variant="secondary" className="gap-1.5" data-testid="badge-pos">
                    <BookOpen className="h-3.5 w-3.5" />
                    {currentWord.partOfSpeech}
                  </Badge>
                  
                  <motion.div
                    key={currentWord.word}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <p className="text-lg sm:text-xl text-muted-foreground italic">
                      "{currentWord.definition}"
                    </p>
                  </motion.div>
                </div>

                {showAnswer && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                  >
                    <p className="text-sm text-muted-foreground mb-1">The answer was:</p>
                    <p className="text-2xl font-bold text-primary">{currentWord.word}</p>
                  </motion.div>
                )}

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type the word..."
                      className={`text-center text-lg font-semibold tracking-wider ${
                        feedback === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback === "wrong"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
                      disabled={showAnswer}
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
                      disabled={showAnswer}
                      data-testid="button-skip"
                    >
                      Skip (Show Answer)
                    </Button>
                    <Button
                      onClick={checkAnswer}
                      disabled={userInput.length === 0 || showAnswer}
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
            <Card className="border-accent">
              <CardContent className="p-6 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <Trophy className="h-16 w-16 mx-auto text-accent" />
                </motion.div>
                <h3 className="text-2xl font-bold">Vocabulary Master!</h3>
                <p className="text-muted-foreground">
                  You matched all the definitions!
                </p>
                <div className="text-3xl font-bold text-primary">{score} points</div>
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
