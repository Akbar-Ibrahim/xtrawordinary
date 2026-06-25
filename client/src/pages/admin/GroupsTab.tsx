import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star } from "lucide-react";
import type { Group } from "@shared/schema/groups";

export function GroupsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allGroups, isLoading } = useQuery<Group[]>({ queryKey: ["/api/admin/groups"] });

  const featureMutation = useMutation({
    mutationFn: ({ id, isFeatured }: { id: number; isFeatured: boolean }) =>
      apiRequest("PATCH", `/api/groups/${id}/feature`, { isFeatured }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/groups"] }); toast({ title: "Group updated" }); },
    onError: () => toast({ title: "Failed to update group", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!allGroups?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground" data-testid="text-no-groups">No public groups yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>All Groups ({allGroups?.length ?? 0})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Name</th>
                <th className="text-left py-3 px-2">Visibility</th>
                <th className="text-left py-3 px-2">Members</th>
                <th className="text-left py-3 px-2">Tags</th>
                <th className="text-left py-3 px-2">Featured</th>
                <th className="text-right py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(allGroups || []).map((g) => (
                <tr key={g.id} className="border-b hover:bg-muted/50" data-testid={`group-row-${g.id}`}>
                  <td className="py-3 px-2 font-medium">{g.name}</td>
                  <td className="py-3 px-2">
                    <Badge variant="outline" className="text-xs">{g.isPublic ? "Public" : "Private"}</Badge>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{g.memberCount ?? "—"}</td>
                  <td className="py-3 px-2">
                    <div className="flex flex-wrap gap-1">
                      {(g.tags || []).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    {g.isFeatured ? (
                      <Badge variant="default" className="gap-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/40 dark:text-yellow-300" data-testid={`badge-featured-${g.id}`}>
                        <Star className="h-3 w-3 fill-current" />Featured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">—</Badge>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Button
                      size="sm"
                      variant={g.isFeatured ? "outline" : "secondary"}
                      onClick={() => featureMutation.mutate({ id: g.id, isFeatured: !g.isFeatured })}
                      disabled={featureMutation.isPending}
                      data-testid={`button-feature-${g.id}`}
                    >
                      <Star className={`h-3 w-3 mr-1 ${g.isFeatured ? "" : "fill-current"}`} />
                      {g.isFeatured ? "Unfeature" : "Feature"}
                    </Button>
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
