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

type WordLengthPayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

export const wordLengthDuelAdapter: DuelGameAdapter = {
  validateMoveClient(input, currentWord) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    const targetLen = parseInt(currentWord, 10);
    if (upper.length !== targetLen) {
      return `"${upper}" is not exactly ${targetLen} letters long`;
    }
    return null;
  },

  buildWordPayload(word, lives): WordLengthPayload {
    return { type: "word", word: word.toUpperCase(), lives };
  },

  buildTimeoutPayload(lives): WordLengthPayload {
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
    return <WordLengthInput {...props} />;
  },

  renderGameDisplay(props) {
    return <WordLengthDisplay {...props} />;
  },
};

function WordLengthInput({
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
  const targetLen = parseInt(currentWord, 10);

  const handleSubmit = () => {
    const upper = value.toUpperCase().trim();
    if (!upper || disabled) return;

    if (upper.length !== targetLen) {
      setLocalFeedback(`"${upper}" is not exactly ${targetLen} letters long`);
      onInvalidMove();
      return;
    }
    if (usedWords.includes(upper)) {
      setLocalFeedback(`"${upper}" was already used`);
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
          }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={`Enter a ${targetLen}-letter word…`}
          className="font-mono uppercase"
          autoFocus
          disabled={disabled}
          data-testid="input-word"
          maxLength={targetLen}
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

function WordLengthDisplay({ currentWord, usedWords }: DuelDisplayProps) {
  const targetLen = parseInt(currentWord, 10);
  return (
    <div className="text-center space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">Target length</p>
      <p
        className="text-5xl font-black text-primary"
        data-testid="text-current-word"
      >
        {targetLen} <span className="text-2xl font-semibold text-muted-foreground">letters</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Submit words that are <strong>exactly {targetLen} letters</strong> long
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
