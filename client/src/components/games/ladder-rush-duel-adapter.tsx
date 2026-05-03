// @refresh reset
import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  DuelGameAdapter,
  DuelInputProps,
  DuelDisplayProps,
} from "@/components/duel-turn-engine";

type LadderRushPayload =
  | { type: "word"; word: string; lives: number }
  | { type: "timeout"; lives: number };

function isNLetterDiff(a: string, b: string, n: number): boolean {
  if (a.length !== b.length) return false;
  const freqA: Record<string, number> = {};
  const freqB: Record<string, number> = {};
  for (const c of a) freqA[c] = (freqA[c] || 0) + 1;
  for (const c of b) freqB[c] = (freqB[c] || 0) + 1;
  let added = 0, removed = 0;
  for (const c of Object.keys(freqA)) {
    const diff = (freqB[c] || 0) - freqA[c];
    if (diff < 0) removed -= diff;
  }
  for (const c of Object.keys(freqB)) {
    const diff = freqB[c] - (freqA[c] || 0);
    if (diff > 0) added += diff;
  }
  return added === n && removed === n;
}

function createLadderRushAdapter(swapCount: 1 | 2): DuelGameAdapter {
  return {
    validateMoveClient(input, currentWord, usedWords) {
      const upper = input.toUpperCase().trim();
      if (!upper) return "Please enter a word";
      if (upper.length !== currentWord.length) {
        return `Word must be exactly ${currentWord.length} letters`;
      }
      if (!isNLetterDiff(currentWord, upper, swapCount)) {
        return swapCount === 1
          ? "Word must differ by exactly 1 letter"
          : "Word must differ by exactly 2 letters";
      }
      if (usedWords.includes(upper)) {
        return "That word was already used in this chain!";
      }
      return null;
    },

    buildWordPayload(word, lives): LadderRushPayload {
      return { type: "word", word: word.toUpperCase(), lives };
    },

    buildTimeoutPayload(lives): LadderRushPayload {
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
      return <LadderRushInput {...props} swapCount={swapCount} />;
    },

    renderGameDisplay(props) {
      return <LadderRushDisplay {...props} swapCount={swapCount} />;
    },
  };
}

export const ladderRushDuelAdapter = createLadderRushAdapter(1);
export const ladderRushDoubleDuelAdapter = createLadderRushAdapter(2);

// ─── Input ────────────────────────────────────────────────────────────────────

function LadderRushInput({
  currentWord,
  usedWords,
  onSubmit,
  onInvalidMove,
  disabled,
  feedback,
  clearFeedback,
  swapCount,
}: DuelInputProps & { swapCount: 1 | 2 }) {
  const [value, setValue] = useState("");
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled, currentWord]);

  const handleSubmit = () => {
    const upper = value.toUpperCase().trim();
    if (!upper || disabled) return;

    if (upper.length !== currentWord.length) {
      setLocalFeedback(`Word must be exactly ${currentWord.length} letters`);
      onInvalidMove();
      return;
    }
    if (!isNLetterDiff(currentWord, upper, swapCount)) {
      setLocalFeedback(
        swapCount === 1
          ? "Must differ by exactly 1 letter"
          : "Must differ by exactly 2 letters"
      );
      onInvalidMove();
      return;
    }
    if (usedWords.includes(upper)) {
      setLocalFeedback("Already used in this chain!");
      onInvalidMove();
      return;
    }

    setLocalFeedback(null);
    setValue("");
    clearFeedback();
    onSubmit(upper);
  };

  // Highlight letters that differ from currentWord
  const highlights = value
    .toUpperCase()
    .split("")
    .map((ch, i) => (i < currentWord.length && ch !== currentWord[i] ? i : -1))
    .filter((i) => i >= 0);

  return (
    <div className="space-y-3">
      <div className="text-center text-xs text-muted-foreground">
        Change exactly <strong>{swapCount}</strong> letter{swapCount > 1 ? "s" : ""}
        {" "}· same {currentWord.length}-letter word
      </div>

      {/* Ghost preview showing changed letters */}
      {value.trim() && value.length === currentWord.length && (
        <div className="flex justify-center gap-1">
          {value
            .toUpperCase()
            .split("")
            .map((ch, i) => {
              const changed = ch !== currentWord[i];
              return (
                <span
                  key={i}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded font-mono text-sm font-bold border
                    ${changed
                      ? "bg-violet-100 dark:bg-violet-900/40 border-violet-400 text-violet-700 dark:text-violet-300"
                      : "bg-muted border-border text-muted-foreground"
                    }`}
                >
                  {ch}
                </span>
              );
            })}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase().slice(0, currentWord.length));
            setLocalFeedback(null);
            clearFeedback();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder={`${currentWord.length}-letter word…`}
          className="font-mono uppercase tracking-widest text-center"
          disabled={disabled}
          maxLength={currentWord.length}
          data-testid="input-word"
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

// ─── Display ──────────────────────────────────────────────────────────────────

function LadderRushDisplay({
  currentWord,
  usedWords,
  isMyTurn,
  opponentName,
  swapCount,
}: DuelDisplayProps & { swapCount: 1 | 2 }) {
  const chain = usedWords.slice(-5);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          Current word
        </p>
        <p
          className="text-3xl font-black text-primary tracking-[0.15em]"
          data-testid="text-current-word"
        >
          {currentWord}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Change exactly <strong>{swapCount}</strong> letter{swapCount > 1 ? "s" : ""}
          {isMyTurn ? "" : ` — waiting for ${opponentName}`}
        </p>
      </div>

      {chain.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1 mt-1">
          {chain.slice(0, -1).map((w, i) => (
            <Badge key={i} variant="secondary" className="font-mono text-xs opacity-60">
              {w}
            </Badge>
          ))}
          <Badge className="font-mono text-xs bg-primary/15 text-primary border-primary/30">
            {chain[chain.length - 1]}
          </Badge>
        </div>
      )}
    </div>
  );
}
