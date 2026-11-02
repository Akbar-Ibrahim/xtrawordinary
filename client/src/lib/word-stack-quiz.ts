import { makeSeededRng } from "./seeded-rng";
import type { WordStackChallenge } from "@shared/word-stack";

export type WordStackQuizLength = "short" | "medium" | "full";

export function normalizeWordStackQuizLength(value: unknown): WordStackQuizLength {
  return value === "short" || value === "medium" || value === "full" ? value : "full";
}

export function getWordStackQuizLengthLabel(length: WordStackQuizLength): string {
  switch (length) {
    case "short":
      return "Short · 5 puzzles";
    case "medium":
      return "Medium · 10 puzzles";
    case "full":
      return "Full puzzle set";
  }
}

export function createWordStackQuizPlan<T extends { targetWord: string }>(
  puzzles: T[],
  seed: number,
  initialChallenge?: WordStackChallenge,
  length: WordStackQuizLength = "full",
): { challengeType: WordStackChallenge; orderedPuzzles: T[] } {
  const rng = makeSeededRng(seed);
  const seededChallenge: WordStackChallenge = rng() < 0.5 ? "build-up" : "break-down";
  const orderedPuzzles = [...puzzles];

  for (let i = orderedPuzzles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [orderedPuzzles[i], orderedPuzzles[j]] = [orderedPuzzles[j], orderedPuzzles[i]];
  }

  const puzzleLimit = length === "short" ? 5 : length === "medium" ? 10 : orderedPuzzles.length;

  return {
    challengeType: initialChallenge ?? seededChallenge,
    orderedPuzzles: orderedPuzzles.slice(0, puzzleLimit),
  };
}
