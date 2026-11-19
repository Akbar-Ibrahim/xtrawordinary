import { Plus, X } from "lucide-react";
import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH,
  WORD_ROOTS_EXPLORE_MAX_INPUTS,
  WORD_ROOTS_EXPLORE_MAX_WORD_LENGTH,
  WORD_ROOTS_EXPLORE_MIN_INPUTS,
} from "@shared/word-roots-explore";

export function RootSearchForm({
  values,
  length,
  isSearching,
  onChange,
  onLengthChange,
  onSubmit,
  onAdd,
  onRemove,
}: {
  values: string[];
  length: number | null;
  isSearching: boolean;
  onChange: (index: number, value: string) => void;
  onLengthChange: (length: number | null) => void;
  onSubmit: () => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
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
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Find a shared base word</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter {WORD_ROOTS_EXPLORE_MIN_INPUTS}–{WORD_ROOTS_EXPLORE_MAX_INPUTS} different words.
            </p>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-foreground" aria-live="polite">
            {values.length} / {WORD_ROOTS_EXPLORE_MAX_INPUTS}
          </span>
        </div>
      </div>

      <div>
        <Label htmlFor="word-roots-length">Base word length</Label>
        <select
          id="word-roots-length"
          className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={length === null ? "" : String(length)}
          onChange={(event) => onLengthChange(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">Any length</option>
          {Array.from({ length: WORD_ROOTS_EXPLORE_MAX_BASE_WORD_LENGTH }, (_, index) => index + 1).map((wordLength) => (
            <option key={wordLength} value={wordLength}>
              {wordLength} {wordLength === 1 ? "letter" : "letters"}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          This filters the base words returned when you search.
        </p>
      </div>

      <div className="space-y-3">
        {values.map((value, index) => (
          <div className="flex items-end gap-2" key={index}>
            <div className="min-w-0 flex-1">
              <Label htmlFor={`word-roots-input-${index}`} className="text-xs text-muted-foreground">
                Word {index + 1}
              </Label>
              <Input
                id={`word-roots-input-${index}`}
                autoComplete="off"
                className="mt-1.5 uppercase"
                maxLength={WORD_ROOTS_EXPLORE_MAX_WORD_LENGTH}
                placeholder={index === 0 ? "e.g. BUT" : "e.g. NOT"}
                value={value}
                onChange={(event) => onChange(index, event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Remove word ${index + 1}`}
              title={values.length <= WORD_ROOTS_EXPLORE_MIN_INPUTS
                ? `At least ${WORD_ROOTS_EXPLORE_MIN_INPUTS} words are required`
                : `Remove word ${index + 1}`}
              disabled={values.length <= WORD_ROOTS_EXPLORE_MIN_INPUTS}
              onClick={() => onRemove(index)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={values.length >= WORD_ROOTS_EXPLORE_MAX_INPUTS}
        onClick={onAdd}
      >
        <Plus aria-hidden="true" /> Add a word
      </Button>

      <p className="rounded-lg bg-muted/70 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Results are base words linked to every entry through the dictionary’s Word Roots relationships.
      </p>

      <div className="flex justify-center">
        <ExploreIconButton
          type="submit"
          disabled={isSearching}
          label="Find Word Roots base words"
          isLoading={isSearching}
        />
      </div>
    </form>
  );
}
