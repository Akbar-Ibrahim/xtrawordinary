import assert from "node:assert/strict";
import test from "node:test";
import {
  getChallengeCompletionConfigSummary,
  getChallengeInvitationNotificationBody,
  getChallengeResultNotificationBody,
  registerChallengesRoutes,
  validateLetterBalanceChallengeConfig,
} from "./challenges.routes";
import { parseSavedLetterBalanceChallengeConfig } from "@shared/letter-balance-challenge";
import { initStorage } from "../storage";
import { MemStorage } from "../mem-storage";
import { getLockedBalanceAvailability, getLockedBalancePairKey } from "../games/letter-balance-availability";

function getCompleteChallengeHandler(): (req: any, res: any) => Promise<void> {
  let handler: ((req: any, res: any) => Promise<void>) | undefined;
  const app = {
    post(path: string, ...handlers: Array<(req: any, res: any) => unknown>) {
      if (path === "/api/challenges/:id/complete") {
        handler = handlers[1] as (req: any, res: any) => Promise<void>;
      }
      return this;
    },
    get() {
      return this;
    },
  };
  registerChallengesRoutes(app as any);
  assert.ok(handler, "POST /api/challenges/:id/complete handler is registered");
  return handler;
}

function getCreateChallengeHandler(): (req: any, res: any) => Promise<void> {
  let handler: ((req: any, res: any) => Promise<void>) | undefined;
  const app = {
    post(path: string, ...handlers: Array<(req: any, res: any) => unknown>) {
      if (path === "/api/challenges") {
        handler = handlers[1] as (req: any, res: any) => Promise<void>;
      }
      return this;
    },
    get() {
      return this;
    },
  };
  registerChallengesRoutes(app as any);
  assert.ok(handler, "POST /api/challenges handler is registered");
  return handler;
}

test("received Random Letter Balance invitations identify the random challenge", () => {
  assert.equal(
    getChallengeInvitationNotificationBody("@alice", "letter-balance", 875, null),
    "@alice wants you to beat their Letter Balance score of 875 · Random",
  );
});

test("received Locked Balance invitations include the saved category and level", () => {
  assert.equal(
    getChallengeInvitationNotificationBody(
      "@alice",
      "letter-balance",
      875,
      JSON.stringify({ category: "locked_balance", level: 6, consonantCount: 3 }),
    ),
    "@alice wants you to beat their Letter Balance score of 875 · Locked Balance · 6-letter words · 3C/3V",
  );
});

test("received Letter Dodge invitations include the saved difficulty and Survival mode", () => {
  assert.equal(
    getChallengeInvitationNotificationBody(
      "@alice",
      "letter-dodge",
      425,
      JSON.stringify({ difficulty: 3, survival: true }),
    ),
    "@alice wants you to beat their Letter Dodge score of 425 · Hard (3 letters) · Survival",
  );
});

test("unconfigured Letter Dodge invitations keep the existing text", () => {
  assert.equal(
    getChallengeInvitationNotificationBody("@alice", "letter-dodge", 0, null),
    "@alice wants you to beat their Letter Dodge score of 0",
  );
});

test("other received challenge invitation text remains unchanged", () => {
  assert.equal(
    getChallengeInvitationNotificationBody("@alice", "word-fusion", 210, JSON.stringify({ level: 3 })),
    "@alice wants you to beat their Word Fusion score of 210",
  );
});

test("random Letter Balance completion notifications identify the random challenge", () => {
  assert.equal(
    getChallengeCompletionConfigSummary("letter-balance", null),
    " · Random",
  );
  assert.equal(
    getChallengeCompletionConfigSummary(
      "letter-balance",
      JSON.stringify({ category: "start_end_vowel", level: "advanced" }),
    ),
    " · Start & End Vowels · Advanced",
  );
});

test("Locked Balance completion notifications include the saved word length and letter balance", () => {
  assert.equal(
    getChallengeCompletionConfigSummary(
      "letter-balance",
      JSON.stringify({ category: "locked_balance", level: 6, consonantCount: 3 }),
    ),
    " · Locked Balance · 6-letter words · 3C/3V",
  );
});

test("other challenge notification summaries retain their existing behavior", () => {
  assert.equal(
    getChallengeCompletionConfigSummary(
      "letter-dodge",
      JSON.stringify({ difficulty: 3, survival: true }),
    ),
    " · Hard (3 letters) · Survival",
  );
  assert.equal(
    getChallengeCompletionConfigSummary("word-fusion", JSON.stringify({ level: 3 })),
    "",
  );
});

test("challenge result notifications use the completed challenge score and keep its saved rule summary", () => {
  const completedChallenge = {
    gameSlug: "letter-balance",
    gameConfig: JSON.stringify({ category: "locked_balance", level: 6, consonantCount: 3 }),
    receiverScore: 875,
  };

  assert.equal(
    getChallengeResultNotificationBody("@bob", completedChallenge),
    "@bob completed your Letter Balance challenge with a score of 875 · Locked Balance · 6-letter words · 3C/3V",
  );
});

test("challenge result alerts link directly to the completed challenge", async () => {
  const testStorage = await initStorage();
  const challenge = await testStorage.createFriendChallenge({
    senderId: 98101,
    receiverId: 98102,
    gameSlug: "word-fusion",
    senderScore: 120,
    receiverScore: null,
    status: "pending",
    message: null,
    seed: null,
    gameConfig: null,
    senderViewed: false,
    receiverViewed: false,
  });
  const completeChallenge = getCompleteChallengeHandler();
  await completeChallenge(
    {
      params: { id: String(challenge.id) },
      body: { score: 175 },
      user: { id: challenge.receiverId, username: "bob" },
    },
    {
      status() {
        return this;
      },
      json() {},
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  const [notification] = await testStorage.getNotifications(challenge.senderId);
  assert.equal(
    notification?.linkUrl,
    `/friends?tab=challenges&challengeId=${challenge.id}`,
  );
});

test("Letter Balance challenge validation accepts supported numeric levels and Advanced categories", () => {
  const validConfigs = [
    { category: "consonant_count", level: 2 },
    { category: "consonant_count", level: 7 },
    { category: "vowel_count", level: 4 },
    { category: "start_end_vowel", level: 4 },
    { category: "start_end_consonant", level: 12 },
    { category: "start_vowel_end_consonant", level: "advanced" },
    { category: "start_consonant_end_vowel", level: "advanced" },
    { category: "consonant_count", level: "advanced" },
    { category: "vowel_count", level: "advanced" },
    { category: "start_end_vowel", level: "advanced" },
    { category: "start_end_consonant", level: "advanced" },
    { category: "locked_balance", level: 4, consonantCount: 1 },
    { category: "locked_balance", level: 10, consonantCount: 9 },
  ];

  for (const config of validConfigs) {
    assert.equal(validateLetterBalanceChallengeConfig(config), undefined, JSON.stringify(config));
  }
});

test("Letter Balance challenge validation rejects unsupported categories, levels, and Advanced rules", () => {
  const invalidConfigs = [
    {},
    { category: "unknown", level: 4 },
    { category: "consonant_count", level: 1 },
    { category: "consonant_count", level: 8 },
    { category: "consonant_count", level: 2.5 },
    { category: "start_end_vowel", level: 3 },
    { category: "start_end_vowel", level: 13 },
    { category: "locked_balance", level: "advanced", consonantCount: 2 },
  ];

  for (const config of invalidConfigs) {
    assert.ok(validateLetterBalanceChallengeConfig(config), JSON.stringify(config));
  }
  assert.ok(validateLetterBalanceChallengeConfig(null));
  assert.ok(validateLetterBalanceChallengeConfig([]));
});

test("Locked Balance requires a consonant count within the selected word length", () => {
  for (const consonantCount of [undefined, 0, -1, 4, 5, 2.5, "2"]) {
    assert.equal(
      validateLetterBalanceChallengeConfig({
        category: "locked_balance",
        level: 4,
        ...(consonantCount === undefined ? {} : { consonantCount }),
      }),
      "Locked Balance requires a valid consonant count between 1 and the word length minus 1",
      `consonantCount=${String(consonantCount)}`,
    );
  }
});

test("non-Locked Balance categories reject irrelevant consonant counts", () => {
  assert.equal(
    validateLetterBalanceChallengeConfig({
      category: "consonant_count",
      level: 3,
      consonantCount: 2,
    }),
    "Consonant count is only valid for Locked Balance",
  );
});

test("saved Letter Balance challenge settings parse supported legacy records", () => {
  assert.deepEqual(
    parseSavedLetterBalanceChallengeConfig(
      JSON.stringify({ category: "start_end_vowel", level: "advanced" }),
    ),
    {
      kind: "configured",
      config: { category: "start_end_vowel", level: "advanced" },
    },
  );
  assert.deepEqual(
    parseSavedLetterBalanceChallengeConfig(
      JSON.stringify({ category: "locked_balance", level: 6, consonantCount: 3 }),
    ),
    {
      kind: "configured",
      config: { category: "locked_balance", level: 6, consonantCount: 3 },
    },
  );
  assert.deepEqual(parseSavedLetterBalanceChallengeConfig(null), { kind: "random" });
});

test("saved malformed Letter Balance challenge settings are rejected before game launch", () => {
  const legacyConfigs = [
    "{not-json",
    JSON.stringify({ category: "removed_category", level: 4 }),
    JSON.stringify({ category: "consonant_count", level: 1 }),
    JSON.stringify({ category: "locked_balance", level: 6 }),
    JSON.stringify({ category: "locked_balance", level: 6, consonantCount: 6 }),
    JSON.stringify({ category: "vowel_count", level: 3, consonantCount: 2 }),
  ];

  for (const config of legacyConfigs) {
    assert.deepEqual(
      parseSavedLetterBalanceChallengeConfig(config),
      { kind: "invalid" },
      config,
    );
  }
});

test("POST /api/challenges returns clear errors for invalid Letter Balance configurations", async () => {
  const postChallenge = getCreateChallengeHandler();
  const cases = [
    {
      gameConfig: { category: "consonant_count", level: 8 },
      error: "Valid Letter Balance category and level are required",
    },
    {
      gameConfig: { category: "locked_balance", level: 6 },
      error: "Locked Balance requires a valid consonant count between 1 and the word length minus 1",
    },
    {
      gameConfig: { category: "locked_balance", level: 6, consonantCount: 6 },
      error: "Locked Balance requires a valid consonant count between 1 and the word length minus 1",
    },
    {
      gameConfig: { category: "vowel_count", level: 3, consonantCount: 2 },
      error: "Consonant count is only valid for Locked Balance",
    },
    {
      gameConfig: { category: "locked_balance", level: "advanced", consonantCount: 2 },
      error: "Valid Letter Balance category and level are required",
    },
  ];

  for (const { gameConfig, error } of cases) {
    let statusCode = 200;
    let responseBody: { error?: string } | undefined;
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: { error?: string }) {
        responseBody = body;
        return this;
      },
    };

    await postChallenge(
      {
        body: { friendId: 2, gameSlug: "letter-balance", score: 100, gameConfig },
        user: { id: 1, username: "alice" },
      },
      response,
    );
    assert.equal(statusCode, 400, JSON.stringify(gameConfig));
    assert.equal(responseBody?.error, error, JSON.stringify(gameConfig));
  }
});

test("POST /api/challenges rejects a Locked Balance setting with no dictionary answers", async () => {
  const dictionary = await new MemStorage().getWordDictionary();
  const availability = getLockedBalanceAvailability(dictionary);
  const unavailable = Object.entries(availability).find(([, available]) => !available);
  assert.ok(unavailable, "the real word source has at least one unavailable setting");
  await initStorage();

  const [length, consonantCount] = unavailable[0].split(":").map(Number);
  assert.equal(availability[getLockedBalancePairKey(length, consonantCount)], false);
  const postChallenge = getCreateChallengeHandler();
  let statusCode = 200;
  let responseBody: { error?: string } | undefined;

  await postChallenge(
    {
      body: {
        friendId: 2,
        gameSlug: "letter-balance",
        score: 100,
        gameConfig: { category: "locked_balance", level: length, consonantCount },
      },
      user: { id: 1, username: "alice" },
    },
    {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: { error?: string }) {
        responseBody = body;
        return this;
      },
    },
  );

  assert.equal(statusCode, 400);
  assert.equal(responseBody?.error, "No valid dictionary words match this Locked Balance setting");
});
