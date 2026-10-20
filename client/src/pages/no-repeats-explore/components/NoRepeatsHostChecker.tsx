import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { checkNoRepeatsAnswer } from "../api";
import type { NoRepeatsExploreFilters } from "../types";

interface Props {
  filters: NoRepeatsExploreFilters;
}

function resultMessage(dictionaryMatch: boolean, constraintMatch: boolean): string {
  if (!dictionaryMatch) return "This word was not found in the dictionary.";
  if (!constraintMatch) return "This dictionary word repeats a letter or does not match the selected filters.";
  return "This dictionary word is an isogram and matches the selected filters.";
}

export function NoRepeatsHostChecker({ filters }: Props) {
  const [answer, setAnswer] = useState("");
  const filterKey = JSON.stringify(filters);
  const checkMutation = useMutation({
    mutationFn: (word: string) => checkNoRepeatsAnswer(word, filters),
  });

  useEffect(() => {
    checkMutation.reset();
  }, [filterKey]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim()) return;
    checkMutation.mutate(answer.trim().toUpperCase());
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="no-repeats-host-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">For the host</p>
      <h2 id="no-repeats-host-heading" className="mt-1 text-xl font-semibold">Check a spoken answer</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Check whether the word is in the dictionary, has no repeated letters, and matches your selected filters.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="no-repeats-host-answer">Spoken answer</label>
        <input
          id="no-repeats-host-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value.replace(/[^a-z]/gi, "").toUpperCase())}
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2.5 font-mono uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Enter the word"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={100}
        />
        <button
          type="submit"
          disabled={!answer.trim() || checkMutation.isPending}
          className="rounded-lg border px-4 py-2.5 font-medium disabled:opacity-50"
        >
          {checkMutation.isPending ? "Checking…" : "Check answer"}
        </button>
      </form>
      {checkMutation.isError && (
        <p className="mt-3 text-sm text-destructive" role="alert">{checkMutation.error.message}</p>
      )}
      {checkMutation.data && (
        <div
          className={`mt-4 rounded-lg border p-3 ${checkMutation.data.dictionaryMatch && checkMutation.data.constraintMatch ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/30 bg-destructive/5"}`}
          role="status"
        >
          <p className="font-semibold">{checkMutation.data.word}</p>
          <p className="mt-1 text-sm">{resultMessage(checkMutation.data.dictionaryMatch, checkMutation.data.constraintMatch)}</p>
          {checkMutation.data.source === "preview" && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              Checked against the small preview dictionary, not the full connected dictionary.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
