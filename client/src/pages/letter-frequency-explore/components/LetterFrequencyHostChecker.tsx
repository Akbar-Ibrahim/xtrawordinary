import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { checkLetterFrequencyAnswer } from "../api";
import { describeFrequencyRule } from "../format";
import type {
  LetterFrequencyConstraint,
  LetterFrequencyMatch,
} from "../types";

interface Props {
  constraints: LetterFrequencyConstraint[];
  match: LetterFrequencyMatch;
}

function resultMessage(dictionaryMatch: boolean, constraintMatch: boolean): string {
  if (!dictionaryMatch) return "This word was not found in the dictionary.";
  if (!constraintMatch) return "This dictionary word does not meet every selected letter count.";
  return "This dictionary word matches the selected frequency rule.";
}

export function LetterFrequencyHostChecker({ constraints, match }: Props) {
  const [answer, setAnswer] = useState("");
  const ruleKey = JSON.stringify({ constraints, match });
  const checkMutation = useMutation({
    mutationFn: (word: string) => checkLetterFrequencyAnswer(word, constraints, match),
  });

  useEffect(() => {
    checkMutation.reset();
  }, [ruleKey]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim()) return;
    checkMutation.mutate(answer.trim().toUpperCase());
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="frequency-word-check-heading">
      <h2 id="frequency-word-check-heading" className="text-xl font-semibold">Check a word</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        See whether a word exists in the dictionary and has {describeFrequencyRule(constraints, match)}.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="frequency-word-check">Word to check</label>
        <input
          id="frequency-word-check"
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
          {checkMutation.isPending ? "Checking…" : "Check word"}
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
