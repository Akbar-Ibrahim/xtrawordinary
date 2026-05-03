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

/** True if b can be obtained from a by adding or removing exactly one letter at any position. */
function differsByOneLetter(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let si = 0;
  for (let li = 0; li < longer.length; li++) {
    if (si < shorter.length && longer[li] === shorter[si]) si++;
  }
  return si === shorter.length;
}

function canFormFromPool(word: string, pool: string): boolean {
  const counts: Record<string, number> = {};
  for (const c of pool.toUpperCase()) counts[c] = (counts[c] ?? 0) + 1;
  for (const c of word.toUpperCase()) {
    if (!counts[c]) return false;
    counts[c]--;
  }
  return true;
}

/** Check whether word is an ordered subsequence of base (letters in same order). */
function isSubsequenceOf(word: string, base: string): boolean {
  let bi = 0;
  for (let wi = 0; wi < word.length; wi++) {
    while (bi < base.length && base[bi] !== word[wi]) bi++;
    if (bi >= base.length) return false;
    bi++;
  }
  return true;
}

/** Compute remaining pool after all used words have deducted their letters. */
function remainingPool(startPool: string, usedWords: string[]): string {
  let pool = startPool.toUpperCase();
  for (const w of usedWords) {
    for (const c of w.toUpperCase()) {
      pool = pool.replace(c, "");
    }
  }
  return pool;
}

const VOWELS = new Set("AEIOU");

function RaceInput({ currentWord, usedWords, onSubmit, disabled, feedback, clearFeedback, onTyping, placeholder, skipDuplicateCheck }: DuelInputProps & { placeholder: string; skipDuplicateCheck?: boolean }) {
  const [value, setValue] = useState("");
  const handleSubmit = () => {
    const upper = value.toUpperCase().trim();
    if (!upper || disabled) return;
    if (!skipDuplicateCheck && usedWords.includes(upper)) return;
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
            if (e.target.value) onTyping?.();
          }}
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
  skipDuplicateCheck?: boolean;
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
    renderInput: (props) => <RaceInput {...props} placeholder={opts.placeholder} skipDuplicateCheck={opts.skipDuplicateCheck} />,
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
    // Deterministic display: sort alphabetically (same for both players every render)
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
    // Deterministic display: sort alphabetically (same for both players every render)
    const sorted = seed.split("").sort().join("");
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Anagram Race</p>
        <p className="text-4xl font-black text-primary tracking-widest font-mono" data-testid="text-current-word">
          {sorted}
        </p>
        <p className="text-xs text-muted-foreground">
          Submit words that are anagrams of these letters
        </p>
      </div>
    );
  },
});

// ─── word-stack ────────────────────────────────────────────────────────────────

export const wordStackRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Add or remove one letter from your last word…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    const prevWord = usedWords.length > 0 ? usedWords[usedWords.length - 1] : currentWord.toUpperCase();
    if (!differsByOneLetter(upper, prevWord)) {
      return `Word must be obtainable from "${prevWord}" by adding or removing exactly one letter at any position`;
    }
    return null;
  },
  renderGameDisplay({ currentWord, usedWords }) {
    const prevWord = usedWords.length > 0 ? usedWords[usedWords.length - 1] : currentWord.toUpperCase();
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Word Stack</p>
        <p className="text-4xl font-black text-primary tracking-widest font-mono" data-testid="text-current-word">
          {prevWord}
        </p>
        <p className="text-xs text-muted-foreground">
          Add or remove <strong>one letter</strong> at any position to form a new word
        </p>
      </div>
    );
  },
});

// ─── letter-pool ───────────────────────────────────────────────────────────────

export const letterPoolRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word using your remaining letters…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    // Compute remaining letters client-side (best-effort; server is authoritative)
    const remaining = remainingPool(currentWord, usedWords);
    if (!remaining) return "Your letter pool is exhausted";
    if (!canFormFromPool(upper, remaining)) return "Word must only use your remaining letters";
    return null;
  },
  renderGameDisplay({ currentWord, usedWords }) {
    // Show remaining letters (subtract all used words' letters from starting pool)
    const remaining = remainingPool(currentWord, usedWords);
    const letters = remaining.split("").sort();
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Remaining Letters</p>
        {letters.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-1">
            {letters.map((l, i) => (
              <Badge
                key={i}
                variant={VOWELS.has(l) ? "default" : "secondary"}
                className="text-base font-black px-2.5 py-0.5 font-mono"
                data-testid={i === 0 ? "text-current-word" : undefined}
              >
                {l}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-2xl font-black text-muted-foreground" data-testid="text-current-word">Pool exhausted</p>
        )}
        <p className="text-xs text-muted-foreground">Use your remaining letters (letters are consumed)</p>
      </div>
    );
  },
});

// ─── word-maker ────────────────────────────────────────────────────────────────

export const wordMakerRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type a word whose letters appear in order in the base word…",
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    if (usedWords.includes(upper)) return "You already used that word";
    if (!isSubsequenceOf(upper, currentWord.toUpperCase())) {
      return `Word letters must appear in order within "${currentWord}"`;
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
        <p className="text-xs text-muted-foreground">Submit words whose letters appear <strong>in order</strong> within <strong>{base}</strong></p>
      </div>
    );
  },
});

// ─── word-split ────────────────────────────────────────────────────────────────

export const wordSplitRaceAdapter: DuelGameAdapter = makeAdapter({
  placeholder: "Type the next slice of the compound word…",
  skipDuplicateCheck: true,
  validateMoveClient(input, currentWord, usedWords) {
    const upper = input.toUpperCase().trim();
    if (!upper) return "Please enter a word";
    const compound = currentWord.toUpperCase();
    // Compute where the player's cursor is (total letters covered so far, looping)
    const totalCovered = usedWords.reduce((sum, w) => sum + w.length, 0);
    const splitPos = totalCovered % compound.length;
    const remaining = compound.slice(splitPos);
    if (!remaining.startsWith(upper)) {
      return `Next slice must start at position ${splitPos + 1}: expected "${remaining.slice(0, upper.length || 4)}…"`;
    }
    if (splitPos + upper.length > compound.length) {
      return `Word extends past the end of "${compound}"`;
    }
    return null;
  },
  renderGameDisplay({ currentWord, usedWords }) {
    const compound = currentWord.toUpperCase();
    const totalCovered = usedWords.reduce((sum, w) => sum + w.length, 0);
    const splitPos = totalCovered % compound.length;
    const covered = compound.slice(0, splitPos);
    const cursor = compound[splitPos] ?? "";
    const rest = compound.slice(splitPos + 1);
    return (
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Split the compound word</p>
        <p className="text-3xl font-black font-mono tracking-widest" data-testid="text-current-word">
          <span className="text-muted-foreground/40">{covered}</span>
          <span className="text-primary underline underline-offset-4">{cursor}</span>
          <span className="text-foreground">{rest}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Submit a word starting at the <strong>underlined letter</strong> (cursor loops after full coverage)
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
