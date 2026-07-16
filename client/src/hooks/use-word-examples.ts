import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export type WordExamplesGame = "letter-hunt" | "letter-dodge";

export interface WordExamplesResult {
  words: string[];
  total: number;
}

export function useWordExamples(
  game: WordExamplesGame,
  letters: string[],
  limit: number = 10
) {
  const [enabled, setEnabled] = useState(false);

  const resolvedLetters = letters.filter(l => l && l.toUpperCase() !== "ANY");

  const query = useQuery<WordExamplesResult>({
    queryKey: ["/api/games/word-examples", game, [...resolvedLetters].sort().join(","), limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        game,
        letters: resolvedLetters.join(","),
        limit: String(limit),
      });
      const res = await fetch(`/api/games/word-examples?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch word examples");
      return res.json();
    },
    enabled: enabled && resolvedLetters.length > 0,
    staleTime: Infinity,
  });

  return {
    ...query,
    resolvedLetters,
    trigger: () => setEnabled(true),
    isTriggered: enabled,
  };
}
