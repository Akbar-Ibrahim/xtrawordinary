import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, ArrowLeft, Loader2, Type, Skull, Sparkles } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { apiRequest } from "@/lib/queryClient";
import type { VowelConsonantConfig, WordValidationResponse } from "@shared/schema";

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

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

// Variation category types
type VariationCategory = 
  | "consonant_count"
  | "vowel_count"
  | "start_end_vowel"
  | "start_end_consonant"
  | "start_vowel_end_consonant"
  | "start_consonant_end_vowel"
  | "consonant_oblivion"
  | "vowel_oblivion";

// Level type - either a number or "advanced"
type LevelType = number | "advanced";

// Current constraint for gameplay
interface GameConstraint {
  description: string;
  validate: (word: string) => { valid: boolean; message: string };
}

// Category definitions with their level ranges
interface CategoryDefinition {
  id: VariationCategory;
  name: string;
  description: string;
  icon: "count" | "position" | "oblivion";
  levelType: "count" | "length";
  minLevel: number;
  maxLevel: number;
  hasAdvanced: boolean;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: "consonant_count",
    name: "Consonant Count",
    description: "Words with a specific number of consonants",
    icon: "count",
    levelType: "count",
    minLevel: 2,
    maxLevel: 7,
    hasAdvanced: true,
  },
  {
    id: "vowel_count",
    name: "Vowel Count",
    description: "Words with a specific number of vowels",
    icon: "count",
    levelType: "count",
    minLevel: 2,
    maxLevel: 7,
    hasAdvanced: true,
  },
  {
    id: "start_end_vowel",
    name: "Start & End Vowels",
    description: "Words that start and end with vowels",
    icon: "position",
    levelType: "length",
    minLevel: 4,
    maxLevel: 12,
    hasAdvanced: true,
  },
  {
    id: "start_end_consonant",
    name: "Start & End Consonants",
    description: "Words that start and end with consonants",
    icon: "position",
    levelType: "length",
    minLevel: 4,
    maxLevel: 12,
    hasAdvanced: true,
  },
  {
    id: "start_vowel_end_consonant",
    name: "Start Vowel, End Consonant",
    description: "Words starting with a vowel, ending with a consonant",
    icon: "position",
    levelType: "length",
    minLevel: 4,
    maxLevel: 12,
    hasAdvanced: true,
  },
  {
    id: "start_consonant_end_vowel",
    name: "Start Consonant, End Vowel",
    description: "Words starting with a consonant, ending with a vowel",
    icon: "position",
    levelType: "length",
    minLevel: 4,
    maxLevel: 12,
    hasAdvanced: true,
  },
  {
    id: "consonant_oblivion",
    name: "Consonant Oblivion",
    description: "Exact consonant count AND word length - ultimate challenge!",
    icon: "oblivion",
    levelType: "count",
    minLevel: 2,
    maxLevel: 5,
    hasAdvanced: true,
  },
  {
    id: "vowel_oblivion",
    name: "Vowel Oblivion",
    description: "Exact vowel count AND word length - ultimate challenge!",
    icon: "oblivion",
    levelType: "count",
    minLevel: 2,
    maxLevel: 5,
    hasAdvanced: true,
  },
];

// Generate constraint based on category and level
function generateConstraint(
  category: VariationCategory,
  level: LevelType,
  wordIndex: number = 0
): GameConstraint {
  const categoryDef = CATEGORIES.find(c => c.id === category)!;
  
  // For advanced mode, randomize the constraint value
  const getRandomValue = (min: number, max: number) => 
    Math.floor(Math.random() * (max - min + 1)) + min;
  
  const isAdvanced = level === "advanced";
  
  switch (category) {
    case "consonant_count": {
      const count = isAdvanced ? getRandomValue(2, 7) : level as number;
      return {
        description: `Words with exactly ${count} consonants`,
        validate: (word: string) => {
          const actual = countConsonants(word.toUpperCase());
          if (actual !== count) {
            return { valid: false, message: `Word must have exactly ${count} consonants (found ${actual})` };
          }
          return { valid: true, message: "" };
        }
      };
    }
    
    case "vowel_count": {
      const count = isAdvanced ? getRandomValue(2, 7) : level as number;
      return {
        description: `Words with exactly ${count} vowels`,
        validate: (word: string) => {
          const actual = countVowels(word.toUpperCase());
          if (actual !== count) {
            return { valid: false, message: `Word must have exactly ${count} vowels (found ${actual})` };
          }
          return { valid: true, message: "" };
        }
      };
    }
    
    case "start_end_vowel": {
      const length = isAdvanced ? getRandomValue(4, 12) : level as number;
      return {
        description: isAdvanced 
          ? `${length}-letter word starting AND ending with a vowel`
          : `${length}-letter words starting AND ending with a vowel`,
        validate: (word: string) => {
          const upper = word.toUpperCase();
          if (upper.length !== length) {
            return { valid: false, message: `Word must be exactly ${length} letters long` };
          }
          if (!isVowel(upper[0])) {
            return { valid: false, message: "Word must start with a vowel" };
          }
          if (!isVowel(upper[upper.length - 1])) {
            return { valid: false, message: "Word must end with a vowel" };
          }
          return { valid: true, message: "" };
        }
      };
    }
    
    case "start_end_consonant": {
      const length = isAdvanced ? getRandomValue(4, 12) : level as number;
      return {
        description: isAdvanced 
          ? `${length}-letter word starting AND ending with a consonant`
          : `${length}-letter words starting AND ending with a consonant`,
        validate: (word: string) => {
          const upper = word.toUpperCase();
          if (upper.length !== length) {
            return { valid: false, message: `Word must be exactly ${length} letters long` };
          }
          if (!isConsonant(upper[0])) {
            return { valid: false, message: "Word must start with a consonant" };
          }
          if (!isConsonant(upper[upper.length - 1])) {
            return { valid: false, message: "Word must end with a consonant" };
          }
          return { valid: true, message: "" };
        }
      };
    }
    
    case "start_vowel_end_consonant": {
      const length = isAdvanced ? getRandomValue(4, 12) : level as number;
      return {
        description: isAdvanced 
          ? `${length}-letter word: vowel start, consonant end`
          : `${length}-letter words: vowel start, consonant end`,
        validate: (word: string) => {
          const upper = word.toUpperCase();
          if (upper.length !== length) {
            return { valid: false, message: `Word must be exactly ${length} letters long` };
          }
          if (!isVowel(upper[0])) {
            return { valid: false, message: "Word must start with a vowel" };
          }
          if (!isConsonant(upper[upper.length - 1])) {
            return { valid: false, message: "Word must end with a consonant" };
          }
          return { valid: true, message: "" };
        }
      };
    }
    
    case "start_consonant_end_vowel": {
      const length = isAdvanced ? getRandomValue(4, 12) : level as number;
      return {
        description: isAdvanced 
          ? `${length}-letter word: consonant start, vowel end`
          : `${length}-letter words: consonant start, vowel end`,
        validate: (word: string) => {
          const upper = word.toUpperCase();
          if (upper.length !== length) {
            return { valid: false, message: `Word must be exactly ${length} letters long` };
          }
          if (!isConsonant(upper[0])) {
            return { valid: false, message: "Word must start with a consonant" };
          }
          if (!isVowel(upper[upper.length - 1])) {
            return { valid: false, message: "Word must end with a vowel" };
          }
          return { valid: true, message: "" };
        }
      };
    }
    
    case "consonant_oblivion": {
      const count = isAdvanced ? getRandomValue(2, 5) : level as number;
      // Word length is count + random vowels (between 2 and 4)
      const vowelCount = isAdvanced ? getRandomValue(2, 4) : (wordIndex % 3) + 2;
      const length = count + vowelCount;
      return {
        description: `${length}-letter word with exactly ${count} consonants`,
        validate: (word: string) => {
          const upper = word.toUpperCase();
          if (upper.length !== length) {
            return { valid: false, message: `Word must be exactly ${length} letters long` };
          }
          const actualConsonants = countConsonants(upper);
          if (actualConsonants !== count) {
            return { valid: false, message: `Word must have exactly ${count} consonants (found ${actualConsonants})` };
          }
          return { valid: true, message: "" };
        }
      };
    }
    
    case "vowel_oblivion": {
      const count = isAdvanced ? getRandomValue(2, 5) : level as number;
      // Word length is count + random consonants (between 2 and 5)
      const consonantCount = isAdvanced ? getRandomValue(2, 5) : (wordIndex % 4) + 2;
      const length = count + consonantCount;
      return {
        description: `${length}-letter word with exactly ${count} vowels`,
        validate: (word: string) => {
          const upper = word.toUpperCase();
          if (upper.length !== length) {
            return { valid: false, message: `Word must be exactly ${length} letters long` };
          }
          const actualVowels = countVowels(upper);
          if (actualVowels !== count) {
            return { valid: false, message: `Word must have exactly ${count} vowels (found ${actualVowels})` };
          }
          return { valid: true, message: "" };
        }
      };
    }
  }
}

// Game states
type GameState = 
  | "category_menu"  // Choosing a variation category
  | "level_menu"     // Choosing a level within a category
  | "playing"        // Active gameplay
  | "level_complete" // Level finished, showing options
  | "game_over";     // Lost the game

export function LetterBalanceGame() {
  const { data: config, isLoading: configLoading } = useQuery<VowelConsonantConfig>({
    queryKey: ["/api/games/letter-balance/config"],
  });

  // Word validation is done via backend API - no pre-fetching of dictionary
  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });

  // Game state
  const [gameState, setGameState] = useState<GameState>("category_menu");
  const [selectedCategory, setSelectedCategory] = useState<VariationCategory | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<LevelType | null>(null);
  const [currentConstraint, setCurrentConstraint] = useState<GameConstraint | null>(null);
  
  // Gameplay state
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef<number>(12);
  const isPlayingRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordsPerLevel = config?.wordsPerRound || 20;
  const timePerWord = config?.timePerWord || 12;
  const isLoading = configLoading;
  
  // Use ref to always have latest timePerWord value
  const timePerWordRef = useRef<number>(12);
  timePerWordRef.current = timePerWord;

  // Focus input when game starts or constraint changes
  useEffect(() => {
    if (gameState === "playing" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [gameState, currentConstraint]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  const startTimer = useCallback(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Set initial values - use ref to get latest value
    const initialTime = timePerWordRef.current;
    timeLeftRef.current = initialTime;
    setTimeLeft(initialTime);
    isPlayingRef.current = true;
    
    // Start countdown
    timerRef.current = setInterval(() => {
      // Guard: only count down if game is active
      if (!isPlayingRef.current) {
        return;
      }
      
      timeLeftRef.current -= 1;
      const newTime = timeLeftRef.current;
      setTimeLeft(newTime);
      
      if (newTime <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        isPlayingRef.current = false;
        setGameState("game_over");
      }
    }, 1000);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // Select a category and show level menu
  const selectCategory = (category: VariationCategory) => {
    setSelectedCategory(category);
    setGameState("level_menu");
  };

  // Start game with selected category and level
  const startGame = useCallback((level: LevelType) => {
    if (!selectedCategory) return;
    
    // Clear any existing timer first
    clearTimer();
    
    // Reset all game state
    setSelectedLevel(level);
    setScore(0);
    setWordsCompleted(0);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    
    // Generate initial constraint
    const constraint = generateConstraint(selectedCategory, level, 0);
    setCurrentConstraint(constraint);
    setGameState("playing");
    
    // Start timer (will set isPlayingRef.current = true)
    startTimer();
  }, [selectedCategory, startTimer, clearTimer]);

  // Generate next constraint (for advanced mode or next word)
  const generateNextConstraint = useCallback(() => {
    if (!selectedCategory || selectedLevel === null) return;
    
    const newWordIndex = wordsCompleted + 1;
    const constraint = generateConstraint(selectedCategory, selectedLevel, newWordIndex);
    setCurrentConstraint(constraint);
    
    if (selectedLevel === "advanced") {
      // In advanced mode, constraint changes every word
      setCurrentConstraint(constraint);
    }
  }, [selectedCategory, selectedLevel, wordsCompleted]);

  // Continue to next level
  const continueToNextLevel = useCallback(() => {
    if (!selectedCategory || selectedLevel === null || selectedLevel === "advanced") return;
    
    const categoryDef = CATEGORIES.find(c => c.id === selectedCategory)!;
    const nextLevel = (selectedLevel as number) + 1;
    
    if (nextLevel <= categoryDef.maxLevel) {
      // Clear any existing timer first
      clearTimer();
      
      setSelectedLevel(nextLevel);
      setWordsCompleted(0);
      setUsedWords(new Set());
      setUserInput("");
      setFeedback(null);
      
      const constraint = generateConstraint(selectedCategory, nextLevel, 0);
      setCurrentConstraint(constraint);
      setGameState("playing");
      
      // Start timer (will set isPlayingRef.current = true)
      startTimer();
    }
  }, [selectedCategory, selectedLevel, startTimer, clearTimer]);

  // Back to category menu
  const backToMenu = () => {
    clearTimer();
    setSelectedCategory(null);
    setSelectedLevel(null);
    setCurrentConstraint(null);
    setGameState("category_menu");
  };

  // Back to level menu
  const backToLevelMenu = () => {
    clearTimer();
    setSelectedLevel(null);
    setCurrentConstraint(null);
    setGameState("level_menu");
  };

  // Check the submitted answer
  const checkAnswer = async () => {
    if (!userInput.trim() || !currentConstraint) return;

    const upperWord = userInput.toUpperCase();

    // Check if already used
    if (usedWords.has(upperWord)) {
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    // Validate against constraint
    const constraintCheck = currentConstraint.validate(upperWord);
    if (!constraintCheck.valid) {
      setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    // Validate word exists in dictionary
    try {
      const result = await validateMutation.mutateAsync(upperWord);
      if (!result.valid) {
        setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => setFeedback(null), 1500);
        return;
      }

      clearTimer();
      
      setFeedback({ type: "correct", message: "Correct!" });
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      
      // Score based on word length and level difficulty
      const levelBonus = selectedLevel === "advanced" ? 50 : (selectedLevel as number) * 10;
      setScore((prev) => prev + 75 + levelBonus);
      
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");

      setTimeout(() => {
        setFeedback(null);
        if (newWordsCompleted >= wordsPerLevel) {
          setGameState("level_complete");
        } else {
          // Generate new constraint for advanced mode
          if (selectedLevel === "advanced" && selectedCategory) {
            const newConstraint = generateConstraint(selectedCategory, selectedLevel, newWordsCompleted);
            setCurrentConstraint(newConstraint);
          }
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

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Category Menu
  if (gameState === "category_menu") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-center mb-6">Choose Your Challenge</h3>
            <div className="grid gap-3">
              {CATEGORIES.map((cat) => (
                <motion.div
                  key={cat.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 px-6 flex items-center gap-4 text-left"
                    onClick={() => selectCategory(cat.id)}
                    data-testid={`button-category-${cat.id}`}
                  >
                    <div className="flex-shrink-0">
                      {cat.icon === "oblivion" ? (
                        <Skull className="h-6 w-6 text-destructive" />
                      ) : cat.icon === "count" ? (
                        <Type className="h-6 w-6 text-primary" />
                      ) : (
                        <Zap className="h-6 w-6 text-accent" />
                      )}
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-semibold">{cat.name}</span>
                      <span className="text-sm text-muted-foreground font-normal">
                        {cat.description}
                      </span>
                    </div>
                    {cat.icon === "oblivion" && (
                      <Badge variant="destructive" className="ml-auto">
                        Extreme
                      </Badge>
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Level Menu
  if (gameState === "level_menu" && selectedCategory) {
    const categoryDef = CATEGORIES.find(c => c.id === selectedCategory)!;
    const levels: LevelType[] = [];
    
    for (let i = categoryDef.minLevel; i <= categoryDef.maxLevel; i++) {
      levels.push(i);
    }
    if (categoryDef.hasAdvanced) {
      levels.push("advanced");
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={backToMenu}
                className="gap-1"
                data-testid="button-back-category"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">{categoryDef.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{categoryDef.description}</p>
            </div>
            
            <div className="grid gap-2">
              {levels.map((level) => (
                <motion.div
                  key={level}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    variant={level === "advanced" ? "default" : "outline"}
                    className={`w-full h-auto py-3 px-6 flex items-center justify-between ${
                      level === "advanced" ? "bg-gradient-to-r from-primary to-accent text-white" : ""
                    }`}
                    onClick={() => startGame(level)}
                    data-testid={`button-level-${level}`}
                  >
                    <span className="font-semibold flex items-center gap-2">
                      {level === "advanced" ? (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Advanced Mode
                        </>
                      ) : categoryDef.levelType === "count" ? (
                        `${level} ${categoryDef.id.includes("consonant") ? "Consonants" : "Vowels"}`
                      ) : (
                        `${level}-Letter Words`
                      )}
                    </span>
                    {level === "advanced" && (
                      <Badge variant="secondary" className="bg-white/20 text-white">
                        Random
                      </Badge>
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Level Complete Screen
  if (gameState === "level_complete" && selectedCategory) {
    const categoryDef = CATEGORIES.find(c => c.id === selectedCategory)!;
    const canContinue = selectedLevel !== "advanced" && 
      (selectedLevel as number) < categoryDef.maxLevel;

    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <Trophy className="h-16 w-16 mx-auto text-accent" />
            </motion.div>
            
            <div>
              <h3 className="text-2xl font-bold text-accent">Level Complete!</h3>
              <p className="text-muted-foreground mt-2">
                {selectedLevel === "advanced" 
                  ? "You conquered the Advanced challenge!"
                  : `You completed ${categoryDef.levelType === "count" 
                      ? `${selectedLevel} ${categoryDef.id.includes("consonant") ? "consonants" : "vowels"}`
                      : `${selectedLevel}-letter words`
                    }!`
                }
              </p>
            </div>
            
            <Badge variant="outline" className="text-lg px-4 py-2 gap-2">
              <Trophy className="h-4 w-4" />
              {score} points
            </Badge>

            <ShareResults
              gameName="Letter Balance"
              gameSlug="letter-balance"
              score={score}
              wordsCompleted={wordsCompleted}
              challengeName={selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : undefined}
              isWin={true}
            />
            
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              {canContinue && (
                <Button
                  className="gap-2"
                  onClick={continueToNextLevel}
                  data-testid="button-next-level"
                >
                  Next Level
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                onClick={backToLevelMenu}
                data-testid="button-level-menu"
              >
                Choose Another Level
              </Button>
              <Button
                variant="ghost"
                onClick={backToMenu}
                data-testid="button-main-menu"
              >
                Main Menu
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Game Over Screen
  if (gameState === "game_over") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <XCircle className="h-16 w-16 mx-auto text-destructive" />
            </motion.div>
            
            <div>
              <h3 className="text-2xl font-bold text-destructive">Time's Up!</h3>
              <p className="text-muted-foreground mt-2">
                You completed {wordsCompleted} words
              </p>
            </div>
            
            <Badge variant="outline" className="text-lg px-4 py-2 gap-2">
              <Trophy className="h-4 w-4" />
              {score} points
            </Badge>

            <ShareResults
              gameName="Letter Balance"
              gameSlug="letter-balance"
              score={score}
              wordsCompleted={wordsCompleted}
              challengeName={selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : undefined}
              isWin={false}
            />
            
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button
                onClick={() => selectedLevel && startGame(selectedLevel)}
                data-testid="button-try-again"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={backToLevelMenu}
                data-testid="button-level-menu"
              >
                Choose Another Level
              </Button>
              <Button
                variant="ghost"
                onClick={backToMenu}
                data-testid="button-main-menu"
              >
                Main Menu
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Playing state
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5" data-testid="badge-score">
            <Trophy className="h-3.5 w-3.5" />
            {score} pts
          </Badge>
          {selectedLevel !== "advanced" && (
            <Badge className="bg-primary text-primary-foreground gap-1.5" data-testid="badge-level">
              <Zap className="h-3.5 w-3.5" />
              Level {selectedLevel}
            </Badge>
          )}
          {selectedLevel === "advanced" && (
            <Badge className="bg-gradient-to-r from-primary to-accent text-white gap-1.5" data-testid="badge-level">
              <Sparkles className="h-3.5 w-3.5" />
              Advanced
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={timeLeft <= 3 ? "destructive" : "secondary"} 
            className="gap-1.5 min-w-[60px] justify-center" 
            data-testid="badge-timer"
          >
            <Timer className="h-3.5 w-3.5" />
            {timeLeft}s
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={backToMenu}
            className="gap-1.5"
            data-testid="button-restart"
          >
            <RotateCcw className="h-4 w-4" />
            Menu
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
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
                  key={currentConstraint?.description}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center justify-center gap-2"
                >
                  {selectedCategory?.includes("oblivion") ? (
                    <Skull className="h-6 w-6 text-destructive" />
                  ) : (
                    <Type className="h-6 w-6 text-primary" />
                  )}
                </motion.div>
                <Badge 
                  variant={selectedCategory?.includes("oblivion") ? "destructive" : "secondary"} 
                  className="text-sm px-4 py-2" 
                  data-testid="badge-constraint"
                >
                  {currentConstraint?.description}
                </Badge>
                <Progress value={(wordsCompleted / wordsPerLevel) * 100} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {wordsCompleted} / {wordsPerLevel} words
                </p>
              </div>

              <Progress value={(timeLeft / timePerWord) * 100} className="h-2" />

              <div className="max-w-sm mx-auto space-y-4">
                <div className="relative">
                  <Input
                    ref={inputRef}
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

                {feedback && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-center text-sm font-medium ${
                      feedback.type === "correct" ? "text-accent" : "text-destructive"
                    }`}
                    data-testid="text-feedback"
                  >
                    {feedback.message}
                  </motion.p>
                )}

                <Button
                  className="w-full"
                  onClick={checkAnswer}
                  disabled={!userInput.trim()}
                  data-testid="button-submit"
                >
                  Submit
                </Button>
              </div>

              {usedWords.size > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2 text-center">
                    Words used ({usedWords.size}):
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center max-h-24 overflow-y-auto">
                    {Array.from(usedWords).map((word) => (
                      <Badge key={word} variant="outline" className="text-xs">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
