import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameSlug: string;
  gameName: string;
}

export function GameReportDialog({ open, onOpenChange, gameSlug, gameName }: Props) {
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const { toast } = useToast();
  const submit = useMutation({
    mutationFn: () => apiRequest("POST", "/api/game-reports", { gameSlug, message, website }),
    onSuccess: () => {
      setMessage("");
      setWebsite("");
      onOpenChange(false);
      toast({ title: "Report sent", description: "Thank you for helping us improve this game." });
    },
    onError: () => toast({
      title: "Report not sent",
      description: "Please try again. Your message is still here.",
      variant: "destructive",
    }),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (message.trim() && !submit.isPending) submit.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>Tell us what went wrong with {gameName}. No account or email is required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="game-report-message" className="text-sm font-medium">What happened?</label>
            <Textarea
              id="game-report-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe the issue you encountered…"
              rows={7}
              maxLength={5000}
              required
              disabled={submit.isPending}
              data-testid="input-game-report-message"
            />
            <p className="text-right text-xs text-muted-foreground">{message.length}/5,000</p>
          </div>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="game-report-website">Website</label>
            <input id="game-report-website" tabIndex={-1} autoComplete="off" value={website}
              onChange={(event) => setWebsite(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!message.trim() || submit.isPending} data-testid="button-submit-game-report">
              {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {submit.isPending ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}