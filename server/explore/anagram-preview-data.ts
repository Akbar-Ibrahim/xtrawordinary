import { anagramWordSets } from "../game-data";

// Keep a deliberately small Explore-only fixture. Do not expand normal gameplay data.
export const anagramExplorePreviewRows = [
  ...anagramWordSets,
  { original: "NO", anagrams: ["ON"] },
];
