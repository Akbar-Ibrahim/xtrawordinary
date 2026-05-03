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

type LetterHuntPayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

export const letterHuntDuelAdapter: DuelGameAdapter = {
  validateMoveClient(input, currentWord) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    const targetLetter = currentWord.toUpperCase();
    if (!upper.includes(targetLetter)) {
      return `Word must contain the letter "${targetLetter}"`;
    }
    return null;
  },

  buildWordPayload(word, lives): LetterHuntPayload {
    return { type: "word", word: word.toUpperCase(), lives };
  },

  buildTimeoutPayload(lives): LetterHuntPayload {
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
    return <LetterHuntInput {...props} />;
  },

  renderGameDisplay(props) {
    return <LetterHuntDisplay {...props} />;
  },
};

function LetterHuntInput({
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
      setLocalFeedback(`Word must contain the letter "${targetLetter}"`);
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
          placeholder={`Enter a word containing "${targetLetter}"…`}
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

function LetterHuntDisplay({ currentWord, usedWords }: DuelDisplayProps) {
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
        Submit words that contain <strong>"{targetLetter}"</strong>
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
