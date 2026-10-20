import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkLetterBalanceWord } from "../api";
import type { LetterBalanceExploreCheck, LetterBalanceExploreFilters } from "../types";

interface Props {
  filters: LetterBalanceExploreFilters;
}

export function LetterBalanceHostChecker({ filters }: Props) {
  const [answer, setAnswer] = useState("");
  const [checkedRule, setCheckedRule] = useState("");
  const ruleKey = JSON.stringify(filters);
  const checkMutation = useMutation<LetterBalanceExploreCheck, Error, string>({
    mutationFn: (word) => checkLetterBalanceWord(word, filters),
  });

  useEffect(() => {
    checkMutation.reset();
    setCheckedRule("");
  }, [ruleKey]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || checkMutation.isPending) return;
    setCheckedRule(ruleKey);
    checkMutation.mutate(answer.trim().toUpperCase());
  }

  const currentResult = checkedRule === ruleKey ? checkMutation.data : undefined;
  const message = currentResult
    ? !currentResult.dictionaryMatch
      ? "This word was not found in the dictionary."
      : currentResult.constraintMatch
        ? "This dictionary word matches the selected rule."
        : "This is a dictionary word, but it does not match the selected rule."
    : undefined;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Check a spoken answer</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter the word someone says aloud. The check uses the pattern selected above.
        </p>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
          <Input
            aria-label="Spoken answer"
            autoComplete="off"
            value={answer}
            onChange={(event) => setAnswer(event.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())}
            placeholder="ENTER A WORD"
          />
          <Button type="submit" disabled={!answer.trim() || checkMutation.isPending} className="shrink-0">
            {checkMutation.isPending ? "Checking…" : "Check answer"}
          </Button>
        </form>
        {checkMutation.error && (
          <div className="mt-3 space-y-2">
            <p role="alert" className="text-sm text-destructive">{checkMutation.error.message}</p>
            <Button variant="outline" size="sm" onClick={() => checkMutation.mutate(answer.trim().toUpperCase())}>
              Retry check
            </Button>
          </div>
        )}
        {message && (
          <p
            role="status"
            className={`mt-3 rounded-md p-3 text-sm ${
              currentResult?.constraintMatch
                ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                : currentResult?.dictionaryMatch
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
