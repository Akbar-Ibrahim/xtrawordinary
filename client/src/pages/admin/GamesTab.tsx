import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Game } from "@shared/schema";

export function GamesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: games, isLoading } = useQuery<Game[]>({ queryKey: ["/api/admin/games"] });

  const toggleMutation = useMutation({
    mutationFn: ({ slug, isActive }: { slug: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/games/${slug}/active`, { isActive }),
    onMutate: async ({ slug, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/games"] });
      const previous = queryClient.getQueryData<Game[]>(["/api/admin/games"]);
      queryClient.setQueryData<Game[]>(["/api/admin/games"], (old) =>
        old?.map((g) => g.slug === slug ? { ...g, isActive } : g) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["/api/admin/games"], context.previous);
      toast({ title: "Failed to update game", variant: "destructive" });
    },
    onSuccess: () => toast({ title: "Game updated" }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!games?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground" data-testid="text-no-games">No games found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>All Games ({games.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Name</th>
                <th className="text-left py-3 px-2">Slug</th>
                <th className="text-left py-3 px-2">Difficulty</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-right py-3 px-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.slug} className="border-b hover:bg-muted/50" data-testid={`game-row-${g.slug}`}>
                  <td className="py-3 px-2 font-medium">{g.name}</td>
                  <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{g.slug}</td>
                  <td className="py-3 px-2">
                    <Badge variant="outline" className="capitalize text-xs">{g.difficulty}</Badge>
                  </td>
                  <td className="py-3 px-2">
                    {g.isActive !== false ? (
                      <Badge variant="default" className="text-xs bg-green-500/20 text-green-700 border-green-500/40 dark:text-green-300">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Switch
                      checked={g.isActive !== false}
                      onCheckedChange={(checked) => toggleMutation.mutate({ slug: g.slug, isActive: checked })}
                      disabled={toggleMutation.isPending}
                      data-testid={`toggle-game-${g.slug}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
