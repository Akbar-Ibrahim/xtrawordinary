import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, Zap } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { Group } from "@shared/schema";
import { DUEL_GAME_SLUGS_LIST, DUEL_GAME_NAMES, DUEL_TURN_SLUGS, DUEL_RACE_SLUGS } from "./constants";

export function HuddleChallengeDialog({
  open,
  onOpenChange,
  groupId,
  publicGroups,
  huddleGroupSearch,
  setHuddleGroupSearch,
  huddleTargetGroupId,
  setHuddleTargetGroupId,
  huddleGameSlug,
  setHuddleGameSlug,
  huddleFormat,
  setHuddleFormat,
  huddleRaceTarget,
  setHuddleRaceTarget,
  huddleRaceTimeLimit,
  setHuddleRaceTimeLimit,
  createHuddleMutation,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: number;
  publicGroups: Group[] | undefined;
  huddleGroupSearch: string;
  setHuddleGroupSearch: (v: string) => void;
  huddleTargetGroupId: number | null;
  setHuddleTargetGroupId: (v: number | null) => void;
  huddleGameSlug: string;
  setHuddleGameSlug: (v: string) => void;
  huddleFormat: "turn" | "race";
  setHuddleFormat: (v: "turn" | "race") => void;
  huddleRaceTarget: number;
  setHuddleRaceTarget: (v: number) => void;
  huddleRaceTimeLimit: number;
  setHuddleRaceTimeLimit: (v: number) => void;
  createHuddleMutation: UseMutationResult<any, any, void>;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Challenge Another Group
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Send a group battle challenge. One admin from each group plays as the typist while the rest cheer them on.</p>

          <div className="space-y-1">
            <label className="text-sm font-medium">Opponent Group</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search groups..."
                value={huddleGroupSearch}
                onChange={e => setHuddleGroupSearch(e.target.value)}
                className="pl-8"
                data-testid="input-huddle-search"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border mt-1">
              {(() => {
                const filtered = (publicGroups || [])
                  .filter(g => g.id !== groupId && g.name.toLowerCase().includes(huddleGroupSearch.toLowerCase()));
                if (!filtered.length) return <p className="text-sm text-muted-foreground text-center py-4">No groups found</p>;
                return filtered.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { setHuddleTargetGroupId(g.id); setHuddleGroupSearch(g.name); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left ${huddleTargetGroupId === g.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                    data-testid={`huddle-group-option-${g.id}`}
                  >
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{g.name}</span>
                    {huddleTargetGroupId === g.id && <span className="ml-auto text-xs">✓</span>}
                  </button>
                ));
              })()}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Game</label>
            <Select value={huddleGameSlug} onValueChange={v => {
              setHuddleGameSlug(v);
              if (huddleFormat === "turn" && !DUEL_TURN_SLUGS.has(v)) setHuddleFormat("race");
              if (huddleFormat === "race" && !DUEL_RACE_SLUGS.has(v)) setHuddleFormat("turn");
            }}>
              <SelectTrigger data-testid="select-huddle-game">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DUEL_GAME_SLUGS_LIST.map(slug => (
                  <SelectItem key={slug} value={slug}>{DUEL_GAME_NAMES[slug] || slug}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Format</label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={huddleFormat === "turn" ? "default" : "outline"}
                onClick={() => setHuddleFormat("turn")}
                disabled={!DUEL_TURN_SLUGS.has(huddleGameSlug)}
                data-testid="button-huddle-format-turn"
              >
                Turn-Based
              </Button>
              <Button
                type="button"
                size="sm"
                variant={huddleFormat === "race" ? "default" : "outline"}
                onClick={() => setHuddleFormat("race")}
                disabled={!DUEL_RACE_SLUGS.has(huddleGameSlug)}
                data-testid="button-huddle-format-race"
              >
                Race
              </Button>
            </div>
          </div>

          {huddleFormat === "race" && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Target words (first to reach wins)</label>
                <div className="flex gap-1 flex-wrap">
                  {[5, 10, 15, 20, 25].map(n => (
                    <Button key={n} type="button" size="sm"
                      variant={huddleRaceTarget === n ? "default" : "outline"}
                      onClick={() => setHuddleRaceTarget(n)}
                      data-testid={`button-huddle-target-${n}`}
                    >{n}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Time limit</label>
                <div className="flex gap-1 flex-wrap">
                  {[{ v: 180, l: "3 min" }, { v: 300, l: "5 min" }, { v: 600, l: "10 min" }].map(({ v, l }) => (
                    <Button key={v} type="button" size="sm"
                      variant={huddleRaceTimeLimit === v ? "default" : "outline"}
                      onClick={() => setHuddleRaceTimeLimit(v)}
                      data-testid={`button-huddle-timelimit-${v}`}
                    >{l}</Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!huddleTargetGroupId && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Select an opponent group to continue.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => createHuddleMutation.mutate()}
            disabled={!huddleTargetGroupId || createHuddleMutation.isPending}
            data-testid="button-huddle-send"
          >
            {createHuddleMutation.isPending ? "Sending..." : "Send Challenge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
