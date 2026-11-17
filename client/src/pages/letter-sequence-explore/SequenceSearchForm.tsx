import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import { LETTER_SEQUENCE_EXPLORE_MAX_WORD_LENGTH } from "@shared/letter-sequence-explore";

const MAX_SEQUENCE_LENGTH = 32;

export function sanitizeSequence(value: string) {
  return value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, MAX_SEQUENCE_LENGTH);
}

export function SequenceSearchForm({
  value,
  length,
  isSearching,
  onChange,
  onLengthChange,
  onSubmit,
}: {
  value: string;
  length: number | null;
  isSearching: boolean;
  onChange: (value: string) => void;
  onLengthChange: (length: number | null) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="rounded-2xl border border-[#e5dece] bg-[#fcfaf5] p-5 shadow-[0_5px_18px_rgba(73,57,32,0.035)] dark:border-[#42443c] dark:bg-[#20221e] sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="sequence-word-length" className="block text-sm font-semibold text-foreground">
        Word length
      </label>
      <select
        id="sequence-word-length"
        className="mt-1.5 h-11 w-full rounded-xl border border-[#ded7c8] bg-[#f8f5ed] px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-[#494a42] dark:bg-[#171916]"
        value={length === null ? "" : String(length)}
        onChange={(event) => onLengthChange(event.target.value ? Number(event.target.value) : null)}
      >
        <option value="">Any length</option>
        {Array.from({ length: LETTER_SEQUENCE_EXPLORE_MAX_WORD_LENGTH }, (_, index) => index + 1).map((wordLength) => (
          <option key={wordLength} value={wordLength}>
            {wordLength} {wordLength === 1 ? "letter" : "letters"}
          </option>
        ))}
      </select>

      <label htmlFor="sequence-input" className="block text-sm font-semibold text-foreground">
        Letter sequence
      </label>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
        Enter letters A–Z. Spaces and punctuation are removed.
      </p>
      <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <input
            id="sequence-input"
            autoComplete="off"
            maxLength={MAX_SEQUENCE_LENGTH}
            value={value}
            onChange={(event) => onChange(sanitizeSequence(event.target.value))}
            placeholder="e.g. word"
            className="h-12 w-full rounded-xl border border-[#ded7c8] bg-[#f8f5ed] px-4 font-mono text-base font-semibold uppercase tracking-[0.14em] text-foreground outline-none transition-colors placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-[#494a42] dark:bg-[#171916]"
            aria-describedby="sequence-hint"
          />
        </div>
        <ExploreIconButton
          type="submit"
          disabled={!value || isSearching}
          label="Search words"
          isLoading={isSearching}
          className="h-12 w-12 rounded-xl bg-[#765e45] text-[#fbf9f3] hover:bg-[#654f39] focus-visible:ring-4 focus-visible:ring-[#c58831]/30 dark:bg-[#d6c39a] dark:text-[#242923] dark:hover:bg-[#e4d2a8]"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p id="sequence-hint" className="text-xs text-muted-foreground">
          Up to {MAX_SEQUENCE_LENGTH} letters
        </p>
        <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-label={`${value.length} of ${MAX_SEQUENCE_LENGTH} letters`}>
          {value.length}/{MAX_SEQUENCE_LENGTH}
        </span>
      </div>
    </form>
  );
}
