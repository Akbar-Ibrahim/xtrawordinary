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

type LetterPositionPayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

function parseConstraint(currentWord: string): { letter: string; position: number } {
  const [letter, posStr] = currentWord.split(":");
  return { letter: letter.toUpperCase(), position: parseInt(posStr, 10) };
}

export const letterPositionDuelAdapter: DuelGameAdapter = {
  validateMoveClient(input, currentWord) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    const { letter, position } = parseConstraint(currentWord);
    if (upper.length < position) {
      return `Word must have at least ${position} letters`;
    }
    if (upper[position - 1] !== letter) {
      return `Letter at position ${position} must be "${letter}"`;
    }
    return null;
  },

  buildWordPayload(word, lives): LetterPositionPayload {
    return { type: "word", word: word.toUpperCase(), lives };
  },

  buildTimeoutPayload(lives): LetterPositionPayload {
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
    return <LetterPositionInput {...props} />;
  },

  renderGameDisplay(props) {
    return <LetterPositionDisplay {...props} />;
  },
};

function LetterPositionInput({
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
  const { letter, position } = parseConstraint(currentWord);

  const handleSubmit = () => {
    const upper = value.toUpperCase().trim();
    if (!upper || disabled) return;

    if (upper.length < position) {
      setLocalFeedback(`Word must have at least ${position} letters`);
      onInvalidMove();
      return;
    }
    if (upper[position - 1] !== letter) {
      setLocalFeedback(`Letter at position ${position} must be "${letter}"`);
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
          placeholder={`Enter a word with "${letter}" at position ${position}…`}
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

function LetterPositionDisplay({ currentWord, usedWords, isMyTurn }: DuelDisplayProps) {
  const { letter, position } = parseConstraint(currentWord);
  const ordinal = ["", "1st", "2nd", "3rd", "4th", "5th"][position] ?? `${position}th`;
  return (
    <div className="text-center space-y-3">
      <div className="flex items-center justify-center gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Position Master</p>
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
        className="rounded-xl border-2 border-primary bg-primary/5 py-4 px-6 flex items-center justify-center gap-4"
        data-testid="box-constraint"
      >
        <p
          className="text-5xl font-black text-primary tracking-widest"
          data-testid="text-current-word"
        >
          {letter}
        </p>
        <div className="text-left">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">at position</p>
          <p className="text-4xl font-black">{position}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Submit words where the <strong>{ordinal} letter is "{letter}"</strong>
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
