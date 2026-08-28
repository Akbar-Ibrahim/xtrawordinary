import { Activity, CheckCircle2, Play, UserPlus, Users } from "lucide-react";
import type { AnalyticsReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

const series = [
  { key: "uniqueVisitors", label: "Visitors", color: "#e07a5f", icon: Users },
  { key: "sessions", label: "Sessions", color: "#3d405b", icon: Activity },
  { key: "gameStarts", label: "Starts", color: "#81b29a", icon: Play },
  { key: "gameCompletions", label: "Completions", color: "#f2cc8f", icon: CheckCircle2 },
  { key: "registrations", label: "Sign-ups", color: "#6d597a", icon: UserPlus },
] as const;

export function AnalyticsTrends({ report }: { report: AnalyticsReport }) {
  const data = report.daily.map((day) => ({ ...day, label: day.date.slice(5) }));
  const hasActivity = data.some((day) => day.uniqueVisitors || day.sessions || day.gameStarts || day.gameCompletions || day.registrations);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-end justify-between gap-4 border-b border-border/60 bg-muted/20">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Over time</p><CardTitle className="mt-1 text-xl">Daily pulse</CardTitle><p className="mt-1 text-sm text-muted-foreground">How players moved through the collection.</p></div>
        <div className="hidden flex-wrap justify-end gap-x-4 gap-y-2 text-xs sm:flex">{series.map((item) => <span key={item.key} className="flex items-center gap-1.5 text-muted-foreground"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>
      </CardHeader>
      <CardContent className="pt-6">
        {hasActivity ? <ChartContainer config={Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]))} className="h-[280px] w-full aspect-auto">
          <AreaChart data={data} margin={{ left: -20, right: 10, top: 8 }}>
            <defs>{series.map((item) => <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity={0.24} /><stop offset="100%" stopColor={item.color} stopOpacity={0} /></linearGradient>)}</defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {series.map((item) => <Area key={item.key} type="monotone" dataKey={item.key} stroke={item.color} fill={`url(#fill-${item.key})`} strokeWidth={2} activeDot={{ r: 4 }} />)}
          </AreaChart>
        </ChartContainer> : <EmptyState label="No daily activity in this range." />}
      </CardContent>
    </Card>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">{label}</div>;
}