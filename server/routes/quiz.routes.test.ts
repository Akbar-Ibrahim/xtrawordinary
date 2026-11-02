import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { MemStorage } from "../mem-storage";
import { registerQuizRoutes } from "./quiz.routes";
import { initStorage } from "../storage";
import { errorHandler } from "../middleware/error-handler";
import {
  configureErrorHandling,
  configureRequestPipeline,
} from "../middleware/request-pipeline";

const TEST_USER_ID = 9867967;

type TestContext = {
  baseUrl: string;
  testStorage: MemStorage;
};

async function withRouteTestServer(
  run: (context: TestContext) => Promise<void>,
  useConfiguredPipeline = false,
): Promise<void> {
  const previousStorageMode = process.env.STORAGE_MODE;
  process.env.STORAGE_MODE = "memory";
  let testStorage: MemStorage;
  try {
    const initializedStorage = await initStorage();
    assert.ok(initializedStorage instanceof MemStorage, "route tests use in-memory storage");
    testStorage = initializedStorage;
  } finally {
    if (previousStorageMode === undefined) delete process.env.STORAGE_MODE;
    else process.env.STORAGE_MODE = previousStorageMode;
  }

  const app = express();
  if (useConfiguredPipeline) configureRequestPipeline(app);
  else app.use(express.json({ strict: false }));
  app.use((req: any, _res, next) => {
    req.isAuthenticated = () => true;
    req.user = {
      id: TEST_USER_ID,
      username: "quiz-body-test",
      name: "Quiz Body Test",
      isPremium: true,
    };
    next();
  });
  registerQuizRoutes(app);
  if (useConfiguredPipeline) configureErrorHandling(app);
  else app.use(errorHandler);

  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test server port");
    await run({ baseUrl: `http://127.0.0.1:${address.port}`, testStorage });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

type InvalidBody = {
  label: string;
  present: boolean;
  value?: unknown;
};

const INVALID_BODIES: InvalidBody[] = [
  { label: "missing", present: false },
  { label: "null", present: true, value: null },
  { label: "string", present: true, value: "not an object" },
  { label: "number", present: true, value: 42 },
  { label: "boolean", present: true, value: false },
  { label: "array", present: true, value: [] },
];

async function sendRequest(
  baseUrl: string,
  path: string,
  method: "POST" | "PATCH",
  body: InvalidBody,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    ...(body.present
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body.value),
        }
      : {}),
  });
}

async function sendMalformedJsonRequest(
  baseUrl: string,
  path: string,
  method: "POST" | "PATCH",
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: '{"malformed":',
  });
}

let nextQuizTestCode = 0;

async function createTestQuiz(testStorage: MemStorage) {
  return testStorage.createQuizSession({
    creatorId: TEST_USER_ID,
    gameSlug: "letter-balance",
    title: "Quiz body validation test",
    description: null,
    shareCode: `QBODY${String(++nextQuizTestCode).padStart(3, "0")}`,
    params: {},
    closesAt: null,
  });
}

test("quiz-session creation rejects missing and non-object request bodies without creating sessions", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const sessionsBefore = await testStorage.getQuizSessionsByCreator(TEST_USER_ID);

    for (const invalidBody of INVALID_BODIES) {
      const response = await sendRequest(baseUrl, "/api/quiz-sessions", "POST", invalidBody);
      assert.equal(response.status, 400, invalidBody.label);
      assert.deepEqual(await response.json(), { error: "Request body must be a JSON object" });
      assert.deepEqual(
        await testStorage.getQuizSessionsByCreator(TEST_USER_ID),
        sessionsBefore,
        invalidBody.label,
      );
    }
  });
});

test("Word Stack can be created as a quiz with its selected shared challenge", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const response = await sendRequest(baseUrl, "/api/quiz-sessions", "POST", {
      label: "Word Stack quiz",
      present: true,
      value: {
        gameSlug: "word-stack",
        title: "Word Stack Night",
        params: { challenge: "break-down" },
      },
    });

    assert.equal(response.status, 200);
    const createdQuiz = await response.json();
    assert.equal(createdQuiz.gameSlug, "word-stack");
    assert.deepEqual(createdQuiz.params, { challenge: "break-down" });
    assert.deepEqual(
      await testStorage.getQuizSessionByCode(createdQuiz.shareCode),
      createdQuiz,
    );
  });
});

test("quiz settings can be reused into a fresh session without carrying over scores", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const source = await testStorage.createQuizSession({
      creatorId: TEST_USER_ID,
      gameSlug: "letter-balance",
      title: "Reusable quiz",
      description: "Instructions for players",
      shareCode: `QREUSE${String(++nextQuizTestCode).padStart(3, "0")}`,
      params: { category: "locked_balance", level: 5, consonantCount: 2, customRules: ["extra"] },
      closesAt: null,
    });
    await testStorage.addQuizSessionScore(source.id, TEST_USER_ID, 120);

    const response = await sendRequest(baseUrl, `/api/quiz-sessions/${source.shareCode}/duplicate`, "POST", {
      label: "reuse settings",
      present: true,
      value: {
        title: "Friday round",
        description: "Updated instructions for Friday",
        closesAt: "2031-04-05T12:30:00.000Z",
      },
    });

    assert.equal(response.status, 200);
    const duplicate = await response.json();
    assert.notEqual(duplicate.id, source.id);
    assert.notEqual(duplicate.shareCode, source.shareCode);
    assert.equal(duplicate.creatorId, TEST_USER_ID);
    assert.equal(duplicate.gameSlug, source.gameSlug);
    assert.equal(duplicate.title, "Friday round");
    assert.equal(duplicate.description, "Updated instructions for Friday");
    assert.deepEqual(duplicate.params, source.params);
    assert.equal(duplicate.closesAt, "2031-04-05T12:30:00.000Z");
    assert.equal((await testStorage.getQuizSessionByCode(source.shareCode))?.description, "Instructions for players");
    assert.equal((await testStorage.getQuizSessionScores(duplicate.id)).length, 0);
    assert.equal((await testStorage.getQuizSessionScores(source.id)).length, 1);

    const noCloseDateResponse = await sendRequest(baseUrl, `/api/quiz-sessions/${source.shareCode}/duplicate`, "POST", {
      label: "reuse settings without close date",
      present: true,
      value: { title: "Always open" },
    });
    assert.equal(noCloseDateResponse.status, 200);
    const noCloseDateDuplicate = await noCloseDateResponse.json();
    assert.equal(noCloseDateDuplicate.closesAt, null);
    assert.equal(noCloseDateDuplicate.description, source.description);

    const clearedDescriptionResponse = await sendRequest(
      baseUrl,
      `/api/quiz-sessions/${source.shareCode}/duplicate`,
      "POST",
      {
        label: "reuse settings with cleared instructions",
        present: true,
        value: { title: "No instructions", description: "   " },
      },
    );
    assert.equal(clearedDescriptionResponse.status, 200);
    assert.equal((await clearedDescriptionResponse.json()).description, null);
    assert.equal((await testStorage.getQuizSessionByCode(source.shareCode))?.description, "Instructions for players");
  });
});

test("quiz settings cannot be reused by a non-creator or with invalid titles and close dates", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const source = await testStorage.createQuizSession({
      creatorId: TEST_USER_ID + 1,
      gameSlug: "letter-balance",
      title: "Another host's quiz",
      description: null,
      shareCode: `QREUSE${String(++nextQuizTestCode).padStart(3, "0")}`,
      params: {},
      closesAt: null,
    });
    const sessionsBefore = await testStorage.getQuizSessionsByCreator(TEST_USER_ID);
    const forbiddenResponse = await sendRequest(baseUrl, `/api/quiz-sessions/${source.shareCode}/duplicate`, "POST", {
      label: "non-creator",
      present: true,
      value: { title: "Not allowed" },
    });
    assert.equal(forbiddenResponse.status, 403);
    assert.deepEqual(await testStorage.getQuizSessionsByCreator(TEST_USER_ID), sessionsBefore);

    const ownedSource = await createTestQuiz(testStorage);
    const sessionsBeforeInvalidRequests = await testStorage.getQuizSessionsByCreator(TEST_USER_ID);
    for (const value of [
      { title: "   " },
      { title: "Invalid close date", closesAt: "not-a-date" },
      { title: "Non-string close date", closesAt: 123 },
      { title: "Non-string description", description: 123 },
    ]) {
      const response = await sendRequest(baseUrl, `/api/quiz-sessions/${ownedSource.shareCode}/duplicate`, "POST", {
        label: "invalid reuse request",
        present: true,
        value,
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await testStorage.getQuizSessionsByCreator(TEST_USER_ID), sessionsBeforeInvalidRequests);
    }
  });
});

test("quiz rule updates reject missing and non-object request bodies without changing rules", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const quiz = await createTestQuiz(testStorage);
    const originalParams = quiz.params;

    for (const invalidBody of INVALID_BODIES) {
      const response = await sendRequest(
        baseUrl,
        `/api/quiz-sessions/${quiz.shareCode}`,
        "PATCH",
        invalidBody,
      );
      assert.equal(response.status, 400, invalidBody.label);
      assert.deepEqual(await response.json(), { error: "Request body must be a JSON object" });
      assert.deepEqual((await testStorage.getQuizSessionByCode(quiz.shareCode))?.params, originalParams);
    }
  });
});

test("score submission rejects missing and non-object request bodies without creating scores", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const quiz = await createTestQuiz(testStorage);

    for (const invalidBody of INVALID_BODIES) {
      const response = await sendRequest(
        baseUrl,
        `/api/quiz-sessions/${quiz.shareCode}/scores`,
        "POST",
        invalidBody,
      );
      assert.equal(response.status, 400, invalidBody.label);
      assert.deepEqual(await response.json(), { error: "Request body must be a JSON object" });
      assert.deepEqual(await testStorage.getQuizSessionScores(quiz.id), []);
    }
  });
});

test("malformed JSON on quiz mutations returns a clear error without persisting changes", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const quiz = await createTestQuiz(testStorage);
    const sessionsAfterCreate = await testStorage.getQuizSessionsByCreator(TEST_USER_ID);
    const originalParams = quiz.params;

    const createResponse = await sendMalformedJsonRequest(baseUrl, "/api/quiz-sessions", "POST");
    assert.equal(createResponse.status, 400);
    assert.deepEqual(await createResponse.json(), { error: "Invalid JSON request body" });
    assert.deepEqual(await testStorage.getQuizSessionsByCreator(TEST_USER_ID), sessionsAfterCreate);

    const duplicateResponse = await sendMalformedJsonRequest(
      baseUrl,
      `/api/quiz-sessions/${quiz.shareCode}/duplicate`,
      "POST",
    );
    assert.equal(duplicateResponse.status, 400);
    assert.deepEqual(await duplicateResponse.json(), { error: "Invalid JSON request body" });
    assert.deepEqual(await testStorage.getQuizSessionsByCreator(TEST_USER_ID), sessionsAfterCreate);

    const updateResponse = await sendMalformedJsonRequest(
      baseUrl,
      `/api/quiz-sessions/${quiz.shareCode}`,
      "PATCH",
    );
    assert.equal(updateResponse.status, 400);
    assert.deepEqual(await updateResponse.json(), { error: "Invalid JSON request body" });
    assert.deepEqual((await testStorage.getQuizSessionByCode(quiz.shareCode))?.params, originalParams);

    const scoreResponse = await sendMalformedJsonRequest(
      baseUrl,
      `/api/quiz-sessions/${quiz.shareCode}/scores`,
      "POST",
    );
    assert.equal(scoreResponse.status, 400);
    assert.deepEqual(await scoreResponse.json(), { error: "Invalid JSON request body" });
    assert.deepEqual(await testStorage.getQuizSessionScores(quiz.id), []);
  }, true);
});

test("malformed JSON on non-quiz routes keeps the existing error response", async () => {
  await withRouteTestServer(async ({ baseUrl }) => {
    const response = await sendMalformedJsonRequest(baseUrl, "/api/not-a-quiz-route", "POST");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { message: "Invalid JSON request body" });
  }, true);
});

test("score submission saves once and duplicate submissions preserve the original score", async () => {
  await withRouteTestServer(async ({ baseUrl, testStorage }) => {
    const quiz = await createTestQuiz(testStorage);
    const scorePath = `/api/quiz-sessions/${quiz.shareCode}/scores`;

    const firstResponse = await sendRequest(baseUrl, scorePath, "POST", {
      label: "valid score",
      present: true,
      value: { score: 135 },
    });
    assert.equal(firstResponse.status, 200);
    const originalScore = await firstResponse.json();
    assert.equal(originalScore.score, 135);
    assert.deepEqual(
      await testStorage.getQuizSessionScore(quiz.id, TEST_USER_ID),
      originalScore,
    );
    assert.equal((await testStorage.getQuizSessionScores(quiz.id)).length, 1);

    const duplicateResponse = await sendRequest(baseUrl, scorePath, "POST", {
      label: "duplicate score",
      present: true,
      value: { score: 999 },
    });
    assert.equal(duplicateResponse.status, 409);
    assert.deepEqual(await duplicateResponse.json(), {
      error: "Already submitted",
      score: originalScore,
    });
    assert.deepEqual(
      await testStorage.getQuizSessionScore(quiz.id, TEST_USER_ID),
      originalScore,
    );
    const scores = await testStorage.getQuizSessionScores(quiz.id);
    assert.equal(scores.length, 1);
    assert.equal(scores[0].score, 135);
  });
});
