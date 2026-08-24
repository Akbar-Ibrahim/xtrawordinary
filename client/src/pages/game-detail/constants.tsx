import { LadderRushGame } from "@/components/games/ladder-rush";
import { WordLadderGame } from "@/components/games/word-ladder";
import { AnagramSolverGame } from "@/components/games/anagram-solver";
import { WordScrambleGame } from "@/components/games/word-scramble";
import { DefinitionMatchGame } from "@/components/games/definition-match";
import { LetterPoolGame } from "@/components/games/letter-pool";
import { WordMakerGame } from "@/components/games/word-maker";
import { WordLengthGame } from "@/components/games/word-length";
import { LetterPositionGame } from "@/components/games/letter-position";
import { LetterHuntGame } from "@/components/games/letter-hunt";
import { WordChainGame } from "@/components/games/word-chain";
import { LetterBalanceGame } from "@/components/games/letter-balance";
import { LetterFrequencyGame } from "@/components/games/letter-frequency";
import { WordStackGame } from "@/components/games/word-stack";
import { NoRepeatsGame } from "@/components/games/no-repeats";
import { WordSplitGame } from "@/components/games/word-split";
import { ProgressiveRevealGame } from "@/components/games/progressive-reveal";
import { WordSweepGame } from "@/components/games/word-sweep";
import { WordRootsGame } from "@/components/games/word-roots";
import { ShellWordsGame } from "@/components/games/shell-words";
import { DeepShellWordsGame } from "@/components/games/deep-shell-words";
import { WordStretchGame } from "@/components/games/word-stretch";
import { WordBloomGame } from "@/components/games/word-bloom";
import { LetterDodgeGame } from "@/components/games/letter-dodge";
import { WordExtensionGame } from "@/components/games/word-extension";

export const difficultyColors: Record<string, string> = {
  easy: "bg-accent text-accent-foreground",
  medium: "bg-chart-3 text-white",
  hard: "bg-destructive text-destructive-foreground",
};

const LadderRushDoubleGame = (props: { groupSeed?: number; locked?: boolean }) =>
  <LadderRushGame {...props} doubleSwap />;

export const gameComponents: Record<string, React.ComponentType<{ groupSeed?: number; locked?: boolean }>> = {
  "word-ladder": WordLadderGame,
  "anagram-solver": AnagramSolverGame,
  "word-scramble": WordScrambleGame,
  "definition-match": DefinitionMatchGame,
  "letter-pool": LetterPoolGame,
  "word-maker": WordMakerGame,
  "word-length": WordLengthGame,
  "letter-position": LetterPositionGame,
  "letter-hunt": LetterHuntGame,
  "word-chain": WordChainGame,
  "letter-balance": LetterBalanceGame,
  "letter-frequency": LetterFrequencyGame,
  "word-stack": WordStackGame,
  "no-repeats": NoRepeatsGame,
  "word-split": WordSplitGame,
  "progressive-reveal": ProgressiveRevealGame,
  "word-sweep": WordSweepGame,
  "word-roots": WordRootsGame,
  "ladder-rush": LadderRushGame,
  "ladder-rush-double": LadderRushDoubleGame,
  "shell-words": ShellWordsGame,
  "deep-shell-words": DeepShellWordsGame,
  "word-stretch": WordStretchGame,
  "word-bloom": WordBloomGame,
  "letter-dodge": LetterDodgeGame,
  "word-extension": WordExtensionGame,
};

export const CUSTOM_PLAY_SLUGS = new Set([
  "letter-position",
  "letter-hunt",
  "letter-frequency",
  "letter-balance",
  "word-length",
  "letter-dodge",
]);

export const UNTIMED_GAME_SLUGS = new Set([
  "word-chain",
  "word-ladder",
  "letter-hunt",
  "word-scramble",
  "no-repeats",
  "ladder-rush",
  "ladder-rush-double",
  "letter-dodge",
  "shell-words",
  "deep-shell-words",
  "word-length",
  "letter-position",
  "word-roots",
  "letter-balance",
  "letter-frequency",
  "anagram-solver",
  "definition-match",
  "word-sweep",
  "word-bloom",
  "word-extension",
  "word-stretch",
]);

export const LETTER_BALANCE_CATEGORIES_DETAIL = [
  { id: "consonant_count", name: "Consonant Count", levelType: "count", levels: [2, 3, 4, 5, 6, 7] },
  { id: "vowel_count", name: "Vowel Count", levelType: "count", levels: [2, 3, 4, 5, 6, 7] },
  { id: "start_end_vowel", name: "Start & End Vowels", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_end_consonant", name: "Start & End Consonants", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_vowel_end_consonant", name: "Start Vowel, End Consonant", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "start_consonant_end_vowel", name: "Start Consonant, End Vowel", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "locked_balance", name: "Locked Balance", levelType: "length", levels: [4, 5, 6, 7, 8, 9, 10] },
] as const;

export interface ChallengeResult {
  myScore: number;
  opponentScore: number;
  won: boolean;
  isSender: boolean;
}
