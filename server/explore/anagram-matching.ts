import { normalizeExploreWord } from "./letter-matching";

export function hasSameLetters(left: string, right: string): boolean {
  const normalizedLeft = normalizeExploreWord(left);
  const normalizedRight = normalizeExploreWord(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return [...normalizedLeft].sort().join("") === [...normalizedRight].sort().join("");
}
