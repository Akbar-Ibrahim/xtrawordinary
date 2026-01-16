import type { Game, AnagramWordSet, ScrambleWord, DefinitionWord, BuilderWord, MakerWord } from "@shared/schema";

export interface IStorage {
  getGames(): Promise<Game[]>;
  getGameBySlug(slug: string): Promise<Game | undefined>;
  getWordGuessingWords(): Promise<string[]>;
  getAnagramWordSets(): Promise<AnagramWordSet[]>;
  getScrambleWords(): Promise<ScrambleWord[]>;
  getDefinitionWords(): Promise<DefinitionWord[]>;
  getBuilderWords(): Promise<BuilderWord[]>;
  getMakerWords(): Promise<MakerWord[]>;
}

// Word Guessing words (5-letter words)
const wordGuessingWords: string[] = [
  "REACT", "SOUND", "BRAIN", "FLAME", "CRISP", 
  "GRADE", "PLANT", "SWIFT", "GLOBE", "QUEST"
];

// Anagram Solver word sets
const anagramWordSets: AnagramWordSet[] = [
  { original: "LISTEN", anagram: "SILENT", hint: "Without sound" },
  { original: "DANGER", anagram: "GARDEN", hint: "A place to grow flowers" },
  { original: "EARTH", anagram: "HEART", hint: "It pumps blood" },
  { original: "DUSTY", anagram: "STUDY", hint: "What students do" },
  { original: "NIGHT", anagram: "THING", hint: "An object or item" },
  { original: "ANGEL", anagram: "ANGLE", hint: "Geometry term" },
  { original: "SAVES", anagram: "VASES", hint: "Hold flowers" },
  { original: "BORED", anagram: "ROBED", hint: "Wearing a robe" },
];

// Word Scramble words with categories
const scrambleWords: ScrambleWord[] = [
  { word: "PUZZLE", category: "Games" },
  { word: "BRIGHT", category: "Adjective" },
  { word: "MONKEY", category: "Animal" },
  { word: "CASTLE", category: "Building" },
  { word: "FROZEN", category: "Temperature" },
  { word: "PLANET", category: "Space" },
  { word: "GUITAR", category: "Music" },
  { word: "JUNGLE", category: "Nature" },
  { word: "DRAGON", category: "Fantasy" },
  { word: "MARKET", category: "Place" },
  { word: "RHYTHM", category: "Music" },
  { word: "SILVER", category: "Metal" },
];

// Definition Match words
const definitionWords: DefinitionWord[] = [
  { word: "LUMINOUS", definition: "Emitting or reflecting light; shining brightly", partOfSpeech: "adjective" },
  { word: "EPHEMERAL", definition: "Lasting for a very short time; fleeting", partOfSpeech: "adjective" },
  { word: "ELOQUENT", definition: "Fluent or persuasive in speaking or writing", partOfSpeech: "adjective" },
  { word: "RESILIENT", definition: "Able to recover quickly from difficulties", partOfSpeech: "adjective" },
  { word: "SERENE", definition: "Calm, peaceful, and untroubled", partOfSpeech: "adjective" },
  { word: "OBSCURE", definition: "Not clearly expressed or easily understood", partOfSpeech: "adjective" },
  { word: "MEANDER", definition: "To follow a winding course; to wander aimlessly", partOfSpeech: "verb" },
  { word: "PONDER", definition: "To think about something carefully before making a decision", partOfSpeech: "verb" },
  { word: "CHERISH", definition: "To protect and care for lovingly; to hold dear", partOfSpeech: "verb" },
  { word: "FLOURISH", definition: "To grow or develop in a healthy or vigorous way", partOfSpeech: "verb" },
];

// Word Builder words (first and last letters shown)
const builderWords: BuilderWord[] = [
  { word: "ADVENTURE", hint: "An exciting experience or undertaking", category: "Experience" },
  { word: "BEAUTIFUL", hint: "Pleasing to the senses", category: "Appearance" },
  { word: "CHALLENGE", hint: "A task that tests abilities", category: "Activity" },
  { word: "DANGEROUS", hint: "Able to cause harm", category: "Risk" },
  { word: "EDUCATION", hint: "Process of learning", category: "Learning" },
  { word: "FANTASTIC", hint: "Extraordinarily good", category: "Quality" },
  { word: "GENTLEMAN", hint: "A courteous man", category: "Person" },
  { word: "HAPPINESS", hint: "State of being content", category: "Emotion" },
  { word: "IMPORTANT", hint: "Of great significance", category: "Value" },
  { word: "KNOWLEDGE", hint: "Facts and information acquired", category: "Learning" },
];

// Word Maker words (form words from base word)
const makerWords: MakerWord[] = [
  { 
    baseWord: "CREATIVE", 
    derivatives: ["CREATE", "CRATE", "RATE", "TEAR", "CARE", "RACE", "ACRE", "CART", "RICE", "VICE", "TRACE", "REACT", "CATER"],
    maxWords: 10
  },
  { 
    baseWord: "ADVENTURE", 
    derivatives: ["ADVENT", "TRADE", "VENT", "RENT", "DENT", "TEND", "RUDE", "TRUE", "NUDE", "TURN", "UNDER", "NERVE", "TUNED"],
    maxWords: 10
  },
  { 
    baseWord: "WONDERFUL", 
    derivatives: ["WONDER", "WORD", "FORD", "FLOW", "FLEW", "FOND", "FOLD", "LONE", "ROLE", "DUNE", "NUDE", "FOUNDER", "LOWER"],
    maxWords: 10
  },
  { 
    baseWord: "CELEBRATE", 
    derivatives: ["CELEB", "CREATE", "ELECT", "BERATE", "BEER", "TREE", "FREE", "ABLE", "CABLE", "TABLE", "REBEL", "ALERT", "LATER"],
    maxWords: 10
  },
  { 
    baseWord: "FANTASTIC", 
    derivatives: ["FAST", "CAST", "FACT", "FIST", "SAINT", "STAIN", "SATIN", "FAINT", "ANTIC", "STATIC", "NASTY", "FANCY", "TITAN"],
    maxWords: 10
  },
  { 
    baseWord: "BEAUTIFUL", 
    derivatives: ["BEAT", "FEAT", "ABLE", "TABLE", "FABLE", "FAIL", "TAIL", "BAIT", "FATAL", "FAULT", "FLUTE", "FUTILE", "LIFE"],
    maxWords: 10
  },
];

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
  },
  {
    id: "4",
    slug: "definition-match",
    name: "Definition Match",
    description: "Read the definition and guess the word it describes.",
    longDescription: "Expand your vocabulary in this definition-based word game! You'll be shown a definition and must figure out which word it describes. The part of speech is provided as a hint. Score points for each correct answer and build your streak for bonus points. Perfect for vocabulary building!",
    rules: [
      "Read the definition carefully",
      "Type the word that matches the definition",
      "Part of speech is shown as a hint",
      "Case doesn't matter - just spell it right!",
      "Build streaks for bonus points"
    ],
    difficulty: "medium",
    estimatedTime: "3-5 min",
    icon: "BookOpen",
    color: "hsl(210, 70%, 50%)",
    playCount: 7650
  },
  {
    id: "5",
    slug: "word-builder",
    name: "Word Builder",
    description: "Fill in the missing middle letters to complete the word.",
    longDescription: "Put your spelling skills to the test! You'll see the first and last letters of a word, with blanks in between. Use the hint and category to figure out the complete word. The fewer hints you use, the more points you earn!",
    rules: [
      "The first and last letters are revealed",
      "Fill in the missing middle letters",
      "Use the hint for clues about the word's meaning",
      "Category tells you what type of word it is",
      "Score based on speed and accuracy"
    ],
    difficulty: "medium",
    estimatedTime: "4-6 min",
    icon: "PenTool",
    color: "hsl(340, 75%, 55%)",
    playCount: 6420
  },
  {
    id: "6",
    slug: "word-maker",
    name: "Word Maker",
    description: "Create as many words as you can from a given set of letters.",
    longDescription: "How many words can you make? You're given a base word, and your challenge is to form as many smaller words as possible using only its letters. Each letter can only be used once per word. Find all the target words to win!",
    rules: [
      "Form words using letters from the base word",
      "Each letter can only be used once per word",
      "Words must be at least 3 letters long",
      "Find the target number of words to win",
      "Duplicate words don't count"
    ],
    difficulty: "hard",
    estimatedTime: "5-8 min",
    icon: "Sparkles",
    color: "hsl(280, 65%, 55%)",
    playCount: 5890
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

  async getWordGuessingWords(): Promise<string[]> {
    return wordGuessingWords;
  }

  async getAnagramWordSets(): Promise<AnagramWordSet[]> {
    return anagramWordSets;
  }

  async getScrambleWords(): Promise<ScrambleWord[]> {
    return scrambleWords;
  }

  async getDefinitionWords(): Promise<DefinitionWord[]> {
    return definitionWords;
  }

  async getBuilderWords(): Promise<BuilderWord[]> {
    return builderWords;
  }

  async getMakerWords(): Promise<MakerWord[]> {
    return makerWords;
  }
}

export const storage = new MemStorage();
