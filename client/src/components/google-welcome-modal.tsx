import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function GoogleWelcomeModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "google-new") {
      setOpen(true);
      if (user?.name) setName(user.name);
    }
  }, [user]);

  function clearParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    window.history.replaceState({}, "", url.toString());
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed === user?.name) {
      clearParam();
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/users/me", { name: trimmed });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Display name saved!", description: `You'll appear as "${trimmed}" across xtraWordinary.` });
    } catch {
      toast({ title: "Couldn't save name", description: "You can change it anytime from your profile.", variant: "destructive" });
    } finally {
      setSaving(false);
      clearParam();
      setOpen(false);
    }
  }

  function handleDismiss() {
    clearParam();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-sm" data-testid="modal-google-welcome">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Welcome to xtraWordinary!
          </DialogTitle>
          <DialogDescription>
            Your Google name will be shown on leaderboards and your profile. You can keep it or choose something else — you can always change it later in your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="welcome-name">Display name</Label>
            <Input
              id="welcome-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              maxLength={50}
              data-testid="input-welcome-name"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1"
              data-testid="button-welcome-save"
            >
              {saving ? "Saving…" : "Looks good, let's go!"}
            </Button>
            <Button
              variant="ghost"
              onClick={handleDismiss}
              data-testid="button-welcome-skip"
            >
              Skip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
