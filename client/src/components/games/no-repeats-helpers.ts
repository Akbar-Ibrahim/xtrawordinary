export const SURVIVAL_TIME_PER_WORD = 8;
export const SURVIVAL_TIME_OPTIONS = [
  { label: "Easy",   seconds: 15 },
  { label: "Normal", seconds: 8  },
  { label: "Hard",   seconds: 5  },
] as const;

export type Challenge = 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const CHALLENGE_CONFIG: Record<Challenge, { name: string; description: string; wordLength: number; requiredCount: number }> = {
  3: { name: "Challenge 3", description: "3-letter isograms · 1 required letter",  wordLength: 3, requiredCount: 1 },
  4: { name: "Challenge 4", description: "4-letter isograms · 2 required letters", wordLength: 4, requiredCount: 2 },
  5: { name: "Challenge 5", description: "5-letter isograms · 2 required letters", wordLength: 5, requiredCount: 2 },
  6: { name: "Challenge 6", description: "6-letter isograms · 2 required letters", wordLength: 6, requiredCount: 2 },
  7: { name: "Challenge 7", description: "7-letter isograms · 3 required letters", wordLength: 7, requiredCount: 3 },
  8: { name: "Challenge 8", description: "8-letter isograms · 3 required letters", wordLength: 8, requiredCount: 3 },
  9: { name: "Challenge 9", description: "9-letter isograms · 3 required letters", wordLength: 9, requiredCount: 3 },
};

export function hasUniqueLetters(word: string): boolean {
  const upper = word.toUpperCase();
  return new Set(upper.split("")).size === upper.length;
}

export function getNextChallenge(current: Challenge): Challenge | null {
  if (current >= 9) return null;
  return (current + 1) as Challenge;
}

// ── Required-letter generation ───────────────────────────────────────────────
const REQUIRED_VOWELS        = ["A", "E", "I", "O", "U"];
const REQUIRED_COMMON_CONS   = ["T", "N", "S", "R", "H", "L", "D", "C", "M", "F", "P"];
const REQUIRED_UNCOMMON_CONS = ["G", "W", "B", "Y", "K"];

// Weighted pool: vowels 3×, common consonants 2×, uncommon 1×
const REQUIRED_WEIGHTED_POOL: string[] = [
  ...REQUIRED_VOWELS,      ...REQUIRED_VOWELS,      ...REQUIRED_VOWELS,
  ...REQUIRED_COMMON_CONS, ...REQUIRED_COMMON_CONS,
  ...REQUIRED_UNCOMMON_CONS,
];

export function getRequiredLetterCount(wordLength: number): number {
  if (wordLength <= 3) return 1;
  if (wordLength <= 6) return 2;
  return 3;
}

export function generateRequiredLetters(wordLength: number, rng: () => number = Math.random): string[] {
  const count = getRequiredLetterCount(wordLength);
  const pool  = [...REQUIRED_WEIGHTED_POOL];
  const selected: string[] = [];

  // Always guarantee at least one vowel
  const vowelPool = [...REQUIRED_VOWELS];
  const vIdx      = Math.floor(rng() * vowelPool.length);
  const vowel     = vowelPool[vIdx];
  selected.push(vowel);
  for (let i = pool.length - 1; i >= 0; i--) {
    if (pool[i] === vowel) pool.splice(i, 1);
  }

  // Fill remaining slots, no duplicates
  while (selected.length < count && pool.length > 0) {
    const idx    = Math.floor(rng() * pool.length);
    const letter = pool[idx];
    selected.push(letter);
    for (let i = pool.length - 1; i >= 0; i--) {
      if (pool[i] === letter) pool.splice(i, 1);
    }
  }

  return selected;
}

export function validateRequiredLetters(
  word: string,
  requiredLetters: string[],
): { valid: boolean; message: string } {
  const upper = word.toUpperCase();
  for (const letter of requiredLetters) {
    if (!upper.includes(letter)) {
      return {
        valid: false,
        message:
          requiredLetters.length === 1
            ? `Word must contain the letter "${letter}"`
            : `Word must contain "${letter}" — use all required letters!`,
      };
    }
  }
  return { valid: true, message: "" };
}
