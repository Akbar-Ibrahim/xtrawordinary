import type { DuelGameAdapter } from "@/components/duel-turn-engine";
import { wordChainDuelAdapter } from "@/components/games/word-chain-duel-adapter";
import { ladderRushDuelAdapter, ladderRushDoubleDuelAdapter } from "@/components/games/ladder-rush-duel-adapter";
import { letterHuntDuelAdapter } from "@/components/games/letter-hunt-duel-adapter";
import { wordLengthDuelAdapter } from "@/components/games/word-length-duel-adapter";
import { letterFrequencyDuelAdapter } from "@/components/games/letter-frequency-duel-adapter";
import { letterPositionDuelAdapter } from "@/components/games/letter-position-duel-adapter";
import { letterBalanceDuelAdapter } from "@/components/games/letter-balance-duel-adapter";
import {
  wordScrambleRaceAdapter,
  noRepeatsRaceAdapter,
  anagramSolverRaceAdapter,
  wordStackRaceAdapter,
  letterPoolRaceAdapter,
  wordMakerRaceAdapter,
  wordSplitRaceAdapter,
  definitionMatchRaceAdapter,
} from "@/components/race-adapters";

export function getAdapterForSlug(gameSlug: string): DuelGameAdapter {
  switch (gameSlug) {
    case "letter-hunt":           return letterHuntDuelAdapter;
    case "word-length":           return wordLengthDuelAdapter;
    case "letter-frequency":      return letterFrequencyDuelAdapter;
    case "letter-position":       return letterPositionDuelAdapter;
    case "letter-balance":        return letterBalanceDuelAdapter;
    case "word-scramble":         return wordScrambleRaceAdapter;
    case "no-repeats":            return noRepeatsRaceAdapter;
    case "anagram-solver":        return anagramSolverRaceAdapter;
    case "word-stack":            return wordStackRaceAdapter;
    case "letter-pool":           return letterPoolRaceAdapter;
    case "word-maker":            return wordMakerRaceAdapter;
    case "word-split":            return wordSplitRaceAdapter;
    case "definition-match":      return definitionMatchRaceAdapter;
    case "ladder-rush-4":
    case "ladder-rush-5":
    case "ladder-rush-6":         return ladderRushDuelAdapter;
    case "ladder-rush-double-4":
    case "ladder-rush-double-5":
    case "ladder-rush-double-6":  return ladderRushDoubleDuelAdapter;
    default:                      return wordChainDuelAdapter;
  }
}
