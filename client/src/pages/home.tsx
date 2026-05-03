import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { GameCard } from "@/components/game-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Gamepad2, Flame, Trophy, Calendar, ArrowRight, CheckCircle, Shuffle, Swords, Search, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { Game } from "@shared/schema";
import { loadStats, loadStreak, loadFavorites, getDailyChallengeRecord } from "@/lib/game-stats";
import { PremiumBanner } from "@/components/premium-banner";

interface DailyChallengeResponse {
  date: string;
  slug: string;
  game: Game;
}

const DIFFICULTIES = ["all", "easy", "medium", "hard"] as const;
type DifficultyFilter = typeof DIFFICULTIES[number];

const difficultyLabel: Record<DifficultyFilter, string> = {
  all: "All",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");

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

  const filteredGames = useMemo(() => {
    let result = sortedGames;
    if (difficultyFilter !== "all") {
      result = result.filter((g) => g.difficulty === difficultyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sortedGames, difficultyFilter, searchQuery]);

  const isFiltering = searchQuery.trim() !== "" || difficultyFilter !== "all";
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
            <div className="flex items-center justify-center gap-3 sm:gap-5 mb-8 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Gamepad2 className="h-4 w-4 text-primary" />
                <span>{games?.length ?? "—"} games</span>
              </div>
              <span className="text-muted-foreground/30 select-none">·</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Daily challenge</span>
              </div>
              <span className="text-muted-foreground/30 select-none">·</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-primary" />
                <span>Free to play</span>
              </div>
            </div>
            <h1 className="tracking-tight mb-4">
              <span className="block text-xl sm:text-2xl font-medium text-foreground/60 mb-2">
                Think you know words?
              </span>
              <span className="text-5xl sm:text-6xl lg:text-7xl font-extrabold italic bg-gradient-to-r from-primary via-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
                xtra<span className="not-italic font-black">W</span>ordinary
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Daily challenges, leaderboards, and word games to obsess over.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {dailyChallenge && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="flex flex-col"
              >
                <Link href="/daily" className="flex-1 flex flex-col">
                  <Card className="hover-elevate cursor-pointer border-primary/20 h-full" data-testid="card-daily-challenge">
                    <CardContent className="p-4 flex items-center gap-3 h-full">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: dailyChallenge.game.color }}
                      >
                        {(() => {
                          const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[dailyChallenge.game.icon] || LucideIcons.Gamepad2;
                          return <Icon className="h-5 w-5 text-white" />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm">Daily Challenge</span>
                          {getDailyChallengeRecord(dailyChallenge.date) && (
                            <CheckCircle className="h-3.5 w-3.5 text-accent shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          Today: {dailyChallenge.game.name}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                  className="hover-elevate cursor-pointer border-dashed h-full"
                  onClick={pickSurpriseGame}
                  data-testid="card-surprise-me"
                >
                  <CardContent className="p-4 flex items-center gap-3 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                      <Shuffle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Surprise Me</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {!hasPlayed ? "Let us pick a game for you." : "Find a game you haven't tried."}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.23 }}
              className="flex flex-col"
            >
              <Link href="/duels" className="flex-1 flex flex-col">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-duels-shortcut">
                  <CardContent className="p-4 flex items-center gap-3 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-violet-500/10">
                      <Swords className="h-5 w-5 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Duels</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Turn-based &amp; race challenges
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              className="flex flex-col"
            >
              <PremiumBanner variant="card" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.22 }}
            className="mb-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <Gamepad2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Available Games</h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search games…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  data-testid="input-game-search"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {DIFFICULTIES.map((d) => (
                  <Button
                    key={d}
                    variant={difficultyFilter === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDifficultyFilter(d)}
                    data-testid={`button-filter-${d}`}
                  >
                    {difficultyLabel[d]}
                  </Button>
                ))}
              </div>
            </div>
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
          ) : filteredGames.length > 0 ? (
            <>
              {isFiltering && (
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-filter-count">
                  {filteredGames.length} {filteredGames.length === 1 ? "game" : "games"} found
                </p>
              )}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredGames.map((game, index) => (
                  <GameCard key={game.id} game={game} index={index} onFavoriteChange={handleFavoriteChange} />
                ))}
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              {isFiltering ? (
                <>
                  <Search className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-3">No games match your search.</p>
                  <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setDifficultyFilter("all"); }} data-testid="button-clear-filters">
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <Gamepad2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No games available at the moment.</p>
                </>
              )}
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
