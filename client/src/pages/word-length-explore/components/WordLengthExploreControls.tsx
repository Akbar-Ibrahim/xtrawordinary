import type { FormEvent } from "react";
import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import { WORD_LENGTH_VARIANTS } from "@shared/word-length";
import { WORD_LENGTH_EXPLORE_MAX_LENGTH } from "@shared/word-length-explore";
import type { WordLengthExplorePattern } from "../types";

interface Props {
  pattern: WordLengthExplorePattern;
  isSearching: boolean;
  onPatternChange: (pattern: WordLengthExplorePattern) => void;
  onSearch: (pattern: WordLengthExplorePattern) => void;
}

function updatePattern(
  pattern: WordLengthExplorePattern,
  variation: WordLengthExplorePattern["variation"],
): WordLengthExplorePattern {
  return {
    variation,
    length: pattern.length,
    ...(variation === 2 || variation === 4 ? { startsWith: pattern.startsWith ?? "" } : {}),
    ...(variation === 3 || variation === 5 ? { endsWith: pattern.endsWith ?? "" } : {}),
    ...(variation === 4 || variation === 5 ? { contains: pattern.contains ?? "" } : {}),
  };
}

export function WordLengthExploreControls({
  pattern,
  isSearching,
  onPatternChange,
  onSearch,
}: Props) {
  const needsStartsWith = pattern.variation === 2 || pattern.variation === 4;
  const needsEndsWith = pattern.variation === 3 || pattern.variation === 5;
  const needsContains = pattern.variation === 4 || pattern.variation === 5;
  const lettersReady =
    (!needsStartsWith || !!pattern.startsWith) &&
    (!needsEndsWith || !!pattern.endsWith) &&
    (!needsContains || !!pattern.contains);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lettersReady) onSearch(pattern);
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="length-controls-heading">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Length Challenge</p>
        <h2 id="length-controls-heading" className="mt-1 text-xl font-semibold">Choose a word pattern</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse dictionary words that fit a length and letter pattern.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="length-explore-pattern" className="mb-1 block text-sm font-medium">Pattern</label>
          <select
            id="length-explore-pattern"
            value={pattern.variation}
            onChange={(event) => onPatternChange(updatePattern(pattern, Number(event.target.value) as WordLengthExplorePattern["variation"]))}
            className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {WORD_LENGTH_VARIANTS.map((variant) => (
              <option key={variant.variation} value={variant.variation}>{variant.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="length-explore-length" className="mb-1 block text-sm font-medium">Exact word length</label>
          <input
            id="length-explore-length"
            type="number"
            min={1}
            max={WORD_LENGTH_EXPLORE_MAX_LENGTH}
            value={pattern.length}
            onChange={(event) => onPatternChange({ ...pattern, length: Number(event.target.value) })}
            className="w-28 rounded-lg border bg-background px-3 py-2.5 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">Explore includes dictionary words shorter than normal gameplay allows.</p>
        </div>

        {(needsStartsWith || needsEndsWith || needsContains) && (
          <div className="grid grid-cols-2 gap-3">
            {needsStartsWith && (
              <LetterInput
                id="length-explore-starts-with"
                label="Starts with"
                value={pattern.startsWith ?? ""}
                onChange={(startsWith) => onPatternChange({ ...pattern, startsWith })}
              />
            )}
            {needsEndsWith && (
              <LetterInput
                id="length-explore-ends-with"
                label="Ends with"
                value={pattern.endsWith ?? ""}
                onChange={(endsWith) => onPatternChange({ ...pattern, endsWith })}
              />
            )}
            {needsContains && (
              <LetterInput
                id="length-explore-contains"
                label={pattern.variation === 4 ? "Contains (not last)" : "Contains (not first)"}
                value={pattern.contains ?? ""}
                onChange={(contains) => onPatternChange({ ...pattern, contains })}
              />
            )}
          </div>
        )}

        <div className="flex justify-center">
          <ExploreIconButton
            type="submit"
            disabled={!lettersReady || isSearching || !Number.isInteger(pattern.length) || pattern.length < 1 || pattern.length > WORD_LENGTH_EXPLORE_MAX_LENGTH}
            label="Find words"
            isLoading={isSearching}
            className="bg-primary text-primary-foreground"
          />
        </div>
      </form>
    </section>
  );
}

function LetterInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^a-z]/gi, "").slice(0, 1).toUpperCase())}
        className="w-full rounded-lg border bg-background px-3 py-2.5 font-mono uppercase tracking-[0.15em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="A–Z"
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={1}
      />
    </div>
  );
}
