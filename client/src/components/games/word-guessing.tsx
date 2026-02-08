import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Lightbulb, Trophy, X, Loader2 } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";

const MAX_ATTEMPTS = 6;

type LetterStatus = "correct" | "present" | "absent" | "empty";

interface LetterCell {
  letter: string;
  status: LetterStatus;
}

export function WordGuessingGame() {
  const { playSound } = useSound();
  const { data: words = [], isLoading, error, refetch } = useQuery<string[]>({
    queryKey: ["/api/games/word-guessing/words"],
    refetchOnMount: "always",
  });

  const [activeWords, setActiveWords] = useState<string[]>([]);
  const [targetWord, setTargetWord] = useState("");
  const [guesses, setGuesses] = useState<LetterCell[][]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">("playing");
  const [usedLetters, setUsedLetters] = useState<Map<string, LetterStatus>>(new Map());
  const [shake, setShake] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");

  const initGame = useCallback(async () => {
    const result = await refetch();
    const freshWords = result.data || [];
    if (freshWords.length === 0) return;
    setActiveWords(freshWords);
    const word = freshWords[Math.floor(Math.random() * freshWords.length)];
    setTargetWord(word);
    setGuesses([]);
    setCurrentGuess("");
    setGameStatus("playing");
    setUsedLetters(new Map());
  }, [refetch]);

  useEffect(() => {
    if (words.length > 0 && !targetWord) {
      initGame();
    }
  }, [words, targetWord, initGame]);

  const checkGuess = (guess: string): LetterCell[] => {
    const result: LetterCell[] = [];
    const targetLetters = targetWord.split("");
    const guessLetters = guess.split("");
    const used = new Array(5).fill(false);

    guessLetters.forEach((letter, i) => {
      if (letter === targetLetters[i]) {
        result[i] = { letter, status: "correct" };
        used[i] = true;
      }
    });

    guessLetters.forEach((letter, i) => {
      if (result[i]) return;
      const foundIndex = targetLetters.findIndex(
        (t, j) => t === letter && !used[j] && !result[j]?.status
      );
      if (foundIndex !== -1) {
        result[i] = { letter, status: "present" };
        used[foundIndex] = true;
      } else {
        result[i] = { letter, status: "absent" };
      }
    });

    return result;
  };

  const submitGuess = () => {
    if (currentGuess.length !== 5) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const result = checkGuess(currentGuess);
    const newGuesses = [...guesses, result];
    setGuesses(newGuesses);

    const newUsedLetters = new Map(usedLetters);
    result.forEach(({ letter, status }) => {
      const existing = newUsedLetters.get(letter);
      if (!existing || status === "correct" || (status === "present" && existing === "absent")) {
        newUsedLetters.set(letter, status);
      }
    });
    setUsedLetters(newUsedLetters);

    if (currentGuess === targetWord) {
      playSound("win");
      setGameStatus("won");
      setCompletionMessage(getCompletionMessage(true));
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      playSound("lose");
      setGameStatus("lost");
      setCompletionMessage(getCompletionMessage(false));
    } else {
      const allCorrect = result.every(r => r.status === "correct");
      if (!allCorrect && result.some(r => r.status === "present" || r.status === "absent")) {
        playSound("wrong");
      }
    }

    setCurrentGuess("");
  };

  const handleKeyPress = (key: string) => {
    if (gameStatus !== "playing") return;

    if (key === "ENTER") {
      submitGuess();
    } else if (key === "BACKSPACE") {
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess((prev) => prev + key);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key === "ENTER" || key === "BACKSPACE" || /^[A-Z]$/.test(key)) {
        e.preventDefault();
        handleKeyPress(key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const keyboard = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ];

  const getLetterColor = (status: LetterStatus) => {
    switch (status) {
      case "correct":
        return "bg-accent text-accent-foreground";
      case "present":
        return "bg-chart-3 text-white";
      case "absent":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-card border-2";
    }
  };

  const getKeyColor = (letter: string) => {
    const status = usedLetters.get(letter);
    if (!status) return "bg-secondary";
    return getLetterColor(status);
  };

  const renderGrid = () => {
    const rows = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const cells = [];
      for (let j = 0; j < 5; j++) {
        let cell: LetterCell;
        if (guesses[i]) {
          cell = guesses[i][j];
        } else if (i === guesses.length) {
          cell = { letter: currentGuess[j] || "", status: "empty" };
        } else {
          cell = { letter: "", status: "empty" };
        }
        cells.push(
          <motion.div
            key={`${i}-${j}`}
            initial={cell.status !== "empty" && i === guesses.length - 1 ? { rotateX: 0 } : false}
            animate={cell.status !== "empty" && i === guesses.length - 1 ? { rotateX: 360 } : {}}
            transition={{ duration: 0.5, delay: j * 0.1 }}
            className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-xl font-bold rounded-md ${getLetterColor(cell.status)} ${
              i === guesses.length && shake ? "animate-shake" : ""
            }`}
            data-testid={`cell-${i}-${j}`}
            aria-label={cell.letter ? `${cell.letter}, ${cell.status === "empty" ? "pending" : cell.status}` : "Empty cell"}
          >
            {cell.letter}
          </motion.div>
        );
      }
      rows.push(
        <div key={i} className="flex gap-1.5 justify-center">
          {cells}
        </div>
      );
    }
    return rows;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" data-testid="badge-attempts">
            {guesses.length}/{MAX_ATTEMPTS} attempts
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
          New Game
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-1.5" aria-label="Word guessing grid" role="grid">{renderGrid()}</div>
        </CardContent>
      </Card>

      <div aria-live="polite">
        <AnimatePresence>
          {gameStatus !== "playing" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
            <Card className={gameStatus === "won" ? "border-accent" : "border-destructive"}>
              <CardContent className="p-6 text-center">
                {gameStatus === "won" ? (
                  <div className="space-y-2">
                    <Trophy className="h-12 w-12 mx-auto text-accent" />
                    <h3 className="text-xl font-bold">Congratulations!</h3>
                    <p className="text-muted-foreground">
                      You guessed the word in {guesses.length} attempts!
                    </p>
                    <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <X className="h-12 w-12 mx-auto text-destructive" />
                    <h3 className="text-xl font-bold">Game Over</h3>
                    <p className="text-muted-foreground">
                      The word was <span className="font-bold">{targetWord}</span>
                    </p>
                    <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
                  </div>
                )}
                <ShareResults
                  gameName="Word Guessing"
                  gameSlug="word-guessing"
                  score={MAX_ATTEMPTS - guesses.length + 1}
                  isWin={gameStatus === "won"}
                />
                <Button onClick={initGame} className="mt-4" data-testid="button-play-again">
                  Play Again
                </Button>
              </CardContent>
            </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        {keyboard.map((row, i) => (
          <div key={i} className="flex justify-center gap-1">
            {row.map((key) => (
              <Button
                key={key}
                variant="secondary"
                size="sm"
                onClick={() => handleKeyPress(key)}
                className={`${
                  key.length > 1 ? "px-2 sm:px-4 text-xs" : "w-8 sm:w-10"
                } h-12 font-semibold ${getKeyColor(key)}`}
                disabled={gameStatus !== "playing"}
                data-testid={`key-${key.toLowerCase()}`}
                aria-label={key === "BACKSPACE" ? "Backspace" : key === "ENTER" ? "Submit guess" : key}
              >
                {key === "BACKSPACE" ? "←" : key}
              </Button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
        <Lightbulb className="h-4 w-4" />
        <span>Tip: Green = correct position, Yellow = wrong position</span>
      </div>
    </div>
  );
}
