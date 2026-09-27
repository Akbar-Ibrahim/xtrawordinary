import type { AnalyticsReport, Game } from "@shared/schema";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AnalyticsAudience,
  AnalyticsComparison,
  AnalyticsDailyTable,
  AnalyticsFunnel,
  AnalyticsGames,
  AnalyticsRetention,
  AnalyticsTrends,
} from "./index";
import { AnalyticsSiteTotals, type AdminOverviewStats } from "./AnalyticsSiteTotals";

const sections = [
  { value: "period", label: "Period over Period" },
  { value: "pulse", label: "Daily Pulse" },
  { value: "activation", label: "Activation" },
  { value: "audience", label: "Audience & Retention" },
  { value: "games", label: "Games" },
  { value: "daily", label: "Daily Detail" },
  { value: "totals", label: "Site Totals" },
] as const;

export function AnalyticsSections({
  report,
  games,
  stats,
  isLoading,
  hasError,
}: {
  report?: AnalyticsReport;
  games: Game[];
  stats?: AdminOverviewStats;
  isLoading: boolean;
  hasError: boolean;
}) {
  const reportContent = (render: (data: AnalyticsReport) => ReactNode) => {
    if (hasError) {
      return <Card><CardContent className="py-10 text-center text-sm text-destructive">Analytics could not be loaded for this date range and filter.</CardContent></Card>;
    }
    if (isLoading) {
      return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    if (!report) {
      return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Choose a valid date range to view analytics.</CardContent></Card>;
    }
    return render(report);
  };

  return (
    <Tabs defaultValue="period" className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <TabsList aria-label="Overview sections" className="h-auto min-w-max justify-start gap-1">
          {sections.map(section => (
            <TabsTrigger
              key={section.value}
              value={section.value}
              data-testid={`overview-section-${section.value}`}
            >
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="period" data-testid="overview-panel-period">
        {reportContent(data => <AnalyticsComparison comparison={data.comparison} />)}
      </TabsContent>
      <TabsContent value="pulse" data-testid="overview-panel-pulse">
        {reportContent(data => <AnalyticsTrends report={data} />)}
      </TabsContent>
      <TabsContent value="activation" data-testid="overview-panel-activation">
        {reportContent(data => <AnalyticsFunnel funnel={data.funnel} />)}
      </TabsContent>
      <TabsContent value="audience" data-testid="overview-panel-audience">
        {reportContent(data => (
          <div className="space-y-6">
            <AnalyticsAudience audience={data.audience} />
            <AnalyticsRetention cohorts={data.retention} />
          </div>
        ))}
      </TabsContent>
      <TabsContent value="games" data-testid="overview-panel-games">
        {reportContent(data => <AnalyticsGames games={data.games} catalog={games} />)}
      </TabsContent>
      <TabsContent value="daily" data-testid="overview-panel-daily">
        {reportContent(data => <AnalyticsDailyTable days={data.daily} />)}
      </TabsContent>
      <TabsContent value="totals" data-testid="overview-panel-totals">
        <AnalyticsSiteTotals stats={stats} games={games} />
      </TabsContent>
    </Tabs>
  );
}