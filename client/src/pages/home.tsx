import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { GameCard } from "@/components/game-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Gamepad2, Sparkles, Flame, Trophy, Calendar, ArrowRight, CheckCircle, Shuffle } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { Game } from "@shared/schema";
import { loadStats, loadStreak, loadFavorites, getDailyChallengeRecord } from "@/lib/game-stats";
import { PremiumBanner } from "@/components/premium-banner";

interface DailyChallengeResponse {
  date: string;
  slug: string;
  game: Game;
}

export default function Home() {
  const { data: games, isLoading, error } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const { data: dailyChallenge } = useQuery<DailyChallengeResponse>({
    queryKey: ["/api/daily-challenge"],
  });

  const stats = useMemo(() => loadStats(), []);
  const streak = useMemo(() => loadStreak(), []);
  const [favorites, setFavorites] = useState(() => loadFavorites());

  const handleFavoriteChange = useCallback(() => {
    setFavorites(loadFavorites());
  }, []);

  const sortedGames = useMemo(() => {
    if (!games) return [];
    const favSet = new Set(favorites);
    return [...games].sort((a, b) => {
      const aFav = favSet.has(a.slug) ? 0 : 1;
      const bFav = favSet.has(b.slug) ? 0 : 1;
      return aFav - bFav;
    });
  }, [games, favorites]);
  const hasPlayed = stats.totalGamesPlayed > 0;

  const [, navigate] = useLocation();

  const pickSurpriseGame = useCallback(() => {
    if (!games?.length) return;
    const playedSlugs = new Set(Object.keys(stats.perGame));
    const unplayed = games.filter(g => !playedSlugs.has(g.slug));
    const pool = unplayed.length > 0 ? unplayed : games;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    navigate(`/game/${pick.slug}`);
  }, [games, stats, navigate]);

  return (
    <div className="min-h-screen">
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Challenge Your Vocabulary</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              Welcome to{" "}
              <span className="font-extrabold italic bg-gradient-to-r from-primary via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
                xtra<span className="not-italic font-black">W</span>ordinary
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Discover a collection of engaging word games designed to test your
              vocabulary, improve your spelling, and have fun along the way.
            </p>
          </motion.div>

          {hasPlayed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-8"
            >
              <Link href="/stats">
                <Card className="hover-elevate cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-6 flex-wrap">
                        {streak.currentStreak > 0 && (
                          <div className="flex items-center gap-2" data-testid="home-streak">
                            <Flame className="h-5 w-5 text-chart-3" />
                            <span className="font-semibold">{streak.currentStreak} day streak</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2" data-testid="home-games-played">
                          <Gamepad2 className="h-5 w-5 text-primary" />
                          <span className="text-sm text-muted-foreground">
                            {stats.totalGamesPlayed} games played
                          </span>
                        </div>
                        <div className="flex items-center gap-2" data-testid="home-wins">
                          <Trophy className="h-5 w-5 text-chart-2" />
                          <span className="text-sm text-muted-foreground">
                            {stats.totalGamesWon} wins
                          </span>
                        </div>
                        {streak.longestStreak > 1 && (
                          <div className="flex items-center gap-2" data-testid="home-longest-streak">
                            <Calendar className="h-5 w-5 text-chart-4" />
                            <span className="text-sm text-muted-foreground">
                              Best: {streak.longestStreak} days
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">View Stats</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          )}

          <div className="mb-6">
            <PremiumBanner />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {dailyChallenge && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="flex flex-col"
              >
                <Link href="/daily" className="flex-1 flex flex-col">
                  <Card className="hover-elevate cursor-pointer border-primary/20 flex-1 flex flex-col">
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: dailyChallenge.game.color }}
                        >
                          {(() => {
                            const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[dailyChallenge.game.icon] || LucideIcons.Gamepad2;
                            return <Icon className="h-6 w-6 text-white" />;
                          })()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-semibold">Daily Challenge</span>
                            {getDailyChallengeRecord(dailyChallenge.date) && (
                              <CheckCircle className="h-4 w-4 text-accent" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Today: {dailyChallenge.game.name}
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto pt-4 flex justify-center">
                        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-daily-challenge">
                          {getDailyChallengeRecord(dailyChallenge.date) ? "View Result" : "Play Now"}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )}

            {!isLoading && games && games.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.21 }}
                className="flex flex-col"
              >
                <Card
                  className="hover-elevate cursor-pointer border-dashed flex-1 flex flex-col"
                  onClick={pickSurpriseGame}
                  data-testid="card-surprise-me"
                >
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                        <Shuffle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Shuffle className="h-4 w-4 text-primary" />
                          <span className="font-semibold">Surprise Me</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {!hasPlayed
                            ? "Not sure where to start? Let us pick a game for you."
                            : "Try something new — we'll find a game you haven't played yet."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto pt-4 flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        data-testid="button-surprise-me"
                        onClick={(e) => { e.stopPropagation(); pickSurpriseGame(); }}
                      >
                        Pick for me
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            className="flex items-center gap-2 mb-8"
          >
            <Gamepad2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Available Games</h2>
          </motion.div>

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-muted-foreground">
                Unable to load games. Please try again later.
              </p>
            </motion.div>
          ) : sortedGames.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedGames.map((game, index) => (
                <GameCard key={game.id} game={game} index={index} onFavoriteChange={handleFavoriteChange} />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Gamepad2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No games available at the moment.
              </p>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
