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
import { WordGuessingGame } from "@/components/games/word-guessing";
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

interface DailyChallengeResponse {
  date: string;
  slug: string;
  game: Game;
}

const gameComponents: Record<string, React.ComponentType> = {
  "word-guessing": WordGuessingGame,
  "anagram-solver": AnagramSolverGame,
  "word-scramble": WordScrambleGame,
  "definition-match": DefinitionMatchGame,
  "letter-pool": LetterPoolGame,
  "word-maker": WordMakerGame,
  "word-length": WordLengthGame,
  "letter-position": LetterPositionGame,
  "contains-letters": ContainsLettersGame,
  "letter-balance": LetterBalanceGame,
  "letter-frequency": LetterFrequencyGame,
  "no-repeats": NoRepeatsGame,
  "word-sweep": WordSweepGame,
};

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

  const { game, date } = data;
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] || LucideIcons.Gamepad2;
  const GameComponent = gameComponents[data.slug];
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

            {GameComponent ? (
              <GameComponent />
            ) : (
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
