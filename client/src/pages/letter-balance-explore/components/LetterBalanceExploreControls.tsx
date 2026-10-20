import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LetterBalanceExploreFilters } from "../types";

const PATTERNS: Array<{ value: LetterBalanceExploreFilters["category"]; label: string }> = [
  { value: "vowel_count", label: "Exact number of vowels" },
  { value: "consonant_count", label: "Exact number of consonants" },
  { value: "start_end_vowel", label: "Starts and ends with a vowel" },
  { value: "start_end_consonant", label: "Starts and ends with a consonant" },
  { value: "start_vowel_end_consonant", label: "Starts with a vowel, ends with a consonant" },
  { value: "start_consonant_end_vowel", label: "Starts with a consonant, ends with a vowel" },
  { value: "locked_balance", label: "Set length and consonant count" },
];

interface Props {
  filters: LetterBalanceExploreFilters;
  isSearching: boolean;
  onChange: (filters: LetterBalanceExploreFilters) => void;
  onSearch: (filters: LetterBalanceExploreFilters) => void;
}

export function LetterBalanceExploreControls({
  filters,
  isSearching,
  onChange,
  onSearch,
}: Props) {
  const usesCount = filters.category === "vowel_count" || filters.category === "consonant_count";
  const isLocked = filters.category === "locked_balance";
  const countValue = usesCount ? filters.count : filters.consonantCount;
  const validCount = countValue !== undefined
    && countValue >= 0
    && (filters.length === undefined || countValue <= filters.length);
  const validLockedBalance = !isLocked
    || (filters.length !== undefined
      && filters.consonantCount !== undefined
      && filters.consonantCount >= 0
      && filters.consonantCount <= filters.length);
  const canSearch = (usesCount ? validCount : true) && validLockedBalance;
  const countLabel = filters.category === "vowel_count" ? "Vowel count" : "Consonant count";

  function update<K extends keyof LetterBalanceExploreFilters>(
    key: K,
    value: LetterBalanceExploreFilters[K],
  ) {
    const next = { ...filters, [key]: value };
    if (key === "category") {
      next.count = value === "vowel_count" || value === "consonant_count" ? 2 : undefined;
      next.consonantCount = value === "locked_balance" ? 2 : undefined;
      if (value === "locked_balance" && next.length === undefined) next.length = 4;
    }
    onChange(next);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSearch) onSearch(filters);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Choose a word pattern</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="letter-balance-pattern">Pattern</Label>
            <select
              id="letter-balance-pattern"
              aria-label="Word pattern"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filters.category}
              onChange={(event) => update("category", event.target.value as LetterBalanceExploreFilters["category"])}
            >
              {PATTERNS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {usesCount && (
            <div className="space-y-2">
              <Label htmlFor="letter-balance-count">{countLabel}</Label>
              <Input
                id="letter-balance-count"
                aria-label="Exact count"
                type="number"
                min={0}
                max={100}
                value={filters.count ?? ""}
                onChange={(event) => update("count", event.target.value === "" ? undefined : Number(event.target.value))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="letter-balance-length">
              Word length{isLocked ? "" : " (optional)"}
            </Label>
            <Input
              id="letter-balance-length"
              aria-label="Word length"
              type="number"
              min={1}
              max={100}
              placeholder={isLocked ? "For example, 6" : "Any length"}
              value={filters.length ?? ""}
              onChange={(event) => update("length", event.target.value === "" ? undefined : Number(event.target.value))}
              required={isLocked}
            />
            <p className="text-xs text-muted-foreground">
              Explore includes short words; normal game length limits do not apply.
            </p>
          </div>

          {isLocked && (
            <div className="space-y-2">
              <Label htmlFor="letter-balance-consonants">Exact consonant count</Label>
              <Input
                id="letter-balance-consonants"
                aria-label="Exact consonant count"
                type="number"
                min={0}
                max={filters.length ?? 100}
                value={filters.consonantCount ?? ""}
                onChange={(event) => update("consonantCount", event.target.value === "" ? undefined : Number(event.target.value))}
                required
              />
            </div>
          )}

          {!canSearch && (
            <p role="alert" className="text-sm text-destructive">
              {isLocked
                ? "Choose a word length and a consonant count no greater than that length."
                : "Enter a count no greater than the selected word length."}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!canSearch || isSearching}>
            {isSearching ? "Searching…" : "Browse words"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
