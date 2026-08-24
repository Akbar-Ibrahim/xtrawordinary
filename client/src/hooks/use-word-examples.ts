import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export type WordExamplesGame =
  | "letter-hunt"
  | "letter-dodge"
  | "letter-position"
  | "no-repeats"
  | "word-length"
  | "letter-frequency"
  | "letter-balance";

export type DatabaseWordExamplesRequest =
  | {
      game: "word-length";
      length: number;
      variation: number;
      startsWith?: string;
      endsWith?: string;
      contains?: string;
    }
  | {
      game: "letter-frequency";
      mode: "exact" | "minimum";
      constraints: Array<{ letter: string; count: number }>;
    }
  | {
      game: "letter-balance";
      category:
        | "consonant_count"
        | "vowel_count"
        | "start_end_vowel"
        | "start_end_consonant"
        | "start_vowel_end_consonant"
        | "start_consonant_end_vowel"
        | "locked_balance"
        | "custom";
      length?: number;
      vowelCount?: number;
      consonantCount?: number;
    };

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
  databaseRequest?: DatabaseWordExamplesRequest,
) {
  const [enabled, setEnabled] = useState(false);

  const resolvedLetters = letters.filter(l => l && l.toUpperCase() !== "ANY");

  const isLp = game === "letter-position";
  const isNr = game === "no-repeats";
  const isDatabase = databaseRequest !== undefined;
  const lpReady = isLp && resolvedLetters.length === 1 && position !== undefined && position >= 1;
  const nrReady = isNr && challenge !== undefined;
  const availability = useQuery<{ available: boolean }>({
    queryKey: ["/api/games/database-word-examples/availability"],
    queryFn: async () => {
      const res = await fetch("/api/games/database-word-examples/availability", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check database word-example availability");
      return res.json();
    },
    enabled: isDatabase,
    staleTime: Infinity,
    retry: false,
  });

  const query = useQuery<WordExamplesResult>({
    queryKey: isDatabase
      ? ["/api/games/database-word-examples", databaseRequest, limit]
      : isLp
      ? ["/api/games/letter-position/examples", resolvedLetters[0], position, limit]
      : isNr
        ? ["/api/games/no-repeats/examples", challenge, [...resolvedLetters].sort().join(","), limit]
        : ["/api/games/word-examples", game, [...resolvedLetters].sort().join(","), limit],
    queryFn: async () => {
      if (databaseRequest) {
        const params = new URLSearchParams({
          game: databaseRequest.game,
          limit: String(limit),
        });
        if (databaseRequest.game === "word-length") {
          params.set("length", String(databaseRequest.length));
          params.set("variation", String(databaseRequest.variation));
          if (databaseRequest.startsWith) params.set("startsWith", databaseRequest.startsWith);
          if (databaseRequest.endsWith) params.set("endsWith", databaseRequest.endsWith);
          if (databaseRequest.contains) params.set("contains", databaseRequest.contains);
        } else if (databaseRequest.game === "letter-frequency") {
          params.set("mode", databaseRequest.mode);
          params.set("constraints", databaseRequest.constraints.map(({ letter, count }) => `${letter}:${count}`).join(","));
        } else {
          params.set("category", databaseRequest.category);
          if (databaseRequest.length !== undefined) params.set("length", String(databaseRequest.length));
          if (databaseRequest.vowelCount !== undefined) params.set("vowelCount", String(databaseRequest.vowelCount));
          if (databaseRequest.consonantCount !== undefined) params.set("consonantCount", String(databaseRequest.consonantCount));
        }
        const res = await fetch(`/api/games/database-word-examples?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch database word examples");
        return res.json();
      }
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
    enabled: enabled && (isDatabase ? availability.data?.available === true : isLp ? lpReady : isNr ? nrReady : resolvedLetters.length > 0),
    staleTime: Infinity,
  });

  return {
    ...query,
    resolvedLetters,
    trigger: () => setEnabled(true),
    isTriggered: enabled,
    databaseAvailable: availability.data?.available === true,
    isDatabaseAvailabilityLoading: availability.isLoading,
  };
}
