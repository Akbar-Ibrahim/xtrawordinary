export const ALLOWED_EMOJIS = ["🔥", "❤️", "😂", "👏"];

export const DUEL_TURN_SLUGS = new Set([
  "word-chain", "letter-hunt", "word-length", "letter-frequency",
  "letter-position", "letter-balance",
]);
export const DUEL_RACE_SLUGS = new Set([
  "letter-hunt", "word-length", "letter-frequency", "letter-position", "letter-balance",
  "word-scramble", "no-repeats", "anagram-solver", "word-stack",
  "letter-pool", "word-maker", "word-split", "definition-match",
]);
export const DUEL_GAME_SLUGS_LIST = Array.from(new Set([...Array.from(DUEL_TURN_SLUGS), ...Array.from(DUEL_RACE_SLUGS)]));
export const DUEL_GAME_NAMES: Record<string, string> = {
  "word-chain": "Word Chain", "letter-hunt": "Letter Hunt", "word-length": "Length Challenge",
  "letter-frequency": "Letter Frequency", "letter-position": "Position Master",
  "letter-balance": "Letter Balance", "word-scramble": "Word Scramble",
  "no-repeats": "No Repeats", "anagram-solver": "Anagram Solver",
  "word-stack": "Word Stack", "letter-pool": "Letter Pool", "word-maker": "Word Maker",
  "word-split": "Word Split", "definition-match": "Definition Match",
};

export const TEAM_RACE_GAME_SLUGS_LIST = [
  "no-repeats", "anagram-solver", "word-maker", "definition-match",
  "letter-hunt", "letter-frequency", "word-length", "letter-dodge", "word-roots",
];
export const TEAM_RACE_GAME_NAMES: Record<string, string> = {
  "no-repeats": "No Repeats", "anagram-solver": "Anagram Solver", "word-maker": "Word Maker",
  "definition-match": "Definition Match", "letter-hunt": "Letter Hunt",
  "letter-frequency": "Letter Frequency", "word-length": "Length Challenge",
  "letter-dodge": "Letter Dodge", "word-roots": "Word Roots",
};

export const GAME_SLUGS = [
  "word-ladder", "anagram-solver", "word-scramble", "definition-match",
  "letter-pool", "word-maker", "word-length", "letter-position",
  "letter-hunt", "letter-dodge", "letter-balance", "letter-frequency", "no-repeats",
  "word-sweep", "word-roots", "shell-words", "deep-shell-words",
];

export const GAME_NAMES: Record<string, string> = {
  "word-ladder": "Word Ladder", "anagram-solver": "Anagram Solver",
  "word-scramble": "Word Scramble", "definition-match": "Definition Match",
  "letter-pool": "Letter Pool", "word-maker": "Word Maker",
  "word-length": "Length Challenge", "letter-position": "Position Master",
  "letter-hunt": "Letter Hunt", "letter-dodge": "Letter Dodge",
  "letter-balance": "Letter Balance",
  "letter-frequency": "Letter Frequency", "no-repeats": "No Repeats",
  "word-sweep": "Word Sweep", "word-roots": "Word Roots",
  "shell-words": "Shell Words", "deep-shell-words": "Deep Shell Words",
};

export const ALL_TAGS = ["School", "Office", "Family", "Friends", "Gaming", "Book Club", "Other"];
