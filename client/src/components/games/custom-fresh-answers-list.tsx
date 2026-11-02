import { useMemo, useState } from "react";

interface CustomFreshAnswersListProps {
  game: string;
  words: readonly string[];
  isCustomPlay?: boolean;
}

/** Read-only: opting out remains the only way to delete saved answers. */
export function CustomFreshAnswersList({
  game,
  words,
  isCustomPlay = true,
}: CustomFreshAnswersListProps) {
  const sortedWords = useMemo(() => [...words].sort(), [words]);
  const [isExpanded, setIsExpanded] = useState(false);

  if (sortedWords.length === 0) return null;

  return (
    <details className="mt-2 text-xs" onToggle={(event) => setIsExpanded(event.currentTarget.open)}>
      <summary
        role="button"
        aria-expanded={isExpanded}
        className="w-fit cursor-pointer rounded-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        View {sortedWords.length} saved answer{sortedWords.length === 1 ? "" : "s"}
      </summary>
      <p className="my-2 text-muted-foreground">
        Saved for {isCustomPlay ? "Custom " : ""}{game} in this browser only. Turning Fresh Answers off deletes this game’s saved list.
      </p>
      <ul
        aria-label={`Saved Fresh Answers for ${isCustomPlay ? "Custom " : ""}${game}`}
        tabIndex={0}
        className="max-h-40 overflow-y-auto rounded-md border bg-background p-2 flex flex-wrap gap-x-3 gap-y-1 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {sortedWords.map((word) => <li key={word}>{word}</li>)}
      </ul>
    </details>
  );
}
