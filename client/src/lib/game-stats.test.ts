import assert from "node:assert/strict";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  },
});

const {
  getBestWordsFound,
  getBestWordsFoundForGame,
  getPersonalBest,
  loadStats,
  recordGameResult,
} = await import("./game-stats");

const play = (
  personalBestSlug: string,
  score: number,
  timestamp: number,
) => recordGameResult({
  slug: "letter-position",
  personalBestSlug,
  score,
  won: false,
  wordsFound: 3,
  timestamp,
});

assert.equal(play("letter-position-1", 310, 1).isNewBest, true);
assert.equal(play("letter-position-2", 240, 2).isNewBest, true);
assert.equal(play("letter-position-1", 280, 3).isNewBest, false);
assert.equal(getPersonalBest("letter-position-1"), 310);
assert.equal(getPersonalBest("letter-position-2"), 240);
assert.equal(getPersonalBest("letter-position"), 310);

const stats = loadStats();
assert.equal(stats.perGame["letter-position"].gamesPlayed, 3);
assert.equal(stats.perGame["letter-position"].bestScore, 310);
assert.equal(stats.perGame["letter-position-1"], undefined);
assert.equal(stats.totalGamesPlayed, 3);

values.clear();
const playDodge = (personalBestSlug: string, score: number, timestamp: number) =>
  recordGameResult({
    slug: "letter-dodge",
    personalBestSlug,
    score,
    won: false,
    wordsFound: 2,
    timestamp,
  });

assert.equal(playDodge("letter-dodge-easy", 500, 4).isNewBest, true);
assert.equal(playDodge("letter-dodge-medium", 320, 5).isNewBest, true);
assert.equal(playDodge("letter-dodge-easy-survival", 450, 6).isNewBest, true);
assert.equal(playDodge("letter-dodge-medium-survival", 280, 7).isNewBest, true);
assert.equal(playDodge("letter-dodge-easy", 400, 8).isNewBest, false);

assert.equal(getPersonalBest("letter-dodge-easy"), 500);
assert.equal(getPersonalBest("letter-dodge-medium"), 320);
assert.equal(getPersonalBest("letter-dodge-easy-survival"), 450);
assert.equal(getPersonalBest("letter-dodge-medium-survival"), 280);
assert.equal(getPersonalBest("letter-dodge"), 500);

const dodgeStats = loadStats();
assert.equal(dodgeStats.perGame["letter-dodge"].gamesPlayed, 5);
assert.equal(dodgeStats.perGame["letter-dodge"].bestScore, 500);
assert.equal(dodgeStats.perGame["letter-dodge-easy"], undefined);
assert.equal(dodgeStats.totalGamesPlayed, 5);

values.clear();
recordGameResult({
  slug: "letter-position",
  personalBestSlug: "letter-position-2",
  survivalSuggestionSlug: "letter-position-2",
  score: 1200,
  won: false,
  wordsFound: 101,
  timestamp: 9,
});
recordGameResult({
  slug: "letter-position",
  personalBestSlug: "letter-position-2-survival",
  score: 1600,
  won: false,
  wordsFound: 140,
  timestamp: 10,
});

assert.equal(getBestWordsFound("letter-position-2"), 101);
assert.equal(getBestWordsFoundForGame("letter-position"), 101);
assert.equal(getBestWordsFoundForGame("letter-dodge"), 0);
