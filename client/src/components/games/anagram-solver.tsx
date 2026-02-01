import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Timer, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import type { AnagramWordSet } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";

export function AnagramSolverGame() {
  const { playSound } = useSound();
  const { data: wordSets = [], isLoading, error, refetch } = useQuery<AnagramWordSet[]>({
    queryKey: ["/api/games/anagram-solver/words"],
    refetchOnMount: "always",
  });

  const [activeWordSets, setActiveWordSets] = useState<AnagramWordSet[]>([]);
  const [currentSet, setCurrentSet] = useState<AnagramWordSet | null>(null);
  const [userInput, setUserInput] = useState("");
  const [foundAnagrams, setFoundAnagrams] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "timeup">("playing");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "duplicate"; message: string } | null>(null);
  const [usedSets, setUsedSets] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const selectNewWord = useCallback(() => {
    const availableIndices = activeWordSets.map((_, i) => i).filter(i => !usedSets.has(i));
    if (availableIndices.length === 0) {
      playSound("win");
      setGameStatus("won");
      return;
    }
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const newSet = activeWordSets[randomIndex];
    setCurrentSet(newSet);
    setFoundAnagrams([]);
    setUserInput("");
    setUsedSets(prev => new Set(Array.from(prev).concat(randomIndex)));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [usedSets, activeWordSets]);

  const initGame = useCallback(async () => {
    const result = await refetch();
    const freshWordSets = result.data || [];
    if (freshWordSets.length === 0) return;
    setActiveWordSets(freshWordSets);
    setScore(0);
    setStreak(0);
    setTimeLeft(90);
    setGameStatus("playing");
    setUsedSets(new Set());
    setFoundAnagrams([]);
    const randomIndex = Math.floor(Math.random() * freshWordSets.length);
    const newSet = freshWordSets[randomIndex];
    setCurrentSet(newSet);
    setUserInput("");
    setUsedSets(new Set([randomIndex]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [refetch]);

  useEffect(() => {
    if (wordSets.length > 0 && !currentSet) {
      initGame();
    }
  }, [wordSets, currentSet, initGame]);

  useEffect(() => {
    if (gameStatus !== "playing") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameStatus("timeup");
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
    
    if (foundAnagrams.includes(upperInput)) {
      playSound("wrong");
      setFeedback({ type: "duplicate", message: "Already found!" });
      setTimeout(() => setFeedback(null), 1000);
      return;
    }
    
    if (currentSet.anagrams.includes(upperInput)) {
      playSound("correct");
      setFeedback({ type: "correct", message: "Correct!" });
      const newFoundAnagrams = [...foundAnagrams, upperInput];
      setFoundAnagrams(newFoundAnagrams);
      setScore(prev => prev + 100 + (streak * 10));
      setStreak(prev => prev + 1);
      setUserInput("");
      
      setTimeout(() => {
        setFeedback(null);
        if (newFoundAnagrams.length === currentSet.anagrams.length) {
          setScore(prev => prev + 200);
          selectNewWord();
        }
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
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`gap-1.5 ${timeLeft <= 10 ? "text-destructive border-destructive" : ""}`}
            data-testid="badge-timer"
          >
            <Timer className="h-3.5 w-3.5" />
            {formatTime(timeLeft)}
          </Badge>
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
                  <p className="text-sm text-muted-foreground">
                    Find all anagrams of this word
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {foundAnagrams.length} / {currentSet.anagrams.length} found
                  </p>
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
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Type an anagram..."
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback?.type === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback?.type === "wrong" || feedback?.type === "duplicate"
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

                  {feedback && feedback.type !== "correct" && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-sm text-destructive"
                    >
                      {feedback.message}
                    </motion.p>
                  )}

                  <Button
                    onClick={checkAnswer}
                    disabled={!userInput.trim()}
                    className="w-full"
                    data-testid="button-submit"
                  >
                    Submit
                  </Button>
                </div>

                {foundAnagrams.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    <p className="w-full text-center text-sm text-muted-foreground mb-2">Found:</p>
                    {foundAnagrams.map((word) => (
                      <Badge key={word} variant="secondary" className="text-sm">
                        {word}
                      </Badge>
                    ))}
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
                    ? "You found all the anagrams!"
                    : `You found ${foundAnagrams.length} anagrams!`}
                </p>
                <div className="text-3xl font-bold text-primary">{score} points</div>
                <ShareResults
                  gameName="Anagram Solver"
                  gameSlug="anagram-solver"
                  score={score}
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
