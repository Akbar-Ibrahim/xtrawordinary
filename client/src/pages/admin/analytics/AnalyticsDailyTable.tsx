import type { AnalyticsDailyReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AnalyticsDailyTable({ days }: { days: AnalyticsDailyReport[] }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Daily detail</p>
        <CardTitle className="text-xl">Activity by day (UTC)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-3 font-medium">Date</th>
              <th className="px-2 py-3 text-right font-medium">Visitors</th>
              <th className="px-2 py-3 text-right font-medium">Sessions</th>
              <th className="px-2 py-3 text-right font-medium">Starts</th>
              <th className="px-2 py-3 text-right font-medium">Completions</th>
              <th className="px-2 py-3 text-right font-medium">Registrations</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.date} className="border-b last:border-0">
                <td className="px-2 py-3 font-medium">{day.date}</td>
                <td className="px-2 py-3 text-right tabular-nums">{day.uniqueVisitors}</td>
                <td className="px-2 py-3 text-right tabular-nums">{day.sessions}</td>
                <td className="px-2 py-3 text-right tabular-nums">{day.gameStarts}</td>
                <td className="px-2 py-3 text-right tabular-nums">{day.gameCompletions}</td>
                <td className="px-2 py-3 text-right tabular-nums">{day.registrations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}