import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Game } from "@shared/schema";
import { AnalyticsOverview } from "./AnalyticsOverview";
import type { AdminOverviewStats } from "./analytics/AnalyticsSiteTotals";

export function OverviewTab() {
  const { data: stats, isLoading } = useQuery<AdminOverviewStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: games } = useQuery<Game[]>({ queryKey: ["/api/admin/games"] });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return <AnalyticsOverview games={games ?? []} stats={stats} />;
}
