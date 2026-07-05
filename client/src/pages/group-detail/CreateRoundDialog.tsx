import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UseMutationResult } from "@tanstack/react-query";
import { GAME_SLUGS, GAME_NAMES } from "./constants";

export function CreateRoundDialog({
  open,
  onOpenChange,
  selectedSlug,
  setSelectedSlug,
  closesAt,
  setClosesAt,
  roundLetterCount,
  setRoundLetterCount,
  roundLetters,
  setRoundLetters,
  roundFreqEnabled,
  setRoundFreqEnabled,
  roundLbMode,
  setRoundLbMode,
  roundLbLevel,
  setRoundLbLevel,
  roundLbConsonantCount,
  setRoundLbConsonantCount,
  createRoundMutation,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedSlug: string;
  setSelectedSlug: (v: string) => void;
  closesAt: string;
  setClosesAt: (v: string) => void;
  roundLetterCount: 2 | 3 | 4;
  setRoundLetterCount: (v: 2 | 3 | 4 | ((prev: 2 | 3 | 4) => 2 | 3 | 4)) => void;
  roundLetters: string[];
  setRoundLetters: (v: string[] | ((prev: string[]) => string[])) => void;
  roundFreqEnabled: boolean;
  setRoundFreqEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  roundLbMode: "random" | "locked";
  setRoundLbMode: (v: "random" | "locked") => void;
  roundLbLevel: number | undefined;
  setRoundLbLevel: (v: number | undefined) => void;
  roundLbConsonantCount: number | undefined;
  setRoundLbConsonantCount: (v: number | undefined) => void;
  createRoundMutation: UseMutationResult<any, any, void>;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start New Round</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Game</label>
            <Select value={selectedSlug} onValueChange={(v) => {
              setSelectedSlug(v);
              setRoundLetterCount(2);
              setRoundLetters(["any", "any"]);
            }}>
              <SelectTrigger data-testid="select-game-slug">
                <SelectValue placeholder="Pick a game" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Random Game</SelectItem>
                {GAME_SLUGS.map(slug => (
                  <SelectItem key={slug} value={slug}>{GAME_NAMES[slug] || slug}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedSlug === "letter-balance" && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="text-sm font-medium">Challenge type</label>
              <div className="flex gap-2">
                <Button type="button" size="sm"
                  variant={roundLbMode === "random" ? "default" : "outline"}
                  onClick={() => { setRoundLbMode("random"); setRoundLbLevel(undefined); setRoundLbConsonantCount(undefined); }}
                  data-testid="button-round-lb-random"
                >
                  Random
                </Button>
                <Button type="button" size="sm"
                  variant={roundLbMode === "locked" ? "default" : "outline"}
                  onClick={() => setRoundLbMode("locked")}
                  data-testid="button-round-lb-locked"
                >
                  Locked Balance
                </Button>
              </div>
              {roundLbMode === "locked" && (
                <>
                  <div>
                    <label className="text-xs font-medium">Word length</label>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {[4,5,6,7,8,9,10].map(lv => (
                        <Button key={lv} type="button" size="sm"
                          variant={roundLbLevel === lv ? "default" : "outline"}
                          onClick={() => { setRoundLbLevel(lv); setRoundLbConsonantCount(undefined); }}
                          data-testid={`button-round-lb-level-${lv}`}
                        >
                          {lv}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {roundLbLevel !== undefined && (
                    <div>
                      <label className="text-xs font-medium">Consonant count <span className="text-muted-foreground font-normal">(vowels = {roundLbLevel} − count)</span></label>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Array.from({ length: roundLbLevel - 1 }, (_, i) => i + 1).map(c => {
                          const v = roundLbLevel - c;
                          return (
                            <Button key={c} type="button" size="sm"
                              variant={roundLbConsonantCount === c ? "default" : "outline"}
                              onClick={() => setRoundLbConsonantCount(c)}
                              data-testid={`button-round-lb-consonant-${c}`}
                              title={`${c}C / ${v}V`}
                            >
                              {c}C/{v}V
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {(!roundLbLevel || !roundLbConsonantCount) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {!roundLbLevel ? "Pick a word length." : "Pick a consonant count."}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {selectedSlug === "letter-frequency" && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Multi-Letter Mode <span className="text-muted-foreground font-normal">(pin letters)</span></label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={roundFreqEnabled}
                  onClick={() => setRoundFreqEnabled(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${roundFreqEnabled ? "bg-primary" : "bg-input"}`}
                  data-testid="toggle-round-freq-enabled"
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${roundFreqEnabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
              {roundFreqEnabled && (
                <>
                  <div className="flex gap-1">
                    {([2, 3, 4] as const).map(n => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={roundLetterCount === n ? "default" : "outline"}
                        onClick={() => {
                          setRoundLetterCount(n);
                          setRoundLetters(prev => {
                            const next = n > prev.length
                              ? [...prev, ...Array(n - prev.length).fill("any")]
                              : prev.slice(0, n);
                            return next;
                          });
                        }}
                        data-testid={`button-round-freq-multi-count-${n}`}
                      >
                        {n} letters
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: roundLetterCount }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className="text-xs text-muted-foreground font-medium">Letter {i + 1}</span>
                        <Select
                          value={roundLetters[i] || "any"}
                          onValueChange={(v) => setRoundLetters(prev => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          })}
                        >
                          <SelectTrigger className="w-16 h-8 text-sm" data-testid={`select-round-freq-multi-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {"ABCDEFGHILMNOPRSTUWY".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Each slot can be "Any" or a specific letter. All members will play with the same pinned letters.</p>
                </>
              )}
              {!roundFreqEnabled && (
                <p className="text-xs text-muted-foreground">Enable to pin specific letters for all members. Off = each member gets a seeded random challenge.</p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">Closing Time <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={e => setClosesAt(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              data-testid="input-closes-at"
            />
            <p className="text-xs text-muted-foreground">Leave blank to keep the round open indefinitely.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => createRoundMutation.mutate()} disabled={createRoundMutation.isPending || (selectedSlug === "letter-balance" && roundLbMode === "locked" && (!roundLbLevel || !roundLbConsonantCount))} data-testid="button-create-round-submit">
            {createRoundMutation.isPending ? "Creating..." : "Start Round"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
