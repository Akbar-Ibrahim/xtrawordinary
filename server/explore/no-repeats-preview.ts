export const NO_REPEATS_PREVIEW_SOURCE = "preview" as const;

export const NO_REPEATS_PREVIEW_WORDS = [
  "A", "I", "AI", "AN", "AS", "AT", "BE", "BY", "DO", "GO", "IT", "NO", "ON", "TO", "UP", "WE",
  "ACE", "ACT", "AGE", "ATE", "BAD", "BIRD", "BOOK", "CARE", "CAT", "CLOUD", "CRANE", "DOG",
  "DOOR", "EAR", "ELBOW", "FIGHT", "FLOW", "LETTER", "NIGHT", "NOON", "NOTE", "PAINTING",
  "SILENT", "STONE", "WORD",
].sort((left, right) => left.localeCompare(right, "en"));
