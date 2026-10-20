import test from "node:test";
import assert from "node:assert/strict";
import {
  getGameDetailDescription,
  getGameDetailRules,
  getStandardPlayGameConfig,
  getSupportedGameConfigFields,
} from "@shared/schema";
import { parseGameConfigUpdate } from "../game-config";
import { gamesData } from "../game-data";

test("Letter Dodge exposes all difficulty leaderboards and Survival", () => {
  const game = gamesData.find(({ slug }) => slug === "letter-dodge");
  assert.equal(game?.hasSurvival, true);
  assert.deepEqual(game?.modes, [
    { label: "Easy (1 letter)", slug: "letter-dodge-easy" },
    { label: "Medium (2 letters)", slug: "letter-dodge-medium" },
    { label: "Hard (3 letters)", slug: "letter-dodge-hard" },
    { label: "Expert (4 letters)", slug: "letter-dodge-expert" },
    { label: "Master (5 letters)", slug: "letter-dodge-master" },
    { label: "Savant (6–12 letters)", slug: "letter-dodge-savant" },
    { label: "Advanced (random 1–5)", slug: "letter-dodge-advanced" },
  ]);
});

test("Letter Hunt exposes each challenge and order combination as a leaderboard mode", () => {
  const game = gamesData.find(({ slug }) => slug === "letter-hunt");
  assert.equal(game?.hasSurvival, true);
  assert.equal(game?.modes?.length, 12);
  assert.deepEqual(game?.modes?.[0], {
    label: "Challenge 1 (2 letters) - Unordered",
    slug: "letter-hunt-1-unordered",
  });
  assert.deepEqual(game?.modes?.[11], {
    label: "Challenge Advanced (random 2-6 letters) - Ordered",
    slug: "letter-hunt-advanced-ordered",
  });
});

test("Letter Pool exposes a separate non-Survival leaderboard per decoy level", () => {
  const game = gamesData.find(({ slug }) => slug === "letter-pool");
  assert.equal(Boolean(game?.hasSurvival), false);
  assert.deepEqual(game?.modes, [
    { label: "With Pool · 1 Decoy", slug: "letter-pool-decoys-1" },
    { label: "With Pool · 2 Decoys", slug: "letter-pool-decoys-2" },
    { label: "With Pool · 3 Decoys", slug: "letter-pool-decoys-3" },
  ]);
});

test("catalogue seed data includes Spoken Word but not a separate dormant no-pool game", () => {
  const spokenWord = gamesData.find(({ slug }) => slug === "spoken-word-transformations");
  const letterPool = gamesData.find(({ slug }) => slug === "letter-pool");

  assert.ok(spokenWord);
  assert.ok(spokenWord.modes && spokenWord.modes.length > 0);
  assert.deepEqual(letterPool?.modes?.map(({ slug }) => slug), [
    "letter-pool-decoys-1",
    "letter-pool-decoys-2",
    "letter-pool-decoys-3",
  ]);
  assert.equal(
    gamesData.some(({ slug }) => slug === "letter-pool-without-pool"),
    false,
  );
});

test("Word Stack exposes separate non-Survival leaderboards for both challenges", () => {
  const game = gamesData.find(({ slug }) => slug === "word-stack");
  assert.equal(Boolean(game?.hasSurvival), false);
  assert.deepEqual(game?.modes, [
    { label: "Build Up", slug: "word-stack-build-up" },
    { label: "Break Down", slug: "word-stack-break-down" },
  ]);
});

test("No Repeats exposes separate leaderboards for challenge length and play mode", () => {
  const game = gamesData.find(({ slug }) => slug === "no-repeats");
  assert.equal(game?.hasSurvival, true);
  assert.equal(game?.modes?.length, 14);
  assert.deepEqual(game?.modes?.slice(0, 2), [
    { label: "Challenge 3 - Free Form", slug: "no-repeats-3-free" },
    { label: "Challenge 3 - Required Letters", slug: "no-repeats-3-required" },
  ]);
  assert.deepEqual(game?.modes?.slice(-2), [
    { label: "Challenge 9 - Free Form", slug: "no-repeats-9-free" },
    { label: "Challenge 9 - Required Letters", slug: "no-repeats-9-required" },
  ]);
});

test("Word Extension exposes one leaderboard per added-letter difficulty and no Survival boards", () => {
  const game = gamesData.find(({ slug }) => slug === "word-extension");
  assert.equal(Boolean(game?.hasSurvival), false);
  assert.deepEqual(game?.modes, [
    { label: "Easy (+1)", slug: "word-extension-1" },
    { label: "Medium (+2)", slug: "word-extension-2" },
    { label: "Hard (+3)", slug: "word-extension-3" },
    { label: "Expert (+4)", slug: "word-extension-4" },
  ]);
});

test("support matrix exposes only settings consumed by standard play", () => {
  assert.deepEqual(getSupportedGameConfigFields("word-fusion"), [
    "timeLimitSeconds",
    "wordTarget",
  ]);
  assert.deepEqual(getSupportedGameConfigFields("word-scramble"), ["livesCount"]);
  assert.deepEqual(getSupportedGameConfigFields("word-ladder"), []);
});

test("game config parser accepts supported positive integers and null", () => {
  assert.deepEqual(
    parseGameConfigUpdate("no-repeats", {
      timeLimitSeconds: 90,
      wordTarget: null,
    }),
    {
      ok: true,
      config: { timeLimitSeconds: 90, wordTarget: null },
    },
  );
});

test("game config parser rejects irrelevant and obsolete settings", () => {
  assert.deepEqual(parseGameConfigUpdate("word-scramble", { wordTarget: 4 }), {
    ok: false,
    error: "wordTarget is not supported for word-scramble",
  });
  assert.deepEqual(parseGameConfigUpdate("no-repeats", { survivalSecondsPerWord: 8 }), {
    ok: false,
    error: "survivalSecondsPerWord is not a supported game config field",
  });
});

test("game config parser rejects fractional and non-positive values", () => {
  for (const value of [1.5, 0, -3]) {
    assert.deepEqual(parseGameConfigUpdate("word-scramble", { livesCount: value }), {
      ok: false,
      error: "livesCount must be a positive integer or null",
    });
  }
});

test("game config parser enforces game-specific target limits", () => {
  assert.deepEqual(parseGameConfigUpdate("word-roots", { wordTarget: 6 }), {
    ok: false,
    error: "wordTarget must be at most 5 for word-roots",
  });
  assert.deepEqual(parseGameConfigUpdate("word-fusion", { wordTarget: 51 }), {
    ok: false,
    error: "wordTarget must be at most 50 for word-fusion",
  });
});

test("admin game config applies to standard play but not friend challenges", () => {
  const game = {
    timeLimitSeconds: 120,
    wordTarget: 7,
    livesCount: 3,
  };
  assert.deepEqual(
    getStandardPlayGameConfig(game, {
      isSenderMode: false,
      isReceiverMode: false,
      isCustomPlay: false,
    }),
    game,
  );
  assert.deepEqual(
    getStandardPlayGameConfig(game, {
      isSenderMode: true,
      isReceiverMode: false,
      isCustomPlay: false,
    }),
    {},
  );
  assert.deepEqual(
    getStandardPlayGameConfig(game, {
      isSenderMode: false,
      isReceiverMode: true,
      isCustomPlay: false,
    }),
    {},
  );
});

const standardContext = {
  isSenderMode: false,
  isReceiverMode: false,
  isCustomPlay: false,
};

test("game detail rules use configured time limit and word target", () => {
  assert.deepEqual(
    getGameDetailRules(
      {
        slug: "word-fusion",
        rules: ["Complete 5 rounds before the 90-second timer ends"],
        timeLimitSeconds: 120,
        wordTarget: 8,
      },
      standardContext,
    ),
    ["Complete 8 rounds before the 2-minute timer ends"],
  );
});

test("combined game detail rules update either configured value independently", () => {
  assert.deepEqual(
    getGameDetailRules(
      {
        slug: "word-roots",
        rules: ["Complete 5 rounds in 3 minutes"],
        wordTarget: 4,
      },
      standardContext,
    ),
    ["Complete 4 rounds in 3 minutes"],
  );
  assert.deepEqual(
    getGameDetailRules(
      {
        slug: "word-fusion",
        rules: ["Complete 5 rounds before the 90-second timer ends"],
        timeLimitSeconds: 45,
      },
      standardContext,
    ),
    ["Complete 5 rounds before the 45-second timer ends"],
  );
});

test("game detail rules use configured lives", () => {
  assert.deepEqual(
    getGameDetailRules(
      {
        slug: "word-scramble",
        rules: ["You have 3 lives - wrong answers lose a life"],
        livesCount: 5,
      },
      standardContext,
    ),
    ["You have 5 lives - wrong answers lose a life"],
  );
});

test("game detail descriptions use configured time limit, word target, and singular life", () => {
  assert.equal(
    getGameDetailDescription(
      {
        slug: "ladder-rush",
        longDescription: "Keep the chain going as long as possible in 90 seconds.",
        timeLimitSeconds: 120,
      },
      standardContext,
    ),
    "Keep the chain going as long as possible in 2 minutes.",
  );
  assert.equal(
    getGameDetailDescription(
      {
        slug: "word-chain",
        longDescription: "Complete 100 words per level to advance!",
        wordTarget: 12,
      },
      standardContext,
    ),
    "Complete 12 words per level to advance!",
  );
  assert.equal(
    getGameDetailDescription(
      {
        slug: "word-scramble",
        longDescription: "Be careful - you only have 3 lives!",
        livesCount: 1,
      },
      standardContext,
    ),
    "Be careful - you only have 1 life!",
  );
  assert.deepEqual(
    getGameDetailRules(
      {
        slug: "word-scramble",
        rules: ["You have 3 lives - wrong answers lose a life"],
        livesCount: 1,
      },
      standardContext,
    ),
    ["You have 1 life - wrong answers lose a life"],
  );
});

test("game detail rules retain built-in defaults without overrides", () => {
  const rules = ["Complete 5 rounds before the 90-second timer ends"];
  assert.equal(
    getGameDetailRules(
      {
        slug: "word-fusion",
        rules,
        timeLimitSeconds: null,
        wordTarget: undefined,
      },
      standardContext,
    ),
    rules,
  );
});

test("game detail rules retain mode-specific instructions outside standard play", () => {
  const game = {
    slug: "word-fusion",
    rules: ["Complete 5 rounds before the 90-second timer ends"],
    timeLimitSeconds: 120,
    wordTarget: 8,
  };

  for (const context of [
    { ...standardContext, isSenderMode: true },
    { ...standardContext, isReceiverMode: true },
    { ...standardContext, isCustomPlay: true },
  ]) {
    assert.equal(getGameDetailRules(game, context), game.rules);
  }
});

test("game detail descriptions retain mode-specific instructions outside standard play", () => {
  const game = {
    slug: "letter-dodge",
    longDescription: "Classic mode gives 90 seconds.",
    timeLimitSeconds: 240,
  };

  for (const context of [
    { ...standardContext, isSenderMode: true },
    { ...standardContext, isReceiverMode: true },
    { ...standardContext, isCustomPlay: true },
  ]) {
    assert.equal(getGameDetailDescription(game, context), game.longDescription);
  }
});
