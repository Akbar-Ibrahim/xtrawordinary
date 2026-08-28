import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { AnalyticsComparisonReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const labels: Array<[keyof AnalyticsComparisonReport, string]> = [
  ["uniqueVisitors", "Unique visitors"], ["sessions", "Sessions"], ["gameStarts", "Game starts"], ["gameCompletions", "Completions"], ["registrations", "Registrations"],
];

export function AnalyticsComparison({ comparison }: { comparison: AnalyticsComparisonReport }) {
  return <Card><CardHeader><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Period over period</p><CardTitle className="text-xl">What changed</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{labels.map(([key, label]) => {
    const metric = comparison[key]; const change = metric.changePercent; const positive = change !== null && change > 0; const neutral = change === null || change === 0;
    return <div key={key} className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-2 flex items-baseline justify-between gap-2"><strong className="text-xl tabular-nums">{metric.current.toLocaleString()}</strong><span className={`flex items-center text-xs font-semibold ${neutral ? "text-muted-foreground" : positive ? "text-emerald-700" : "text-rose-700"}`}>{neutral ? <Minus className="mr-1 h-3 w-3" /> : positive ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}{change === null ? "New" : `${Math.abs(change).toFixed(1)}%`}</span></div><p className="mt-1 text-[11px] text-muted-foreground">previous {metric.previous.toLocaleString()}</p></div>;
  })}</CardContent></Card>;
}