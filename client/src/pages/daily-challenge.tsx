import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Trophy, X, Play, CheckCircle } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { Game } from "@shared/schema";
import { getDailyChallengeRecord, saveDailyChallengeRecord } from "@/lib/game-stats";
import { WordLadderGame } from "@/components/games/word-ladder";
import { AnagramSolverGame } from "@/components/games/anagram-solver";
import { WordScrambleGame } from "@/components/games/word-scramble";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { WordMakerGame } from "@/components/games/word-maker";
import { WordLengthGame } from "@/components/games/word-length";
import { LetterPositionGame } from "@/components/games/letter-position";
import { ContainsLettersGame } from "@/components/games/contains-letters";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
import { NoRepeatsGame } from "@/components/games/no-repeats";
import { WordSweepGame } from "@/components/games/word-sweep";
import { WordChainGame } from "@/components/games/word-chain";
import { WordSplitGame } from "@/components/games/word-split";
import { WordStackGame } from "@/components/games/word-stack";
import { ProgressiveRevealGame } from "@/components/games/progressive-reveal";

interface DailyChallengeResponse {
  date: string;
  slug: string;
  game: Game;
  seed: number;
}

const LETTER_BALANCE_CATEGORIES = [
  "consonant_count", "vowel_count", "start_end_vowel", "start_end_consonant",
  "start_vowel_end_consonant", "start_consonant_end_vowel", "consonant_oblivion", "vowel_oblivion",
] as const;

const LETTER_BALANCE_LEVELS: Record<string, number[]> = {
  consonant_count: [2, 3, 4, 5, 6, 7],
  vowel_count: [2, 3, 4, 5, 6, 7],
  start_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_vowel_end_consonant: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  start_consonant_end_vowel: [4, 5, 6, 7, 8, 9, 10, 11, 12],
  consonant_oblivion: [2, 3, 4, 5],
  vowel_oblivion: [2, 3, 4, 5],
};

function renderDailyGame(slug: string, seed: number): React.ReactNode {
  switch (slug) {
    case "word-length": {
      const variation = (seed % 5) + 1;
      return <WordLengthGame initialChallenge={variation} />;
    }
    case "letter-position": {
      const challenge = ((seed % 2) + 1) as 1 | 2;
      return <LetterPositionGame initialChallenge={challenge} />;
    }
    case "contains-letters": {
      const options: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
      const challenge = options[seed % options.length];
      return <ContainsLettersGame initialChallenge={challenge} />;
    }
    case "letter-balance": {
      const cat = LETTER_BALANCE_CATEGORIES[seed % LETTER_BALANCE_CATEGORIES.length];
      const levels = LETTER_BALANCE_LEVELS[cat];
      const level = levels[(seed >> 4) % levels.length];
      return <LetterBalanceGame initialChallenge={{ category: cat, level }} />;
    }
    case "letter-frequency": {
      const options: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
      const challenge = options[seed % options.length];
      return <LetterFrequencyGame initialChallenge={challenge} />;
    }
    case "no-repeats": {
      const options: Array<3 | 4 | 5 | 6 | 7> = [3, 4, 5, 6, 7];
      const challenge = options[seed % options.length];
      return <NoRepeatsGame initialChallenge={challenge} />;
    }
    case "word-ladder":
      return <WordLadderGame initialChallenge />;

    case "anagram-solver":
      return <AnagramSolverGame />;
    case "word-scramble":
      return <WordScrambleGame />;
    case "definition-match":
      return <DefinitionMatchGame />;
    case "letter-pool": {
      const poolVariation = seed % 2 === 0 ? "with-pool" : "without-pool";
      return <LetterPoolGame initialChallenge={poolVariation as "with-pool" | "without-pool"} />;
    }
    case "word-maker":
      return <WordMakerGame />;
    case "word-sweep":
      return <WordSweepGame />;
    case "word-chain": {
      const variation = ((seed % 2) + 1) as 1 | 2;
      const level = ((seed >> 2) % 2 + 1) as 1 | 2;
      return <WordChainGame initialChallenge={{ variation, level }} />;
    }
    case "word-split": {
      const difficulties = ["short", "medium", "long"] as const;
      const diff = difficulties[seed % difficulties.length];
      return <WordSplitGame initialChallenge={diff} />;
    }
    case "word-stack":
      return <WordStackGame />;
    case "progressive-reveal":
      return <ProgressiveRevealGame />;
    default:
      return null;
  }
}

export default function DailyChallenge() {
  const [isPlaying, setIsPlaying] = useState(false);

  const { data, isLoading, error } = useQuery<DailyChallengeResponse>({
    queryKey: ["/api/daily-challenge"],
  });

  const completedRecord = data ? getDailyChallengeRecord(data.date) : null;
  const alreadyCompleted = !!completedRecord;

  const [completed, setCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    if (!data || alreadyCompleted) return;
    const handleGameResult = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.slug !== data.slug) return;
      saveDailyChallengeRecord({
        date: data.date,
        slug: data.slug,
        score: detail.score ?? 0,
        completedAt: Date.now(),
      });
      setFinalScore(detail.score ?? 0);
      setCompleted(true);
      setIsPlaying(false);
    };
    window.addEventListener("wordplay-game-result", handleGameResult);
    return () => window.removeEventListener("wordplay-game-result", handleGameResult);
  }, [data, alreadyCompleted]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-64 w-full max-w-2xl mx-auto rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>
        </Link>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load today's challenge.</p>
        </div>
      </div>
    );
  }

  const { game, date, seed } = data;
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] || LucideIcons.Gamepad2;
  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back-daily">
          <ArrowLeft className="h-4 w-4" />
          Back to Games
        </Button>
      </Link>

      <AnimatePresence mode="wait">
        {!isPlaying ? (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">{formattedDate}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">Daily Challenge</h1>
              <p className="text-muted-foreground">
                A new challenge every day. Same game for everyone.
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: game.color }}
                  >
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{game.name}</h2>
                    <p className="text-sm text-muted-foreground">{game.description}</p>
                  </div>
                </div>

                {alreadyCompleted || completed ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="inline-flex items-center gap-2 text-accent">
                      <CheckCircle className="h-6 w-6" />
                      <span className="font-semibold text-lg">Challenge Complete</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Trophy className="h-5 w-5 text-chart-2" />
                      <span className="text-lg font-medium">
                        Score: {completed ? finalScore : completedRecord?.score ?? 0}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Come back tomorrow for a new challenge!
                    </p>
                  </div>
                ) : (
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => setIsPlaying(true)}
                    data-testid="button-play-daily"
                  >
                    <Play className="h-5 w-5" />
                    Start Challenge
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: game.color }}
                >
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{game.name}</h2>
                  <Badge variant="outline" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    Daily Challenge
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(false)}
                className="gap-1.5"
                data-testid="button-exit-daily"
              >
                <X className="h-4 w-4" />
                Exit
              </Button>
            </div>

            {renderDailyGame(data.slug, seed) || (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    This game is coming soon!
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
