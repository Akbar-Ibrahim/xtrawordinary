// @refresh reset
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type {
  DuelGameAdapter,
  DuelInputProps,
  DuelDisplayProps,
} from "@/components/duel-turn-engine";

type LetterBalancePayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

const VOWELS = "AEIOU";

function parseConstraint(currentWord: string): { count: number; type: "V" | "C" } {
  const count = parseInt(currentWord.slice(0, -1), 10);
  const type = currentWord.slice(-1) as "V" | "C";
  return { count, type };
}

function countVowels(word: string): number {
  return word.toUpperCase().split("").filter(c => VOWELS.includes(c)).length;
}

function countConsonants(word: string): number {
  return word.toUpperCase().split("").filter(c => !VOWELS.includes(c) && /[A-Z]/.test(c)).length;
}

export const letterBalanceDuelAdapter: DuelGameAdapter = {
  validateMoveClient(input, currentWord) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    const { count, type } = parseConstraint(currentWord);
    const actual = type === "V" ? countVowels(upper) : countConsonants(upper);
    if (actual !== count) {
      const typeName = type === "V" ? "vowel" : "consonant";
      return `Word must have exactly ${count} ${typeName}${count !== 1 ? "s" : ""}`;
    }
    return null;
  },

  buildWordPayload(word, lives): LetterBalancePayload {
    return { type: "word", word: word.toUpperCase(), lives };
  },

  buildTimeoutPayload(lives): LetterBalancePayload {
    return { type: "timeout", lives };
  },

  extractOpponentWord(payload): string | null {
    if (payload !== null && typeof payload === "object") {
      const p = payload as { type?: string; word?: string };
      if (p.type === "word" && typeof p.word === "string") return p.word;
    }
    return null;
  },

  renderInput(props) {
    return <LetterBalanceInput {...props} />;
  },

  renderGameDisplay(props) {
    return <LetterBalanceDisplay {...props} />;
  },
};

function LetterBalanceInput({
  currentWord,
  usedWords,
  onSubmit,
  onInvalidMove,
  disabled,
  feedback,
  clearFeedback,
}: DuelInputProps) {
  const [value, setValue] = useState("");
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const { count, type } = parseConstraint(currentWord);
  const typeName = type === "V" ? "vowel" : "consonant";

  const handleSubmit = () => {
    const upper = value.toUpperCase().trim();
    if (!upper || disabled) return;

    const actual = type === "V" ? countVowels(upper) : countConsonants(upper);
    if (actual !== count) {
      setLocalFeedback(`Word must have exactly ${count} ${typeName}${count !== 1 ? "s" : ""}`);
      onInvalidMove();
      return;
    }
    if (usedWords.includes(upper)) {
      setLocalFeedback("That word was already used!");
      onInvalidMove();
      return;
    }

    setLocalFeedback(null);
    setValue("");
    clearFeedback();
    onSubmit(upper);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            clearFeedback();
          }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={`Enter a word with exactly ${count} ${typeName}${count !== 1 ? "s" : ""}…`}
          className="font-mono uppercase"
          autoFocus
          disabled={disabled}
          data-testid="input-word"
          maxLength={30}
        />
        <Button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          data-testid="button-submit"
        >
          Submit
        </Button>
      </div>
      {(localFeedback ?? feedback) && (
        <p className="text-xs text-destructive text-center" data-testid="text-feedback">
          {localFeedback ?? feedback}
        </p>
      )}
    </div>
  );
}

function LetterBalanceDisplay({ currentWord, usedWords, isMyTurn }: DuelDisplayProps) {
  const { count, type } = parseConstraint(currentWord);
  const typeName = type === "V" ? "Vowel" : "Consonant";
  const typeColor = type === "V" ? "text-blue-500" : "text-orange-500";
  const typeBorder = type === "V" ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20" : "border-orange-400 bg-orange-50 dark:bg-orange-950/20";
  return (
    <div className="text-center space-y-3">
      <div className="flex items-center justify-center gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Letter Balance</p>
        {isMyTurn ? (
          <span
            className="inline-flex items-center rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-xs font-semibold text-primary"
            data-testid="label-your-turn"
          >
            Your turn
          </span>
        ) : (
          <span
            className="inline-flex items-center rounded-full bg-muted border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground"
            data-testid="label-waiting"
          >
            Opponent's turn
          </span>
        )}
      </div>

      {/* Constraint box — always high contrast so players can track the rule at a glance */}
      <div
        className={`rounded-xl border-2 py-4 px-6 flex items-center justify-center gap-3 ${typeBorder}`}
        data-testid="box-constraint"
      >
        <p
          className={`text-5xl font-black ${typeColor}`}
          data-testid="text-current-word"
        >
          {count}
        </p>
        <p className={`text-2xl font-bold ${typeColor}`}>
          {typeName}{count !== 1 ? "s" : ""}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Submit words with <strong>exactly {count} {typeName.toLowerCase()}{count !== 1 ? "s" : ""}</strong>
      </p>
      {usedWords.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 pt-1">
          {usedWords.slice(-6).map((w) => (
            <Badge key={w} variant="secondary" className="font-mono text-xs">
              {w}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
