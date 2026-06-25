import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Swords, X, Pencil, Check } from "lucide-react";

type Tournament = {
  id: number; name: string; status: string; registrationDeadline: string;
  roundDeadlineHours: number; minPlayers: number; maxPlayers: number | null; createdAt: string;
};

const statusColor = (s: string) =>
  ({
    registration: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    active: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    completed: "bg-primary/15 text-primary",
    cancelled: "bg-muted text-muted-foreground",
  }[s] ?? "bg-muted text-muted-foreground");

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WordWarsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [roundHours, setRoundHours] = useState("24");
  const [minPlayers, setMinPlayers] = useState("2");
  const [maxPlayers, setMaxPlayers] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editRoundHours, setEditRoundHours] = useState("24");
  const [editMinPlayers, setEditMinPlayers] = useState("2");
  const [editMaxPlayers, setEditMaxPlayers] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({ queryKey: ["/api/word-wars"] });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/word-wars", {
      name: name.trim(),
      registrationDeadline: new Date(deadline).toISOString(),
      roundDeadlineHours: parseInt(roundHours),
      minPlayers: parseInt(minPlayers) || 2,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : null,
    }),
    onSuccess: () => {
      toast({ title: "Tournament created!" });
      queryClient.invalidateQueries({ queryKey: ["/api/word-wars"] });
      setName(""); setDeadline(""); setRoundHours("24"); setMinPlayers("2"); setMaxPlayers("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const drawMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/word-wars/${id}/draw`),
    onSuccess: () => { toast({ title: "Bracket drawn!" }); queryClient.invalidateQueries({ queryKey: ["/api/word-wars"] }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/word-wars/${id}`, {
      name: editName.trim(),
      registrationDeadline: new Date(editDeadline).toISOString(),
      roundDeadlineHours: parseInt(editRoundHours),
      minPlayers: parseInt(editMinPlayers) || 2,
      maxPlayers: editMaxPlayers ? parseInt(editMaxPlayers) : null,
    }),
    onSuccess: () => { toast({ title: "Tournament updated!" }); queryClient.invalidateQueries({ queryKey: ["/api/word-wars"] }); setEditingId(null); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => { setCancellingId(id); return apiRequest("POST", `/api/word-wars/${id}/cancel`); },
    onSuccess: () => { toast({ title: "Tournament cancelled." }); queryClient.invalidateQueries({ queryKey: ["/api/word-wars"] }); setCancellingId(null); },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); setCancellingId(null); },
  });

  function startEdit(t: Tournament) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditDeadline(toLocalDatetime(t.registrationDeadline));
    setEditRoundHours(String(t.roundDeadlineHours));
    setEditMinPlayers(String(t.minPlayers ?? 2));
    setEditMaxPlayers(t.maxPlayers ? String(t.maxPlayers) : "");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" />Create Tournament</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ww-name">Tournament Name</Label>
              <Input id="ww-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Word Wars Season 1" data-testid="input-ww-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ww-deadline">Registration Deadline</Label>
              <Input id="ww-deadline" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} data-testid="input-ww-deadline" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ww-round-hours">Hours per Round</Label>
              <Input id="ww-round-hours" type="number" min="1" value={roundHours} onChange={e => setRoundHours(e.target.value)} data-testid="input-ww-round-hours" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ww-min">Min Players to Run</Label>
              <Input id="ww-min" type="number" min="2" value={minPlayers} onChange={e => setMinPlayers(e.target.value)} placeholder="2" data-testid="input-ww-min-players" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ww-max">Max Players (optional)</Label>
              <Input id="ww-max" type="number" min="2" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} placeholder="Unlimited" data-testid="input-ww-max-players" />
            </div>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || !deadline || createMutation.isPending} data-testid="button-create-ww-tournament">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Create Tournament
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Swords className="h-4 w-4" />All Tournaments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : tournaments.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No tournaments yet.</p>
          ) : (
            <div className="space-y-3" data-testid="list-admin-tournaments">
              {tournaments.map(t => (
                <div key={t.id} className="border rounded-lg px-4 py-3 space-y-3" data-testid={`row-ww-tournament-${t.id}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${statusColor(t.status)}`}>{t.status}</Badge>
                        <span className="font-medium truncate" data-testid={`text-ww-name-${t.id}`}>{t.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Deadline: {new Date(t.registrationDeadline).toLocaleString()} · {t.roundDeadlineHours}h/round
                        {` · min ${t.minPlayers ?? 2}`}{t.maxPlayers ? ` · max ${t.maxPlayers}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.status === "registration" && editingId !== t.id && (
                        <Button size="sm" variant="outline" onClick={() => startEdit(t)} data-testid={`button-edit-ww-tournament-${t.id}`}>
                          <Pencil className="h-3 w-3 mr-1" />Edit
                        </Button>
                      )}
                      {t.status === "registration" && editingId !== t.id && (
                        <Button size="sm" variant="outline" onClick={() => drawMutation.mutate(t.id)} disabled={drawMutation.isPending} data-testid={`button-draw-bracket-${t.id}`}>
                          {drawMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Draw Bracket
                        </Button>
                      )}
                      {t.status === "registration" && editingId !== t.id && (
                        <Button
                          size="sm" variant="destructive"
                          onClick={() => { if (window.confirm(`Cancel "${t.name}"? This cannot be undone.`)) cancelMutation.mutate(t.id); }}
                          disabled={cancellingId === t.id}
                          data-testid={`button-cancel-ww-tournament-${t.id}`}
                        >
                          {cancellingId === t.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}Cancel
                        </Button>
                      )}
                      {editingId !== t.id && (
                        <a href={`/word-wars/${t.id}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" data-testid={`link-ww-bracket-${t.id}`}>View</Button>
                        </a>
                      )}
                      {editingId === t.id && (
                        <>
                          <Button size="sm" onClick={() => updateMutation.mutate(t.id)} disabled={!editName.trim() || !editDeadline || updateMutation.isPending} data-testid={`button-save-ww-tournament-${t.id}`}>
                            {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-ww-${t.id}`}>
                            <X className="h-3 w-3 mr-1" />Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === t.id && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 border-t" data-testid={`form-edit-ww-${t.id}`}>
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid={`input-edit-ww-name-${t.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Registration Deadline</Label>
                        <Input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} data-testid={`input-edit-ww-deadline-${t.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hours per Round</Label>
                        <Input type="number" min="1" value={editRoundHours} onChange={e => setEditRoundHours(e.target.value)} data-testid={`input-edit-ww-round-hours-${t.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Players</Label>
                        <Input type="number" min="2" value={editMinPlayers} onChange={e => setEditMinPlayers(e.target.value)} data-testid={`input-edit-ww-min-players-${t.id}`} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Players (optional)</Label>
                        <Input type="number" min="2" value={editMaxPlayers} onChange={e => setEditMaxPlayers(e.target.value)} placeholder="Unlimited" data-testid={`input-edit-ww-max-players-${t.id}`} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
