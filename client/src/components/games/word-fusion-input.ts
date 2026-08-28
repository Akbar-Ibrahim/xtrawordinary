import type { FusionTile } from "./word-fusion-tiles";

export function normalizeFusionAnswer(value: string, maxLength: number): string {
  return value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, maxLength);
}

export function switchToTypedFusionAnswer(value: string, maxLength: number): {
  typedAnswer: string;
  selectedTiles: FusionTile[];
} {
  return {
    typedAnswer: normalizeFusionAnswer(value, maxLength),
    selectedTiles: [],
  };
}

export function switchToTappedFusionAnswer(
  tile: FusionTile,
  selectedTiles: FusionTile[],
): {
  typedAnswer: string;
  selectedTiles: FusionTile[];
} {
  return {
    typedAnswer: "",
    selectedTiles: [...selectedTiles, tile],
  };
}