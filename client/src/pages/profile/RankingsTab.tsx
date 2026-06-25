import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface Props {
  rankings: Array<{ gameSlug: string; rank: number; score: number }>;
  formatGameName: (slug: string) => string;
}

export function RankingsTab({ rankings, formatGameName }: Props) {
  if (rankings.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium mb-1">No rankings yet</p>
        <p className="text-sm">Submit scores to appear on the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rankings.map((r) => (
        <div key={r.gameSlug} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`row-ranking-${r.gameSlug}`}>
          <span className="font-medium">{formatGameName(r.gameSlug)}</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{r.score.toLocaleString()} pts</span>
            <Badge variant={r.rank <= 3 ? "default" : "secondary"}>#{r.rank}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
