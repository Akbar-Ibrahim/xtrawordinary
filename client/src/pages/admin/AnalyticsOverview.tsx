import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnalyticsReport, Game } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AnalyticsToolbar } from "./analytics";
import { AnalyticsSections } from "./analytics/AnalyticsSections";
import type { AdminOverviewStats } from "./analytics/AnalyticsSiteTotals";
import { buildAnalyticsQuery } from "./analytics/query";

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function recentRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: dateKey(start), endDate: dateKey(end) };
}

export function AnalyticsOverview({
  games,
  stats,
}: {
  games: Game[];
  stats?: AdminOverviewStats;
}) {
  const initialRange = useMemo(() => recentRange(7), []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [gameSlug, setGameSlug] = useState<string>();
  const [gameMode, setGameMode] = useState<string>();
  const { toast } = useToast();

  const queryString = useMemo(() => {
    return buildAnalyticsQuery(startDate, endDate, gameSlug, gameMode);
  }, [startDate, endDate, gameSlug, gameMode]);
  const reportUrl = `/api/admin/analytics?${queryString}`;
  const { data, isLoading, isFetching, error, refetch } = useQuery<AnalyticsReport>({
    queryKey: [reportUrl],
    enabled: startDate <= endDate,
    refetchOnMount: "always",
  });

  const applyRange = (days: number) => {
    const range = recentRange(days);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };
  const selectGame = (slug?: string) => {
    setGameSlug(slug);
  };
  const exportCsv = async () => {
    try {
      const response = await fetch(`/api/admin/analytics.csv?${queryString}`, { credentials: "include" });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `analytics-${startDate}-to-${endDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Analytics exported", description: "The aggregate CSV is ready." });
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">First-party analytics</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Player growth and engagement</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Aggregate trends only—no IP addresses, answers, keystrokes, or device fingerprints.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((days) => <Button key={days} type="button" variant="outline" size="sm" onClick={() => applyRange(days)}>Last {days} days</Button>)}
        </div>
      </div>

      <AnalyticsToolbar
        startDate={startDate}
        endDate={endDate}
        gameSlug={gameSlug}
        gameMode={gameMode}
        games={games}
        isFetching={isFetching}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onGameChange={selectGame}
        onModeChange={setGameMode}
        onRefresh={() => void refetch()}
        onExport={() => void exportCsv()}
      />

      {data && !error && (
        <Card data-testid="card-retained-unique-visitors">
          <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Total unique visitors in stored history</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Distinct tracked visitors across available analytics records, regardless of the date and game filters above. Records are kept for up to 730 days; this is not an all-time count.
              </p>
            </div>
            <strong className="shrink-0 text-3xl tabular-nums" data-testid="total-retained-unique-visitors">
              {data.uniqueVisitorsInRetainedHistory.toLocaleString()}
            </strong>
          </CardContent>
        </Card>
      )}
      <AnalyticsSections report={data} games={games} stats={stats} isLoading={isLoading} hasError={!!error} />
    </div>
  );
}