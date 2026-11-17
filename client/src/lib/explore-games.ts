export type ExploreGame = {
  gameSlug?: string;
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
  {
    gameSlug: "word-length",
    title: "Length Challenge",
    description: "Browse dictionary words by length and letter pattern.",
    path: "/explore/word-length",
  },
  {
    gameSlug: "shell-words",
    title: "Shell Words",
    description: "Explore dictionary relationships between outer words and their revealed inner words.",
    path: "/explore/shell-words",
  },
  {
    gameSlug: "deep-shell-words",
    title: "Deep Shell Words",
    description: "Explore deeper word relationships formed by removing two letters from each end.",
    path: "/explore/deep-shell-words",
  },
  {
    gameSlug: "word-split",
    title: "Word Split",
    description: "Explore every linked way to divide a word into smaller words using all its letters.",
    path: "/explore/word-split",
  },
  {
    gameSlug: "word-fusion",
    title: "Word Fusion",
    description: "Combine letters from multiple words and find dictionary words that use the entire pool.",
    path: "/explore/word-fusion",
  },
  {
    gameSlug: "word-roots",
    title: "Word Roots",
    description: "Find base words linked to every word you enter.",
    path: "/explore/word-roots",
  },
  {
    title: "Prefix Search",
    description: "Find dictionary words that begin with a letter sequence you choose.",
    path: "/explore/prefix-search",
  },
  {
    title: "Suffix Search",
    description: "Find dictionary words that end with a letter sequence you choose.",
    path: "/explore/suffix-search",
  },
  {
    title: "Contains Search",
    description: "Find words with a letter sequence strictly inside, not at either end.",
    path: "/explore/contains-search",
  },
];

export function getExploreGame(gameSlug: string): ExploreGame | undefined {
  return EXPLORE_GAMES.find((game) => game.gameSlug === gameSlug);
}
