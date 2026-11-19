import type { FormEvent } from "react";
import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import type { ExploreBrowseInput, ExploreDirection, ShellWordExploreDepth } from "../types";

interface Props {
  filters: ExploreBrowseInput;
  isSearching: boolean;
  onChange: (filters: ExploreBrowseInput) => void;
  onDepthChange: (depth: ShellWordExploreDepth) => void;
  onSearch: (filters: ExploreBrowseInput) => void;
}

export function ShellWordsControls({ filters, isSearching, onChange, onDepthChange, onSearch }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch({ ...filters, word: filters.word?.trim().toUpperCase() || undefined });
  }
  return (
    <section className="rounded-2xl border border-[#d8d0c3] bg-[#fffdf8] p-5 shadow-[0_12px_35px_rgba(63,49,32,0.06)] sm:p-6" aria-labelledby="shell-browse-heading">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#8e4532]">Browse index · depths 1–4</p>
      <h2 id="shell-browse-heading" className="mt-1 font-serif text-2xl text-[#263b39]">Set your lens</h2>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="shell-explore-depth" className="mb-1.5 block text-sm font-semibold text-[#344c48]">Relationship depth</label>
          <select
            id="shell-explore-depth"
            value={filters.depth}
            onChange={(event) => onDepthChange(Number(event.target.value) as ShellWordExploreDepth)}
            className="w-full rounded-lg border border-[#d8d0c3] bg-[#faf7f0] px-3 py-2.5 text-[#263b39] outline-none focus-visible:ring-2 focus-visible:ring-[#aa6048]"
          >
            {[1, 2, 3, 4].map((depth) => <option key={depth} value={depth}>Depth {depth} · remove {depth} letter{depth === 1 ? "" : "s"} from each end</option>)}
          </select>
        </div>
        <DirectionSelector direction={filters.direction} onChange={(direction) => onChange({ ...filters, direction })} />
        <div>
          <label htmlFor="shell-exact-filter" className="mb-1.5 block text-sm font-semibold text-[#344c48]">Exact word <span className="font-normal text-[#5e655f]">(optional)</span></label>
          <input id="shell-exact-filter" value={filters.word ?? ""} onChange={(event) => onChange({ ...filters, word: event.target.value.replace(/[^a-z]/gi, "").toUpperCase() })} placeholder="Any word" autoComplete="off" autoCapitalize="characters" className="w-full rounded-lg border border-[#d8d0c3] bg-[#faf7f0] px-3 py-2.5 font-mono uppercase tracking-wider text-[#263b39] outline-none focus-visible:ring-2 focus-visible:ring-[#aa6048]" />
          <p className="mt-1 text-xs text-[#5e655f]">Matches the word on the selected side of the relationship.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <BoundaryInput id="shell-first-letter" label={`Outer starts with (${filters.depth})`} depth={filters.depth} value={filters.first ?? ""} onChange={(first) => onChange({ ...filters, first: first || undefined })} />
          <BoundaryInput id="shell-last-letter" label={`Outer ends with (${filters.depth})`} depth={filters.depth} value={filters.last ?? ""} onChange={(last) => onChange({ ...filters, last: last || undefined })} />
        </div>
        <div className="flex justify-center">
          <ExploreIconButton
            type="submit"
            disabled={isSearching}
            label="Browse relationships"
            isLoading={isSearching}
            className="bg-[#aa6048] text-[#fffaf2] hover:bg-[#8e4f3e]"
          />
        </div>
      </form>
    </section>
  );
}

function DirectionSelector({ direction, onChange }: { direction: ExploreDirection; onChange: (direction: ExploreDirection) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-[#344c48]">Search by</legend>
      <div className="grid grid-cols-2 rounded-lg border border-[#d8d0c3] bg-[#f5f0e7] p-1">
        {(["shell", "inner"] as const).map((value) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => onChange(value)} className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${direction === value ? "bg-[#263b39] text-[#fffdf8] shadow-sm" : "text-[#58625b] hover:text-[#263b39]"}`}>{value === "shell" ? "Outer / shell" : "Inner word"}</button>)}
      </div>
    </fieldset>
  );
}

function BoundaryInput({ id, label, depth, value, onChange }: { id: string; label: string; depth: ShellWordExploreDepth; value: string; onChange: (value: string) => void }) {
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[#344c48]">{label}</label>
    <input id={id} value={value} onChange={(event) => onChange(event.target.value.replace(/[^a-z]/gi, "").slice(0, depth).toUpperCase())} placeholder={`${"A".repeat(depth)}`} maxLength={depth} autoComplete="off" className="w-full rounded-lg border border-[#d8d0c3] bg-[#faf7f0] px-3 py-2.5 font-mono uppercase tracking-[0.16em] text-[#263b39] outline-none focus-visible:ring-2 focus-visible:ring-[#aa6048]" />
  </div>;
}
