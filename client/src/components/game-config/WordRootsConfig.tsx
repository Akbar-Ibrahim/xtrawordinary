import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import type { GameConfigProps } from "./types";

export function WordRootsConfig({ params, setParams, dialogType, open }: GameConfigProps) {
  const wrSeed: number | undefined = params.wrSeed;

  useEffect(() => {
    if (wrSeed === undefined) {
      setParams(p => ({ ...p, wrSeed: Math.floor(Math.random() * 1_000_000) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrSeed]);

  const { data: wrPreviewPuzzles, isFetching: wrPreviewFetching } = useQuery<Array<{ canonicalWord: string; derivatives: string[] }>>({
    queryKey: ["/api/games/word-roots/puzzles", wrSeed],
    queryFn: async () => {
      const r = await fetch(`/api/games/word-roots/puzzles?seed=${wrSeed}`, { credentials: "include" });
      return r.json();
    },
    enabled: open,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  const prefix = dialogType === "season" ? "season-" : "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Puzzle Set Preview</label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setParams(p => ({ ...p, wrSeed: Math.floor(Math.random() * 1_000_000) }))}
          disabled={wrPreviewFetching}
          className="gap-1.5 h-7 text-xs"
          data-testid={`button-${prefix}wr-reroll`}
        >
          {wrPreviewFetching
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <RefreshCw className="h-3 w-3" />}
          Re-roll
        </Button>
      </div>
      <div className="rounded-lg border bg-muted/10 p-3 space-y-2 min-h-[120px]">
        {wrPreviewFetching ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : wrPreviewPuzzles ? (
          wrPreviewPuzzles.map((p, i) => (
            <div key={i} className="flex flex-col gap-0.5" data-testid={`${prefix}wr-preview-${i}`}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                <span className="font-mono font-bold tracking-wider text-sm">{p.canonicalWord}</span>
              </div>
              <div className="flex flex-wrap gap-1 pl-6">
                {p.derivatives.map((d, j) => (
                  <span key={j} className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono text-muted-foreground">{d}</span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground text-center pt-6">Loading preview…</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Players see the derivative clues (badges), not the canonical word. Re-roll to get a different set of 5 puzzles.</p>
    </div>
  );
}
