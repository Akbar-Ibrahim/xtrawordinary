export const LETTER_CONSTRAINT_PREVIEW_SOURCE = "preview" as const;

export const LETTER_CONSTRAINT_PREVIEW_WORDS = [
  "ACE", "ACT", "AGE", "ALE", "ATE", "BAD", "BEE", "BELL", "BOLD", "BOOK",
  "CABLE", "CART", "CASE", "CAST", "CAT", "CATER", "CHART", "COOK", "COT",
  "CREATE", "CRATE", "DEAR", "DOG", "EAR", "EAST", "EAT", "EEL", "ELATE",
  "ETHER", "FEAR", "FLEE", "FULL", "GATE", "HARE", "HATER", "HEART", "HEEL",
  "HELLO", "HILL", "LATE", "LATER", "LEAST", "LETTER", "LEVEL", "LULL",
  "MINT", "MOON", "NOTE", "RATE", "REACT", "RELATE", "ROSE", "SEAT", "SHEET",
  "SLATE", "SOUP", "STALE", "STARE", "STATE", "STEAL", "STEAM", "SUN", "Tale",
  "TAR", "TARE", "TART", "TEA", "TEAR", "TEARS", "TEASE", "THESE", "THERE",
  "TREAT", "TREE", "TRACE", "WIND", "WOOD", "WORLD",
].map((word) => word.toUpperCase()).sort((left, right) => left.localeCompare(right, "en"));

export const DODGE_MINIMUM_WORD_LENGTH = 4;
export const DODGE_SHORT_WORD_EXCLUSION = "Letter Dodge gameplay requires at least 4 letters.";
