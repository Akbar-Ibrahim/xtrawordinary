import { test, expect } from "@playwright/test";
import {
  expireGameIntervals,
  holdGameIntervals,
  openResultGame,
} from "./game-result-helpers";

test("Word Chain ignores validation from the previous run after replay", async ({ page }) => {
  let releaseResponse!: () => void;
  let requestReceived!: () => void;
  const pendingResponse = new Promise<void>(resolve => { releaseResponse = resolve; });
  const validationReceived = new Promise<void>(resolve => { requestReceived = resolve; });
  let deferNextValidation = true;

  await page.route("**/api/games/word-chain/start", route =>
    route.fulfill({ json: { word: "CAT" } }),
  );
  await page.route("**/api/games/validate-word", async route => {
    if (deferNextValidation) {
      deferNextValidation = false;
      requestReceived();
      await pendingResponse;
    }
    await route.fulfill({ json: { valid: true } });
  });
  await page.route("**/api/games/word-chain/computer-word", route =>
    route.fulfill({ json: { word: "DOG" } }),
  );

  await openResultGame(page, "word-chain");
  await page.getByTestId("button-level-1").click();
  await page.getByTestId("input-word").fill("TREE");
  await page.getByTestId("button-submit").click();
  await validationReceived;
  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("heading-game-over")).toBeVisible();

  await page.getByTestId("button-play-again").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  releaseResponse();
  await expect(page.getByTestId("animated-number")).toHaveText("0");
  await expect(page.getByTestId("text-live-word-count")).toHaveText("0");
  await expect(page.getByText("DOG", { exact: true })).toHaveCount(0);
});

test("Word Stack ignores validation after End Game", async ({ page }) => {
  let releaseResponse!: () => void;
  let requestReceived!: () => void;
  const pendingResponse = new Promise<void>(resolve => { releaseResponse = resolve; });
  const validationReceived = new Promise<void>(resolve => { requestReceived = resolve; });

  await page.route("**/api/games/word-stack/puzzles", route =>
    route.fulfill({ json: [{ targetWord: "CAT", startWord: "AT" }] }),
  );
  await page.route("**/api/games/validate-word", async route => {
    requestReceived();
    await pendingResponse;
    await route.fulfill({ json: { valid: true } });
  });

  await openResultGame(page, "word-stack");
  await page.getByTestId("button-challenge-build-up").click();
  await page.getByTestId("input-word").fill("AT");
  await page.getByTestId("button-submit").click();
  await validationReceived;
  await page.getByTestId("button-end-game").click();
  await expect(page.getByRole("heading", { name: "Session Ended" })).toBeVisible();
  releaseResponse();
  await expect(page.getByText("Final Score: 0", { exact: false })).toBeVisible();
  await expect(page.getByText("Puzzles Completed: 0 of 1", { exact: true })).toBeVisible();
});

for (const slug of ["shell-words", "deep-shell-words"]) {
  const isDeep = slug === "deep-shell-words";
  const label = isDeep ? "Deep Shell Words" : "Shell Words";

  test(`${label} ignores validation that returns after timeout`, async ({ page }) => {
    await holdGameIntervals(page);
    let releaseResponse!: () => void;
    let requestReceived!: () => void;
    const pendingResponse = new Promise<void>(resolve => { releaseResponse = resolve; });
    const validationReceived = new Promise<void>(resolve => { requestReceived = resolve; });

    await page.route(`**/api/games/${slug}/validate?**`, async route => {
      requestReceived();
      await pendingResponse;
      await route.fulfill({ json: { valid: true, innerWord: "CAT" } });
    });
    await openResultGame(page, slug);
    await page.getByTestId("button-start-game").click();
    await expect(page.getByTestId("input-word")).toBeVisible();
    await page.getByTestId("input-word").fill("SCAT");
    await page.getByTestId("button-submit").click();
    await validationReceived;

    await expireGameIntervals(page, 90);
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    releaseResponse();
    await expect(page.getByTestId("text-final-score")).toHaveText("0");
    await expect(page.getByText("Run ended. You found 0 words.", { exact: true })).toBeVisible();
  });

  test(`${label} ignores a delayed next-puzzle response after End Game`, async ({ page }) => {
    let releaseResponse!: () => void;
    let requestReceived!: () => void;
    const pendingResponse = new Promise<void>(resolve => { releaseResponse = resolve; });
    const nextPuzzleReceived = new Promise<void>(resolve => { requestReceived = resolve; });
    let puzzleRequests = 0;
    const outerWord = isDeep ? "XXCATYY" : "ACATB";

    await page.route(`**/api/games/${slug}/puzzle?**`, async route => {
      puzzleRequests += 1;
      if (puzzleRequests === 1) {
        await route.fulfill({ json: { middle: "CAT", count: 1 } });
        return;
      }
      requestReceived();
      await pendingResponse;
      await route.fulfill({ json: { middle: "DOG", count: 1 } });
    });
    await page.route(`**/api/games/${slug}/validate?**`, route =>
      route.fulfill({ json: { valid: true, innerWord: "CAT" } }),
    );

    await openResultGame(page, slug);
    await page.getByTestId("button-variation-wrapper").click();
    await page.getByTestId("button-start-game").click();
    await expect(page.getByTestId("text-middle-word")).toHaveText("CAT");
    await page.getByTestId("input-word").fill(outerWord);
    await page.getByTestId("button-submit").click();
    await nextPuzzleReceived;

    await page.getByTestId("button-end-game").click();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    const finalScore = await page.getByTestId("text-final-score").innerText();
    releaseResponse();
    await expect(page.getByTestId("text-final-score")).toHaveText(finalScore);
    await expect(page.getByText(/Run ended\. You found 1 word\./)).toBeVisible();
  });
}

test("Deep Shell ignores an answer reveal from the previous run after replay", async ({ page }) => {
  let releaseResponse!: () => void;
  let requestReceived!: () => void;
  let responseFulfilled!: () => void;
  const pendingResponse = new Promise<void>(resolve => { releaseResponse = resolve; });
  const answerReceived = new Promise<void>(resolve => { requestReceived = resolve; });
  const answerResponseFulfilled = new Promise<void>(resolve => { responseFulfilled = resolve; });

  await page.route("**/api/games/deep-shell-words/crack?**", route =>
    route.fulfill({ json: { first: "AB", last: "YZ" } }),
  );
  await page.route("**/api/games/deep-shell-words/crack-answer?**", async route => {
    requestReceived();
    await pendingResponse;
    await route.fulfill({ json: { example: "LATEANSWER" } });
    responseFulfilled();
  });

  await openResultGame(page, "deep-shell-words");
  await page.getByTestId("button-variation-crack").click();
  await page.getByTestId("button-start-game").click();
  await expect(page.getByTestId("text-round-progress")).toHaveText("1 / 10");
  await page.getByTestId("button-skip").click();
  await expect(page.getByTestId("text-round-progress")).toHaveText("2 / 10");
  await page.getByTestId("button-end-game").click();
  await page.getByTestId("button-reveal-0").click();
  await answerReceived;

  await page.getByTestId("button-replay").click();
  await expect(page.getByTestId("input-word")).toBeVisible();
  await page.getByTestId("button-skip").click();
  await expect(page.getByTestId("text-round-progress")).toHaveText("2 / 10");
  await page.getByTestId("button-end-game").click();
  await expect(page.getByTestId("button-reveal-0")).toBeVisible();

  releaseResponse();
  await answerResponseFulfilled;
  await page.waitForTimeout(100);
  await expect(page.getByTestId("answer-0")).toHaveCount(0);
  await expect(page.getByTestId("button-reveal-0")).toBeVisible();
});
