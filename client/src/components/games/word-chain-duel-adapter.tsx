// @refresh reset
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type {
  DuelGameAdapter,
  DuelInputProps,
  DuelDisplayProps,
} from "@/components/duel-turn-engine";

type WordChainPayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

// ─── Adapter implementation ──────────────────────────────────────────────────

/**
 * Word Chain game adapter for DuelTurnEngine.
 * Provides Word Chain-specific validation, payload building, and UI rendering.
 * Dictionary validation is intentionally deferred to the server so that the
 * server remains the single source of truth and errors propagate back via the
 * WS "error" message (triggering the engine's 0.5s time penalty + rollback).
 */
export const wordChainDuelAdapter: DuelGameAdapter = {
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    const requiredLetter = currentWord[currentWord.length - 1];
    if (!upper.startsWith(requiredLetter)) {
      return `Word must start with "${requiredLetter}"`;
    }
    if (usedWords.includes(upper)) {
      return "That word was already used!";
    }
    return null;
  },

  buildWordPayload(word, lives): WordChainPayload {
    return { type: "word", word: word.toUpperCase(), lives };
  },

  buildTimeoutPayload(lives): WordChainPayload {
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
    return <WordChainInput {...props} />;
  },

  renderGameDisplay(props) {
    return <WordChainDisplay {...props} />;
  },
};

// ─── Word Chain Input ─────────────────────────────────────────────────────────

function WordChainInput({
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

  const handleSubmit = () => {
    const upper = value.toUpperCase().trim();
    if (!upper || disabled) return;

    // Client-side checks — call onInvalidMove() so the engine applies the 0.5s
    // time penalty even when the adapter short-circuits before calling onSubmit.
    const requiredLetter = currentWord[currentWord.length - 1];
    if (!upper.startsWith(requiredLetter)) {
      setLocalFeedback(`Word must start with "${requiredLetter}"`);
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
    // Dictionary validation is server-authoritative; onSubmit sends to server.
    // Invalid dictionary words trigger a WS "error" response → engine rolls back
    // the optimistic update and deducts 0.5s automatically.
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
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder={`Start with "${currentWord[currentWord.length - 1]}"…`}
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

// ─── Word Chain Display ───────────────────────────────────────────────────────

function WordChainDisplay({ currentWord }: DuelDisplayProps) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Chain from</p>
      <p
        className="text-3xl font-black text-primary tracking-wider"
        data-testid="text-current-word"
      >
        {currentWord}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Next word must start with{" "}
        <strong>"{currentWord[currentWord.length - 1]}"</strong>
      </p>
    </div>
  );
}
