import assert from "node:assert/strict";
import {
  buildLeaderboardUrl,
  parseLeaderboardUrl,
  resolveLeaderboardModeSlug,
} from "./leaderboard-url";

assert.deepEqual(
  parseLeaderboardUrl("?game=letter-position&mode=letter-position-2&survival=1"),
  {
    gameSlug: "letter-position",
    modeSlug: "letter-position-2",
    isSurvival: true,
    hasSurvivalParam: true,
  },
);
assert.equal(parseLeaderboardUrl("game=word-length&survival=true").isSurvival, true);
assert.equal(parseLeaderboardUrl("survival=0").isSurvival, false);

const modes = [{ slug: "challenge-1" }, { slug: "challenge-2" }];
assert.equal(resolveLeaderboardModeSlug(modes, "challenge-2"), "challenge-2");
assert.equal(resolveLeaderboardModeSlug(modes, "invalid"), "challenge-1");
assert.equal(resolveLeaderboardModeSlug([], undefined), "");

assert.equal(
  buildLeaderboardUrl("letter-position", "letter-position-2", true),
  "/leaderboard?game=letter-position&mode=letter-position-2&survival=1",
);
for (const modeSlug of ["letter-position-1", "letter-position-2"]) {
  assert.equal(
    buildLeaderboardUrl("letter-position", modeSlug, false),
    `/leaderboard?game=letter-position&mode=${modeSlug}`,
  );
  assert.equal(
    buildLeaderboardUrl("letter-position", modeSlug, true),
    `/leaderboard?game=letter-position&mode=${modeSlug}&survival=1`,
  );
}
assert.equal(
  buildLeaderboardUrl("word-length", "word-length-3"),
  "/leaderboard?game=word-length&mode=word-length-3",
);
assert.equal(buildLeaderboardUrl("overall"), "/leaderboard");

console.log("Leaderboard URL tests passed");
