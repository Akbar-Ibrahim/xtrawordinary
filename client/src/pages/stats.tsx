import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Trophy,
  Gamepad2,
  Target,
  Flame,
  Calendar,
  Star,
  TrendingUp,
  BarChart3,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { loadStats, loadStreak, getTotalWordsFound, getUniqueGamesPlayed } from "@/lib/game-stats";
import type { Game } from "@shared/schema";

export default function Stats() {
  const stats = useMemo(() => loadStats(), []);
  const streak = useMemo(() => loadStreak(), []);
  const totalWords = useMemo(() => getTotalWordsFound(), []);
  const uniqueGames = useMemo(() => getUniqueGamesPlayed(), []);

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const winRate = stats.totalGamesPlayed > 0
    ? Math.round((stats.totalGamesWon / stats.totalGamesPlayed) * 100)
    : 0;

  const favoriteGame = useMemo(() => {
    let maxPlayed = 0;
    let favSlug: string | null = null;
    for (const [slug, gs] of Object.entries(stats.perGame)) {
      if (gs.gamesPlayed > maxPlayed) {
        maxPlayed = gs.gamesPlayed;
        favSlug = slug;
      }
    }
    if (!favSlug) return null;
    const game = games.find((g) => g.slug === favSlug);
    return game ? { game, played: maxPlayed } : null;
  }, [stats, games]);

  const gameStatsWithNames = useMemo(() => {
    return Object.entries(stats.perGame)
      .map(([slug, gs]) => {
        const game = games.find((g) => g.slug === slug);
        return { slug, ...gs, name: game?.name || slug };
      })
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  }, [stats, games]);

  const hasAnyData = stats.totalGamesPlayed > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="gap-2 mb-8" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Games
        </Button>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-8">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-stats-title">Your Statistics</h1>
        </div>

        {!hasAnyData ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Gamepad2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No games played yet</h2>
              <p className="text-muted-foreground mb-6">
                Play some games to start tracking your stats!
              </p>
              <Link href="/">
                <Button data-testid="button-play-games">Browse Games</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Gamepad2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Games Played</p>
                      <p className="text-2xl font-bold" data-testid="text-total-games">
                        {stats.totalGamesPlayed}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <Target className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-2xl font-bold" data-testid="text-win-rate">{winRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                      <Flame className="h-5 w-5 text-chart-3" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Streak</p>
                      <p className="text-2xl font-bold" data-testid="text-current-streak">
                        {streak.currentStreak} {streak.currentStreak === 1 ? "day" : "days"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
                      <BookOpen className="h-5 w-5 text-chart-1" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Words Found</p>
                      <p className="text-2xl font-bold" data-testid="text-total-words">
                        {totalWords}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                      <Star className="h-5 w-5 text-chart-2" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Games Explored</p>
                      <p className="text-2xl font-bold" data-testid="text-unique-games">
                        {uniqueGames} / 17
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                      <Calendar className="h-5 w-5 text-chart-4" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Longest Streak</p>
                      <p className="text-2xl font-bold" data-testid="text-longest-streak">
                        {streak.longestStreak} {streak.longestStreak === 1 ? "day" : "days"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {favoriteGame && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Trophy className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Favorite Game</p>
                        <p className="text-lg font-bold" data-testid="text-favorite-game">
                          {favoriteGame.game.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Played {favoriteGame.played} times
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {gameStatsWithNames.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Per-Game Breakdown</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {gameStatsWithNames.map((gs) => {
                    const gameWinRate = gs.gamesPlayed > 0
                      ? Math.round((gs.gamesWon / gs.gamesPlayed) * 100)
                      : 0;
                    return (
                      <Link key={gs.slug} href={`/game/${gs.slug}`}>
                        <Card className="hover-elevate cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h3 className="font-semibold truncate" data-testid={`text-game-name-${gs.slug}`}>
                                {gs.name}
                              </h3>
                              <Badge variant="secondary" data-testid={`badge-plays-${gs.slug}`}>
                                {gs.gamesPlayed} plays
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Trophy className="h-3.5 w-3.5 text-chart-2" />
                                <span className="text-sm" data-testid={`text-best-${gs.slug}`}>
                                  Best: {gs.bestScore}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Target className="h-3.5 w-3.5 text-accent" />
                                <span className="text-sm" data-testid={`text-winrate-${gs.slug}`}>
                                  {gameWinRate}% wins
                                </span>
                              </div>
                              {gs.totalWordsFound > 0 && (
                                <div className="flex items-center gap-1">
                                  <BookOpen className="h-3.5 w-3.5 text-chart-1" />
                                  <span className="text-sm">
                                    {gs.totalWordsFound} words
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
