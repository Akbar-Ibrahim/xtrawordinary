import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import type { ExploreDirection, ShellWordExploreCheck, ShellWordExploreDepth } from "../types";

interface Props {
  direction: ExploreDirection;
  depth: ShellWordExploreDepth;
  relationshipName: string;
  checkWord: (input: { depth: ShellWordExploreDepth; direction: ExploreDirection; word: string }) => Promise<ShellWordExploreCheck>;
}

export function ExploreWordCheck({ direction, depth, relationshipName, checkWord }: Props) {
  const [word, setWord] = useState("");
  const mutation = useMutation({ mutationFn: checkWord });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = word.replace(/[^a-z]/gi, "").toUpperCase();
    if (normalized) {
      mutation.reset();
      mutation.mutate({ depth, direction, word: normalized });
    }
  }
  const result = mutation.data;
  return (
    <section className="rounded-2xl border border-[#d8d0c3] bg-[#f8f4eb] p-5 sm:p-6" aria-labelledby="word-check-heading">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#8e4532]">Exact lookup</p>
      <h2 id="word-check-heading" className="mt-1 font-serif text-2xl text-[#263b39]">Check a word</h2>
      <p className="mt-1 text-sm leading-relaxed text-[#58625b]">A direct dictionary and depth-{depth} relationship check. No suggestions or partial matches.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="relationship-word-check" className="sr-only">Exact word to check</label>
        <input id="relationship-word-check" value={word} onChange={(event) => setWord(event.target.value.replace(/[^a-z]/gi, "").toUpperCase())} placeholder="Type an exact word" autoComplete="off" autoCapitalize="characters" maxLength={100} className="min-w-0 flex-1 rounded-lg border border-[#d8d0c3] bg-[#fffdf8] px-3 py-2.5 font-mono uppercase tracking-wider text-[#263b39] outline-none focus-visible:ring-2 focus-visible:ring-[#aa6048]" />
        <ExploreIconButton
          type="submit"
          disabled={!word.trim() || mutation.isPending}
          label="Check exact word"
          isLoading={mutation.isPending}
          className="bg-[#263b39] text-[#fffdf8] hover:bg-[#344c48]"
        />
      </form>
      {mutation.isError && <p className="mt-3 text-sm text-[#9b4539]" role="alert">{mutation.error.message || "Could not check this word. Try again."}</p>}
      {mutation.isSuccess && result && <CheckResult result={result} relationshipName={relationshipName} />}
    </section>
  );
}

function CheckResult({ result, relationshipName }: { result: ShellWordExploreCheck; relationshipName: string }) {
  return (
    <div className="mt-4 rounded-xl border border-[#ddd4c6] bg-[#fffdf8] p-4" role="status" aria-live="polite">
      <p className="font-mono text-lg font-bold tracking-wider text-[#263b39]">{result.word}</p>
      <p className="mt-2 text-sm text-[#53605a]">In dictionary <strong className={result.dictionaryMatch ? "text-[#456d57]" : "text-[#9b4539]"}>{result.dictionaryMatch ? "— yes" : "— no"}</strong></p>
      <p className="mt-1 text-sm text-[#53605a]">Recorded depth-{result.depth} {relationshipName.toLowerCase()} relationship <strong className={result.relationshipMatch ? "text-[#456d57]" : "text-[#9b4539]"}>{result.relationshipMatch ? "— yes" : "— no"}</strong></p>
      {result.relationshipMatch && result.direction === "shell" && result.innerWord && <p className="mt-3 border-t border-[#ece6dc] pt-3 text-sm text-[#53605a]">Inner word <span className="ml-2 font-mono font-bold uppercase text-[#263b39]">{result.innerWord}</span></p>}
      {result.relationshipMatch && result.direction === "inner" && <p className="mt-3 border-t border-[#ece6dc] pt-3 text-sm text-[#53605a]">Linked outer words <span className="ml-2 font-mono font-bold text-[#263b39]">{result.linkedShellCount}</span></p>}
      {result.source === "preview" && <p className="mt-3 text-xs text-[#856d62]">Checked against the preview dictionary sample.</p>}
    </div>
  );
}
