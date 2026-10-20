export type ExploreGame = {
  gameSlug: string;
  title: string;
  description: string;
  path: string;
};

export const EXPLORE_GAMES: ExploreGame[] = [
  {
    gameSlug: "word-maker",
    title: "Word Maker",
    description: "Find words hidden in a base word, or check answers during a game night.",
    path: "/explore/word-maker",
  },
  {
    gameSlug: "anagram-solver",
    title: "Anagram Solver",
    description: "Find dictionary words made from the same set of letters.",
    path: "/explore/anagram-solver",
  },
  {
    gameSlug: "word-scramble",
    title: "Word Scramble",
    description: "Enter scrambled letters and find dictionary words they can form.",
    path: "/explore/word-scramble",
  },
  {
    gameSlug: "letter-hunt",
    title: "Letter Hunt",
    description: "Find words that contain the letters you choose.",
    path: "/explore/letter-hunt",
  },
  {
    gameSlug: "letter-dodge",
    title: "Letter Dodge",
    description: "Find words that avoid the letters you enter.",
    path: "/explore/letter-dodge",
  },
  {
    gameSlug: "letter-position",
    title: "Letter Position",
    description: "Search for words with a chosen letter in a specific position.",
    path: "/explore/letter-position",
  },
  {
    gameSlug: "letter-frequency",
    title: "Letter Frequency",
    description: "Find words using selected letters a specific number of times.",
    path: "/explore/letter-frequency",
  },
  {
    gameSlug: "no-repeats",
    title: "No Repeats",
    description: "Browse words that use each letter only once.",
    path: "/explore/no-repeats",
  },
  {
    gameSlug: "letter-balance",
    title: "Vowels & Consonants",
    description: "Explore words by their vowel and consonant patterns.",
    path: "/explore/letter-balance",
  },
];

export function getExploreGame(gameSlug: string): ExploreGame | undefined {
  return EXPLORE_GAMES.find((game) => game.gameSlug === gameSlug);
}
