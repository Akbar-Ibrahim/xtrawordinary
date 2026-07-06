import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { GameConfigProps } from "./types";

const WL_MIN_WORDS = 10;

export function WordLengthConfig({ params, setParams, dialogType, open }: GameConfigProps) {
  const wlLength = params.length as number | undefined;
  const wlStartsWith = params.startsWith as string | undefined;
  const wlEndsWith = params.endsWith as string | undefined;
  const wlContains = params.contains as string | undefined;
  const wlQs = new URLSearchParams({
    ...(wlLength ? { length: String(wlLength) } : {}),
    ...(wlStartsWith ? { startsWith: wlStartsWith } : {}),
    ...(wlEndsWith ? { endsWith: wlEndsWith } : {}),
    ...(wlContains ? { contains: wlContains } : {}),
  });
  const { data: wlCountData, isFetching: wlCountFetching } = useQuery<{ count: number; ok: boolean }>({
    queryKey: ["/api/games/word-length/validate", wlLength, wlStartsWith, wlEndsWith, wlContains],
    queryFn: async () => {
      const res = await fetch(`/api/games/word-length/validate?${wlQs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!wlLength && open,
    staleTime: Infinity,
  });

  const wordCountTextTestId = dialogType === "season" ? "text-season-wl-word-count" : "text-wl-quiz-word-count";
  const wordCountErrorTestId = dialogType === "season" ? "text-season-wl-word-count-error" : "text-wl-word-count-error";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Exact Word Length (3–12)</label>
        <div className="flex gap-1 mt-1 flex-wrap">
          {Array.from({ length: 10 }, (_, i) => i + 3).map(n => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={params.length === n ? "default" : "outline"}
              onClick={() => setParams(p => ({ ...p, length: n }))}
              data-testid={`button-${dialogType}-wl-length-${n}`}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>
      {params.length && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium">Starts with</label>
              <Select
                value={params.startsWith ?? "any"}
                onValueChange={(v) => setParams(p => ({ ...p, startsWith: v === "any" ? undefined : v }))}
              >
                <SelectTrigger className="mt-1 h-8 text-sm" data-testid={`select-${dialogType}-wl-starts`}><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Ends with</label>
              <Select
                value={params.endsWith ?? "any"}
                onValueChange={(v) => setParams(p => ({ ...p, endsWith: v === "any" ? undefined : v }))}
              >
                <SelectTrigger className="mt-1 h-8 text-sm" data-testid={`select-${dialogType}-wl-ends`}><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Contains</label>
              <Select
                value={params.contains ?? "any"}
                onValueChange={(v) => setParams(p => ({ ...p, contains: v === "any" ? undefined : v }))}
              >
                <SelectTrigger className="mt-1 h-8 text-sm" data-testid={`select-${dialogType}-wl-contains`}><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className={`text-xs ${wlCountFetching ? "text-muted-foreground" : !wlCountData ? "" : !wlCountData.ok ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid={wordCountTextTestId}>
            {wlCountFetching ? "Checking…" : !wlCountData ? "" : !wlCountData.ok ? `Only ${wlCountData.count} matching words — need at least ${WL_MIN_WORDS}. Adjust filters.` : `${wlCountData.count} words match ✓`}
          </p>
        </>
      )}
      {!params.survival && (
        <>
          <div>
            <label className="text-xs font-medium">Words to find (Classic)</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={1}
                max={wlCountData?.count ?? undefined}
                value={params.wordCount ?? 20}
                onChange={(e) => {
                  const v = Math.max(1, parseInt(e.target.value) || 1);
                  setParams(p => ({ ...p, wordCount: v }));
                }}
                className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm"
                data-testid={`input-${dialogType}-wl-word-count`}
              />
              {wlCountData?.ok && (params.wordCount ?? 20) > wlCountData.count && (
                <p className="text-xs text-destructive" data-testid={wordCountErrorTestId}>
                  Max {wlCountData.count} for this filter
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Time limit (Classic)</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {[60, 90, 120, 180, 300].map(t => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={(params.timeLimit ?? 120) === t ? "default" : "outline"}
                  onClick={() => setParams(p => ({ ...p, timeLimit: t }))}
                  data-testid={`button-${dialogType}-wl-time-${t}`}
                >
                  {t < 60 ? `${t}s` : `${t / 60}min`}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
