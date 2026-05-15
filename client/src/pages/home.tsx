import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { GameCard } from "@/components/game-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Flame, Trophy, Calendar, ArrowRight, CheckCircle, Shuffle, Swords, Search, X, Sparkles, Sword, LayoutGrid, List } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { Game, WordWarsTournament } from "@shared/schema";

import { loadStats, loadStreak, loadFavorites, getDailyChallengeRecord } from "@/lib/game-stats";

import { PremiumBanner } from "@/components/premium-banner";

type TournamentWithCount = WordWarsTournament & { registrationCount: number };
type ChampionEntry = { id: number; tournamentId: number; userId: number; createdAt: string; user: { id: number; name: string; avatarUrl: string | null } | null; tournament: { id: number; name: string } | null };

const ONBOARDED_KEY = "xw_onboarded";
const VIEW_MODE_KEY = "xw_game_view_mode";

const STARTER_GAMES = [
  { slug: "word-scramble", label: "Word Scramble", blurb: "Unscramble letters into words", difficulty: "easy", color: "hsl(142, 69%, 45%)" },
  { slug: "word-chain",    label: "Word Chain",    blurb: "Each word starts where the last ended", difficulty: "medium", color: "hsl(221, 83%, 58%)" },
  { slug: "anagram-solver", label: "Anagram Solver", blurb: "Find all hidden words in the set", difficulty: "hard", color: "hsl(340, 82%, 55%)" },
];

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

  const { data: wordWarsTournaments = [] } = useQuery<TournamentWithCount[]>({
    queryKey: ["/api/word-wars"],
  });

  const openTournament = wordWarsTournaments.find(t => t.status === "active") ?? wordWarsTournaments.find(t => t.status === "registration");
  const hasAnyTournament = wordWarsTournaments.length > 0;

  const { data: hallOfFame = [] } = useQuery<ChampionEntry[]>({
    queryKey: ["/api/word-wars/champions"],
    enabled: !openTournament && hasAnyTournament,
  });

  const stats = useMemo(() => loadStats(), []);
  const streak = useMemo(() => loadStreak(), []);
  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");

  const [viewMode, setViewMode] = useState<"grid" | "compact">(() => {
    try {
      return (localStorage.getItem(VIEW_MODE_KEY) as "grid" | "compact") || "compact";
    } catch {
      return "compact";
    }
  });

  const toggleViewMode = useCallback((mode: "grid" | "compact") => {
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch {}
    setViewMode(mode);
  }, []);

  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDED_KEY);
    } catch {
      return false;
    }
  });

  const dismissWelcome = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
    setShowWelcome(false);
  }, []);

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

          <AnimatePresence>
            {showWelcome && !hasPlayed && (
              <motion.div
                key="welcome-banner"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="mb-8"
              >
                <Card className="border-primary/25 bg-primary/5 relative overflow-hidden" data-testid="card-welcome-banner">
                  <CardContent className="p-5 sm:p-6">
                    <button
                      onClick={dismissWelcome}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Dismiss welcome banner"
                      data-testid="button-dismiss-welcome"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-bold text-base mb-1">Welcome to xtraWordinary!</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          25 word games. Daily challenges. 1-on-1 duels. Pick a game below to get started — it's free to play.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                          {STARTER_GAMES.map((g) => (
                            <Link key={g.slug} href={`/game/${g.slug}`} onClick={dismissWelcome}>
                              <div
                                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                                data-testid={`card-starter-${g.slug}`}
                              >
                                <div
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: g.color }}
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate">{g.label}</p>
                                  <p className="text-xs text-muted-foreground truncate">{g.blurb}</p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>

                        <Button size="sm" variant="ghost" onClick={dismissWelcome} className="text-xs text-muted-foreground h-auto py-1 px-2" data-testid="button-welcome-skip">
                          I'll browse on my own
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

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

          <div className="flex overflow-x-auto gap-3 mb-8 scrollbar-none pb-1">
            {dailyChallenge && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="flex flex-col flex-1 min-w-[200px]"
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
                className="flex flex-col flex-1 min-w-[200px]"
              >
                <Card
                  className="hover-elevate cursor-pointer border-dashed h-full"
                  onClick={pickSurpriseGame}
                  data-testid="card-surprise-me"
                >
                  <CardContent className="p-4 flex items-center gap-3 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500">
                      <Shuffle className="h-5 w-5 text-white" />
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
              className="flex flex-col flex-1 min-w-[200px]"
            >
              <Link href="/duels" className="flex-1 flex flex-col">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-duels-shortcut">
                  <CardContent className="p-4 flex items-center gap-3 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-violet-500">
                      <Swords className="h-5 w-5 text-white" />
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
              transition={{ delay: 0.25 }}
              className="flex flex-col flex-1 min-w-[200px]"
            >
              {(() => {
                let subLabel: string;
                if (openTournament) {
                  if (openTournament.status === "registration") {
                    subLabel = `${openTournament.registrationCount} ${openTournament.registrationCount === 1 ? "warrior" : "warriors"} · closes ${new Date(openTournament.registrationDeadline).toLocaleDateString()}`;
                  } else {
                    subLabel = "In Progress";
                  }
                } else if (hallOfFame.length > 0 && hallOfFame[0].user) {
                  subLabel = `Last champion: ${hallOfFame[0].user.name}`;
                } else if (hasAnyTournament) {
                  subLabel = "View past tournaments";
                } else {
                  subLabel = "Bracket tournaments";
                }
                return (
                  <Link href="/word-wars" className="flex-1 flex flex-col">
                    <Card
                      className={`hover-elevate cursor-pointer h-full${openTournament ? " border-amber-400/40" : ""}`}
                      data-testid="card-word-wars-shortcut"
                    >
                      <CardContent className="p-4 flex items-center gap-3 h-full">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-rose-500">
                          <Sword className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">Word Wars</p>
                          <p className="text-xs text-muted-foreground truncate">{subLabel}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })()}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.27 }}
              className="flex flex-col flex-1 min-w-[200px]"
            >
              <Link href="/guild-wars" className="flex-1 flex flex-col">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-guild-wars-shortcut">
                  <CardContent className="p-4 flex items-center gap-3 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-purple-500">
                      <Swords className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Guild Wars</p>
                      <p className="text-xs text-muted-foreground truncate">Group bracket tournaments</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.29 }}
              className="flex flex-col flex-1 min-w-[200px]"
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
              <h2 className="text-xl font-semibold flex-1">Available Games</h2>
              <div className="flex items-center gap-0.5 p-0.5 rounded-md border bg-muted">
                <button
                  onClick={() => toggleViewMode("grid")}
                  className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  title="Grid view"
                  data-testid="button-view-grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleViewMode("compact")}
                  className={`p-1.5 rounded transition-colors ${viewMode === "compact" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  title="Compact view"
                  data-testid="button-view-compact"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
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
            <div className={viewMode === "compact" ? "grid sm:grid-cols-2 gap-2" : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"}>
              {[1, 2, 3].map((i) => (
                viewMode === "compact"
                  ? <Skeleton key={i} className="h-16 rounded-lg" />
                  : (
                    <div key={i} className="space-y-4">
                      <Skeleton className="h-32 w-full rounded-lg" />
                      <div className="space-y-2 p-4">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    </div>
                  )
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
              {viewMode === "compact" ? (
                <div className="grid sm:grid-cols-2 gap-2">
                  {filteredGames.map((game) => {
                    const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[game.icon] ?? LucideIcons.Gamepad2;
                    return (
                      <Link key={game.id} href={`/game/${game.slug}`}>
                        <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-game-compact-${game.slug}`}>
                          <CardContent className="p-3 flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: game.color }}
                            >
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate mb-0.5">{game.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{game.description}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredGames.map((game, index) => (
                    <GameCard key={game.id} game={game} index={index} onFavoriteChange={handleFavoriteChange} />
                  ))}
                </div>
              )}
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
