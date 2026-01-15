import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Shuffle, Trophy, Timer, CheckCircle, XCircle } from "lucide-react";

const WORD_SETS = [
  { original: "LISTEN", anagram: "SILENT", hint: "Without sound" },
  { original: "DANGER", anagram: "GARDEN", hint: "A place to grow flowers" },
  { original: "EARTH", anagram: "HEART", hint: "It pumps blood" },
  { original: "DUSTY", anagram: "STUDY", hint: "What students do" },
  { original: "NIGHT", anagram: "THING", hint: "An object or item" },
  { original: "ANGEL", anagram: "ANGLE", hint: "Geometry term" },
  { original: "SAVES", anagram: "VASES", hint: "Hold flowers" },
  { original: "BORED", anagram: "ROBED", hint: "Wearing a robe" },
];

export function AnagramSolverGame() {
  const [currentSet, setCurrentSet] = useState(WORD_SETS[0]);
  const [shuffledLetters, setShuffledLetters] = useState<string[]>([]);
  const [selectedLetters, setSelectedLetters] = useState<number[]>([]);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "timeup">("playing");
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [usedSets, setUsedSets] = useState<Set<number>>(new Set());

  const shuffleArray = (arr: string[]) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const selectNewWord = useCallback(() => {
    const availableIndices = WORD_SETS.map((_, i) => i).filter(i => !usedSets.has(i));
    if (availableIndices.length === 0) {
      setGameStatus("won");
      return;
    }
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const newSet = WORD_SETS[randomIndex];
    setCurrentSet(newSet);
    setShuffledLetters(shuffleArray(newSet.original.split("")));
    setSelectedLetters([]);
    setAnswer("");
    setShowHint(false);
    setUsedSets(prev => new Set(Array.from(prev).concat(randomIndex)));
  }, [usedSets]);

  const initGame = useCallback(() => {
    setScore(0);
    setStreak(0);
    setTimeLeft(60);
    setGameStatus("playing");
    setUsedSets(new Set());
    const randomIndex = Math.floor(Math.random() * WORD_SETS.length);
    const newSet = WORD_SETS[randomIndex];
    setCurrentSet(newSet);
    setShuffledLetters(shuffleArray(newSet.original.split("")));
    setSelectedLetters([]);
    setAnswer("");
    setShowHint(false);
    setUsedSets(new Set([randomIndex]));
  }, []);

  useEffect(() => {
    initGame();
  }, []);

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

  const handleLetterClick = (index: number) => {
    if (selectedLetters.includes(index)) {
      setSelectedLetters(prev => prev.filter(i => i !== index));
      setAnswer(prev => {
        const idx = selectedLetters.indexOf(index);
        return prev.slice(0, idx) + prev.slice(idx + 1);
      });
    } else {
      setSelectedLetters(prev => [...prev, index]);
      setAnswer(prev => prev + shuffledLetters[index]);
    }
  };

  const checkAnswer = () => {
    if (answer.toUpperCase() === currentSet.anagram) {
      setFeedback("correct");
      const points = showHint ? 50 : 100;
      setScore(prev => prev + points + (streak * 10));
      setStreak(prev => prev + 1);
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

  const reshuffleLetters = () => {
    setShuffledLetters(shuffleArray(currentSet.original.split("")));
    setSelectedLetters([]);
    setAnswer("");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
                    Rearrange the letters to form a word
                  </p>
                  {showHint && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-primary font-medium"
                    >
                      Hint: {currentSet.hint}
                    </motion.p>
                  )}
                </div>

                <div className="flex justify-center gap-2 flex-wrap">
                  {shuffledLetters.map((letter, index) => (
                    <motion.button
                      key={index}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleLetterClick(index)}
                      className={`w-12 h-12 sm:w-14 sm:h-14 text-xl font-bold rounded-md border-2 transition-all ${
                        selectedLetters.includes(index)
                          ? "bg-primary text-primary-foreground border-primary scale-90 opacity-50"
                          : "bg-card hover-elevate"
                      }`}
                      data-testid={`letter-${index}`}
                    >
                      {letter}
                    </motion.button>
                  ))}
                </div>

                <div className="flex justify-center">
                  <div
                    className={`min-w-[200px] h-14 flex items-center justify-center rounded-md border-2 border-dashed text-xl font-bold tracking-wider ${
                      feedback === "correct"
                        ? "border-accent bg-accent/10 text-accent"
                        : feedback === "wrong"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-muted"
                    }`}
                    data-testid="answer-display"
                  >
                    {answer || (
                      <span className="text-muted-foreground text-base font-normal">
                        Click letters above
                      </span>
                    )}
                    {feedback === "correct" && (
                      <CheckCircle className="h-5 w-5 ml-2 text-accent" />
                    )}
                    {feedback === "wrong" && (
                      <XCircle className="h-5 w-5 ml-2 text-destructive" />
                    )}
                  </div>
                </div>

                <div className="flex justify-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={reshuffleLetters}
                    className="gap-1.5"
                    data-testid="button-shuffle"
                  >
                    <Shuffle className="h-4 w-4" />
                    Shuffle
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowHint(true)}
                    disabled={showHint}
                    data-testid="button-hint"
                  >
                    Show Hint (-50pts)
                  </Button>
                  <Button
                    onClick={checkAnswer}
                    disabled={answer.length !== currentSet.anagram.length}
                    data-testid="button-submit"
                  >
                    Submit
                  </Button>
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
            <Card className={gameStatus === "won" ? "border-accent" : "border-chart-3"}>
              <CardContent className="p-6 text-center space-y-4">
                <Trophy className={`h-16 w-16 mx-auto ${gameStatus === "won" ? "text-accent" : "text-chart-3"}`} />
                <h3 className="text-2xl font-bold">
                  {gameStatus === "won" ? "Amazing!" : "Time's Up!"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You solved all the anagrams!"
                    : `You scored ${score} points!`}
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
