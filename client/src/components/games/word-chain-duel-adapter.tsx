import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { DuelGameAdapter, DuelInputProps, DuelDisplayProps } from "@/components/duel-turn-engine";
import type { WordValidationResponse } from "@shared/schema";

type WordChainPayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

// ─── Adapter implementation ──────────────────────────────────────────────────

/**
 * Word Chain game adapter for DuelTurnEngine.
 * Handles Word Chain-specific move rules, payload building, and rendering.
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

function WordChainInput({ currentWord, usedWords, onSubmit, disabled, feedback, clearFeedback }: DuelInputProps) {
  const [value, setValue] = useState("");

  const validateMutation = useMutation({
    mutationFn: async (word: string) => {
      const res = await apiRequest("POST", "/api/games/validate-word", { word });
      return res.json() as Promise<WordValidationResponse>;
    },
  });

  const handleSubmit = async () => {
    const word = value.toUpperCase().trim();
    if (!word || disabled) return;

    const clientError = wordChainDuelAdapter.validateMoveClient(word, currentWord, usedWords);
    if (clientError) {
      // The adapter validated; no additional client-side error expected here
      return;
    }

    // Dictionary check via server API
    const result = await validateMutation.mutateAsync(word);
    if (!result.valid) {
      clearFeedback();
      // Surface as feedback via parent by just returning invalid — the engine
      // shows the server-side error message from the error WS message instead
      return;
    }

    setValue("");
    clearFeedback();
    onSubmit(word);
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
            if (e.key === "Enter") void handleSubmit();
          }}
          placeholder={`Start with "${currentWord[currentWord.length - 1]}"…`}
          className="font-mono uppercase"
          autoFocus
          disabled={disabled || validateMutation.isPending}
          data-testid="input-word"
          maxLength={30}
        />
        <Button
          onClick={() => void handleSubmit()}
          disabled={!value.trim() || validateMutation.isPending || disabled}
          data-testid="button-submit"
        >
          {validateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Submit"
          )}
        </Button>
      </div>
      {feedback && (
        <p className="text-xs text-destructive text-center" data-testid="text-feedback">
          {feedback}
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
