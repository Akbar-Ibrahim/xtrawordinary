import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Flag, Loader2, Mail, MailOpen } from "lucide-react";
import type { AdminGameReport } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function GameReportsTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: reports, isLoading, isError } = useQuery<AdminGameReport[]>({
    queryKey: ["/api/admin/game-reports"],
  });
  const selected = reports?.find((report) => report.id === selectedId);
  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/game-reports/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/game-reports"] }),
    onError: () => toast({ title: "Could not mark report as read", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (isError) return <Card><CardContent className="p-8 text-center text-destructive">Game reports could not be loaded.</CardContent></Card>;

  const unreadCount = reports?.filter((report) => !report.readAt).length ?? 0;
  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5" />Game reports</CardTitle>
          {unreadCount > 0 && <Badge>{unreadCount} unread</Badge>}
        </CardHeader>
        <CardContent>
          {!reports?.length ? (
            <p className="py-10 text-center text-muted-foreground" data-testid="text-no-game-reports">
              No game reports yet.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {reports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(report.id);
                    if (!report.readAt) markRead.mutate(report.id);
                  }}
                  className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50 ${!report.readAt ? "bg-primary/5" : ""}`}
                  data-testid={`game-report-${report.id}`}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${report.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {report.readAt ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className={`text-sm ${!report.readAt ? "font-semibold" : "font-medium"}`}>{report.gameName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{format(new Date(report.createdAt), "MMM d, yyyy")}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">{report.message}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.gameName}</DialogTitle>
                <DialogDescription>
                  Reported {format(new Date(selected.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </DialogDescription>
              </DialogHeader>
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed" data-testid="game-report-body">
                {selected.message}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}