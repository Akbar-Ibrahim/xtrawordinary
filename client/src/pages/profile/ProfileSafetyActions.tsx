import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Ban, Flag } from "lucide-react";
import type { UserReportReason } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  targetUser: { id: number; name: string; username: string };
}

const REPORT_REASONS: Array<{ value: UserReportReason; label: string }> = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

export function ProfileSafetyActions({ targetUser }: Props) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reason, setReason] = useState<UserReportReason | "">("");
  const [details, setDetails] = useState("");

  const block = useMutation({
    mutationFn: () => apiRequest("POST", `/api/users/${targetUser.id}/block`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/blocked"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/duels/challenges"] });
      toast({ title: "User blocked", description: "They can no longer find or contact you through friend requests or challenges." });
      navigate("/friends?tab=blocked");
    },
    onError: () => toast({ title: "Could not block user", variant: "destructive" }),
  });

  const report = useMutation({
    mutationFn: () => apiRequest("POST", `/api/users/${targetUser.id}/report`, { reason, details }),
    onSuccess: () => {
      setReportDialogOpen(false);
      setReason("");
      setDetails("");
      toast({ title: "Report sent", description: "An administrator will review it. Reporting does not block the user." });
    },
    onError: () => toast({ title: "Could not send report", variant: "destructive" }),
  });

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setReportDialogOpen(true)} data-testid="button-report-user">
        <Flag className="mr-1 h-4 w-4" />Report
      </Button>
      <Button size="sm" variant="outline" onClick={() => setBlockDialogOpen(true)} data-testid="button-block-user">
        <Ban className="mr-1 h-4 w-4" />Block
      </Button>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent data-testid="dialog-block-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Block @{targetUser.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes any friendship, hides each of you from the other’s profile search and suggestions, and prevents friend requests and direct challenges. Pending direct challenges are cancelled. You can unblock them later from Friends → Blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => block.mutate()} disabled={block.isPending}>
              {block.isPending ? "Blocking…" : "Block user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent data-testid="dialog-report-user">
          <DialogHeader>
            <DialogTitle>Report @{targetUser.username}</DialogTitle>
            <DialogDescription>
              Reports are sent to administrators for review. The user is not automatically blocked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={reason} onValueChange={(value) => setReason(value as UserReportReason)}>
              <SelectTrigger aria-label="Report reason" data-testid="select-report-reason">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
              placeholder="Add context to help us review (optional)"
              maxLength={1000}
              rows={4}
              data-testid="input-report-details"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => report.mutate()}
              disabled={!reason || report.isPending}
              data-testid="button-submit-user-report"
            >
              {report.isPending ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
