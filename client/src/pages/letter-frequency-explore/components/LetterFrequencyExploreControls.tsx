import type {
  FrequencyExploreMode,
  LetterFrequencyConstraint,
  LetterFrequencyMatch,
} from "../types";
import { MultiLetterFrequencyControls } from "./MultiLetterFrequencyControls";
import { SingleLetterFrequencyControls } from "./SingleLetterFrequencyControls";

interface Props {
  mode: FrequencyExploreMode;
  singleConstraint: LetterFrequencyConstraint;
  singleMatch: LetterFrequencyMatch;
  multiConstraints: LetterFrequencyConstraint[];
  isSearching: boolean;
  onModeChange: (mode: FrequencyExploreMode) => void;
  onSingleConstraintChange: (constraint: LetterFrequencyConstraint) => void;
  onSingleMatchChange: (match: LetterFrequencyMatch) => void;
  onMultiConstraintsChange: (constraints: LetterFrequencyConstraint[]) => void;
  onSearch: () => void;
}

export function LetterFrequencyExploreControls({
  mode,
  singleConstraint,
  singleMatch,
  multiConstraints,
  isSearching,
  onModeChange,
  onSingleConstraintChange,
  onSingleMatchChange,
  onMultiConstraintsChange,
  onSearch,
}: Props) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm" aria-labelledby="frequency-controls-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Browse</p>
      <h2 id="frequency-controls-heading" className="mt-1 text-xl font-semibold">Choose a letter pattern</h2>
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Frequency pattern type">
        <button
          type="button"
          aria-pressed={mode === "single"}
          onClick={() => onModeChange("single")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${mode === "single" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
        >
          Single letter
        </button>
        <button
          type="button"
          aria-pressed={mode === "multi"}
          onClick={() => onModeChange("multi")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${mode === "multi" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
        >
          Multi-Letter
        </button>
      </div>
      {mode === "single" ? (
        <SingleLetterFrequencyControls
          constraint={singleConstraint}
          match={singleMatch}
          isSearching={isSearching}
          onConstraintChange={onSingleConstraintChange}
          onMatchChange={onSingleMatchChange}
          onSearch={onSearch}
        />
      ) : (
        <MultiLetterFrequencyControls
          constraints={multiConstraints}
          isSearching={isSearching}
          onConstraintsChange={onMultiConstraintsChange}
          onSearch={onSearch}
        />
      )}
    </section>
  );
}
