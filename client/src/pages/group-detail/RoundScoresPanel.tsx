import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { Clock } from "lucide-react";
import { ReactionStrip } from "./ReactionStrip";
import type { RoundScoreEntry } from "./types";

export function RoundScoresPanel({ groupId, roundId, currentUserId }: { groupId: number; roundId: number; currentUserId: number | undefined }) {
  const { data, isLoading } = useQuery<RoundScoreEntry[]>({
    queryKey: ["/api/groups", groupId, "rounds", roundId, "scores"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds/${roundId}/scores`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load scores");
      return res.json();
    },
  });

  if (isLoading) return <div className="py-2 px-3"><Skeleton className="h-10 w-full" /></div>;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-3">No scores submitted for this round.</p>;
  }

  return (
    <div className="space-y-2 pt-1">
      {data.map((entry, i) => (
        <div key={entry.id} className="px-3 py-2 rounded-lg bg-muted/40" data-testid={`round-score-${roundId}-${entry.userId}`}>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold w-5 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
              {i + 1}
            </span>
            <Link href={`/u/${entry.user.username}`}>
              <UserAvatar name={entry.user.name} avatarUrl={entry.user.avatarUrl} className="h-7 w-7 cursor-pointer" />
            </Link>
            <Link href={`/u/${entry.user.username}`} className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate hover:underline cursor-pointer">{entry.user.name}<span className="block text-xs font-normal text-muted-foreground">@{entry.user.username}</span></span>
            </Link>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {entry.durationMs != null
                ? `${Math.floor(entry.durationMs / 60000)}:${String(Math.floor((entry.durationMs % 60000) / 1000)).padStart(2, "0")}`
                : new Date(entry.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="font-bold text-sm">{entry.score.toLocaleString()}</span>
          </div>
          <div className="pl-8">
            <ReactionStrip groupId={groupId} roundId={roundId} scoreId={entry.id} currentUserId={currentUserId} />
          </div>
        </div>
      ))}
    </div>
  );
}
