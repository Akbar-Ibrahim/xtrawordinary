import { useState, useEffect } from "react";
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
import { useUsernameAvailability } from "@/hooks/use-username-availability";
import { suggestUsername } from "@shared/usernames";

export function GoogleWelcomeModal() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const availability = useUsernameAvailability(username);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") !== "google-new") return;

    setOpen(true);
    let active = true;
    fetch("/api/auth/google/pending", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Pending Google signup not found");
        return res.json();
      })
      .then((data) => {
        if (active && data.name) setUsername(suggestUsername(data.name));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  function clearParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    window.history.replaceState({}, "", url.toString());
  }

  async function handleSave() {
    const trimmed = username.trim();
    if (!trimmed || availability.available !== true) return;
    setSaving(true);
    let completed = false;
    try {
      const response = await apiRequest("POST", "/api/auth/google/complete", { username: trimmed });
      await response.json();
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Username saved!", description: `People can now find you as @${trimmed.toLowerCase()}.` });
      completed = true;
    } catch (error: any) {
      toast({ title: "Couldn't save username", description: error?.message || "Try another username.", variant: "destructive" });
    } finally {
      setSaving(false);
      if (completed) {
        clearParam();
        setOpen(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="max-w-sm" data-testid="modal-google-welcome">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Welcome to xtraWordinary!
          </DialogTitle>
          <DialogDescription>
            Keep your Google display name, then choose the unique username friends will use to find you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="welcome-username">Username</Label>
            <Input
              id="welcome-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              minLength={3}
              maxLength={20}
              autoCapitalize="none"
              data-testid="input-welcome-username"
              autoFocus
            />
            <p className={`text-xs ${availability.available === false ? "text-destructive" : "text-muted-foreground"}`}>
              {availability.checking ? "Checking availability…" : availability.message || "3–20 lowercase letters, numbers, or underscores."}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving || availability.checking || availability.available !== true}
              className="flex-1"
              data-testid="button-welcome-save"
            >
              {saving ? "Saving…" : "Continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
