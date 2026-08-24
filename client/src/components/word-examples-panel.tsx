import { Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWordExamples, type DatabaseWordExamplesRequest, type WordExamplesGame } from "@/hooks/use-word-examples";

interface WordExamplesPanelProps {
  game: WordExamplesGame;
  letters: string[];
  limit?: number;
  buttonLabel?: string;
  className?: string;
  position?: number;
  challenge?: number;
  databaseRequest?: DatabaseWordExamplesRequest;
}

export function WordExamplesPanel({
  game,
  letters,
  limit = 10,
  buttonLabel,
  className,
  position,
  challenge,
  databaseRequest,
}: WordExamplesPanelProps) {
  const {
    data,
    isLoading,
    isFetched,
    trigger,
    resolvedLetters,
    refetch,
    databaseAvailable,
    isDatabaseAvailabilityLoading,
  } = useWordExamples(game, letters, limit, position, challenge, databaseRequest);

  if (databaseRequest) {
    if (isDatabaseAvailabilityLoading || !databaseAvailable) return null;
  } else if (game === "no-repeats") {
    if (challenge === undefined) return null;
  } else {
    if (resolvedLetters.length === 0) return null;
  }

  const defaultLabel =
    game === "letter-dodge"
      ? "See words that avoid those letters"
      : "See words you could have used";

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground gap-1.5 px-2"
        onClick={isFetched ? () => refetch() : trigger}
        disabled={isLoading}
        data-testid="button-word-examples"
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isFetched ? (
          <RefreshCw className="h-3 w-3" />
        ) : (
          <Lightbulb className="h-3 w-3" />
        )}
        {isFetched ? "Refresh sample" : (buttonLabel ?? defaultLabel)}
      </Button>

      {isFetched && data && (
        <div className="space-y-1.5 pt-0.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{data.total.toLocaleString()}</span>{" "}
            matching word{data.total !== 1 ? "s" : ""} — sample:
          </p>
          <div className="flex flex-wrap gap-1">
            {data.words.map((w) => (
              <Badge
                key={w}
                variant="outline"
                className="font-mono text-xs px-1.5 py-0"
                data-testid={`badge-example-${w}`}
              >
                {w}
              </Badge>
            ))}
            {data.words.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No words found for these constraints.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
