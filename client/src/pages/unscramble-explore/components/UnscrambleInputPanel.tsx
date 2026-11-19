import type { FormEvent } from "react";
import { Shuffle } from "lucide-react";
import { ExploreIconButton } from "@/components/explore/ExploreIconButton";

interface Props {
  letters: string;
  examples: string[];
  examplesSource?: "preview" | "database";
  examplesLoading: boolean;
  examplesError: boolean;
  submitting: boolean;
  onLettersChange: (value: string) => void;
  onSubmit: () => void;
  onChooseExample: (scramble: string) => void;
  onRetryExamples: () => void;
}

export function UnscrambleInputPanel({
  letters,
  examples,
  examplesSource,
  examplesLoading,
  examplesError,
  submitting,
  onLettersChange,
  onSubmit,
  onChooseExample,
  onRetryExamples,
}: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <aside className="wmx-panel wmx-controls" aria-label="Unscramble letters">
      <label className="wmx-section-label" htmlFor="unscramble-letters">Scrambled letters</label>
      <form onSubmit={submit}>
        <div className="wmx-search-wrap">
          <Shuffle className="wmx-search-icon" size={17} aria-hidden="true" />
          <input
            id="unscramble-letters"
            type="text"
            value={letters}
            onChange={(event) => onLettersChange(event.target.value)}
            placeholder="e.g. NITSEL"
            autoComplete="off"
            autoCapitalize="characters"
            aria-describedby="unscramble-help"
            maxLength={100}
          />
        </div>
        <p id="unscramble-help" className="wmx-note">
          Enter letters in any order. Matches must use every letter exactly once.
        </p>
        <div className="mt-2 flex justify-center">
          <ExploreIconButton
            type="submit"
            disabled={!letters || submitting}
            label="Find matching words"
            isLoading={submitting}
          />
        </div>
      </form>

      <div className="wmx-session" aria-labelledby="unscramble-samples-heading">
        <h3 id="unscramble-samples-heading">{examplesSource === "preview" ? "Try a preview sample" : "Try a database sample"}</h3>
        {examplesLoading ? (
          <p className="wmx-note" role="status">Loading sample scrambles…</p>
        ) : examplesError ? (
          <p className="wmx-error" role="alert">
            Could not load samples.
            <button type="button" className="wmx-retry" onClick={onRetryExamples}>Try again</button>
          </p>
        ) : examples.length ? (
          <>
            {examplesSource === "preview" && (
              <p className="wmx-note">Small preview sample. With MySQL enabled, examples come from the connected dictionary.</p>
            )}
            <div className="wmx-scramble-samples">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="wmx-scramble-sample"
                  onClick={() => onChooseExample(example)}
                  aria-label={`Try scrambled letters ${example}`}
                >
                  {example}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="wmx-note">No sample words are available.</p>
        )}
      </div>
    </aside>
  );
}
