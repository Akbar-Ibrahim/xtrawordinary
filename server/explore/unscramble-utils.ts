export function normalizeScrambledLetters(value: string): string {
  return value.trim().toUpperCase();
}

export function countLetters(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of normalizeScrambledLetters(value)) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return counts;
}

export function shuffleLetters(value: string, random: () => number = Math.random): string {
  const normalized = normalizeScrambledLetters(value);
  const letters = [...normalized];
  for (let index = letters.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [letters[index], letters[swapIndex]] = [letters[swapIndex], letters[index]];
  }

  const shuffled = letters.join("");
  if (shuffled !== normalized || new Set(letters).size < 2) return shuffled;
  return `${normalized.slice(1)}${normalized[0]}`;
}
