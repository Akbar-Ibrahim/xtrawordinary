import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPLORE_MAX_WORD_LENGTH_FILTER } from "@shared/explore-limits";

export interface WordSplitSearchFormValues {
  targetWord: string;
  wordCount: string;
  minWordLength: string;
}

export function SplitSearchForm({
  values,
  isSearching,
  onChange,
  onSubmit,
}: {
  values: WordSplitSearchFormValues;
  isSearching: boolean;
  onChange: (values: WordSplitSearchFormValues) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <Label htmlFor="word-split-target">Dictionary word</Label>
        <Input
          id="word-split-target"
          autoComplete="off"
          className="mt-2 uppercase"
          maxLength={100}
          placeholder="e.g. EDUCATION"
          value={values.targetWord}
          onChange={(event) => onChange({ ...values, targetWord: event.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <Label htmlFor="word-split-count">Words in each split</Label>
          <Input
            id="word-split-count"
            className="mt-2"
            type="number"
            min={2}
            max={100}
            placeholder="Any number"
            value={values.wordCount}
            onChange={(event) => onChange({ ...values, wordCount: event.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">Leave blank to see every split size.</p>
        </div>
        <div>
          <Label htmlFor="word-split-min-length">Minimum letters per word</Label>
          <Input
            id="word-split-min-length"
            className="mt-2"
            type="number"
            min={1}
            max={EXPLORE_MAX_WORD_LENGTH_FILTER}
            value={values.minWordLength}
            onChange={(event) => onChange({ ...values, minWordLength: event.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Lower this to include shorter dictionary words.
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <ExploreIconButton
          type="submit"
          disabled={isSearching}
          label="Find word splits"
          isLoading={isSearching}
        />
      </div>
    </form>
  );
}
