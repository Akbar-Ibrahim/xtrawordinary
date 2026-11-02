import { anagramWordSets } from "../game-data";

// Keep a deliberately small Explore-only fixture. Do not expand normal gameplay data.
export const anagramExplorePreviewRows = [
  ...anagramWordSets,
  { original: "NO", anagrams: ["ON"] },
  { original: "RANGE", anagrams: ["ANGER"] },
  { original: "NOTE", anagrams: ["TONE"] },
  { original: "PACE", anagrams: ["CAPE"] },
  { original: "QUIZ", anagrams: [] },
];
