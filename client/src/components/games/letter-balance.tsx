import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trophy, Zap, CheckCircle, XCircle, Timer, ArrowRight, ArrowLeft, Loader2, Type, Lock, Sparkles, LogIn, Flame, Skull } from "lucide-react";
import { ShareResults } from "@/components/share-results";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { AnimatedNumber } from "@/components/animated-number";
import { StreakIndicator } from "@/components/streak-indicator";
import { apiRequest } from "@/lib/queryClient";
import type { VowelConsonantConfig, WordValidationResponse } from "@shared/schema";
import { useSound } from "@/lib/sound-provider";
import { getCompletionMessage } from "@/lib/completion-messages";
import { useGameResult, usePersonalBest } from "@/hooks/use-game-result";
import { makeSeededRng } from "@/lib/seeded-rng";
import { TryAnotherGameButton } from "@/components/try-another-game-button";

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function getEffectiveSlug(
  isSurvival: boolean,
  category: VariationCategory | null,
  level: LevelType | null,
  consonantCount: number | null
): string {
  if (isSurvival) return "letter-balance-survival";
  if (category === "locked_balance") {
    if (level === "advanced") return "letter-balance-locked-advanced";
    if (level !== null && consonantCount !== null) {
      return `letter-balance-locked-${level}l${consonantCount}c`;
    }
  }
  return "letter-balance";
}

const CLASSIC_TIME_LIMIT = 90;
const SURVIVAL_TIME_PER_WORD = 8;
const SURVIVAL_TIME_OPTIONS = [
  { label: "5s", seconds: 5 },
  { label: "8s", seconds: 8 },
  { label: "12s", seconds: 12 },
];

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
export type VariationCategory = 
  | "consonant_count"
  | "vowel_count"
  | "start_end_vowel"
  | "start_end_consonant"
  | "start_vowel_end_consonant"
  | "start_consonant_end_vowel"
  | "locked_balance";

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
  icon: "count" | "position" | "oblivion" | "locked";
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
    id: "locked_balance",
    name: "Locked Balance",
    description: "You pick the word length and consonant count — vowels follow automatically",
    icon: "locked",
    levelType: "length",
    minLevel: 4,
    maxLevel: 10,
    hasAdvanced: true,
  },
];

// Generate constraint based on category and level
function generateConstraint(
  category: VariationCategory,
  level: LevelType,
  wordIndex: number = 0,
  rng: () => number = Math.random,
  fixedConsonantCount?: number
): GameConstraint {
  const categoryDef = CATEGORIES.find(c => c.id === category)!;
  
  // For advanced mode, randomize the constraint value
  const getRandomValue = (min: number, max: number) => 
    Math.floor(rng() * (max - min + 1)) + min;
  
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
    
    case "locked_balance": {
      const wordLength = isAdvanced ? getRandomValue(4, 10) : level as number;
      let consonants: number;
      if (isAdvanced) {
        consonants = getRandomValue(1, wordLength - 1);
      } else if (fixedConsonantCount !== undefined) {
        consonants = fixedConsonantCount;
      } else {
        const maxC = Math.min(wordLength - 1, Math.ceil(wordLength * 0.6));
        const minC = Math.max(1, Math.floor(wordLength * 0.3));
        consonants = minC + (wordIndex % Math.max(1, maxC - minC + 1));
      }
      const vowels = wordLength - consonants;
      return {
        description: `${wordLength}-letter word: ${consonants} consonant${consonants !== 1 ? "s" : ""}, ${vowels} vowel${vowels !== 1 ? "s" : ""}`,
        validate: (word: string) => {
          const upper = word.toUpperCase();
          if (upper.length !== wordLength) {
            return { valid: false, message: `Word must be exactly ${wordLength} letters long` };
          }
          const actualConsonants = countConsonants(upper);
          if (actualConsonants !== consonants) {
            return { valid: false, message: `Word must have exactly ${consonants} consonant${consonants !== 1 ? "s" : ""} (found ${actualConsonants})` };
          }
          return { valid: true, message: "" };
        }
      };
    }
    default: {
      // Defensive fallback for unknown/legacy category slugs
      return {
        description: "Any word (4 or more letters)",
        validate: (word: string) => {
          if (word.trim().length < 4) {
            return { valid: false, message: "Word must be at least 4 letters long" };
          }
          return { valid: true, message: "" };
        }
      };
    }
  }
}

type CustomLbConstraint = { vowels?: number; consonants?: number; length?: number };

function generateCustomLbConstraint(cc: CustomLbConstraint): GameConstraint {
  const parts: string[] = [];
  if (cc.vowels !== undefined) parts.push(`exactly ${cc.vowels} vowel${cc.vowels !== 1 ? "s" : ""}`);
  if (cc.consonants !== undefined) parts.push(`exactly ${cc.consonants} consonant${cc.consonants !== 1 ? "s" : ""}`);
  if (cc.length !== undefined) parts.push(`${cc.length} letters long`);
  return {
    description: parts.length > 0 ? `Words with ${parts.join(", ")}` : "Any word",
    validate: (word: string) => {
      const upper = word.toUpperCase();
      if (cc.length !== undefined && upper.length !== cc.length) {
        return { valid: false, message: `Word must be exactly ${cc.length} letters` };
      }
      if (cc.vowels !== undefined) {
        const actual = countVowels(upper);
        if (actual !== cc.vowels) {
          return { valid: false, message: `Word must have exactly ${cc.vowels} vowel${cc.vowels !== 1 ? "s" : ""} (found ${actual})` };
        }
      }
      if (cc.consonants !== undefined) {
        const actual = countConsonants(upper);
        if (actual !== cc.consonants) {
          return { valid: false, message: `Word must have exactly ${cc.consonants} consonant${cc.consonants !== 1 ? "s" : ""} (found ${actual})` };
        }
      }
      return { valid: true, message: "" };
    },
  };
}

// Game states
type GameState = 
  | "category_menu"  // Choosing a variation category
  | "level_menu"     // Choosing a level within a category
  | "playing"        // Active gameplay
  | "level_complete" // Level finished, showing options
  | "game_over";     // Lost the game

export function LetterBalanceGame({ initialChallenge, customConstraint, groupSeed, locked, quizMode, initialSurvival, initialTimeLimit, initialWordCount, onGameEnd }: { initialChallenge?: { category: VariationCategory; level: LevelType; consonantCount?: number }; customConstraint?: CustomLbConstraint; groupSeed?: number; locked?: boolean; quizMode?: boolean; initialSurvival?: boolean; initialTimeLimit?: number; initialWordCount?: number; onGameEnd?: () => void } = {}) {
  const { playSound } = useSound();
  const [isSurvival, setIsSurvival] = useState(initialSurvival ?? false);
  const [survivalTime, setSurvivalTime] = useState(SURVIVAL_TIME_PER_WORD);
  const isSurvivalRef = useRef(false);
  const survivalTimeRef = useRef(SURVIVAL_TIME_PER_WORD);
  isSurvivalRef.current = isSurvival;
  survivalTimeRef.current = survivalTime;
  const [gameState, setGameState] = useState<GameState>("category_menu");
  const [selectedCategory, setSelectedCategory] = useState<VariationCategory | null>(initialChallenge?.category ?? null);
  const [selectedLevel, setSelectedLevel] = useState<LevelType | null>(initialChallenge?.level ?? null);
  const [lockedConsonantCount, setLockedConsonantCount] = useState<number | null>(initialChallenge?.consonantCount ?? null);
  const [pendingLockedLength, setPendingLockedLength] = useState<number | null>(null);
  const effectiveSlug = getEffectiveSlug(isSurvival, selectedCategory, selectedLevel, lockedConsonantCount);
  const { reportResult, resetRecorded } = useGameResult({ slug: effectiveSlug, quizMode });
  const personalBest = usePersonalBest(effectiveSlug);
  const seedRngRef = useRef<(() => number) | undefined>(
    groupSeed !== undefined ? makeSeededRng(groupSeed) : undefined
  );
  const { data: config, isLoading: configLoading } = useQuery<VowelConsonantConfig>({
    queryKey: ["/api/games/letter-balance/config"],
  });

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const response = await apiRequest("POST", "/api/games/validate-word", { word });
      return response.json() as Promise<WordValidationResponse>;
    },
  });
  const [currentConstraint, setCurrentConstraint] = useState<GameConstraint | null>(null);
  
  // Gameplay state
  const [userInput, setUserInput] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsCompleted, setWordsCompleted] = useState(0);
  const [timeLeft, setTimeLeft] = useState(initialTimeLimit ?? CLASSIC_TIME_LIMIT);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "invalid"; message: string } | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [completionMessage, setCompletionMessage] = useState("");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLeftRef = useRef<number>(initialTimeLimit ?? CLASSIC_TIME_LIMIT);
  const isPlayingRef = useRef<boolean>(false);
  const totalTimeLimitRef = useRef<number>(initialTimeLimit ?? CLASSIC_TIME_LIMIT);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordsPerLevel = initialWordCount ?? config?.wordsPerRound ?? 20;
  const classicTimeLimit = initialTimeLimit ?? CLASSIC_TIME_LIMIT;
  const isLoading = configLoading;

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

  const startTimer = useCallback((survivalMode: boolean) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const initialTime = survivalMode ? survivalTimeRef.current : classicTimeLimit;
    totalTimeLimitRef.current = initialTime;
    timeLeftRef.current = initialTime;
    setTimeLeft(initialTime);
    isPlayingRef.current = true;

    timerRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;

      timeLeftRef.current -= 1;
      const newTime = timeLeftRef.current;
      setTimeLeft(newTime);

      if (newTime <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        isPlayingRef.current = false;
        setCompletionMessage(getCompletionMessage(false));
        setGameState("game_over");
      }
    }, 1000);
  }, [classicTimeLimit]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // Select a category and show level menu
  const selectCategory = (category: VariationCategory) => {
    setSelectedCategory(category);
    setPendingLockedLength(null);
    setGameState("level_menu");
  };

  // Start game with selected category and level
  const startGame = useCallback((level: LevelType, consonantCount?: number) => {
    if (!selectedCategory) return;
    
    resetRecorded();
    clearTimer();
    
    setSelectedLevel(level);
    setPendingLockedLength(null);
    if (consonantCount !== undefined) setLockedConsonantCount(consonantCount);
    setScore(0);
    setStreak(0);
    setWordsCompleted(0);
    setUsedWords(new Set());
    setUserInput("");
    setFeedback(null);
    
    const constraint = generateConstraint(selectedCategory, level, 0, seedRngRef.current, consonantCount);
    setCurrentConstraint(constraint);
    setGameState("playing");
    startTimer(isSurvivalRef.current);
  }, [selectedCategory, startTimer, clearTimer, resetRecorded]);

  useEffect(() => {
    if (customConstraint && (customConstraint.vowels !== undefined || customConstraint.consonants !== undefined || customConstraint.length !== undefined)) {
      const synth = generateCustomLbConstraint(customConstraint);
      resetRecorded();
      clearTimer();
      setScore(0);
      setStreak(0);
      setWordsCompleted(0);
      setUsedWords(new Set());
      setUserInput("");
      setFeedback(null);
      setCurrentConstraint(synth);
      setGameState("playing");
      startTimer(isSurvivalRef.current);
    } else if (initialChallenge && selectedCategory) {
      startGame(initialChallenge.level, initialChallenge.consonantCount);
    }
  }, []);

  useEffect(() => {
    if (gameState === "level_complete" || gameState === "game_over") {
      reportResult(score, gameState === "level_complete", wordsCompleted);
      onGameEnd?.();
    }
  }, [gameState, score, reportResult, wordsCompleted]);

  // Generate next constraint (for advanced mode or next word)
  const generateNextConstraint = useCallback(() => {
    if (!selectedCategory || selectedLevel === null) return;
    
    const newWordIndex = wordsCompleted + 1;
    const constraint = generateConstraint(selectedCategory, selectedLevel, newWordIndex, seedRngRef.current, lockedConsonantCount ?? undefined);
    setCurrentConstraint(constraint);
    
    if (selectedLevel === "advanced") {
      setCurrentConstraint(constraint);
    }
  }, [selectedCategory, selectedLevel, wordsCompleted, lockedConsonantCount]);

  // Continue to next level
  const continueToNextLevel = useCallback(() => {
    if (!selectedCategory || selectedLevel === null || selectedLevel === "advanced") return;
    
    const categoryDef = CATEGORIES.find(c => c.id === selectedCategory)!;
    const nextLevel = (selectedLevel as number) + 1;
    
    if (nextLevel <= categoryDef.maxLevel) {
      clearTimer();
      
      setSelectedLevel(nextLevel);
      setWordsCompleted(0);
      setUsedWords(new Set());
      setUserInput("");
      setFeedback(null);
      
      const constraint = generateConstraint(selectedCategory, nextLevel, 0, seedRngRef.current, lockedConsonantCount ?? undefined);
      setCurrentConstraint(constraint);
      setGameState("playing");
      startTimer(false);
    }
  }, [selectedCategory, selectedLevel, startTimer, clearTimer, lockedConsonantCount]);

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
      playSound("wrong");
      setStreak(0);
      setFeedback({ type: "invalid", message: "Already used this word!" });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    // Validate against constraint
    const constraintCheck = currentConstraint.validate(upperWord);
    if (!constraintCheck.valid) {
      playSound("wrong");
      setStreak(0);
        setFeedback({ type: "wrong", message: constraintCheck.message });
      setTimeout(() => setFeedback(null), 1500);
      return;
    }

    // Validate word exists in dictionary
    try {
      const result = await validateMutation.mutateAsync(upperWord);
      if (!result.valid) {
        playSound("wrong");
        setStreak(0);
          setFeedback({ type: "invalid", message: "Not a valid word!" });
        setTimeout(() => setFeedback(null), 1500);
        return;
      }

      playSound("correct");
      setFeedback({ type: "correct", message: "Correct!" });
      setStreak(prev => prev + 1);
      setUsedWords((prev) => new Set(Array.from(prev).concat(upperWord)));
      
      // Score based on word length and level difficulty
      const levelBonus = selectedLevel === "advanced" ? 50 : (selectedLevel as number) * 10;
      setScore((prev) => prev + 75 + levelBonus);
      
      const newWordsCompleted = wordsCompleted + 1;
      setWordsCompleted(newWordsCompleted);
      setUserInput("");

      setTimeout(() => {
        setFeedback(null);
        if (!isSurvivalRef.current && newWordsCompleted >= wordsPerLevel) {
          setCompletionMessage(getCompletionMessage(true));
          setGameState("level_complete");
        } else {
          // Generate new constraint for advanced mode
          if (selectedLevel === "advanced" && selectedCategory) {
            const newConstraint = generateConstraint(selectedCategory, selectedLevel, newWordsCompleted, seedRngRef.current, lockedConsonantCount ?? undefined);
            setCurrentConstraint(newConstraint);
          }
          // Survival: restart per-word timer. Classic: timer keeps running.
          if (isSurvivalRef.current) {
            startTimer(true);
          }
        }
      }, 500);
    } catch {
      playSound("wrong");
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
            {!locked && (
              <div className="flex justify-center gap-2 mb-2">
                <Button variant={!isSurvival ? "default" : "outline"} size="sm" onClick={() => setIsSurvival(false)} className="gap-1.5" data-testid="button-mode-classic">
                  <Timer className="h-3.5 w-3.5" />
                  Classic
                </Button>
                <Button variant={isSurvival ? "default" : "outline"} size="sm" onClick={() => setIsSurvival(true)} className="gap-1.5" data-testid="button-mode-survival">
                  <Flame className="h-3.5 w-3.5" />
                  {isSurvival ? `Survival (${survivalTime}s/word)` : "Survival"}
                </Button>
              </div>
            )}
            {isSurvival && !locked && (
              <div className="flex justify-center items-center gap-2 mb-4 flex-wrap">
                {SURVIVAL_TIME_OPTIONS.map(opt => (
                  <Button key={opt.seconds} variant={survivalTime === opt.seconds ? "default" : "outline"} size="sm" onClick={() => setSurvivalTime(opt.seconds)} data-testid={`button-survival-time-${opt.seconds}`}>
                    {opt.label}
                  </Button>
                ))}
                <p className="w-full text-center text-xs text-muted-foreground">{survivalTime}s per word — timer resets on correct answer!</p>
              </div>
            )}
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
                      {cat.icon === "locked" ? (
                        <Lock className="h-6 w-6 text-primary" />
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

    // Locked Balance: two-step picker (word length → consonant count)
    if (selectedCategory === "locked_balance") {
      return (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              {!locked && (
                <div className="flex items-center gap-2 mb-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={pendingLockedLength !== null ? () => setPendingLockedLength(null) : backToMenu}
                    className="gap-1"
                    data-testid="button-back-category"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold">{categoryDef.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{categoryDef.description}</p>
              </div>
              {pendingLockedLength === null ? (
                <>
                  <p className="text-sm font-medium text-center mb-3 text-muted-foreground">Step 1 of 2 — Choose word length</p>
                  <div className="grid gap-2">
                    {([4,5,6,7,8,9,10,"advanced"] as const).map((level) => (
                      <motion.div key={String(level)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          variant={level === "advanced" ? "default" : "outline"}
                          className={`w-full h-auto py-3 px-6 flex items-center justify-between ${level === "advanced" ? "bg-gradient-to-r from-primary to-accent text-white" : ""}`}
                          onClick={() => level === "advanced" ? startGame("advanced") : setPendingLockedLength(level as number)}
                          data-testid={`button-level-${level}`}
                        >
                          <span className="font-semibold flex items-center gap-2">
                            {level === "advanced" ? (
                              <><Sparkles className="h-4 w-4" />Advanced Mode</>
                            ) : (
                              `${level}-Letter Words`
                            )}
                          </span>
                          {level === "advanced" && (
                            <Badge variant="secondary" className="bg-white/20 text-white">Random</Badge>
                          )}
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-center mb-1 text-muted-foreground">Step 2 of 2 — Choose consonant count</p>
                  <p className="text-xs text-muted-foreground text-center mb-3">{pendingLockedLength}-letter words · vowels = {pendingLockedLength} − consonants</p>
                  <div className="grid gap-2">
                    {Array.from({ length: pendingLockedLength - 1 }, (_, i) => i + 1).map((c) => {
                      const v = pendingLockedLength - c;
                      return (
                        <motion.div key={c} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            variant="outline"
                            className="w-full h-auto py-3 px-6 flex items-center justify-between"
                            onClick={() => startGame(pendingLockedLength, c)}
                            data-testid={`button-consonant-count-${c}`}
                          >
                            <span className="font-semibold">{c} consonant{c !== 1 ? "s" : ""}</span>
                            <span className="text-sm text-muted-foreground">→ {v} vowel{v !== 1 ? "s" : ""}</span>
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

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
            {!locked && (
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
            )}
            
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

  // Level Complete Screen (custom constraint mode — no category navigation)
  if (gameState === "level_complete" && !selectedCategory) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center space-y-6">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}>
              <Trophy className="h-16 w-16 mx-auto text-accent" />
            </motion.div>
            <div>
              <h3 className="text-2xl font-bold text-accent">Level Complete!</h3>
              <p className="text-muted-foreground mt-2">You completed {wordsCompleted} words!</p>
              <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2 gap-2">
              <Trophy className="h-4 w-4" />
              <AnimatedNumber value={score} /> points
            </Badge>
            {personalBest > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-personal-best">Personal Best: {personalBest} pts</p>
            )}
            <ShareResults gameName="Letter Balance" gameSlug="letter-balance" score={score} wordsCompleted={wordsCompleted} isWin={true} />
            {!user && (
              <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                <LogIn className="h-4 w-4 shrink-0" />
                <span><button className="underline font-medium" onClick={() => setAuthOpen(true)} data-testid="button-sign-in-cta">Sign in</button>{" "}to save your score!</span>
              </div>
            )}
            <TryAnotherGameButton currentSlug="letter-balance" />
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
              <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
            </div>
            
            <Badge variant="outline" className="text-lg px-4 py-2 gap-2">
              <Trophy className="h-4 w-4" />
              <AnimatedNumber value={score} /> points
            </Badge>
            {personalBest > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                Personal Best: {personalBest} pts
              </p>
            )}

            <ShareResults
              gameName="Letter Balance"
              gameSlug="letter-balance"
              score={score}
              wordsCompleted={wordsCompleted}
              challengeName={selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : undefined}
              isWin={true}
            />
            {!user && (
              <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                <LogIn className="h-4 w-4 shrink-0" />
                <span>
                  <button className="underline font-medium" onClick={() => setAuthOpen(true)} data-testid="button-sign-in-cta">Sign in</button>{" "}
                  to save your score to the leaderboard!
                </span>
              </div>
            )}
            
            {!locked && (
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
                <TryAnotherGameButton currentSlug="letter-balance" />
              </div>
            )}
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
              <p className="text-sm italic text-muted-foreground mt-2" data-testid="text-completion-message">{completionMessage}</p>
            </div>
            
            <Badge variant="outline" className="text-lg px-4 py-2 gap-2">
              <Trophy className="h-4 w-4" />
              <AnimatedNumber value={score} /> points
            </Badge>
            {personalBest > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-personal-best">
                Personal Best: {personalBest} pts
              </p>
            )}

            <ShareResults
              gameName="Letter Balance"
              gameSlug="letter-balance"
              score={score}
              wordsCompleted={wordsCompleted}
              challengeName={selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : undefined}
              isWin={false}
            />
            {!user && (
              <div className="text-sm text-muted-foreground border rounded-lg p-3 flex items-center gap-2">
                <LogIn className="h-4 w-4 shrink-0" />
                <span>
                  <button className="underline font-medium" onClick={() => setAuthOpen(true)} data-testid="button-sign-in-cta">Sign in</button>{" "}
                  to save your score to the leaderboard!
                </span>
              </div>
            )}
            
            {!locked && (
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
                <TryAnotherGameButton currentSlug="letter-balance" />
              </div>
            )}
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
            <AnimatedNumber value={score} /> pts
          </Badge>
          {isSurvivalRef.current && (
            <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/50" data-testid="badge-survival">
              <Flame className="h-3.5 w-3.5" />
              Survival
            </Badge>
          )}
          <StreakIndicator streak={streak} />
          {selectedLevel !== null && selectedLevel !== "advanced" && (
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
          {selectedLevel === null && (
            <Badge variant="outline" className="gap-1.5" data-testid="badge-custom">
              <Sparkles className="h-3.5 w-3.5" />
              Custom
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={timeLeft <= (isSurvivalRef.current ? 3 : 30) ? "destructive" : "secondary"}
            className="gap-1.5 min-w-[60px] justify-center"
            data-testid="badge-timer"
            role="timer"
            aria-label={`Time remaining: ${isSurvivalRef.current ? timeLeft + "s" : Math.floor(timeLeft / 60) + ":" + (timeLeft % 60).toString().padStart(2, "0")}`}
          >
            <Timer className="h-3.5 w-3.5" />
            {isSurvivalRef.current ? `${timeLeft}s` : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, "0")}`}
          </Badge>
          {!locked && (
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
          )}
          {!locked && gameState === "playing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { clearTimer(); setCompletionMessage(getCompletionMessage(false)); setGameState("game_over"); }}
              className="gap-1.5"
              data-testid="button-end-game"
            >
              End Game
            </Button>
          )}
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
                {!isSurvivalRef.current && (
                  <Progress value={(wordsCompleted / wordsPerLevel) * 100} className="h-2" />
                )}
                <p className="text-sm text-muted-foreground">
                  {isSurvivalRef.current
                    ? `${wordsCompleted} word${wordsCompleted !== 1 ? "s" : ""}`
                    : `${wordsCompleted} / ${wordsPerLevel} words`}
                </p>
              </div>

              <Progress value={(timeLeft / totalTimeLimitRef.current) * 100} className="h-2" />

              <div className="max-w-sm mx-auto space-y-4">
                <div className="relative">
                  <Input
                    ref={inputRef}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter a word..."
                    aria-label="Enter your word"
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

                <div aria-live="polite" className="min-h-[1.5rem] flex items-center justify-center">
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
                </div>

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
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
