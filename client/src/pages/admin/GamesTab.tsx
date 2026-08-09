import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import type { Game } from "@shared/schema";

function ConfigRow({ game }: { game: Game }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [timeLimit, setTimeLimit] = useState(game.timeLimitSeconds?.toString() ?? "");
  const [wordTarget, setWordTarget] = useState(game.wordTarget?.toString() ?? "");
  const [livesCount, setLivesCount] = useState(game.livesCount?.toString() ?? "");
  const [survivalSecs, setSurvivalSecs] = useState(game.survivalSecondsPerWord?.toString() ?? "");

  const configMutation = useMutation({
    mutationFn: (body: Record<string, number | null>) =>
      apiRequest("PATCH", `/api/admin/games/${game.slug}/config`, body),
    onSuccess: () => {
      toast({ title: "Config saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
    onError: () => toast({ title: "Failed to save config", variant: "destructive" }),
  });

  const parseVal = (s: string): number | null => {
    const n = parseInt(s, 10);
    return s.trim() === "" || isNaN(n) || n <= 0 ? null : n;
  };

  const handleSave = () => {
    configMutation.mutate({
      timeLimitSeconds: parseVal(timeLimit),
      wordTarget: parseVal(wordTarget),
      livesCount: parseVal(livesCount),
      survivalSecondsPerWord: parseVal(survivalSecs),
    });
  };

  return (
    <>
      <tr className="border-b hover:bg-muted/50" data-testid={`config-row-${game.slug}`}>
        <td colSpan={5} className="py-0">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-config-toggle-${game.slug}`}
          >
            <Settings className="h-3 w-3" />
            Config
            {game.timeLimitSeconds && <Badge variant="outline" className="text-xs py-0 h-4">{game.timeLimitSeconds}s</Badge>}
            {game.wordTarget && <Badge variant="outline" className="text-xs py-0 h-4">{game.wordTarget} words</Badge>}
            {game.livesCount && <Badge variant="outline" className="text-xs py-0 h-4">{game.livesCount} lives</Badge>}
            {open ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-muted/20" data-testid={`config-panel-${game.slug}`}>
          <td colSpan={5} className="px-3 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Time limit (s)</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 120"
                  value={timeLimit}
                  onChange={e => setTimeLimit(e.target.value)}
                  className="h-8 text-sm"
                  data-testid={`input-config-time-${game.slug}`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Word target</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 15"
                  value={wordTarget}
                  onChange={e => setWordTarget(e.target.value)}
                  className="h-8 text-sm"
                  data-testid={`input-config-words-${game.slug}`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Lives</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 3"
                  value={livesCount}
                  onChange={e => setLivesCount(e.target.value)}
                  className="h-8 text-sm"
                  data-testid={`input-config-lives-${game.slug}`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Survival sec/word</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 8"
                  value={survivalSecs}
                  onChange={e => setSurvivalSecs(e.target.value)}
                  className="h-8 text-sm"
                  data-testid={`input-config-survival-${game.slug}`}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={configMutation.isPending}
                className="h-7 text-xs"
                data-testid={`button-config-save-${game.slug}`}
              >
                {configMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save
              </Button>
              <p className="text-xs text-muted-foreground">Leave blank to clear (no limit)</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function GamesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: games, isLoading } = useQuery<Game[]>({ queryKey: ["/api/admin/games"] });

  const toggleMutation = useMutation({
    mutationFn: ({ slug, isActive }: { slug: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/games/${slug}/active`, { isActive }),
    onMutate: async ({ slug, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/games"] });
      const previous = queryClient.getQueryData<Game[]>(["/api/admin/games"]);
      queryClient.setQueryData<Game[]>(["/api/admin/games"], (old) =>
        old?.map((g) => g.slug === slug ? { ...g, isActive } : g) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["/api/admin/games"], context.previous);
      toast({ title: "Failed to update game", variant: "destructive" });
    },
    onSuccess: () => toast({ title: "Game updated" }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!games?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground" data-testid="text-no-games">No games found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>All Games ({games.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Name</th>
                <th className="text-left py-3 px-2">Slug</th>
                <th className="text-left py-3 px-2">Difficulty</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-right py-3 px-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <>
                  <tr key={g.slug} className="border-b hover:bg-muted/50" data-testid={`game-row-${g.slug}`}>
                    <td className="py-3 px-2 font-medium">
                      <Link
                        href={`/games/${g.slug}`}
                        className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                        data-testid={`link-game-${g.slug}`}
                      >
                        {g.name}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </Link>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{g.slug}</td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className="capitalize text-xs">{g.difficulty}</Badge>
                    </td>
                    <td className="py-3 px-2">
                      {g.isActive !== false ? (
                        <Badge variant="default" className="text-xs bg-green-500/20 text-green-700 border-green-500/40 dark:text-green-300">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Switch
                        checked={g.isActive !== false}
                        onCheckedChange={(checked) => toggleMutation.mutate({ slug: g.slug, isActive: checked })}
                        disabled={toggleMutation.isPending}
                        data-testid={`toggle-game-${g.slug}`}
                      />
                    </td>
                  </tr>
                  <ConfigRow key={`${g.slug}-config`} game={g} />
                </>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
