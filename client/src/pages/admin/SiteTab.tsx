import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, X, Check } from "lucide-react";

export function SiteTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [announcementText, setAnnouncementText] = useState("");

  const { data: current, isLoading } = useQuery<{ text: string | null }>({
    queryKey: ["/api/site/announcement"],
    queryFn: async () => {
      const res = await fetch("/api/site/announcement");
      if (!res.ok) return { text: null };
      return res.json();
    },
  });

  const saveAnnouncement = useMutation({
    mutationFn: (text: string) => apiRequest("POST", "/api/site/announcement", { text }),
    onSuccess: () => {
      toast({ title: "Announcement saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/site/announcement"] });
      setAnnouncementText("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeAnnouncement = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/site/announcement"),
    onSuccess: () => { toast({ title: "Announcement removed" }); queryClient.invalidateQueries({ queryKey: ["/api/site/announcement"] }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Sitewide Announcement Banner</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : current?.text ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border" data-testid="card-current-announcement">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Current announcement:</p>
                <p className="text-sm">{current.text}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeAnnouncement.mutate()} disabled={removeAnnouncement.isPending} data-testid="button-remove-announcement">
                {removeAnnouncement.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active announcement.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="announcement-input" className="text-sm">New announcement (max 300 characters)</Label>
            <Input
              id="announcement-input"
              value={announcementText}
              onChange={e => setAnnouncementText(e.target.value)}
              placeholder="Type your announcement here…"
              maxLength={300}
              data-testid="input-announcement"
            />
            <p className="text-xs text-muted-foreground text-right">{announcementText.length}/300</p>
            <Button onClick={() => saveAnnouncement.mutate(announcementText)} disabled={!announcementText.trim() || saveAnnouncement.isPending} data-testid="button-save-announcement">
              {saveAnnouncement.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {current?.text ? "Update Announcement" : "Set Announcement"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
