import type { AnalyticsFunnelReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function AnalyticsFunnel({ funnel }: { funnel: AnalyticsFunnelReport }) {
  const stages = [
    ["Visitors", funnel.visitors, 100],
    ["Started a game", funnel.gameStarters, funnel.visitorToGameStartRate],
    ["Completed a game", funnel.gameCompleters, funnel.gameStartToCompletionRate],
    ["Registered", funnel.registrations, funnel.visitorToRegistrationRate],
    ["Played after registering", funnel.postRegistrationPlayers, funnel.registrationToPlayRate],
  ] as const;
  return <Card><CardHeader><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Journey</p><CardTitle className="text-xl">Activation funnel</CardTitle></CardHeader><CardContent className="space-y-4">{stages.map(([label, value, rate], index) => <div key={label} className="relative"><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium">{label}</span><span className="tabular-nums text-muted-foreground">{value.toLocaleString()} <span className="ml-1 text-xs">({rate.toFixed(1)}%)</span></span></div><Progress value={Math.min(100, rate)} className={`h-2 ${index === 0 ? "[&>div]:bg-primary" : "[&>div]:bg-[#81b29a]"}`} /></div>)}</CardContent></Card>;
}