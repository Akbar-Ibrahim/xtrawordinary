import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { GameRecord } from "@/lib/game-stats";
import type { Game } from "@shared/schema";

interface ScoreTrendChartProps {
  history: GameRecord[];
  games: Game[];
  defaultSlug?: string;
}

function MiniSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = max - min || 1;
  const W = 56;
  const H = 18;
  const pts = scores
    .map((v, i) => {
      const x = (i / (scores.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} className="text-primary/60 flex-shrink-0">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{d.score} pts</p>
      <p className="text-xs text-muted-foreground">{d.date}</p>
    </div>
  );
}

export function ScoreTrendChart({ history, games, defaultSlug }: ScoreTrendChartProps) {
  const eligibleSlugs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of history) counts.set(r.slug, (counts.get(r.slug) || 0) + 1);
    return Array.from(counts.entries())
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug);
  }, [history]);

  const initialSlug = defaultSlug && eligibleSlugs.includes(defaultSlug)
    ? defaultSlug
    : eligibleSlugs[0] || "";

  const [selectedSlug, setSelectedSlug] = useState(initialSlug);

  const { chartData, best, avg, weekChange, trend } = useMemo(() => {
    const plays = history.filter((r) => r.slug === selectedSlug).slice(-30);
    if (plays.length < 3) return { chartData: [], best: 0, avg: 0, weekChange: null, trend: 0 };

    const chartData = plays.map((r, i) => ({
      play: i + 1,
      score: r.score,
      date: new Date(r.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));

    const best = Math.max(...plays.map((r) => r.score));
    const avg = Math.round(plays.reduce((s, r) => s + r.score, 0) / plays.length);

    const halfIdx = Math.floor(plays.length / 2);
    const firstHalfAvg = plays.slice(0, halfIdx).reduce((s, r) => s + r.score, 0) / halfIdx;
    const secondHalfAvg = plays.slice(halfIdx).reduce((s, r) => s + r.score, 0) / (plays.length - halfIdx);
    const trend = firstHalfAvg > 0 ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100) : 0;

    const nowMs = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const thisWeek = plays.filter((r) => r.timestamp >= nowMs - weekMs);
    const lastWeek = plays.filter((r) => r.timestamp >= nowMs - 2 * weekMs && r.timestamp < nowMs - weekMs);
    const thisAvg = thisWeek.length > 0 ? thisWeek.reduce((s, r) => s + r.score, 0) / thisWeek.length : 0;
    const lastAvg = lastWeek.length > 0 ? lastWeek.reduce((s, r) => s + r.score, 0) / lastWeek.length : 0;
    const weekChange =
      thisWeek.length > 0 && lastWeek.length > 0
        ? Math.round(((thisAvg - lastAvg) / lastAvg) * 100)
        : null;

    return { chartData, best, avg, weekChange, trend };
  }, [history, selectedSlug]);

  const gameLabel = (slug: string) => {
    const g = games.find((g) => g.slug === slug);
    return g?.name || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (eligibleSlugs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Play a game 3 or more times to see your score trends.</p>
        </CardContent>
      </Card>
    );
  }

  const yMin = chartData.length > 0 ? Math.max(0, Math.min(...chartData.map((d) => d.score)) - 10) : 0;
  const yMax = chartData.length > 0 ? Math.max(...chartData.map((d) => d.score)) + 10 : 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Score Trends
          </CardTitle>
          <Select value={selectedSlug} onValueChange={setSelectedSlug}>
            <SelectTrigger className="w-[200px] h-8 text-sm" data-testid="select-trend-game">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eligibleSlugs.map((slug) => (
                <SelectItem key={slug} value={slug} data-testid={`option-trend-${slug}`}>
                  {gameLabel(slug)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {chartData.length < 3 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Not enough plays yet — keep going!
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <div>
                <span className="text-muted-foreground">Best</span>
                <span className="ml-1.5 font-semibold" data-testid="text-trend-best">{best}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg (last {chartData.length})</span>
                <span className="ml-1.5 font-semibold" data-testid="text-trend-avg">{avg}</span>
              </div>
              <div className="flex items-center gap-1">
                {trend > 5 ? (
                  <>
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-600 dark:text-green-400 font-medium">+{trend}% improving</span>
                  </>
                ) : trend < -5 ? (
                  <>
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-500 font-medium">{trend}% declining</span>
                  </>
                ) : (
                  <>
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Holding steady</span>
                  </>
                )}
              </div>
              {weekChange !== null && (
                <div className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-0.5 rounded-full">
                  {weekChange > 0 ? (
                    <span className="text-green-600 dark:text-green-400">▲ {weekChange}% vs last week</span>
                  ) : weekChange < 0 ? (
                    <span className="text-red-500">▼ {Math.abs(weekChange)}% vs last week</span>
                  ) : (
                    <span className="text-muted-foreground">Same as last week</span>
                  )}
                </div>
              )}
            </div>

            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                <XAxis
                  dataKey="play"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "Play #", position: "insideBottomRight", offset: -4, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  domain={[yMin, yMax]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={best}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{ value: "Best", position: "right", fontSize: 10, fill: "hsl(var(--primary))" }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#scoreGradient)"
                  dot={chartData.length <= 15 ? { r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 } : false}
                  activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { MiniSparkline };
