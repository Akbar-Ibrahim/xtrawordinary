import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, Loader2, Type } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { VowelConsonantConfig, WordValidationResponse } from "@shared/schema";

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

type VariationType = 
  | "consonant_count"
  | "vowel_count"
  | "length_consonant_count"
  | "length_vowel_count"
  | "all_vowels"
  | "specific_vowels"
  | "specific_consonants"
  | "start_end_consonant"
  | "length_start_end_consonant"
  | "start_end_vowel"
  | "length_start_end_vowel"
  | "length_start_vowel_end_consonant"
  | "length_start_consonant_end_vowel"
  | "start_vowel_end_consonant"
  | "start_consonant_end_vowel";

type Variation = {
  type: VariationType;
  description: string;
  params: Record<string, number | string | string[]>;
};

function countVowels(word: string): number {
  return word.split("").filter(c => VOWELS.has(c)).length;
}

function countConsonants(word: string): number {
  return word.split("").filter(c => /[A-Z]/.test(c) && !VOWELS.has(c)).length;
}

function isVowel(char: string): boolean {
  return VOWELS.has(char.toUpperCase());
}

function isConsonant(char: string): boolean {
  return /[A-Z]/i.test(char) && !isVowel(char);
}

function generateVariationFromDictionary(dictionary: string[], minWords: number = 10): Variation {
  const variations: VariationType[] = [
    "consonant_count",
    "vowel_count",
    "start_end_consonant",
    "start_end_vowel",
    "start_vowel_end_consonant",
    "start_consonant_end_vowel",
    "specific_vowels",
    "specific_consonants"
  ];
  
  for (const variationType of variations.sort(() => Math.random() - 0.5)) {
    switch (variationType) {
      case "consonant_count": {
        for (const count of [2, 3, 4].sort(() => Math.random() - 0.5)) {
          const matching = dictionary.filter(w => countConsonants(w) === count);
          if (matching.length >= minWords) {
            return {
              type: "consonant_count",
              description: `Words with exactly ${count} consonants`,
              params: { count }
            };
          }
        }
        break;
      }
      case "vowel_count": {
        for (const count of [2, 3, 4].sort(() => Math.random() - 0.5)) {
          const matching = dictionary.filter(w => countVowels(w) === count);
          if (matching.length >= minWords) {
            return {
              type: "vowel_count",
              description: `Words with exactly ${count} vowels`,
              params: { count }
            };
          }
        }
        break;
      }
      case "start_end_consonant": {
        const matching = dictionary.filter(w => isConsonant(w[0]) && isConsonant(w[w.length - 1]));
        if (matching.length >= minWords) {
          return {
            type: "start_end_consonant",
            description: "Words that start AND end with a consonant",
            params: {}
          };
        }
        break;
      }
      case "start_end_vowel": {
        const matching = dictionary.filter(w => isVowel(w[0]) && isVowel(w[w.length - 1]));
        if (matching.length >= minWords) {
          return {
            type: "start_end_vowel",
            description: "Words that start AND end with a vowel",
            params: {}
          };
        }
        break;
      }
      case "start_vowel_end_consonant": {
        const matching = dictionary.filter(w => isVowel(w[0]) && isConsonant(w[w.length - 1]));
        if (matching.length >= minWords) {
          return {
            type: "start_vowel_end_consonant",
            description: "Words that start with a vowel and end with a consonant",
            params: {}
          };
        }
        break;
      }
      case "start_consonant_end_vowel": {
        const matching = dictionary.filter(w => isConsonant(w[0]) && isVowel(w[w.length - 1]));
        if (matching.length >= minWords) {
          return {
            type: "start_consonant_end_vowel",
            description: "Words that start with a consonant and end with a vowel",
            params: {}
          };
        }
        break;
      }
      case "specific_vowels": {
        const vowelPairs = [["A", "E"], ["E", "I"], ["O", "U"], ["A", "I"]];
        for (const vowels of vowelPairs.sort(() => Math.random() - 0.5)) {
          const matching = dictionary.filter(w => vowels.every(v => w.includes(v)));
          if (matching.length >= minWords) {
            return {
              type: "specific_vowels",
              description: `Words containing vowels: ${vowels.join(", ")}`,
              params: { vowels }
            };
          }
        }
        break;
      }
      case "specific_consonants": {
        const consonantPairs = [["B", "T"], ["R", "S"], ["N", "T"], ["L", "D"]];
        for (const consonants of consonantPairs.sort(() => Math.random() - 0.5)) {
          const matching = dictionary.filter(w => consonants.every(c => w.includes(c)));
          if (matching.length >= minWords) {
            return {
              type: "specific_consonants",
              description: `Words containing consonants: ${consonants.join(", ")}`,
              params: { consonants }
            };
          }
        }
        break;
      }
    }
  }
  
  return {
    type: "consonant_count",
    description: "Words with exactly 3 consonants",
    params: { count: 3 }
  };
}

function validateVariation(word: string, variation: Variation): { valid: boolean; message: string } {
  const upperWord = word.toUpperCase();
  
  switch (variation.type) {
    case "consonant_count": {
      const count = variation.params.count as number;
      if (countConsonants(upperWord) !== count) {
        return { valid: false, message: `Word must have exactly ${count} consonants` };
      }
      break;
    }
    case "vowel_count": {
      const count = variation.params.count as number;
      if (countVowels(upperWord) !== count) {
        return { valid: false, message: `Word must have exactly ${count} vowels` };
      }
      break;
    }
    case "length_consonant_count": {
      const { length, count } = variation.params as { length: number; count: number };
      if (upperWord.length !== length) {
        return { valid: false, message: `Word must be ${length} letters long` };
      }
      if (countConsonants(upperWord) !== count) {
        return { valid: false, message: `Word must have exactly ${count} consonants` };
      }
      break;
    }
    case "length_vowel_count": {
      const { length, count } = variation.params as { length: number; count: number };
      if (upperWord.length !== length) {
        return { valid: false, message: `Word must be ${length} letters long` };
      }
      if (countVowels(upperWord) !== count) {
        return { valid: false, message: `Word must have exactly ${count} vowels` };
      }
      break;
    }
    case "all_vowels": {
      const allVowels = ["A", "E", "I", "O", "U"];
      for (const v of allVowels) {
        if (!upperWord.includes(v)) {
          return { valid: false, message: `Word must contain all vowels (A, E, I, O, U)` };
        }
      }
      break;
    }
    case "specific_vowels": {
      const vowels = variation.params.vowels as string[];
      for (const v of vowels) {
        if (!upperWord.includes(v)) {
          return { valid: false, message: `Word must contain vowels: ${vowels.join(", ")}` };
        }
      }
      break;
    }
    case "specific_consonants": {
      const consonants = variation.params.consonants as string[];
      for (const c of consonants) {
        if (!upperWord.includes(c)) {
          return { valid: false, message: `Word must contain consonants: ${consonants.join(", ")}` };
        }
      }
      break;
    }
    case "start_end_consonant": {
      if (!isConsonant(upperWord[0])) {
        return { valid: false, message: "Word must start with a consonant" };
      }
      if (!isConsonant(upperWord[upperWord.length - 1])) {
        return { valid: false, message: "Word must end with a consonant" };
      }
      break;
    }
    case "length_start_end_consonant": {
      const length = variation.params.length as number;
      if (upperWord.length !== length) {
        return { valid: false, message: `Word must be ${length} letters long` };
      }
      if (!isConsonant(upperWord[0]) || !isConsonant(upperWord[upperWord.length - 1])) {
        return { valid: false, message: "Word must start and end with a consonant" };
      }
      break;
    }
    case "start_end_vowel": {
      if (!isVowel(upperWord[0])) {
        return { valid: false, message: "Word must start with a vowel" };
      }
      if (!isVowel(upperWord[upperWord.length - 1])) {
        return { valid: false, message: "Word must end with a vowel" };
      }
      break;
    }
    case "length_start_end_vowel": {
      const length = variation.params.length as number;
      if (upperWord.length !== length) {
        return { valid: false, message: `Word must be ${length} letters long` };
      }
      if (!isVowel(upperWord[0]) || !isVowel(upperWord[upperWord.length - 1])) {
        return { valid: false, message: "Word must start and end with a vowel" };
      }
      break;
    }
    case "start_vowel_end_consonant":
    case "length_start_vowel_end_consonant": {
      if (variation.type === "length_start_vowel_end_consonant") {
        const length = variation.params.length as number;
        if (upperWord.length !== length) {
          return { valid: false, message: `Word must be ${length} letters long` };
        }
      }
      if (!isVowel(upperWord[0])) {
        return { valid: false, message: "Word must start with a vowel" };
      }
      if (!isConsonant(upperWord[upperWord.length - 1])) {
        return { valid: false, message: "Word must end with a consonant" };
      }
      break;
    }
    case "start_consonant_end_vowel":
    case "length_start_consonant_end_vowel": {
      if (variation.type === "length_start_consonant_end_vowel") {
        const length = variation.params.length as number;
        if (upperWord.length !== length) {
          return { valid: false, message: `Word must be ${length} letters long` };
        }
      }
      if (!isConsonant(upperWord[0])) {
        return { valid: false, message: "Word must start with a consonant" };
      }
      if (!isVowel(upperWord[upperWord.length - 1])) {
        return { valid: false, message: "Word must end with a vowel" };
      }
      break;
    }
  }
  
  return { valid: true, message: "" };
}

export function VowelMasterGame() {
  const { data: config, isLoading: configLoading } = useQuery<VowelConsonantConfig>({
    queryKey: ["/api/games/vowel-master/config"],
  });

  const { data: dictionary = [], isLoading: dictLoading } = useQuery<string[]>({
    queryKey: ["/api/games/word-dictionary"],
  });

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  const [round, setRound] = useState(1);
  const [variation, setVariation] = useState<Variation | null>(null);
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost" | "roundComplete">("playing");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wordsPerRound = config?.wordsPerRound || 20;
  const timePerWord = config?.timePerWord || 12;
  const totalRounds = 5;
  const isLoading = configLoading || dictLoading;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(timePerWord);
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
  }, [timePerWord]);

  const initGame = useCallback(() => {
    if (dictionary.length === 0) return;
    setRound(1);
    setVariation(generateVariationFromDictionary(dictionary, 10));
    setScore(0);
    setWordsCompleted(0);
    setGameStatus("playing");
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    startTimer();
  }, [dictionary, startTimer]);

  const startNextRound = useCallback(() => {
    if (dictionary.length === 0) return;
    const newRound = round + 1;
    setRound(newRound);
    setVariation(generateVariationFromDictionary(dictionary, 10));
    setWordsCompleted(0);
    setGameStatus("playing");
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    startTimer();
  }, [dictionary, round, startTimer]);

  useEffect(() => {
    if (dictionary.length > 0 && !variation) {
      setVariation(generateVariationFromDictionary(dictionary, 10));
    }
  }, [dictionary, variation]);

  useEffect(() => {
    if (dictionary.length > 0 && gameStatus === "playing" && timerRef.current === null && variation) {
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dictionary, gameStatus, startTimer, variation]);

  const checkAnswer = async () => {
    if (!userInput.trim() || !variation) return;

    const upperWord = userInput.toUpperCase();

    if (usedWords.has(upperWord)) {
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    const constraintCheck = validateVariation(upperWord, variation);
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

      if (timerRef.current) clearInterval(timerRef.current);
      
      setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      setScore((prev) => prev + 75 + round * 15);
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsPerRound) {
          if (round >= totalRounds) {
            setGameStatus("won");
          } else {
            setGameStatus("roundComplete");
          }
        } else {
          startTimer();
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

  if (isLoading || !variation) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
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
          <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-round">
            <Zap className="h-3.5 w-3.5" />
            Round {round}/{totalRounds}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={timeLeft <= 3 ? "destructive" : "secondary"} className="gap-1.5 min-w-[60px] justify-center" data-testid="badge-timer">
            <Timer className="h-3.5 w-3.5" />
            {timeLeft}s
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
                <div className="text-center space-y-4">
                  <motion.div
                    key={variation.description}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Type className="h-6 w-6 text-primary" />
                  </motion.div>
                  <Badge variant="secondary" className="text-sm px-4 py-2" data-testid="badge-constraint">
                    {variation.description}
                  </Badge>
                  <Progress value={(wordsCompleted / wordsPerRound) * 100} className="h-2" />
                  <p className="text-sm text-muted-foreground">
                    {wordsCompleted} / {wordsPerRound} words
                  </p>
                </div>

                <Progress value={(timeLeft / timePerWord) * 100} className="h-2" />

                <div className="max-w-sm mx-auto space-y-4">
                  <div className="relative">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter a word..."
                      className={`text-center text-lg font-semibold tracking-wider uppercase ${
                        feedback?.type === "correct"
                          ? "border-accent bg-accent/10"
                          : feedback?.type === "wrong" || feedback?.type === "invalid"
                          ? "border-destructive bg-destructive/10"
                          : ""
                      }`}
                      autoFocus
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
        ) : gameStatus === "roundComplete" ? (
          <motion.div
            key="roundComplete"
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
                  <CheckCircle className="h-16 w-16 mx-auto text-accent" />
                </motion.div>
                <h3 className="text-2xl font-bold">Round {round} Complete!</h3>
                <p className="text-muted-foreground">
                  Get ready for a new challenge!
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <p className="font-medium mb-2">Next Round:</p>
                  <p className="text-sm text-muted-foreground">
                    A new vowel/consonant constraint will be generated!
                  </p>
                </div>
                <Button onClick={startNextRound} className="gap-2" data-testid="button-next-round">
                  Start Round {round + 1}
                  <ArrowRight className="h-4 w-4" />
                </Button>
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
                  {gameStatus === "won" ? "Vowel Master!" : "Time's Up!"}
                </h3>
                <p className="text-muted-foreground">
                  {gameStatus === "won"
                    ? "You completed all rounds!"
                    : `You reached Round ${round} with ${wordsCompleted} words`}
                </p>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">{score} points</div>
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
