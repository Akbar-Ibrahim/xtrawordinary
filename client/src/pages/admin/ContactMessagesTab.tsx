import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Inbox, Loader2, Mail, MailOpen, Send } from "lucide-react";
import type { ContactMessage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export function ContactMessagesTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: messages, isLoading, isError } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contact-messages"],
  });
  const selectedMessage = messages?.find((message) => message.id === selectedId);

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/contact-messages/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-messages"] }),
    onError: () => toast({ title: "Failed to mark message as read", variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message }: { id: number; message: string }) =>
      apiRequest("POST", `/api/admin/contact-messages/${id}/replies`, { message }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-messages"] });
      toast({ title: "Reply sent" });
    },
    onError: (error: Error) => {
      let description = "The reply could not be delivered. Please try again.";
      const jsonStart = error.message.indexOf("{");
      if (jsonStart >= 0) {
        try {
          description = JSON.parse(error.message.slice(jsonStart)).error || description;
        } catch {
          // Keep the user-friendly fallback.
        }
      }
      toast({ title: "Reply not sent", description, variant: "destructive" });
    },
  });

  const openMessage = (message: ContactMessage) => {
    setReply("");
    setSelectedId(message.id);
    if (!message.readAt) markReadMutation.mutate(message.id);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-destructive">Contact messages could not be loaded.</CardContent>
      </Card>
    );
  }

  const unreadCount = messages?.filter((message) => !message.readAt).length ?? 0;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Contact inbox
          </CardTitle>
          {unreadCount > 0 && <Badge>{unreadCount} unread</Badge>}
        </CardHeader>
        <CardContent>
          {!messages?.length ? (
            <div className="py-10 text-center">
              <Mail className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground" data-testid="text-no-contact-messages">No contact messages yet.</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {messages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => openMessage(message)}
                  className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50 ${!message.readAt ? "bg-primary/5" : ""}`}
                  data-testid={`contact-message-${message.id}`}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${message.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {message.readAt ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className={`truncate text-sm ${!message.readAt ? "font-semibold" : "font-medium"}`}>{message.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(message.createdAt), "MMM d, yyyy")}
                      </span>
                    </span>
                    <span className={`mt-0.5 block truncate text-sm ${!message.readAt ? "font-medium" : ""}`}>
                      {message.subject || "No subject"}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{message.message}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selectedMessage && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{selectedMessage.subject || "No subject"}</DialogTitle>
                <DialogDescription>
                  Received {format(new Date(selectedMessage.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-[6rem_1fr]">
                <dt className="font-medium text-muted-foreground">From</dt>
                <dd className="break-words">{selectedMessage.name}</dd>
                <dt className="font-medium text-muted-foreground">Email</dt>
                <dd className="break-all">{selectedMessage.email}</dd>
              </dl>
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed" data-testid="contact-message-body">
                {selectedMessage.message}
              </div>
              {selectedMessage.replies.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <h3 className="text-sm font-semibold">Sent replies</h3>
                  {selectedMessage.replies.map((sentReply) => (
                    <div key={sentReply.id} className="rounded-lg border bg-primary/5 p-3">
                      <div className="mb-2 text-xs text-muted-foreground">
                        {sentReply.sentByAdminName} · {format(new Date(sentReply.sentAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">{sentReply.message}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 border-t pt-4">
                <label htmlFor="contact-reply" className="text-sm font-semibold">
                  Reply to {selectedMessage.email}
                </label>
                <Textarea
                  id="contact-reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Write your reply…"
                  rows={6}
                  maxLength={5000}
                  disabled={replyMutation.isPending}
                  data-testid="input-contact-reply"
                />
                <div className="text-right text-xs text-muted-foreground">{reply.length}/5,000</div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => replyMutation.mutate({ id: selectedMessage.id, message: reply.trim() })}
                  disabled={!reply.trim() || replyMutation.isPending}
                  data-testid="button-send-contact-reply"
                >
                  {replyMutation.isPending
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Send className="mr-2 h-4 w-4" />}
                  {replyMutation.isPending ? "Sending…" : "Send reply"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}