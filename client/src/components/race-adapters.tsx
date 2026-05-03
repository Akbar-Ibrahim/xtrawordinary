// @refresh reset
// Race-format DuelGameAdapter implementations for the 8 race-only games.
// The 5 shared games (letter-hunt, word-length, letter-frequency, letter-position,
// letter-balance) reuse their existing turn-based adapters directly.
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  DuelGameAdapter,
  DuelInputProps,
  DuelDisplayProps,
} from "@/components/duel-turn-engine";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function canFormFromPool(word: string, pool: string): boolean {
  const counts: Record<string, number> = {};
  for (const c of pool.toUpperCase()) counts[c] = (counts[c] ?? 0) + 1;
  for (const c of word.toUpperCase()) {
    if (!counts[c]) return false;
    counts[c]--;
  }
  return true;
}

const VOWELS = new Set("AEIOU");

function RaceInput({ currentWord, usedWords, onSubmit, disabled, feedback, clearFeedback, placeholder }: DuelInputProps & { placeholder: string }) {
  const [value, setValue] = useState("");
  const handleSubmit = () => {
    const upper = value.toUpperCase().trim();
    if (!upper || disabled) return;
    if (usedWords.includes(upper)) return;
    setValue("");
    clearFeedback();
    onSubmit(upper);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => { setValue(e.target.value.toUpperCase()); clearFeedback(); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={placeholder}
          className="font-mono uppercase"
          autoFocus
          disabled={disabled}
          data-testid="input-word"
          maxLength={30}
        />
        <Button onClick={handleSubmit} disabled={!value.trim() || disabled} data-testid="button-submit">
          Submit
        </Button>
      </div>
      {feedback && (
        <p className="text-xs text-destructive text-center" data-testid="text-feedback">{feedback}</p>
      )}
    </div>
  );
}

function makeAdapter(opts: {
  validateMoveClient: (input: string, currentWord: string, usedWords: string[]) => string | null;
  renderGameDisplay: (props: DuelDisplayProps) => React.ReactNode;
  placeholder: string;
}): DuelGameAdapter {
  return {
    validateMoveClient: opts.validateMoveClient,
    buildWordPayload: (word) => ({ type: "word", word: word.toUpperCase() }),
    buildTimeoutPayload: (lives) => ({ type: "timeout", lives }),
    extractOpponentWord: (payload) => {
      if (payload !== null && typeof payload === "object") {
        const p = payload as { type?: string; word?: string };
        if (p.type === "word" && typeof p.word === "string") return p.word;
      }
      return null;
    },
    renderInput: (props) => <RaceInput {...props} placeholder={opts.placeholder} />,
    renderGameDisplay: opts.renderGameDisplay,
  };
}

// ─── word-scramble ─────────────────────────────────────────────────────────────

export const wordScrambleRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word from the letters…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    if (!canFormFromPool(upper, currentWord)) return "Word must only use letters from the pool";
    return null;
  },
  renderGameDisplay({ currentWord }) {
    const letters = currentWord.toUpperCase().split("").sort();
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Letter pool</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {letters.map((l, i) => (
            <Badge key={i} className="text-lg font-black px-3 py-1 font-mono">{l}</Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Make words using only these letters</p>
      </div>
    );
  },
});

// ─── no-repeats ────────────────────────────────────────────────────────────────

export const noRepeatsRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word with no repeated letters…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    const minLen = parseInt(currentWord, 10);
    if (upper.length < minLen) return `Word must be at least ${minLen} letters long`;
    const letterSet = new Set(upper.split(""));
    if (letterSet.size !== upper.length) return "Word must have no repeated letters";
    return null;
  },
  renderGameDisplay({ currentWord }) {
    const minLen = parseInt(currentWord, 10);
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">No-Repeats Race</p>
        <p className="text-5xl font-black text-primary tabular-nums" data-testid="text-current-word">
          {minLen}+
        </p>
        <p className="text-xs text-muted-foreground">
          Submit words with at least <strong>{minLen}</strong> letters and <strong>no repeated letters</strong>
        </p>
      </div>
    );
  },
});

// ─── anagram-solver ────────────────────────────────────────────────────────────

export const anagramSolverRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type an anagram…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    const seed = currentWord.toUpperCase();
    if (upper.length !== seed.length) return `Word must have exactly ${seed.length} letters`;
    if (upper.split("").sort().join("") !== seed.split("").sort().join("")) {
      return `Word must use the same letters as "${seed}"`;
    }
    return null;
  },
  renderGameDisplay({ currentWord }) {
    const seed = currentWord.toUpperCase();
    const shuffled = seed.split("").sort(() => 0.5 - Math.random()).join("");
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Anagram Race</p>
        <p className="text-4xl font-black text-primary tracking-widest font-mono" data-testid="text-current-word">
          {shuffled}
        </p>
        <p className="text-xs text-muted-foreground">
          Submit words that are anagrams of <strong className="font-mono">{seed}</strong>
        </p>
      </div>
    );
  },
});

// ─── word-stack ────────────────────────────────────────────────────────────────

export const wordStackRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word of the right length…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    const baseLen = parseInt(currentWord, 10);
    const expectedLen = usedWords.length % 2 === 0 ? baseLen : baseLen + 1;
    if (upper.length !== expectedLen) {
      return `Word must be exactly ${expectedLen} letters long`;
    }
    return null;
  },
  renderGameDisplay({ currentWord, usedWords }) {
    const baseLen = parseInt(currentWord, 10);
    const nextLen = usedWords.length % 2 === 0 ? baseLen : baseLen + 1;
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Word Stack</p>
        <p className="text-5xl font-black text-primary tabular-nums" data-testid="text-current-word">
          {nextLen}
        </p>
        <p className="text-xs text-muted-foreground">
          Alternates between <strong>{baseLen}</strong> and <strong>{baseLen + 1}</strong> letter words
        </p>
        <p className="text-xs text-primary font-semibold">
          Next word needs <strong>{nextLen}</strong> letters
        </p>
      </div>
    );
  },
});

// ─── letter-pool ───────────────────────────────────────────────────────────────

export const letterPoolRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word using pool letters…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    if (!canFormFromPool(upper, currentWord)) return "Word must only use letters from the pool";
    return null;
  },
  renderGameDisplay({ currentWord }) {
    const letters = currentWord.toUpperCase().split("");
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Letter Pool</p>
        <div className="flex flex-wrap justify-center gap-1">
          {letters.map((l, i) => (
            <Badge
              key={i}
              variant={VOWELS.has(l) ? "default" : "secondary"}
              className="text-base font-black px-2.5 py-0.5 font-mono"
            >
              {l}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Make words using these letters (reuse allowed)</p>
      </div>
    );
  },
});

// ─── word-maker ────────────────────────────────────────────────────────────────

export const wordMakerRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word using letters from the base word…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    if (!canFormFromPool(upper, currentWord)) {
      return `Word must only use letters from "${currentWord}"`;
    }
    return null;
  },
  renderGameDisplay({ currentWord }) {
    const base = currentWord.toUpperCase();
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Base word</p>
        <p className="text-4xl font-black text-primary tracking-widest font-mono" data-testid="text-current-word">
          {base}
        </p>
        <p className="text-xs text-muted-foreground">Make words using only letters from <strong>{base}</strong></p>
      </div>
    );
  },
});

// ─── word-split ────────────────────────────────────────────────────────────────

export const wordSplitRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word using the compound letters…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    if (!canFormFromPool(upper, currentWord)) return "Word must only use letters from the compound word";
    return null;
  },
  renderGameDisplay({ currentWord }) {
    const compound = currentWord.toUpperCase();
    const mid = Math.ceil(compound.length / 2);
    const part1 = compound.slice(0, mid);
    const part2 = compound.slice(mid);
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Compound Word</p>
        <p className="text-3xl font-black text-primary font-mono tracking-widest" data-testid="text-current-word">
          <span>{part1}</span>
          <span className="text-muted-foreground">·</span>
          <span>{part2}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Make words using letters from <strong>{compound}</strong>
        </p>
      </div>
    );
  },
});

// ─── definition-match ──────────────────────────────────────────────────────────

const DEFINITION_CATEGORY_EXAMPLES: Record<string, string[]> = {
  ANIMALS: ["DOG", "CAT", "BEAR", "LION"],
  COLORS:  ["RED", "BLUE", "PINK", "GOLD"],
  FOODS:   ["RICE", "BEAN", "CAKE", "MILK"],
  SPORTS:  ["GOLF", "POLO", "SWIM", "DIVE"],
  SCIENCE: ["ATOM", "CELL", "GENE", "WAVE"],
};

export const definitionMatchRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word in the category…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    return null;
  },
  renderGameDisplay({ currentWord }) {
    const cat = currentWord.toUpperCase();
    const examples = DEFINITION_CATEGORY_EXAMPLES[cat] ?? [];
    const displayName = cat.charAt(0) + cat.slice(1).toLowerCase();
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Category</p>
        <p className="text-5xl font-black text-primary" data-testid="text-current-word">
          {displayName}
        </p>
        {examples.length > 0 && (
          <p className="text-xs text-muted-foreground">
            e.g. {examples.map((e) => e.charAt(0) + e.slice(1).toLowerCase()).join(", ")}…
          </p>
        )}
        <p className="text-xs text-muted-foreground">Submit words that belong to this category</p>
      </div>
    );
  },
});
