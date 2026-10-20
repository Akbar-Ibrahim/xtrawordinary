export const LETTER_POOL_SESSION_VARIANTS = [
  {
    variation: "with-pool",
    label: "With Pool · 1 Decoy",
    slug: "letter-pool-decoys-1",
  },
  {
    variation: "without-pool",
    label: "Blind (No Pool)",
    slug: "letter-pool-without-pool",
  },
] as const;

export const LETTER_POOL_DECOY_LEVELS = [
  {
    decoyCount: 1,
    label: "1 Decoy",
    difficulty: "Easy",
    slug: "letter-pool-decoys-1",
  },
  {
    decoyCount: 2,
    label: "2 Decoys",
    difficulty: "Medium",
    slug: "letter-pool-decoys-2",
  },
  {
    decoyCount: 3,
    label: "3 Decoys",
    difficulty: "Hard",
    slug: "letter-pool-decoys-3",
  },
] as const;

export type LetterPoolDecoyCount =
  (typeof LETTER_POOL_DECOY_LEVELS)[number]["decoyCount"];

export function getLetterPoolDecoyCount(value: unknown): LetterPoolDecoyCount {
  return LETTER_POOL_DECOY_LEVELS.some((level) => level.decoyCount === value)
    ? value as LetterPoolDecoyCount
    : 1;
}

export type LetterPoolVariation =
  (typeof LETTER_POOL_SESSION_VARIANTS)[number]["variation"];

export const LETTER_POOL_GAME_MODES = [
  ...LETTER_POOL_DECOY_LEVELS.map(({ label, slug }) => ({
    label: `With Pool · ${label}`,
    slug,
  })),
];

export function getLetterPoolLeaderboardSlug(
  variation: LetterPoolVariation,
  decoyCount: LetterPoolDecoyCount = 1,
): string {
  if (variation === "with-pool") {
    const level = LETTER_POOL_DECOY_LEVELS.find(
      (candidate) => candidate.decoyCount === decoyCount,
    );
    if (!level) {
      throw new RangeError(`Unsupported Letter Pool decoy count: ${decoyCount}`);
    }
    return level.slug;
  }

  const mode = LETTER_POOL_SESSION_VARIANTS.find(
    (candidate) => candidate.variation === variation,
  );
  if (!mode) {
    throw new RangeError(`Unsupported Letter Pool variation: ${variation}`);
  }
  return mode.slug;
}

export function createLetterPool(
  word: string,
  decoyCount: number,
  random: () => number = Math.random,
): string[] {
  const targetLetters = word.toUpperCase().replace(/[^A-Z]/g, "").split("");
  if (targetLetters.length === 0) {
    throw new RangeError("A Letter Pool target must contain at least one letter");
  }
  if (!Number.isInteger(decoyCount) || decoyCount < 0) {
    throw new RangeError("Letter Pool decoy count must be a non-negative integer");
  }

  const targetLetterSet = new Set(targetLetters);
  const decoyCandidates = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    .split("")
    .filter((letter) => !targetLetterSet.has(letter));
  if (decoyCount > decoyCandidates.length) {
    throw new RangeError("Not enough distinct decoy letters for this target");
  }

  const shuffledDecoys = shuffle(decoyCandidates, random).slice(0, decoyCount);
  return shuffle([...targetLetters, ...shuffledDecoys], random);
}

export function filterWordsWithoutAnagrams<T extends { word: string }>(
  words: T[],
): T[] {
  const signatures = words.map(({ word }) => getAnagramSignature(word));
  const signatureCounts = new Map<string, number>();

  for (const signature of signatures) {
    if (signature) {
      signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
    }
  }

  return words.filter((_, index) => {
    const signature = signatures[index];
    return signature.length > 0 && signatureCounts.get(signature) === 1;
  });
}

export function canFormWordFromLetters(word: string, letters: string[]): boolean {
  const normalizedWord = word.toUpperCase().replace(/[^A-Z]/g, "");
  const availableCounts = new Map<string, number>();

  for (const letter of letters) {
    const normalizedLetter = letter.toUpperCase().replace(/[^A-Z]/g, "");
    if (!normalizedLetter) continue;
    for (const character of normalizedLetter) {
      availableCounts.set(
        character,
        (availableCounts.get(character) ?? 0) + 1,
      );
    }
  }

  for (const character of normalizedWord) {
    const count = availableCounts.get(character) ?? 0;
    if (count === 0) return false;
    availableCounts.set(character, count - 1);
  }
  return normalizedWord.length > 0;
}

export function chooseRandomUnfilledLetterIndex(
  filledLetters: Array<string | null>,
  random: () => number = Math.random,
): number | null {
  const availableIndexes = filledLetters
    .map((letter, index) => letter === null ? index : -1)
    .filter((index) => index >= 0);
  if (availableIndexes.length === 0) return null;
  return availableIndexes[Math.floor(random() * availableIndexes.length)];
}

function getAnagramSignature(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, "").split("").sort().join("");
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
