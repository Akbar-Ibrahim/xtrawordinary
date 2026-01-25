import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, Loader2, ArrowRight, Menu } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { WordValidationResponse } from "@shared/schema";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ENDS_WITH_ALPHABET = ALPHABET.filter(l => !["J", "Q", "X", "V", "Z"].includes(l));

type LevelConstraint = {
  length: number;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
};

// Generate random constraint based on variation
function generateConstraint(variation: number): LevelConstraint {
  const length = Math.floor(Math.random() * 6) + 3; // 3-8 letters
  const randomLetter = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const randomEndLetter = () => ENDS_WITH_ALPHABET[Math.floor(Math.random() * ENDS_WITH_ALPHABET.length)];
  
  switch (variation) {
    case 1:
      return { length };
    case 2:
      return { length, startsWith: randomLetter() };
    case 3:
      return { length, endsWith: randomEndLetter() };
    case 4:
      return { length, startsWith: randomLetter(), contains: randomLetter() };
    case 5:
      return { length, endsWith: randomEndLetter(), contains: randomLetter() };
    default:
      return { length };
  }
}

const variationDescriptions = [
  "Form {length}-letter words",
  "Form {length}-letter words starting with '{startsWith}'",
  "Form {length}-letter words ending with '{endsWith}'",
  "Form {length}-letter words starting with '{startsWith}' with '{contains}' inside (not at end)",
  "Form {length}-letter words ending with '{endsWith}' with '{contains}' inside (not at start)"
];

const variationOptions = [
  { id: 1, name: "Length Only", description: "Form words of a specific length" },
  { id: 2, name: "Starts With", description: "Same length + must start with a specific letter" },
  { id: 3, name: "Ends With", description: "Same length + must end with a specific letter" },
  { id: 4, name: "Starts & Contains", description: "Same length + starts with letter + contains letter" },
  { id: 5, name: "Ends & Contains", description: "Same length + ends with letter + contains letter" },
];

function formatConstraint(variation: number, constraint: LevelConstraint): string {
  let desc = variationDescriptions[variation - 1];
  desc = desc.replace("{length}", String(constraint.length));
  if (constraint.startsWith) desc = desc.replace("{startsWith}", constraint.startsWith);
  if (constraint.endsWith) desc = desc.replace("{endsWith}", constraint.endsWith);
  if (constraint.contains) desc = desc.replace("{contains}", constraint.contains);
  return desc;
}

// Local constraint validation (length, starts with, ends with, contains)
function validateConstraint(word: string, constraint: LevelConstraint, variation: number): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  
  if (upperWord.length !== constraint.length) {
    return { valid: false, message: `Word must be ${constraint.length} letters` };
  }
  if (constraint.startsWith && !upperWord.startsWith(constraint.startsWith)) {
    return { valid: false, message: `Word must start with '${constraint.startsWith}'` };
  }
  if (constraint.endsWith && !upperWord.endsWith(constraint.endsWith)) {
    return { valid: false, message: `Word must end with '${constraint.endsWith}'` };
  }
  if (constraint.contains) {
    // For variation 4 (Starts & Contains): contains letter must not be at the last position only
    // For variation 5 (Ends & Contains): contains letter must not be at the first position only
    const containsLetter = constraint.contains;
    const middlePart = variation === 4 
      ? upperWord.slice(0, -1)  // Exclude last letter
      : variation === 5 
        ? upperWord.slice(1)    // Exclude first letter
        : upperWord;
    
    if (!middlePart.includes(containsLetter)) {
      const positionHint = variation === 4 ? " (not just at the end)" : variation === 5 ? " (not just at the start)" : "";
      return { valid: false, message: `Word must contain '${containsLetter}'${positionHint}` };
    }
  }
  return { valid: true, message: "" };
}

export function WordLengthGame() {
  // Word validation via backend - no dictionary pre-fetch
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [variation, setVariation] = useState<number>(1);
  const [constraint, setConstraint] = useState<LevelConstraint | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [gameStatus, setGameStatus] = useState<"menu" | "playing" | "won" | "lost">("menu");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wordsPerVariation = 20;
  const timePerVariation = 120;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameStatus("lost");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Start game - generate constraint locally
  const startGame = useCallback((varId: number) => {
    setVariation(varId);
    setScore(0);
    setWordsCompleted(0);
    setTimeLeft(timePerVariation);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    setConstraint(generateConstraint(varId));
    setGameStatus("playing");
    startTimer();
  }, [timePerVariation, startTimer]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const checkAnswer = async () => {
    if (!userInput.trim() || !constraint) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    const constraintCheck = validateConstraint(upperWord, constraint, variation);
    if (!constraintCheck.valid) {
      setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    try {
      const result = await validateMutation.mutateAsync(upperWord);
      if (!result.valid) {
        setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => setFeedback(null), 1500);
        return;
      }

      setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      setScore((prev) => prev + 100 + variation * 20);
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsPerVariation) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameStatus("won");
        }
      }, 500);
    } catch {
      setFeedback({ type: "invalid", message: "Error validating word" });
      setTimeout(() => setFeedback(null), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkAnswer();
    }
  };

  if (gameStatus === "menu") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-center mb-6">Choose Your Challenge</h3>
            <div className="grid gap-3">
              {variationOptions.map((option) => (
                <motion.div
                  key={option.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 px-6 flex flex-col items-start text-left gap-1"
                    onClick={() => startGame(option.id)}
                    data-testid={`button-var-${option.id}`}
                  >
                    <span className="font-semibold">Variation {option.id}: {option.name}</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      {option.description}
                    </span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            {score} pts
          </Badge>
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-variation">
            <Zap className="h-3.5 w-3.5" />
            Variation {variation}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={timeLeft <= 30 ? "destructive" : "secondary"} className="gap-1.5" data-testid="badge-timer">
            <Timer className="h-3.5 w-3.5" />
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGameStatus("menu")}
            className="gap-1.5"
            data-testid="button-restart"
          >
            <RotateCcw className="h-4 w-4" />
            Back to Menu
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
                  <Badge variant="secondary" className="text-sm" data-testid="badge-constraint">
                    {constraint && formatConstraint(variation, constraint)}
                  </Badge>
                  <Progress value={(wordsCompleted / wordsPerVariation) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {wordsCompleted} / {wordsPerVariation} words
                  </p>
                </div>

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder={`Enter a ${constraint?.length || 5}-letter word...`}
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback?.type === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback?.type === "wrong" || feedback?.type === "invalid"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
                      data-testid="input-word"
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
                    disabled={!userInput.trim() || validateMutation.isPending}
                    className="w-full"
                    data-testid="button-submit"
                  >
                    {validateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1 justify-center">
                  {Array.from(usedWords).slice(-10).map((word) => (
                    <Badge key={word} variant="outline" className="text-xs">
                      {word}
                    </Badge>
                  ))}
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
                  {gameStatus === "won" ? "Champion!" : "Time's Up!"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? `You completed Variation ${variation}!`
                    : `You completed ${wordsCompleted} words`}
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{score} points</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => startGame(variation)} 
                    className="gap-1.5"
                    data-testid="button-play-again"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Play Again
                  </Button>
                  {gameStatus === "won" && variation < 5 && (
                    <Button 
                      onClick={() => startGame(variation + 1)} 
                      className="gap-1.5"
                      data-testid="button-next-challenge"
                    >
                      Next Challenge
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    onClick={() => setGameStatus("menu")} 
                    className="gap-1.5"
                    data-testid="button-back-menu"
                  >
                    <Menu className="h-4 w-4" />
                    Back to Menu
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
