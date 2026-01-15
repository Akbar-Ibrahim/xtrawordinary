import type { Game } from "@shared/schema";

export interface IStorage {
  getGames(): Promise<Game[]>;
  getGameBySlug(slug: string): Promise<Game | undefined>;
}

const gamesData: Game[] = [
  {
    id: "1",
    slug: "word-guessing",
    name: "Word Guessing",
    description: "Guess the hidden 5-letter word in 6 attempts or less.",
    longDescription: "Put your vocabulary to the test in this classic word guessing game. You have 6 attempts to guess a hidden 5-letter word. After each guess, you'll get feedback showing which letters are correct and in the right position (green), correct but in the wrong position (yellow), or not in the word at all (gray).",
    rules: [
      "Guess the hidden 5-letter word within 6 attempts",
      "Each guess must be a valid 5-letter word",
      "Green letters are correct and in the right position",
      "Yellow letters are in the word but wrong position",
      "Gray letters are not in the word at all"
    ],
    difficulty: "medium",
    estimatedTime: "3-5 min",
    icon: "Target",
    color: "hsl(262, 83%, 58%)",
    playCount: 15420
  },
  {
    id: "2",
    slug: "anagram-solver",
    name: "Anagram Solver",
    description: "Rearrange scrambled letters to form meaningful words.",
    longDescription: "Challenge yourself to unscramble words against the clock! You'll be given a set of jumbled letters, and your task is to rearrange them to form the correct word. Use hints if you get stuck, but be careful - using hints reduces your score. How many can you solve before time runs out?",
    rules: [
      "Rearrange the scrambled letters to form a word",
      "Click letters to select them in order",
      "Use the shuffle button to rearrange the letters",
      "Hints are available but reduce your score by 50 points",
      "Build streaks for bonus points"
    ],
    difficulty: "easy",
    estimatedTime: "2-3 min",
    icon: "Shuffle",
    color: "hsl(158, 64%, 40%)",
    playCount: 12850
  },
  {
    id: "3",
    slug: "word-scramble",
    name: "Word Scramble",
    description: "Unscramble letters to reveal hidden words before running out of lives.",
    longDescription: "Test your word unscrambling skills in this fast-paced game! Each round presents you with a scrambled word and a category hint. Type the correct word to score points and advance through levels. But be careful - you only have 3 lives, so wrong answers cost you dearly!",
    rules: [
      "Unscramble the letters to form the hidden word",
      "Use the category hint to guide your guess",
      "Type your answer and press Enter or click Submit",
      "You have 3 lives - wrong answers lose a life",
      "Complete words to level up and earn bonus points"
    ],
    difficulty: "hard",
    estimatedTime: "5-10 min",
    icon: "Puzzle",
    color: "hsl(35, 92%, 50%)",
    playCount: 8930
  }
];

export class MemStorage implements IStorage {
  private games: Game[];

  constructor() {
    this.games = gamesData;
  }

  async getGames(): Promise<Game[]> {
    return this.games;
  }

  async getGameBySlug(slug: string): Promise<Game | undefined> {
    return this.games.find((game) => game.slug === slug);
  }
}

export const storage = new MemStorage();
