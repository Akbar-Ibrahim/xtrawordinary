import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export type WordExamplesGame = "letter-hunt" | "letter-dodge" | "letter-position" | "no-repeats";

export interface WordExamplesResult {
  words: string[];
  total: number;
}

export function useWordExamples(
  game: WordExamplesGame,
  letters: string[],
  limit: number = 10,
  position?: number,
  challenge?: number,
) {
  const [enabled, setEnabled] = useState(false);

  const resolvedLetters = letters.filter(l => l && l.toUpperCase() !== "ANY");

  const isLp = game === "letter-position";
  const isNr = game === "no-repeats";
  const lpReady = isLp && resolvedLetters.length === 1 && position !== undefined && position >= 1;
  const nrReady = isNr && challenge !== undefined;

  const query = useQuery<WordExamplesResult>({
    queryKey: isLp
      ? ["/api/games/letter-position/examples", resolvedLetters[0], position, limit]
      : isNr
        ? ["/api/games/no-repeats/examples", challenge, [...resolvedLetters].sort().join(","), limit]
        : ["/api/games/word-examples", game, [...resolvedLetters].sort().join(","), limit],
    queryFn: async () => {
      if (isLp) {
        const params = new URLSearchParams({
          letter: resolvedLetters[0],
          position: String(position),
          limit: String(limit),
        });
        const res = await fetch(`/api/games/letter-position/examples?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch letter position examples");
        return res.json();
      }
      if (isNr) {
        const params = new URLSearchParams({
          challenge: String(challenge),
          limit: String(limit),
        });
        if (resolvedLetters.length > 0) params.set("requiredLetters", resolvedLetters.join(","));
        const res = await fetch(`/api/games/no-repeats/examples?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch no-repeats examples");
        return res.json();
      }
      const params = new URLSearchParams({
        game,
        letters: resolvedLetters.join(","),
        limit: String(limit),
      });
      const res = await fetch(`/api/games/word-examples?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch word examples");
      return res.json();
    },
    enabled: enabled && (isLp ? lpReady : isNr ? nrReady : resolvedLetters.length > 0),
    staleTime: Infinity,
  });

  return {
    ...query,
    resolvedLetters,
    trigger: () => setEnabled(true),
    isTriggered: enabled,
  };
}
