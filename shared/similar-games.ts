/**
 * Default editorial recommendations for the game catalogue.
 * The order is the display order; empty/unlisted games use the More Games fallback.
 */
export const DEFAULT_SIMILAR_GAME_SLUGS: Readonly<Record<string, readonly string[]>> = {
  "anagram-solver": ["word-scramble", "letter-pool", "word-fusion"],
  "word-scramble": ["anagram-solver", "letter-pool", "word-fusion"],
  "letter-pool": ["word-scramble", "anagram-solver", "word-fusion"],
  "word-fusion": ["word-maker", "word-split", "letter-pool"],

  "word-maker": ["word-split", "word-roots", "word-fusion"],
  "word-split": ["word-maker", "word-roots", "word-fusion"],
  "word-roots": ["word-maker", "word-split", "word-extension"],

  "word-bloom": ["word-stretch", "word-stack", "word-extension"],
  "word-stretch": ["word-bloom", "word-stack", "word-extension"],
  "word-stack": ["word-bloom", "word-stretch", "word-extension"],
  "word-extension": ["word-bloom", "word-stretch", "word-stack"],

  "shell-words": ["deep-shell-words"],
  "deep-shell-words": ["shell-words"],

  "word-ladder": ["ladder-rush", "ladder-rush-double", "word-chain"],
  "ladder-rush": ["word-ladder", "ladder-rush-double", "word-chain"],
  "ladder-rush-double": ["word-ladder", "ladder-rush", "word-chain"],
  "word-chain": ["word-ladder", "ladder-rush", "ladder-rush-double"],

  "letter-hunt": ["letter-position", "letter-dodge", "letter-frequency"],
  "letter-dodge": ["letter-hunt", "no-repeats", "letter-frequency"],
  "letter-position": ["letter-hunt", "letter-frequency", "letter-dodge"],
  "letter-frequency": ["letter-position", "letter-hunt", "letter-balance"],
  "letter-balance": ["letter-frequency", "letter-dodge", "no-repeats"],
  "no-repeats": ["letter-dodge", "letter-hunt", "letter-frequency"],

  "definition-match": ["progressive-reveal"],
  "progressive-reveal": ["definition-match"],
};
