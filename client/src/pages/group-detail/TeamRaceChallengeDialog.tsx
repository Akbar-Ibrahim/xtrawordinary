import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Group } from "@shared/schema";
import { TEAM_RACE_GAME_SLUGS_LIST, TEAM_RACE_GAME_NAMES } from "./constants";

export function TeamRaceChallengeDialog({
  open,
  onOpenChange,
  groupId,
  publicGroups,
  trGroupSearch,
  setTrGroupSearch,
  trTargetGroupId,
  setTrTargetGroupId,
  trGameSlug,
  setTrGameSlug,
  trRaceTarget,
  setTrRaceTarget,
  trRaceTimeLimit,
  setTrRaceTimeLimit,
  createTeamRaceMutation,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: number;
  publicGroups: Group[] | undefined;
  trGroupSearch: string;
  setTrGroupSearch: (v: string) => void;
  trTargetGroupId: number | null;
  setTrTargetGroupId: (v: number | null) => void;
  trGameSlug: string;
  setTrGameSlug: (v: string) => void;
  trRaceTarget: number;
  setTrRaceTarget: (v: number) => void;
  trRaceTimeLimit: number;
  setTrRaceTimeLimit: (v: number) => void;
  createTeamRaceMutation: UseMutationResult<any, any, void>;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Race Challenge
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            All members of both groups play simultaneously. Words are pooled per team — the team that finds the most unique valid words wins!
          </p>

          <div className="space-y-1">
            <label className="text-sm font-medium">Opponent Group</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search public groups..."
                value={trGroupSearch}
                onChange={e => setTrGroupSearch(e.target.value)}
                className="pl-8"
                data-testid="input-tr-search"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border mt-1">
              {(() => {
                const filtered = (publicGroups || [])
                  .filter(g => g.id !== groupId && g.name.toLowerCase().includes(trGroupSearch.toLowerCase()));
                if (!filtered.length) return <p className="text-sm text-muted-foreground text-center py-4">No public groups found</p>;
                return filtered.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { setTrTargetGroupId(g.id); setTrGroupSearch(g.name); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left ${trTargetGroupId === g.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                    data-testid={`tr-group-option-${g.id}`}
                  >
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{g.name}</span>
                    {trTargetGroupId === g.id && <span className="ml-auto text-xs">✓</span>}
                  </button>
                ));
              })()}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Game</label>
            <Select value={trGameSlug} onValueChange={setTrGameSlug}>
              <SelectTrigger data-testid="select-tr-game">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_RACE_GAME_SLUGS_LIST.map(slug => (
                  <SelectItem key={slug} value={slug}>{TEAM_RACE_GAME_NAMES[slug] || slug}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Target words (team that reaches this first wins)</label>
              <div className="flex gap-1 flex-wrap">
                {[10, 15, 20, 25, 30].map(n => (
                  <Button key={n} type="button" size="sm"
                    variant={trRaceTarget === n ? "default" : "outline"}
                    onClick={() => setTrRaceTarget(n)}
                    data-testid={`button-tr-target-${n}`}
                  >{n}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Time limit</label>
              <div className="flex gap-1 flex-wrap">
                {[{ v: 180, l: "3 min" }, { v: 300, l: "5 min" }, { v: 480, l: "8 min" }, { v: 600, l: "10 min" }].map(({ v, l }) => (
                  <Button key={v} type="button" size="sm"
                    variant={trRaceTimeLimit === v ? "default" : "outline"}
                    onClick={() => setTrRaceTimeLimit(v)}
                    data-testid={`button-tr-timelimit-${v}`}
                  >{l}</Button>
                ))}
              </div>
            </div>
          </div>

          {!trTargetGroupId && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Select an opponent group to continue.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => createTeamRaceMutation.mutate()}
            disabled={!trTargetGroupId || createTeamRaceMutation.isPending}
            data-testid="button-tr-send"
          >
            {createTeamRaceMutation.isPending ? "Sending..." : "Send Challenge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
