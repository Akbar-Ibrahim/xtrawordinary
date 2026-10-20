import assert from "node:assert/strict";
import {
  getLetterDodgeChallengeDifficulty,
  getLetterDodgeChallengeModeLabel,
  getLetterDodgeChallengeSurvival,
  getLetterDodgeLeaderboardSlug,
  LETTER_DODGE_GAME_MODES,
  LETTER_DODGE_VARIANTS,
  parseLetterDodgeDifficulty,
  type LetterDodgeDifficulty,
} from "./letter-dodge";

assert.deepEqual(
  LETTER_DODGE_VARIANTS.map(({ difficulty, label, slug }) => [
    difficulty,
    label,
    slug,
  ]),
  [
    [1, "Easy (1 letter)", "letter-dodge-easy"],
    [2, "Medium (2 letters)", "letter-dodge-medium"],
    [3, "Hard (3 letters)", "letter-dodge-hard"],
    [4, "Expert (4 letters)", "letter-dodge-expert"],
    [5, "Master (5 letters)", "letter-dodge-master"],
    ["savant", "Savant (6–12 letters)", "letter-dodge-savant"],
    ["advanced", "Advanced (random 1–5)", "letter-dodge-advanced"],
  ],
);

assert.deepEqual(
  LETTER_DODGE_GAME_MODES,
  LETTER_DODGE_VARIANTS.map(({ label, slug }) => ({ label, slug })),
);

const leaderboardSlugs = new Set<string>();
for (const mode of LETTER_DODGE_VARIANTS) {
  const classicSlug = getLetterDodgeLeaderboardSlug(mode.difficulty);
  const survivalSlug = getLetterDodgeLeaderboardSlug(mode.difficulty, true);
  assert.equal(classicSlug, mode.slug);
  assert.equal(survivalSlug, `${mode.slug}-survival`);
  assert.notEqual(classicSlug, survivalSlug);
  leaderboardSlugs.add(classicSlug);
  leaderboardSlugs.add(survivalSlug);
}
assert.equal(leaderboardSlugs.size, LETTER_DODGE_VARIANTS.length * 2);

for (const { difficulty } of LETTER_DODGE_VARIANTS) {
  assert.equal(parseLetterDodgeDifficulty(difficulty), difficulty);
  assert.equal(parseLetterDodgeDifficulty(String(difficulty)), difficulty);
}
assert.equal(parseLetterDodgeDifficulty(undefined), undefined);
assert.equal(parseLetterDodgeDifficulty("6"), undefined);
assert.equal(parseLetterDodgeDifficulty("other"), undefined);

for (const { difficulty } of LETTER_DODGE_VARIANTS) {
  assert.equal(
    getLetterDodgeChallengeDifficulty(JSON.stringify({ difficulty })),
    difficulty,
  );
}
assert.equal(getLetterDodgeChallengeDifficulty(null), "advanced");
assert.equal(getLetterDodgeChallengeDifficulty(undefined), "advanced");
assert.equal(getLetterDodgeChallengeDifficulty(JSON.stringify({})), "advanced");
assert.equal(
  getLetterDodgeChallengeDifficulty(JSON.stringify({ difficulty: "invalid" })),
  "advanced",
);
assert.equal(getLetterDodgeChallengeDifficulty("not json"), "advanced");

assert.equal(
  getLetterDodgeChallengeSurvival(JSON.stringify({ difficulty: 2, survival: true })),
  true,
);
assert.equal(
  getLetterDodgeChallengeSurvival(JSON.stringify({ difficulty: 2, survival: false })),
  false,
);
assert.equal(getLetterDodgeChallengeSurvival(null), false);
assert.equal(getLetterDodgeChallengeSurvival(undefined), false);
assert.equal(getLetterDodgeChallengeSurvival(JSON.stringify({ difficulty: 2 })), false);
assert.equal(
  getLetterDodgeChallengeSurvival(JSON.stringify({ difficulty: 2, survival: "true" })),
  false,
);
assert.equal(getLetterDodgeChallengeSurvival("not json"), false);
assert.equal(
  getLetterDodgeChallengeModeLabel(JSON.stringify({ difficulty: 2, survival: true })),
  "Survival",
);
assert.equal(
  getLetterDodgeChallengeModeLabel(JSON.stringify({ difficulty: 2, survival: false })),
  "Standard",
);
assert.equal(getLetterDodgeChallengeModeLabel(null), "Standard");

assert.throws(
  () => getLetterDodgeLeaderboardSlug("unknown" as LetterDodgeDifficulty),
  RangeError,
);
