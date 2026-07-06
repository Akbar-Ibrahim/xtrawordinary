import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GameConfigProps } from "./types";

const LP_QUIZ_MIN_WORDS = 10;

export function LetterPositionConfig({ params, setParams, dialogType, open }: GameConfigProps) {
  const lpLetter = params.letter as string | undefined;
  const lpPosition = params.position as number | undefined;
  const { data: lpCountData, isFetching: lpCountFetching } = useQuery<{ count: number }>({
    queryKey: ["/api/games/letter-position/validate", lpLetter, lpPosition],
    queryFn: async () => {
      const res = await fetch(`/api/games/letter-position/validate?letter=${lpLetter}&position=${lpPosition}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!lpLetter && !!lpPosition && open,
    staleTime: Infinity,
  });

  const wordCountTestId = dialogType === "season" ? "text-season-lp-word-count" : "text-lp-word-count";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Letter</label>
        <Select
          value={params.letter ?? ""}
          onValueChange={(v) => setParams(p => ({ ...p, letter: v || undefined }))}
        >
          <SelectTrigger className="mt-1" data-testid={`select-${dialogType}-lp-letter`}>
            <SelectValue placeholder="Pick a letter (A–Z)" />
          </SelectTrigger>
          <SelectContent>
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Position (1 = first letter)</label>
        <div className="flex gap-1 mt-1 flex-wrap">
          {([1, 2, 3, 4, 5, 6, 7, 8] as const).map(p => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={params.position === p ? "default" : "outline"}
              onClick={() => setParams(prev => ({ ...prev, position: p }))}
              data-testid={`button-${dialogType}-lp-pos-${p}`}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>
      {lpLetter && lpPosition && (
        <p className={`text-xs ${lpCountFetching ? "text-muted-foreground" : (lpCountData?.count ?? LP_QUIZ_MIN_WORDS) < LP_QUIZ_MIN_WORDS ? "text-destructive" : "text-green-600 dark:text-green-400"}`} data-testid={wordCountTestId}>
          {lpCountFetching
            ? "Checking…"
            : lpCountData === undefined
              ? ""
              : lpCountData.count < LP_QUIZ_MIN_WORDS
                ? `Only ${lpCountData.count} word${lpCountData.count !== 1 ? "s" : ""} match — need at least ${LP_QUIZ_MIN_WORDS}. Try a different letter or position.`
                : `${lpCountData.count} words match`}
        </p>
      )}
      {!params.survival && (
        <>
          <div>
            <label className="text-sm font-medium">Words to find</label>
            <Input
              type="number" min={1} max={50} placeholder="20"
              className="mt-1 h-8 text-sm w-24"
              data-testid={`input-${dialogType}-lp-word-count`}
              value={params.wordCount ?? ""}
              onChange={(e) => setParams(p => ({ ...p, wordCount: e.target.value === "" ? undefined : Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Time limit</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {[60, 90, 120, 180, 300].map(t => (
                <Button key={t} type="button" size="sm"
                  variant={(params.timeLimit ?? 120) === t ? "default" : "outline"}
                  onClick={() => setParams(p => ({ ...p, timeLimit: t }))}
                  data-testid={`button-${dialogType}-lp-time-${t}`}
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

LetterPositionConfig.MIN_WORDS = LP_QUIZ_MIN_WORDS;
