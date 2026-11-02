import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, UserRound } from "lucide-react";
import type { BlockedUser } from "@shared/schema";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function BlockedUsersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: blockedUsers = [], isLoading, isError } = useQuery<BlockedUser[]>({
    queryKey: ["/api/users/me/blocked"],
  });

  const unblock = useMutation({
    mutationFn: (userId: number) => apiRequest("DELETE", `/api/users/${userId}/block`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/blocked"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/suggestions"] });
      toast({ title: "User unblocked", description: "You can now find and interact with this player again." });
    },
    onError: () => toast({ title: "Could not unblock user", variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5" />Blocked users</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-destructive">Blocked users could not be loaded.</p>
        ) : blockedUsers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <UserRound className="mx-auto mb-2 h-9 w-9 opacity-40" />
            <p>You haven’t blocked anyone.</p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {blockedUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-3" data-testid={`blocked-user-${user.id}`}>
                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unblock.mutate(user.id)}
                  disabled={unblock.isPending}
                  data-testid={`button-unblock-${user.id}`}
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
