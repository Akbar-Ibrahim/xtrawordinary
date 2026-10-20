import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ManualCopyDialog } from "@/components/manual-copy-dialog";
import { useResultSharing } from "@/hooks/use-result-sharing";
import type { LetterDodgeSearchResponse, LetterDodgeWord } from "../types";
import { searchLetterDodge } from "../api";

interface Props {
  letters: string;
  items: LetterDodgeWord[];
  hasMore: boolean;
  nextCursor: string | null;
  source: LetterDodgeSearchResponse["source"];
}

function alphabeticalWords(items: LetterDodgeWord[]) {
  return [...new Set(items.map(({ word }) => word.toUpperCase()))]
    .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
}

function formatAnswerList({
  letters,
  items,
  isComplete,
  source,
}: {
  letters: string;
  items: LetterDodgeWord[];
  isComplete: boolean;
  source: LetterDodgeSearchResponse["source"];
}) {
  const words = alphabeticalWords(items);
  const completeness = isComplete
    ? `Full matching list from the current dictionary source (${words.length} answers).`
    : `Loaded results only (${words.length} answers); more matching words may be available.`;
  const sourceNote = source === "preview"
    ? "Dictionary source: small preview dictionary, not the connected database dictionary."
    : null;

  return [
    "Letter Dodge matching words",
    `Forbidden letters: ${[...letters].join(" ")}`,
    "Rule: answers contain none of the forbidden letters.",
    `Results: ${completeness}`,
    sourceNote,
    "Answers (alphabetical):",
    ...words,
  ].filter((line): line is string => line !== null).join("\n");
}

export function LetterDodgeCopyAnswers({
  letters,
  items,
  hasMore,
  nextCursor,
  source,
}: Props) {
  const sharing = useResultSharing({ title: "Copied!", description: "Answer list copied to clipboard" });
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [exportError, setExportError] = useState(false);
  const isBusy = isLoadingAll || sharing.isPending;

  function copyLoaded(event: React.MouseEvent<HTMLButtonElement>) {
    const text = formatAnswerList({ letters, items, isComplete: !hasMore, source });
    void sharing.copy(text, event.currentTarget);
  }

  async function copyAll(event: React.MouseEvent<HTMLButtonElement>) {
    if (isBusy) return;
    const button = event.currentTarget;
    setIsLoadingAll(true);
    setExportError(false);

    try {
      const allItems = [...items];
      const seenCursors = new Set<string>();
      let cursor = hasMore ? nextCursor : null;
      if (hasMore && !cursor) throw new Error("Missing next page cursor");

      while (cursor) {
        if (seenCursors.has(cursor)) throw new Error("Repeated next page cursor");
        seenCursors.add(cursor);
        const page = await searchLetterDodge(letters, cursor);
        if (page.source !== source) throw new Error("Dictionary source changed while loading");
        allItems.push(...page.items);
        if (page.page.hasMore && !page.page.nextCursor) throw new Error("Missing next page cursor");
        cursor = page.page.hasMore ? page.page.nextCursor : null;
      }

      const text = formatAnswerList({ letters, items: allItems, isComplete: true, source });
      await sharing.copy(text, button);
    } catch {
      setExportError(true);
    } finally {
      setIsLoadingAll(false);
    }
  }

  return (
    <div className="mt-5 space-y-3 border-t pt-4">
      <div className="flex flex-wrap gap-2">
        {hasMore ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={copyLoaded}>
              {sharing.isPending ? "Copying…" : `Copy loaded answers (${items.length})`}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={(event) => { void copyAll(event); }}>
              {isLoadingAll ? "Loading all matching words…" : sharing.isPending ? "Copying…" : "Copy all matching answers"}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={(event) => { void copyAll(event); }}>
            {isLoadingAll ? "Preparing full list…" : sharing.isPending ? "Copying…" : "Copy full matching list"}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {hasMore
          ? `Loaded results only: ${items.length} words shown. Copy all matching answers loads every remaining page before copying.`
          : `All matching results are loaded: ${items.length} words.`}
      </p>
      {isLoadingAll && <p className="text-sm text-muted-foreground" role="status">Loading every matching page before copying…</p>}
      {sharing.copied && <p className="text-sm text-muted-foreground" role="status">Answer list copied.</p>}
      {exportError && (
        <p className="text-sm text-destructive" role="alert">
          Could not load the complete matching list, so nothing was copied. Try again.
        </p>
      )}
      <ManualCopyDialog
        text={sharing.manualText}
        onClose={sharing.closeManualCopy}
        restoreFocus={sharing.restoreFocus}
        title="Copy Letter Dodge answers"
        label="Answer list"
        rows={10}
      />
    </div>
  );
}
