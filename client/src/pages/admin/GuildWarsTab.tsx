import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Swords, X } from "lucide-react";

const statusColor = (s: string) =>
  ({
    registration: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    active: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    completed: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    cancelled: "bg-muted text-muted-foreground",
  }[s] ?? "bg-muted text-muted-foreground");

export function GuildWarsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [roundHours, setRoundHours] = useState("24");
  const [minGroups, setMinGroups] = useState("2");
  const [maxGroups, setMaxGroups] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const { data: tournaments = [], isLoading } = useQuery<Array<{
    id: number; name: string; status: string; registrationDeadline: string; roundDeadlineHours: number; minGroups: number; maxGroups: number | null; createdAt: string;
  }>>({ queryKey: ["/api/guild-wars"] });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/guild-wars", {
      name: name.trim(),
      registrationDeadline: new Date(deadline).toISOString(),
      roundDeadlineHours: parseInt(roundHours),
      minGroups: parseInt(minGroups) || 2,
      maxGroups: maxGroups ? parseInt(maxGroups) : null,
    }),
    onSuccess: () => {
      toast({ title: "Tournament created!" });
      queryClient.invalidateQueries({ queryKey: ["/api/guild-wars"] });
      setName(""); setDeadline(""); setRoundHours("24"); setMinGroups("2"); setMaxGroups("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const drawMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/guild-wars/${id}/draw`),
    onSuccess: () => { toast({ title: "Bracket drawn!" }); queryClient.invalidateQueries({ queryKey: ["/api/guild-wars"] }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => { setCancellingId(id); return apiRequest("PATCH", `/api/guild-wars/${id}/cancel`); },
    onSuccess: () => { toast({ title: "Tournament cancelled." }); queryClient.invalidateQueries({ queryKey: ["/api/guild-wars"] }); setCancellingId(null); },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); setCancellingId(null); },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" />Create Guild Wars Tournament</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="gw-name">Tournament Name</Label>
              <Input id="gw-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Guild Wars Season 1" data-testid="input-gw-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-deadline">Registration Deadline</Label>
              <Input id="gw-deadline" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} data-testid="input-gw-deadline" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-round-hours">Hours per Round</Label>
              <Input id="gw-round-hours" type="number" min="1" value={roundHours} onChange={e => setRoundHours(e.target.value)} data-testid="input-gw-round-hours" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-min">Min Guilds to Run</Label>
              <Input id="gw-min" type="number" min="2" value={minGroups} onChange={e => setMinGroups(e.target.value)} placeholder="2" data-testid="input-gw-min-groups" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-max">Max Guilds (optional)</Label>
              <Input id="gw-max" type="number" min="2" value={maxGroups} onChange={e => setMaxGroups(e.target.value)} placeholder="Unlimited" data-testid="input-gw-max-groups" />
            </div>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || !deadline || createMutation.isPending} data-testid="button-create-gw-tournament">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Create Tournament
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Swords className="h-4 w-4" />All Guild Wars Tournaments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : tournaments.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No Guild Wars tournaments yet.</p>
          ) : (
            <div className="space-y-3" data-testid="list-admin-gw-tournaments">
              {tournaments.map(t => (
                <div key={t.id} className="border rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap" data-testid={`row-gw-tournament-${t.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${statusColor(t.status)}`}>{t.status}</Badge>
                      <span className="font-medium truncate" data-testid={`text-gw-name-${t.id}`}>{t.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Deadline: {new Date(t.registrationDeadline).toLocaleString()} · {t.roundDeadlineHours}h/round
                      {` · min ${t.minGroups ?? 2} guilds`}{t.maxGroups ? ` · max ${t.maxGroups}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.status === "registration" && (
                      <Button size="sm" variant="outline" onClick={() => drawMutation.mutate(t.id)} disabled={drawMutation.isPending} data-testid={`button-draw-gw-bracket-${t.id}`}>
                        {drawMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Draw Bracket
                      </Button>
                    )}
                    {t.status === "registration" && (
                      <Button
                        size="sm" variant="destructive"
                        onClick={() => { if (window.confirm(`Cancel "${t.name}"? This cannot be undone.`)) cancelMutation.mutate(t.id); }}
                        disabled={cancellingId === t.id}
                        data-testid={`button-cancel-gw-tournament-${t.id}`}
                      >
                        {cancellingId === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}Cancel
                      </Button>
                    )}
                    <a href={`/guild-wars/${t.id}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" data-testid={`link-gw-bracket-${t.id}`}>View</Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
