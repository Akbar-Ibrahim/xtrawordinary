import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, Flag } from "lucide-react";

export function CommentsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/comments/reported"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/comments/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/comments/reported"] }); toast({ title: "Comment deleted" }); },
    onError: () => toast({ title: "Failed to delete comment", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!reports?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Flag className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-reports">No reported comments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Reported Comments ({reports.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reports.map((r: any) => (
            <div key={r.id} className="border rounded-lg p-4 space-y-2" data-testid={`report-row-${r.id}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      <Flag className="h-3 w-3 mr-1" />Report #{r.id}
                    </Badge>
                    {r.reporter && (
                      <span className="text-xs text-muted-foreground">by <strong>{r.reporter.name}</strong></span>
                    )}
                    <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm"><strong>Reason:</strong> {r.reason}</p>
                  {r.comment && (
                    <div className="bg-muted/40 rounded p-2 mt-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        <strong>{r.comment.user?.name ?? "Unknown"}</strong> · {r.comment.targetType}/{r.comment.targetId}
                      </p>
                      {r.comment.isDeleted ? (
                        <p className="text-sm text-muted-foreground italic">[Already deleted]</p>
                      ) : (
                        <p className="text-sm break-words">{r.comment.content}</p>
                      )}
                    </div>
                  )}
                </div>
                {r.comment && !r.comment.isDeleted && (
                  <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(r.comment.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-reported-${r.comment.id}`}>
                    <Trash2 className="h-3 w-3 mr-1" />Delete Comment
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
