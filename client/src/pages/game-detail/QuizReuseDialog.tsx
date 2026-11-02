import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CopyPlus, GraduationCap } from "lucide-react";
import type { QuizSession } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  session: QuizSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuizReuseDialog({ session, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");

  useEffect(() => {
    if (!open || !session) return;
    setTitle(`Copy of ${session.title}`.slice(0, 200));
    setDescription(session.description ?? "");
    setClosesAt("");
  }, [open, session]);

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Choose a quiz to reuse");
      const response = await apiRequest("POST", `/api/quiz-sessions/${session.shareCode}/duplicate`, {
        title: title.trim(),
        description,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      });
      return response.json() as Promise<QuizSession>;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/quiz-sessions/my"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
      ]);
      toast({ title: "New quiz created", description: "The new quiz has its own share code and no previous scores." });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't reuse quiz settings",
        description: error.message.includes("403")
          ? "Only the quiz creator can reuse these settings, and Quiz Master requires Premium."
          : "Please check the title and try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!duplicateMutation.isPending) onOpenChange(nextOpen);
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyPlus className="h-5 w-5" />
            Reuse quiz settings
          </DialogTitle>
          <DialogDescription>
            Start a new {session?.title ? `"${session.title}"` : ""} quiz with the same game and rules. Players and scores won’t be copied.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="reuse-quiz-title" className="text-sm font-medium">New quiz title</label>
            <Input
              id="reuse-quiz-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              data-testid="input-reuse-quiz-title"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="reuse-quiz-description" className="text-sm font-medium">
              Instructions <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="reuse-quiz-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={4}
              data-testid="input-reuse-quiz-description"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="reuse-quiz-closes-at" className="text-sm font-medium">
              Close date <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="reuse-quiz-closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
              data-testid="input-reuse-quiz-closes-at"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave empty to accept submissions indefinitely.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={duplicateMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => duplicateMutation.mutate()}
            disabled={!session || !title.trim() || duplicateMutation.isPending}
            data-testid="button-confirm-reuse-quiz"
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            {duplicateMutation.isPending ? "Creating…" : "Create new quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
