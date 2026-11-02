import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, Plus, X } from "lucide-react";
import type { Game } from "@shared/schema";
import { DEFAULT_SIMILAR_GAME_SLUGS } from "@shared/similar-games";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SimilarGamesEditorProps {
  game: Game;
  games: Game[];
}

function getInitialSlugs(game: Game): string[] {
  return [...(game.similarGameSlugs ?? DEFAULT_SIMILAR_GAME_SLUGS[game.slug] ?? [])];
}

export function SimilarGamesEditor({ game, games }: SimilarGamesEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSlugs, setSelectedSlugs] = useState(() => getInitialSlugs(game));
  const [candidateSlug, setCandidateSlug] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSelectedSlugs(getInitialSlugs(game));
  }, [game.slug, game.similarGameSlugs]);

  const gameBySlug = useMemo(
    () => new Map(games.map((candidate) => [candidate.slug, candidate])),
    [games],
  );
  const availableGames = useMemo(
    () => games
      .filter((candidate) => candidate.slug !== game.slug && !selectedSlugs.includes(candidate.slug))
      .sort((left, right) => left.name.localeCompare(right.name)),
    [game.slug, games, selectedSlugs],
  );

  const saveMutation = useMutation({
    mutationFn: (similarGameSlugs: string[]) =>
      apiRequest("PATCH", `/api/admin/games/${game.slug}/similar-games`, { similarGameSlugs }),
    onSuccess: () => {
      toast({ title: "Similar Games saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
    onError: () => toast({ title: "Failed to save Similar Games", variant: "destructive" }),
  });

  const addCandidate = () => {
    if (!candidateSlug || selectedSlugs.includes(candidateSlug)) return;
    setSelectedSlugs((current) => [...current, candidateSlug]);
    setCandidateSlug("");
  };

  const moveGame = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedSlugs.length) return;
    setSelectedSlugs((current) => {
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
  };

  const removeGame = (slug: string) => {
    setSelectedSlugs((current) => current.filter((selectedSlug) => selectedSlug !== slug));
  };

  return (
    <>
      <tr className="border-b bg-muted/20" data-testid={`similar-games-row-${game.slug}`}>
        <td colSpan={5} className="py-0">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={`similar-games-panel-${game.slug}`}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-similar-games-toggle-${game.slug}`}
          >
            Similar Games
            <span className="text-[11px]">{selectedSlugs.length} selected</span>
            {open
              ? <ChevronUp className="ml-auto h-3 w-3" />
              : <ChevronDown className="ml-auto h-3 w-3" />}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b bg-muted/20">
          <td colSpan={5} className="px-3 py-3">
            <div className="space-y-3" id={`similar-games-panel-${game.slug}`}>
              <p className="text-xs text-muted-foreground">
                Add, remove, or reorder recommendations. Clearing the list shows the generic More Games section.
              </p>

              {selectedSlugs.length > 0 ? (
                <ol className="space-y-1.5">
                  {selectedSlugs.map((slug, index) => (
                    <li
                      key={`${slug}-${index}`}
                      className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                      data-testid={`similar-game-item-${game.slug}-${slug}`}
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {gameBySlug.get(slug)?.name ?? slug}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Move ${gameBySlug.get(slug)?.name ?? slug} up`}
                        onClick={() => moveGame(index, -1)}
                        disabled={index === 0 || saveMutation.isPending}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Move ${gameBySlug.get(slug)?.name ?? slug} down`}
                        onClick={() => moveGame(index, 1)}
                        disabled={index === selectedSlugs.length - 1 || saveMutation.isPending}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={`Remove ${gameBySlug.get(slug)?.name ?? slug} from Similar Games`}
                        onClick={() => removeGame(slug)}
                        disabled={saveMutation.isPending}
                        data-testid={`button-remove-similar-game-${game.slug}-${slug}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid={`text-empty-similar-games-${game.slug}`}>
                  No similar games selected.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={candidateSlug}
                  onChange={(event) => setCandidateSlug(event.target.value)}
                  className="h-9 min-w-48 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label={`Choose a similar game for ${game.name}`}
                  disabled={availableGames.length === 0 || saveMutation.isPending}
                  data-testid={`select-add-similar-game-${game.slug}`}
                >
                  <option value="">Choose a game to add</option>
                  {availableGames.map((candidate) => (
                    <option key={candidate.slug} value={candidate.slug}>{candidate.name}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCandidate}
                  disabled={!candidateSlug || saveMutation.isPending}
                  data-testid={`button-add-similar-game-${game.slug}`}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveMutation.mutate(selectedSlugs)}
                  disabled={saveMutation.isPending}
                  data-testid={`button-save-similar-games-${game.slug}`}
                >
                  {saveMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  Save recommendations
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
