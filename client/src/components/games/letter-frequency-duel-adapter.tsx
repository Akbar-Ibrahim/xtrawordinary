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

type LetterFrequencyPayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

/** Count how many times a letter appears in a word. */
function countLetter(word: string, letter: string): number {
  return word.split("").filter((c) => c === letter).length;
}

export const letterFrequencyDuelAdapter: DuelGameAdapter = {
  validateMoveClient(input, currentWord) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    const targetLetter = currentWord.toUpperCase();
    if (!upper.includes(targetLetter)) {
      return `Word must contain the letter "${targetLetter}" at least once`;
    }
    return null;
  },

  buildWordPayload(word, lives): LetterFrequencyPayload {
    return { type: "word", word: word.toUpperCase(), lives };
  },

  buildTimeoutPayload(lives): LetterFrequencyPayload {
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
    return <LetterFrequencyInput {...props} />;
  },

  renderGameDisplay(props) {
    return <LetterFrequencyDisplay {...props} />;
  },
};

function LetterFrequencyInput({
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
  const targetLetter = currentWord.toUpperCase();

  const handleSubmit = () => {
    const upper = value.toUpperCase().trim();
    if (!upper || disabled) return;

    if (!upper.includes(targetLetter)) {
      setLocalFeedback(`Word must contain the letter "${targetLetter}" at least once`);
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

  const count = countLetter(value.toUpperCase(), targetLetter);

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
          placeholder={`Enter a word packed with "${targetLetter}"…`}
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
      {value && count > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Contains <strong>{targetLetter}</strong> × {count}
        </p>
      )}
      {(localFeedback ?? feedback) && (
        <p className="text-xs text-destructive text-center" data-testid="text-feedback">
          {localFeedback ?? feedback}
        </p>
      )}
    </div>
  );
}

function LetterFrequencyDisplay({ currentWord, usedWords }: DuelDisplayProps) {
  const targetLetter = currentWord.toUpperCase();
  return (
    <div className="text-center space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">Target letter</p>
      <p
        className="text-5xl font-black text-primary tracking-widest"
        data-testid="text-current-word"
      >
        {targetLetter}
      </p>
      <p className="text-xs text-muted-foreground">
        Submit words packed with <strong>"{targetLetter}"</strong> — more is better
      </p>
      {usedWords.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 pt-1">
          {usedWords.slice(-6).map((w) => (
            <Badge key={w} variant="secondary" className="font-mono text-xs">
              {w}
              <span className="ml-1 opacity-60">×{countLetter(w, targetLetter)}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
