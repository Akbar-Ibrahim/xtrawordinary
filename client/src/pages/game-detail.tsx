import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Play,
  X,
  CheckCircle,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { Game } from "@shared/schema";
import { WordGuessingGame } from "@/components/games/word-guessing";
import { AnagramSolverGame } from "@/components/games/anagram-solver";
import { WordScrambleGame } from "@/components/games/word-scramble";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { WordMakerGame } from "@/components/games/word-maker";
import { WordLengthGame } from "@/components/games/word-length";
import { LetterPositionGame } from "@/components/games/letter-position";
import { ContainsLettersGame } from "@/components/games/contains-letters";
import { WordChainGame } from "@/components/games/word-chain";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
import { WordStackGame } from "@/components/games/word-stack";
import { NoRepeatsGame } from "@/components/games/no-repeats";
import { WordSplitGame } from "@/components/games/word-split";

const difficultyColors = {
  easy: "bg-accent text-accent-foreground",
  medium: "bg-chart-3 text-white",
  hard: "bg-destructive text-destructive-foreground",
};

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
  "word-chain": WordChainGame,
  "letter-balance": LetterBalanceGame,
  "letter-frequency": LetterFrequencyGame,
  "word-stack": WordStackGame,
  "no-repeats": NoRepeatsGame,
  "word-split": WordSplitGame,
};

export default function GameDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [isPlaying, setIsPlaying] = useState(false);

  const { data: game, isLoading, error } = useQuery<Game>({
    queryKey: ["/api/games", slug],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Games
          </Button>
        </Link>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Game not found.</p>
        </div>
      </div>
    );
  }

  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] || LucideIcons.Gamepad2;
  const GameComponent = gameComponents[game.slug];

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Games
        </Button>
      </Link>

      <AnimatePresence mode="wait">
        {!isPlaying ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-6">
              <div
                className="h-48 sm:h-64 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: game.color }}
              >
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, type: "spring" }}
                >
                  <IconComponent className="h-24 w-24 sm:h-32 sm:w-32 text-white drop-shadow-lg" />
                </motion.div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <h1 className="text-3xl sm:text-4xl font-bold">{game.name}</h1>
                  <Badge
                    className={`text-sm ${difficultyColors[game.difficulty]}`}
                    data-testid="badge-difficulty"
                  >
                    {game.difficulty}
                  </Badge>
                </div>

                <p className="text-lg text-muted-foreground">{game.longDescription}</p>

                <div className="flex items-center gap-6 text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {game.estimatedTime}
                  </span>
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    {game.playCount.toLocaleString()} plays
                  </span>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How to Play</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {game.rules.map((rule, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                        <span>{rule}</span>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="lg:sticky lg:top-24 h-fit">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Ready to play?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Test your word skills and have fun!
                    </p>
                  </div>
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => setIsPlaying(true)}
                    data-testid="button-play"
                  >
                    <Play className="h-5 w-5" />
                    Play Now
                  </Button>
                </CardContent>
              </Card>
            </div>
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
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: game.color }}
                >
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold">{game.name}</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(false)}
                className="gap-1.5"
                data-testid="button-close-game"
              >
                <X className="h-4 w-4" />
                Exit Game
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
