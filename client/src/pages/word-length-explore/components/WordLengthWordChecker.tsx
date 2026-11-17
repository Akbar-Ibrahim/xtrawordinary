import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import { checkWordLengthWord } from "../api";
import type { WordLengthExplorePattern } from "../types";

export function WordLengthWordChecker({ pattern }: { pattern: WordLengthExplorePattern }) {
  const [word, setWord] = useState("");
  const checkMutation = useMutation({ mutationFn: checkWordLengthWord });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedWord = word.replace(/[^a-z]/gi, "").toUpperCase();
    if (!normalizedWord) return;
    checkMutation.mutate({ word: normalizedWord, pattern });
  }

  const result = checkMutation.data;

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="length-word-check-heading">
      <h2 id="length-word-check-heading" className="text-xl font-semibold">Check a word</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Check whether a word exists in the dictionary and matches the selected pattern.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="length-word-check">Word to check</label>
        <input
          id="length-word-check"
          value={word}
          onChange={(event) => setWord(event.target.value.replace(/[^a-z]/gi, "").toUpperCase())}
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2.5 font-mono uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Enter a word"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={100}
        />
        <ExploreIconButton
          type="submit"
          disabled={!word.trim() || checkMutation.isPending}
          label="Check word"
          isLoading={checkMutation.isPending}
          variant="outline"
        />
      </form>
      {checkMutation.isError && (
        <p className="mt-3 text-sm text-destructive" role="alert">{checkMutation.error.message}</p>
      )}
      {result && (
        <div className="mt-4 rounded-lg border bg-muted/30 p-3" role="status" aria-live="polite">
          <p className="mb-2 font-semibold">{result.word}</p>
          <p className="text-sm">Exists in dictionary: {result.dictionaryMatch ? "✅" : "❌"}</p>
          <p className="mt-1 text-sm">Matches selected pattern: {result.constraintMatch ? "✅" : "❌"}</p>
          {result.gameplayExclusion && (
            <p className="mt-2 text-xs text-muted-foreground">
              This word is outside Length Challenge’s normal 3–12 letter gameplay range, but Explore includes it.
            </p>
          )}
          {result.source === "preview" && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              Checked against the small preview dictionary, not the full connected dictionary.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
