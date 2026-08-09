import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GroupScoreReaction } from "@shared/schema";
import { ALLOWED_EMOJIS } from "./constants";

export function ReactionStrip({ groupId, roundId, scoreId, currentUserId }: { groupId: number; roundId: number; scoreId: number; currentUserId: number | undefined }) {
  const { data: allReactions } = useQuery<GroupScoreReaction[]>({
    queryKey: ["/api/groups", groupId, "rounds", roundId, "reactions"],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/rounds/${roundId}/reactions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const addMutation = useMutation({
    mutationFn: async (emoji: string) =>
      apiRequest("POST", `/api/groups/${groupId}/rounds/${roundId}/scores/${scoreId}/reactions`, { emoji }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds", roundId, "reactions"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (emoji: string) =>
      apiRequest("DELETE", `/api/groups/${groupId}/rounds/${roundId}/scores/${scoreId}/reactions/${encodeURIComponent(emoji)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/groups", groupId, "rounds", roundId, "reactions"] }),
  });

  const scoreReactions = (allReactions || []).filter(r => r.scoreId === scoreId);

  function handleEmoji(emoji: string) {
    if (!currentUserId) return;
    const hasIt = scoreReactions.some(r => r.userId === currentUserId && r.emoji === emoji);
    if (hasIt) removeMutation.mutate(emoji);
    else addMutation.mutate(emoji);
  }

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap" role="group" aria-label="Reactions">
      {ALLOWED_EMOJIS.map(emoji => {
        const count = scoreReactions.filter(r => r.emoji === emoji).length;
        const isMine = scoreReactions.some(r => r.userId === currentUserId && r.emoji === emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleEmoji(emoji)}
            disabled={!currentUserId}
            aria-pressed={isMine}
            aria-label={`React with ${emoji}${count > 0 ? `, ${count} reaction${count !== 1 ? "s" : ""}` : ""}`}
            className={`inline-flex items-center gap-0.5 text-sm px-1.5 py-0.5 rounded-full border transition-colors ${isMine ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/70"} disabled:cursor-default`}
            title={emoji}
            data-testid={`reaction-${scoreId}-${emoji}`}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span className="text-xs font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
