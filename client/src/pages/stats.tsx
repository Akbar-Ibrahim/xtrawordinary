import { PageSEO } from "@/components/page-seo";
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
import { loadStats, loadStreak, getTotalWordsFound, getUniqueGamesPlayed, type GameRecord } from "@/lib/game-stats";
import { PremiumBanner } from "@/components/premium-banner";
import { ScoreTrendChart, MiniSparkline } from "@/components/score-trend-chart";
import type { Game } from "@shared/schema";

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PlayHeatmap({ history }: { history: GameRecord[] }) {
  const dateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of history) {
      const d = new Date(r.timestamp);
      const key = formatDateStr(d);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [history]);

  const todayStr = formatDateStr(new Date());

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 16 * 7 + 1);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeksArr: { date: string; count: number; isFuture: boolean }[][] = [];
    const current = new Date(startDate);

    for (let w = 0; w < 16; w++) {
      const week: { date: string; count: number; isFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = formatDateStr(current);
        week.push({
          date: dateStr,
          count: dateMap.get(dateStr) || 0,
          isFuture: dateStr > todayStr,
        });
        current.setDate(current.getDate() + 1);
      }
      weeksArr.push(week);
    }

    const labels = weeksArr.map((week) => {
      const firstDate = new Date(week[0].date);
      return firstDate.getDate() <= 7
        ? firstDate.toLocaleString("default", { month: "short" })
        : "";
    });

    return { weeks: weeksArr, monthLabels: labels };
  }, [dateMap, todayStr]);

  const totalActiveDays = useMemo(() => dateMap.size, [dateMap]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Play Activity
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {totalActiveDays} active {totalActiveDays === 1 ? "day" : "days"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-1 min-w-max">
            <div className="flex flex-col gap-1 mr-1 mt-5">
              {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
                <div
                  key={i}
                  className="h-3 w-6 text-right text-[9px] text-muted-foreground leading-3"
                >
                  {label}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                <div className="h-4 text-[9px] text-muted-foreground leading-4 whitespace-nowrap">
                  {monthLabels[wi]}
                </div>
                {week.map((day) => (
                  <div
                    key={day.date}
                    title={
                      day.isFuture
                        ? ""
                        : day.count > 0
                        ? `${day.date}: ${day.count} game${day.count > 1 ? "s" : ""}`
                        : `${day.date}: no games`
                    }
                    className={`h-3 w-3 rounded-sm transition-colors ${
                      day.isFuture
                        ? "opacity-0 pointer-events-none"
                        : day.date === todayStr
                        ? day.count > 0
                          ? "bg-primary ring-1 ring-primary ring-offset-1 ring-offset-background"
                          : "bg-muted ring-1 ring-border ring-offset-1 ring-offset-background"
                        : day.count >= 3
                        ? "bg-primary"
                        : day.count === 2
                        ? "bg-primary/65"
                        : day.count === 1
                        ? "bg-primary/35"
                        : "bg-muted"
                    }`}
                    data-testid={day.date === todayStr ? "heatmap-today" : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground select-none">
          <span>Less</span>
          {["bg-muted", "bg-primary/35", "bg-primary/65", "bg-primary"].map(
            (cls, i) => (
              <div key={i} className={`h-3 w-3 rounded-sm ${cls}`} />
            )
          )}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

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
        const sparkScores = stats.history
          .filter((r) => r.slug === slug)
          .slice(-12)
          .map((r) => r.score);
        return { slug, ...gs, name: game?.name || slug, sparkScores };
      })
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  }, [stats, games]);

  const hasAnyData = stats.totalGamesPlayed > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <PageSEO title="Your Stats" description="Track your personal word game statistics — scores, streaks, games played, and progress over time." path="/stats" />
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
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-stats-title">Your Statistics</h1>
        </div>

        <div className="mb-8">
          <PremiumBanner />
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
                        {uniqueGames} / 25
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

            <PlayHeatmap history={stats.history} />

            <ScoreTrendChart
              history={stats.history}
              games={games}
              defaultSlug={gameStatsWithNames[0]?.slug}
            />

            {gameStatsWithNames.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
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
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <MiniSparkline scores={gs.sparkScores} />
                                <Badge variant="secondary" data-testid={`badge-plays-${gs.slug}`}>
                                  {gs.gamesPlayed}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Trophy className="h-3.5 w-3.5 text-chart-2" />
                                <span className="text-sm" data-testid={`text-best-${gs.slug}`}>
                                  Best: {gs.bestScore}
                                </span>
                              </div>
                              {gs.gamesPlayed > 0 && (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="h-3.5 w-3.5 text-chart-3" />
                                  <span className="text-sm" data-testid={`text-avg-${gs.slug}`}>
                                    Avg: {Math.round(gs.totalScore / gs.gamesPlayed)}
                                  </span>
                                </div>
                              )}
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
