import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Flag, Loader2, Mail, MailOpen } from "lucide-react";
import type { AdminUserReport, UserReportReason } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const REASON_LABELS: Record<UserReportReason, string> = {
  harassment: "Harassment or bullying",
  spam: "Spam",
  inappropriate_content: "Inappropriate content",
  impersonation: "Impersonation",
  other: "Other",
};

function userLabel(user: AdminUserReport["reportedUser"], fallbackId: number): string {
  return user ? `${user.name} (@${user.username})` : `Deleted account (ID ${fallbackId})`;
}

export function UserReportsTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: reports = [], isLoading, isError } = useQuery<AdminUserReport[]>({
    queryKey: ["/api/admin/user-reports"],
  });
  const selected = reports.find((report) => report.id === selectedId);

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/user-reports/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/user-reports"] }),
    onError: () => toast({ title: "Could not mark report as read", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (isError) return <Card><CardContent className="p-8 text-center text-destructive">User reports could not be loaded.</CardContent></Card>;

  const unreadCount = reports.filter((report) => !report.readAt).length;
  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5" />User reports</CardTitle>
          {unreadCount > 0 && <Badge>{unreadCount} unread</Badge>}
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground" data-testid="text-no-user-reports">No user reports yet.</p>
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
                  data-testid={`user-report-${report.id}`}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${report.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {report.readAt ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className={`text-sm ${!report.readAt ? "font-semibold" : "font-medium"}`}>
                        {userLabel(report.reportedUser, report.reportedUserId)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(report.createdAt), "MMM d, yyyy")}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {REASON_LABELS[report.reason]} · Reported by {userLabel(report.reporter, report.reportingUserId)}
                    </span>
                    {report.details && <span className="mt-1 block truncate text-sm text-muted-foreground">{report.details}</span>}
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
                <DialogTitle>{userLabel(selected.reportedUser, selected.reportedUserId)}</DialogTitle>
                <DialogDescription>
                  {REASON_LABELS[selected.reason]} · Reported by {userLabel(selected.reporter, selected.reportingUserId)}
                  <br />
                  Received {format(new Date(selected.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </DialogDescription>
              </DialogHeader>
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed" data-testid="user-report-details">
                {selected.details || "No additional details were provided."}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
