import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Swords, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { DuelHistoryEntry } from "./types";

interface Props {
  duelHistoryLoading: boolean;
  duelHistory: DuelHistoryEntry[];
  formatGameName: (slug: string) => string;
}

export function DuelsTab({ duelHistoryLoading, duelHistory, formatGameName }: Props) {
  if (duelHistoryLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    );
  }

  if (duelHistory.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium mb-1">No duels played yet</p>
        <p className="text-sm">Duel a Friend to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {duelHistory.map((duel) => {
        const isForfeit = duel.isForfeit;
        const outcomeLabel = duel.outcome === "win"
          ? (isForfeit ? "Forfeit" : "Win")
          : duel.outcome === "loss"
          ? (isForfeit ? "Forfeit" : "Loss")
          : duel.outcome === "draw" ? "Draw" : "In Progress";
        const outcomeBadgeVariant: "default" | "destructive" | "secondary" =
          (duel.outcome === "win" || isForfeit) ? "default" : duel.outcome === "loss" ? "destructive" : "secondary";
        const outcomeBadgeClass = duel.outcome === "win"
          ? (isForfeit ? "bg-orange-500 hover:bg-orange-500 text-white border-0" : "bg-green-500 hover:bg-green-500 text-white border-0")
          : isForfeit ? "bg-orange-500 hover:bg-orange-500 text-white border-0" : "";
        const eloDeltaPositive = duel.eloDelta !== null && duel.eloDelta > 0;
        const eloDeltaNegative = duel.eloDelta !== null && duel.eloDelta < 0;
        const date = duel.endedAt ? new Date(duel.endedAt) : new Date(duel.startedAt);
        return (
          <div
            key={duel.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            data-testid={`row-duel-${duel.id}`}
          >
            <div className="flex items-center gap-3">
              <Badge
                variant={outcomeBadgeVariant}
                className={`w-16 justify-center shrink-0 ${outcomeBadgeClass}`}
                data-testid={`badge-duel-outcome-${duel.id}`}
              >
                {outcomeLabel}
              </Badge>
              <UserAvatar name={duel.opponentName} avatarUrl={duel.opponentAvatarUrl} className="h-8 w-8 shrink-0 text-xs" />
              <div>
                <p className="font-medium text-sm" data-testid={`text-duel-opponent-${duel.id}`}>
                  vs{" "}
                  <Link href={`/profile/${duel.opponentId}`}>
                    <span className="hover:underline cursor-pointer">{duel.opponentName}</span>
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatGameName(duel.gameSlug)} · {date.toLocaleDateString(undefined, { dateStyle: "medium" })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0" data-testid={`text-duel-elo-delta-${duel.id}`}>
              {duel.eloDelta !== null ? (
                <>
                  {eloDeltaPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {eloDeltaNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
                  {!eloDeltaPositive && !eloDeltaNegative && <Minus className="h-4 w-4 text-muted-foreground" />}
                  <span className={`text-sm font-semibold ${eloDeltaPositive ? "text-green-500" : eloDeltaNegative ? "text-red-500" : "text-muted-foreground"}`}>
                    {eloDeltaPositive ? "+" : ""}{duel.eloDelta}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
