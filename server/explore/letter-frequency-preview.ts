export const LETTER_FREQUENCY_PREVIEW_SOURCE = "preview" as const;

export const LETTER_FREQUENCY_PREVIEW_WORDS = [
  "ABBREVIATION",
  "ASSESSMENT",
  "ARREST",
  "BALLOON",
  "BANANA",
  "BOOKKEEPER",
  "COFFEE",
  "COMMITTEE",
  "LETTER",
  "MISSISSIPPI",
  "PAPER",
  "QUEUEING",
  "SUCCESS",
  "TATTER",
  "TATTOO",
  "TENET",
  "TREE",
  "APPLE",
].sort((left, right) => left.localeCompare(right, "en"));
