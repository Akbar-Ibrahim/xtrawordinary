export function normalizeExploreWord(value: string): string {
  return value.trim().toUpperCase();
}

export function isAlphabeticWord(value: string): boolean {
  return /^[A-Z]+$/.test(value);
}

export function canFormFromLetters(baseWord: string, candidate: string): boolean {
  if (!candidate || candidate.length > baseWord.length) return false;

  const available = new Map<string, number>();
  for (const letter of normalizeExploreWord(baseWord)) {
    available.set(letter, (available.get(letter) ?? 0) + 1);
  }

  for (const letter of normalizeExploreWord(candidate)) {
    const count = available.get(letter) ?? 0;
    if (count === 0) return false;
    available.set(letter, count - 1);
  }
  return true;
}

export function getGameplayExclusion(
  word: string,
  acceptedDerivatives: ReadonlySet<string>,
  baseEligibleForGameplay: boolean,
): string | null {
  if (!baseEligibleForGameplay) return "base_not_in_regular_word_maker_pool";
  if (word.length < 3) return "below_minimum_length";
  if (!acceptedDerivatives.has(normalizeExploreWord(word))) {
    return "not_in_word_maker_derivatives";
  }
  return null;
}
