import type { LetterFrequencyConstraint, LetterFrequencyMatch } from "./types";

export function describeFrequencyRule(
  constraints: LetterFrequencyConstraint[],
  match: LetterFrequencyMatch,
): string {
  return constraints
    .map(({ letter, count }) => {
      const countDescription = `${match === "minimum" ? "at least " : ""}${count}`;
      return `${countDescription} ${letter}${count === 1 ? "" : "s"}`;
    })
    .join(" and ");
}
