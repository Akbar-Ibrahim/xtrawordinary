import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { checkLetterDodgeAnswer } from "../api";
import type { LetterDodgeCheckResponse } from "../types";

interface Props {
  forbiddenLetters: string;
}

export function LetterDodgeHostChecker({ forbiddenLetters }: Props) {
  const [answer, setAnswer] = useState("");
  const checkMutation = useMutation({
    mutationFn: checkLetterDodgeAnswer,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!forbiddenLetters || !answer.trim()) return;
    checkMutation.mutate({ word: answer.trim().toUpperCase(), forbidden: forbiddenLetters });
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="dodge-word-check-heading">
      <h2 id="dodge-word-check-heading" className="text-xl font-semibold">Check a word</h2>
      <p className="mt-1 text-sm text-muted-foreground">See whether a word avoids the selected letters and exists in the dictionary.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="dodge-word-check">Word to check</label>
        <input
          id="dodge-word-check"
          value={answer}
          onChange={(event) => setAnswer(event.target.value.replace(/[^a-z]/gi, "").toUpperCase())}
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2.5 font-mono uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Enter a word"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={100}
        />
        <button type="submit" disabled={!forbiddenLetters || !answer.trim() || checkMutation.isPending} className="rounded-lg border px-4 py-2.5 font-medium disabled:opacity-50">
          {checkMutation.isPending ? "Checking…" : "Check word"}
        </button>
      </form>
      {checkMutation.isError && <p className="mt-3 text-sm text-destructive" role="alert">{checkMutation.error.message}</p>}
      {checkMutation.data && (
        <div className={`mt-4 rounded-lg border p-3 ${checkMutation.data.dictionaryMatch && checkMutation.data.constraintMatch ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/30 bg-destructive/5"}`} role="status">
          <p className="font-semibold">{checkMutation.data.word}</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Avoids selected letters: {checkMutation.data.constraintMatch ? "✅" : "❌"}</li>
            <li>Exists in dictionary: {checkMutation.data.dictionaryMatch ? "✅" : "❌"}</li>
          </ul>
          {checkMutation.data.source === "preview" && (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Checked against the small preview dictionary, not the full connected dictionary.</p>
          )}
        </div>
      )}
    </section>
  );
}
