import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { MemStorage } from "../mem-storage";
import { registerGroupsRoutes } from "../routes/groups.routes";
import { registerQuizRoutes } from "../routes/quiz.routes";
import { initStorage, storage } from "../storage";
import {
  checkLockedBalanceConfigAvailability,
  getLockedBalanceAvailability,
  getLockedBalancePairKey,
} from "./letter-balance-availability";

const TEST_USER_ID = 987654;
const LOCKED_BALANCE_UNAVAILABLE = {
  category: "locked_balance",
  level: 4,
  consonantCount: 1,
};
const LOCKED_BALANCE_AVAILABLE = {
  category: "locked_balance",
  level: 4,
  consonantCount: 2,
};

async function withRouteTestServer(
  run: (context: {
    baseUrl: string;
    testStorage: MemStorage;
    setDictionary: (words: string[]) => void;
    setAuthenticatedUserId: (id: number) => void;
  }) => Promise<void>,
): Promise<void> {
  const previousStorageMode = process.env.STORAGE_MODE;
  process.env.STORAGE_MODE = "memory";
  let testStorage: MemStorage;
  try {
    const initializedStorage = await initStorage();
    assert.ok(initializedStorage instanceof MemStorage, "route tests use isolated in-memory storage");
    testStorage = initializedStorage;
  } finally {
    if (previousStorageMode === undefined) delete process.env.STORAGE_MODE;
    else process.env.STORAGE_MODE = previousStorageMode;
  }

  const originalGetWordDictionary = testStorage.getWordDictionary;
  let dictionary = ["ABLE"];
  testStorage.getWordDictionary = async () => dictionary;
  let authenticatedUserId = TEST_USER_ID;

  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.isAuthenticated = () => true;
    req.user = { id: authenticatedUserId, username: "letter-balance-test", name: "Letter Balance Test", isPremium: true };
    next();
  });
  registerQuizRoutes(app);
  registerGroupsRoutes(app);

  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server port");
    await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      testStorage,
      setDictionary: (words) => {
        dictionary = words;
      },
      setAuthenticatedUserId: (id) => {
        authenticatedUserId = id;
      },
    });
  } finally {
    testStorage.getWordDictionary = originalGetWordDictionary;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function postJson(baseUrl: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patchJson(baseUrl: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let nextQuizTestCode = 0;

async function createLockedBalanceQuiz(
  testStorage: MemStorage,
  params: Record<string, unknown> = LOCKED_BALANCE_AVAILABLE,
  shareCode = `LBED${String(++nextQuizTestCode).padStart(4, "0")}`,
) {
  return testStorage.createQuizSession({
    creatorId: TEST_USER_ID,
    gameSlug: "letter-balance",
    title: "Locked Balance edit test",
    description: null,
    shareCode,
    params,
    closesAt: null,
  });
}

async function createTestGroup(testStorage: MemStorage): Promise<number> {
  const group = await testStorage.createGroup({
    name: "Locked Balance route test group",
    description: null,
    creatorId: TEST_USER_ID,
    inviteCode: `LBTEST${Date.now()}${Math.floor(Math.random() * 100000)}`,
    isPublic: false,
    isFeatured: false,
    tags: null,
    pinnedAnnouncement: null,
  });
  await testStorage.addGroupMember(group.id, TEST_USER_ID, "owner");
  return group.id;
}

test("Locked Balance availability covers every selectable setting in the real word source", async () => {
  const dictionary = await new MemStorage().getWordDictionary();
  const availability = getLockedBalanceAvailability(dictionary);

  for (let length = 4; length <= 10; length++) {
    for (let consonantCount = 1; consonantCount < length; consonantCount++) {
      const key = getLockedBalancePairKey(length, consonantCount);
      const hasValidWord = dictionary.some((word) => {
        const upper = word.toUpperCase();
        const actualConsonants = upper.split("").filter(
          (character) => /[A-Z]/.test(character) && !"AEIOU".includes(character),
        ).length;
        return upper.length === length && actualConsonants === consonantCount;
      });

      assert.equal(availability[key], hasValidWord, `${length} letters / ${consonantCount} consonants`);
    }
  }

  assert.equal(Object.keys(availability).length, 42, "all selectable boundary combinations are represented");
});

test("Locked Balance saved settings are checked against the active dictionary", () => {
  const dictionary = ["ABLE", "BRAIN", "STREET"];

  assert.equal(
    checkLockedBalanceConfigAvailability(dictionary, { category: "locked_balance", level: 4, consonantCount: 2 }),
    "available",
  );
  assert.equal(
    checkLockedBalanceConfigAvailability(dictionary, { category: "locked_balance", level: 4, consonantCount: 1 }),
    "unavailable",
  );
  assert.equal(
    checkLockedBalanceConfigAvailability(dictionary, { category: "locked_balance", level: 4, consonantCount: 4 }),
    "unavailable",
  );
  assert.equal(
    checkLockedBalanceConfigAvailability(dictionary, { category: "vowel_count", level: 2 }),
    "not_locked_balance",
  );
});

test("POST /api/quiz-sessions rejects unavailable Locked Balance rules and accepts available ones", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const unavailable = await postJson(baseUrl, "/api/quiz-sessions", {
      gameSlug: "letter-balance",
      title: "Unavailable rules",
      params: LOCKED_BALANCE_UNAVAILABLE,
    });
    assert.equal(unavailable.status, 400);
    assert.deepEqual(await testStorage.getQuizSessionsByCreator(TEST_USER_ID), []);

    const available = await postJson(baseUrl, "/api/quiz-sessions", {
      gameSlug: "letter-balance",
      title: "Available rules",
      params: LOCKED_BALANCE_AVAILABLE,
    });
    assert.equal(available.status, 200);
    assert.deepEqual((await available.json() as { params: unknown }).params, LOCKED_BALANCE_AVAILABLE);
    assert.equal((await testStorage.getQuizSessionsByCreator(TEST_USER_ID)).length, 1);
  });
});

test("PATCH /api/quiz-sessions/:code rejects updates from non-creators without changing the quiz", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage, setAuthenticatedUserId }) => {
    const quiz = await createLockedBalanceQuiz(testStorage);
    setAuthenticatedUserId(TEST_USER_ID + 1);

    const response = await patchJson(baseUrl, `/api/quiz-sessions/${quiz.shareCode}`, {
      length: 5,
      consonantCount: 3,
    });

    assert.equal(response.status, 403);
    assert.deepEqual((await testStorage.getQuizSessionByCode(quiz.shareCode))?.params, LOCKED_BALANCE_AVAILABLE);
  });
});

test("PATCH /api/quiz-sessions/:code rejects invalid lengths and consonant counts without changing the quiz", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const quiz = await createLockedBalanceQuiz(testStorage);
    const invalidSettings = [
      { length: 3, consonantCount: 1 },
      { length: 11, consonantCount: 1 },
      { length: 4.5, consonantCount: 1 },
      { length: 4, consonantCount: 0 },
      { length: 4, consonantCount: 4 },
      { length: 4, consonantCount: 1.5 },
    ];

    for (const settings of invalidSettings) {
      const response = await patchJson(baseUrl, `/api/quiz-sessions/${quiz.shareCode}`, settings);
      assert.equal(response.status, 400, JSON.stringify(settings));
      assert.deepEqual((await testStorage.getQuizSessionByCode(quiz.shareCode))?.params, LOCKED_BALANCE_AVAILABLE);
    }
  });
});

test("PATCH /api/quiz-sessions/:code rejects rules unavailable in the active dictionary without changing the quiz", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage, setDictionary }) => {
    const quiz = await createLockedBalanceQuiz(testStorage);
    setDictionary(["ABLE"]);

    const response = await patchJson(baseUrl, `/api/quiz-sessions/${quiz.shareCode}`, {
      length: 4,
      consonantCount: 1,
    });

    assert.equal(response.status, 400);
    assert.deepEqual((await testStorage.getQuizSessionByCode(quiz.shareCode))?.params, LOCKED_BALANCE_AVAILABLE);
  });
});

test("PATCH /api/quiz-sessions/:code updates Locked Balance rules while preserving unrelated quiz params", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage, setDictionary }) => {
    const originalParams = {
      ...LOCKED_BALANCE_AVAILABLE,
      mode: 2,
      customRules: { includeRareWords: true },
    };
    const quiz = await createLockedBalanceQuiz(testStorage, originalParams);
    assert.deepEqual((await testStorage.getQuizSessionByCode(quiz.shareCode))?.params, originalParams);
    setDictionary(["ABLE", "BRAVE"]);

    const response = await patchJson(baseUrl, `/api/quiz-sessions/${quiz.shareCode}`, {
      length: 5,
      consonantCount: 3,
    });

    assert.equal(response.status, 200);
    const expectedParams = {
      ...originalParams,
      level: 5,
      consonantCount: 3,
    };
    assert.deepEqual((await response.json() as { params: unknown }).params, expectedParams);
    assert.deepEqual((await testStorage.getQuizSessionByCode(quiz.shareCode))?.params, expectedParams);
  });
});

test("group round creation rejects unavailable Locked Balance rules and accepts available ones", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const groupId = await createTestGroup(testStorage);

    const unavailableAdHoc = await postJson(baseUrl, `/api/groups/${groupId}/rounds`, {
      gameSlug: "letter-balance",
      gameConfig: LOCKED_BALANCE_UNAVAILABLE,
    });
    assert.equal(unavailableAdHoc.status, 400);
    assert.deepEqual(await testStorage.getGroupRounds(groupId), []);

    const availableAdHoc = await postJson(baseUrl, `/api/groups/${groupId}/rounds`, {
      gameSlug: "letter-balance",
      gameConfig: LOCKED_BALANCE_AVAILABLE,
    });
    assert.equal(availableAdHoc.status, 201);
    assert.equal((await testStorage.getGroupRounds(groupId)).length, 1);

    const now = Date.now();
    const season = await testStorage.createGroupSeason({
      groupId,
      name: "Locked Balance route test season",
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
      status: "active",
      createdById: TEST_USER_ID,
    });

    const unavailableConfigured = await postJson(
      baseUrl,
      `/api/groups/${groupId}/seasons/${season.id}/rounds/configured`,
      { gameSlug: "letter-balance", params: LOCKED_BALANCE_UNAVAILABLE },
    );
    assert.equal(unavailableConfigured.status, 400);
    assert.equal((await testStorage.getGroupRounds(groupId)).length, 1);

    const availableConfigured = await postJson(
      baseUrl,
      `/api/groups/${groupId}/seasons/${season.id}/rounds/configured`,
      { gameSlug: "letter-balance", params: LOCKED_BALANCE_AVAILABLE },
    );
    assert.equal(availableConfigured.status, 201);
    assert.equal((await testStorage.getGroupRounds(groupId)).length, 2);
  });
});

test("a group round cannot begin after its Locked Balance words disappear", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage, setDictionary }) => {
    const groupId = await createTestGroup(testStorage);
    const round = await testStorage.createGroupRound({
      groupId,
      gameSlug: "letter-balance",
      seed: 123,
      status: "active",
      createdById: TEST_USER_ID,
      closesAt: null,
      gameConfig: JSON.stringify(LOCKED_BALANCE_AVAILABLE),
      seasonId: null,
    });

    setDictionary([]);
    const response = await postJson(
      baseUrl,
      `/api/groups/${groupId}/rounds/${round.id}/attempt`,
      {},
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await testStorage.getGroupRoundAttempt(round.id, TEST_USER_ID), undefined);
  });
});
