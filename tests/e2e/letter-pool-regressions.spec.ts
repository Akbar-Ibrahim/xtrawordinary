import { test, expect, type Page } from "@playwright/test";

const LETTER_POOL_GAME = {
  id: 1,
  slug: "letter-pool",
  name: "Letter Pool",
  description: "Build the hidden word from a pool of letters.",
  longDescription: "Build the hidden word from a pool of letters.",
  rules: ["Use the letter pool to spell the hidden word."],
  difficulty: "medium",
  estimatedTime: "5 minutes",
  icon: "Type",
  color: "#2563eb",
  playCount: 0,
  modes: [],
};

const TARGET_WORD = "CARES";

async function openLetterPool(page: Page, targetWords: string | string[] = TARGET_WORD) {
  const words = Array.isArray(targetWords) ? targetWords : [targetWords];
  await page.addInitScript(() => {
    localStorage.setItem("xw_changelog_seen_v2.5", "1");
  });
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/auth/me") {
      await route.fulfill({ json: { user: null } });
    } else if (pathname === "/api/games/letter-pool/words") {
      await route.fulfill({
        json: words.map((word) => ({
          word,
          hint: "A word for things you look after.",
          letterPool: [...word],
        })),
      });
    } else if (pathname === "/api/games/letter-pool") {
      await route.fulfill({ json: LETTER_POOL_GAME });
    } else if (pathname === "/api/games") {
      await route.fulfill({ json: [LETTER_POOL_GAME] });
    } else if (pathname === "/api/likes") {
      await route.fulfill({ json: { counts: {}, likedByMe: {} } });
    } else if (pathname === "/api/games/validate-word") {
      await route.fulfill({ json: { exists: true } });
    } else {
      await route.fulfill({ json: [] });
    }
  });

  await page.goto("/game/letter-pool", { waitUntil: "commit" });
  await page.getByTestId("button-play").click();
  await expect(page.getByTestId("card-with-pool-1-decoy")).toBeVisible();
}

async function chooseDecoyLevel(page: Page, count: number) {
  await page.getByTestId(`card-with-pool-${count}-decoy`).click();
  await expect(page.getByTestId("pool-letter-0")).toBeVisible();
}

for (const decoyCount of [1, 2, 3]) {
  test(`selecting the ${decoyCount}-decoy tier creates exactly ${decoyCount} decoy tiles`, async ({ page }) => {
    await openLetterPool(page);
    await chooseDecoyLevel(page, decoyCount);

    const tiles = await page.locator('[data-testid^="pool-letter-"]').allTextContents();
    const normalizedTiles = tiles.map((letter) => letter.trim());
    const decoys = normalizedTiles.filter((letter) => !TARGET_WORD.includes(letter));

    expect(normalizedTiles).toHaveLength(TARGET_WORD.length + decoyCount);
    expect(decoys).toHaveLength(decoyCount);
    expect(new Set(decoys).size).toBe(decoyCount);
  });
}

test("a random-letter hint reveals one unfilled target tile and consumes it", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  await expect.poll(async () =>
    (await slots.allTextContents()).filter((letter) => letter.trim() !== "").length,
  ).toBe(0);
  await page.getByTestId("button-hint").click();

  await expect.poll(async () =>
    (await slots.allTextContents()).filter((letter) => letter.trim() !== "").length,
  ).toBe(1);
  const revealedLetter = (await slots.allTextContents())
    .map((letter) => letter.trim())
    .find(Boolean);
  expect(revealedLetter).toBeTruthy();

  const usedTileId = await page.locator('[data-testid^="pool-letter-"]').evaluateAll(
    (buttons, letter) => {
      const used = buttons.filter((button) =>
        (button as HTMLButtonElement).disabled &&
        button.textContent?.trim() === letter,
      );
      return used.length === 1
        ? (used[0] as HTMLElement).dataset.testid
        : null;
    },
    revealedLetter,
  );
  expect(usedTileId).toBeTruthy();

  const usedTile = page.getByTestId(usedTileId!);
  await expect(usedTile).toBeDisabled();
  await usedTile.evaluate((button) => (button as HTMLButtonElement).click());
  await expect.poll(async () =>
    (await slots.allTextContents()).filter((letter) => letter.trim() !== "").length,
  ).toBe(1);
  await expect(page.getByTestId("button-hint")).toBeDisabled();
});

test("a used hint resets when the next puzzle starts", async ({ page }) => {
  const nextWord = "PLANT";
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await openLetterPool(page, [TARGET_WORD, nextWord]);
  await chooseDecoyLevel(page, 1);

  const slots = page.locator('[data-testid^="slot-"]');
  const gameArea = page.getByTestId("letter-pool-game-area");
  const hintButton = page.getByTestId("button-hint");

  await hintButton.click();
  await expect(hintButton).toBeDisabled();
  await expect.poll(async () =>
    (await slots.allTextContents()).filter((letter) => letter.trim() !== "").length,
  ).toBe(1);

  const firstPuzzleSlots = (await slots.allTextContents()).map((letter) => letter.trim());
  for (let index = 0; index < TARGET_WORD.length; index++) {
    if (firstPuzzleSlots[index] !== TARGET_WORD[index]) {
      await gameArea.press(TARGET_WORD[index].toLowerCase());
    }
  }
  await expect(slots).toHaveText([...TARGET_WORD]);
  await expect(page.getByTestId("text-progress")).toContainText("Words completed: 1 / 2");

  await expect(slots).toHaveText(["", "", "", "", ""], { timeout: 5_000 });
  await expect(hintButton).toBeEnabled();

  await hintButton.click();
  await expect(hintButton).toBeDisabled();
  await expect.poll(async () =>
    (await slots.allTextContents()).filter((letter) => letter.trim() !== "").length,
  ).toBe(1);
});

test("a hint consumes only one of two matching tiles and leaves the other usable", async ({ page }) => {
  const repeatedLetterWord = "APPLE";
  const repeatedLetter = "P";
  await page.addInitScript(() => {
    Math.random = () => 0.3;
  });
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  const getMatchingTileStates = () =>
    page.locator('[data-testid^="pool-letter-"]').evaluateAll(
      (buttons, letter) => buttons
        .filter((button) => button.textContent?.trim() === letter)
        .map((button) => ({
          testId: (button as HTMLElement).dataset.testid!,
          disabled: (button as HTMLButtonElement).disabled,
        })),
      repeatedLetter,
    );

  await page.getByTestId("button-hint").click();
  await expect.poll(async () =>
    (await slots.allTextContents()).filter((letter) => letter.trim() !== "").length,
  ).toBe(1);

  const revealedLetters = (await slots.allTextContents()).map((letter) => letter.trim());
  expect(revealedLetters.filter((letter) => letter === repeatedLetter)).toHaveLength(1);
  const tileStates = await getMatchingTileStates();
  expect(tileStates).toHaveLength(2);
  expect(tileStates.filter(({ disabled }) => disabled)).toHaveLength(1);
  expect(tileStates.filter(({ disabled }) => !disabled)).toHaveLength(1);

  const remainingTileId = tileStates.find(({ disabled }) => !disabled)?.testId;
  expect(remainingTileId).toBeTruthy();
  await page.getByTestId(remainingTileId!).click();
  await expect(slots).toHaveText(["", "P", "P", "", ""]);
  expect((await getMatchingTileStates()).filter(({ disabled }) => disabled)).toHaveLength(2);
});

test("typing a repeated letter after a hint fills both matching slots and consumes both tiles", async ({ page }) => {
  const repeatedLetterWord = "APPLE";
  const repeatedLetter = "P";
  await page.addInitScript(() => {
    Math.random = () => 0.3;
  });
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  const matchingTiles = page.locator('[data-testid^="pool-letter-"]').filter({
    hasText: repeatedLetter,
  });

  await page.getByTestId("button-hint").click();
  await expect(slots).toHaveText(["", "P", "", "", ""]);
  await expect.poll(() => matchingTiles.evaluateAll(
    (buttons) => buttons.filter((button) => (button as HTMLButtonElement).disabled).length,
  )).toBe(1);

  await page.keyboard.press(repeatedLetter.toLowerCase());

  await expect(slots).toHaveText(["", "P", "P", "", ""]);
  await expect(matchingTiles).toHaveCount(2);
  await expect.poll(() => matchingTiles.evaluateAll(
    (buttons) => buttons.filter((button) => (button as HTMLButtonElement).disabled).length,
  )).toBe(2);
});

test("typing a separated repeated letter after a hint uses the remaining PAPER tile", async ({ page }) => {
  const repeatedLetterWord = "PAPER";
  const repeatedLetter = "P";
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const gameArea = page.getByTestId("letter-pool-game-area");
  const slots = page.locator('[data-testid^="slot-"]');
  const getMatchingTileStates = () =>
    page.locator('[data-testid^="pool-letter-"]').evaluateAll(
      (buttons, letter) => buttons
        .filter((button) => button.textContent?.trim() === letter)
        .map((button) => ({
          testId: (button as HTMLElement).dataset.testid!,
          disabled: (button as HTMLButtonElement).disabled,
        })),
      repeatedLetter,
    );

  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page.getByTestId("button-hint").click();
  await expect(slots).toHaveText(["P", "", "", "", ""]);

  const tileStatesAfterHint = await getMatchingTileStates();
  expect(tileStatesAfterHint).toHaveLength(2);
  expect(tileStatesAfterHint.filter(({ disabled }) => disabled)).toHaveLength(1);
  const hintedTileId = tileStatesAfterHint.find(({ disabled }) => disabled)?.testId;
  const remainingTileId = tileStatesAfterHint.find(({ disabled }) => !disabled)?.testId;
  expect(hintedTileId).toBeTruthy();
  expect(remainingTileId).toBeTruthy();

  await gameArea.press(repeatedLetter.toLowerCase());
  await expect(slots).toHaveText(["P", "", "P", "", ""]);
  await expect(page.getByTestId(hintedTileId!)).toBeDisabled();
  await expect(page.getByTestId(remainingTileId!)).toBeDisabled();
});

test("selecting both repeated-letter tiles fills both target slots and consumes each tile once", async ({ page }) => {
  const repeatedLetterWord = "APPLE";
  const repeatedLetter = "P";
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  const matchingTiles = page.locator('[data-testid^="pool-letter-"]').filter({
    hasText: repeatedLetter,
  });
  const matchingTileIds = await matchingTiles.evaluateAll((buttons) =>
    buttons.map((button) => (button as HTMLElement).dataset.testid!),
  );

  expect(matchingTileIds).toHaveLength(2);
  expect(new Set(matchingTileIds).size).toBe(2);
  await expect(page.getByTestId("button-hint")).toBeEnabled();
  await expect(slots).toHaveText(["", "", "", "", ""]);

  await page.getByTestId(matchingTileIds[0]).click();
  await expect(slots).toHaveText(["", "P", "", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeEnabled();

  await page.getByTestId(matchingTileIds[1]).click();
  await expect(slots).toHaveText(["", "P", "P", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeDisabled();
  await expect(page.getByTestId("button-hint")).toBeEnabled();
});

test("typing still works after clicking a pool tile", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  const slots = page.locator('[data-testid^="slot-"]');
  const findTileId = (letter: string) => page.locator('[data-testid^="pool-letter-"]').evaluateAll(
    (buttons, targetLetter) => {
      const tile = buttons.find((button) => button.textContent?.trim() === targetLetter);
      return tile ? (tile as HTMLElement).dataset.testid : null;
    },
    letter,
  );
  const cTileId = await findTileId("C");
  const aTileId = await findTileId("A");

  expect(cTileId).toBeTruthy();
  expect(aTileId).toBeTruthy();
  await page.getByTestId(cTileId!).click();
  await expect(slots).toHaveText(["C", "", "", "", ""]);
  await expect(page.getByTestId(cTileId!)).toBeDisabled();

  await page.keyboard.press("a");

  await expect(slots).toHaveText(["C", "A", "", "", ""]);
  await expect(page.getByTestId(aTileId!)).toBeDisabled();
});

test("typing a repeated letter fills each matching slot and consumes one pool tile per key press", async ({ page }) => {
  const repeatedLetterWord = "APPLE";
  const repeatedLetter = "P";
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const gameArea = page.getByTestId("letter-pool-game-area");
  const slots = page.locator('[data-testid^="slot-"]');
  const hintButton = page.getByTestId("button-hint");
  const matchingTileIds = await page.locator('[data-testid^="pool-letter-"]').evaluateAll(
    (buttons, letter) => buttons
      .filter((button) => button.textContent?.trim() === letter)
      .map((button) => (button as HTMLElement).dataset.testid!),
    repeatedLetter,
  );

  expect(matchingTileIds).toHaveLength(2);
  await expect(slots).toHaveText(["", "", "", "", ""]);
  await expect(hintButton).toBeEnabled();
  await expect(page.getByTestId(matchingTileIds[0])).toBeEnabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeEnabled();

  await gameArea.press(repeatedLetter.toLowerCase());
  await expect(slots).toHaveText(["", "P", "", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeEnabled();

  await gameArea.press(repeatedLetter.toLowerCase());
  await expect(slots).toHaveText(["", "P", "P", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeDisabled();
  await expect(hintButton).toBeEnabled();
});

test("typing a separated repeated letter fills each matching slot and consumes one pool tile per key press", async ({ page }) => {
  const repeatedLetterWord = "PAPER";
  const repeatedLetter = "P";
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const gameArea = page.getByTestId("letter-pool-game-area");
  const slots = page.locator('[data-testid^="slot-"]');
  const matchingTileIds = await page.locator('[data-testid^="pool-letter-"]').evaluateAll(
    (buttons, letter) => buttons
      .filter((button) => button.textContent?.trim() === letter)
      .map((button) => (button as HTMLElement).dataset.testid!),
    repeatedLetter,
  );

  expect(matchingTileIds).toHaveLength(2);
  expect(new Set(matchingTileIds).size).toBe(2);
  await expect(slots).toHaveText(["", "", "", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeEnabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeEnabled();

  await gameArea.press(repeatedLetter.toLowerCase());
  await expect(slots).toHaveText(["P", "", "", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeEnabled();

  await gameArea.press(repeatedLetter.toLowerCase());
  await expect(slots).toHaveText(["P", "", "P", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeDisabled();
});

test("selecting separated repeated-letter tiles fills their matching slots and consumes each tile once", async ({ page }) => {
  const repeatedLetterWord = "PAPER";
  const repeatedLetter = "P";
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  const matchingTiles = page.locator('[data-testid^="pool-letter-"]').filter({
    hasText: repeatedLetter,
  });
  const matchingTileIds = await matchingTiles.evaluateAll((buttons) =>
    buttons.map((button) => (button as HTMLElement).dataset.testid!),
  );

  expect(matchingTileIds).toHaveLength(2);
  expect(new Set(matchingTileIds).size).toBe(2);
  await expect(page.getByTestId("button-hint")).toBeEnabled();
  await expect(slots).toHaveText(["", "", "", "", ""]);

  await page.getByTestId(matchingTileIds[0]).click();
  await expect(slots).toHaveText(["P", "", "", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeEnabled();

  await page.getByTestId(matchingTileIds[1]).click();
  await expect(slots).toHaveText(["P", "", "P", "", ""]);
  await expect(page.getByTestId(matchingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(matchingTileIds[1])).toBeDisabled();
  await expect(page.getByTestId("button-hint")).toBeEnabled();
});

test("selecting three separated matching tiles fills their target slots and consumes each tile once", async ({ page }) => {
  const repeatedLetterWord = "BANANA";
  const repeatedLetter = "A";
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  const matchingTiles = page.locator('[data-testid^="pool-letter-"]').filter({
    hasText: repeatedLetter,
  });
  const matchingTileIds = await matchingTiles.evaluateAll((buttons) =>
    buttons.map((button) => (button as HTMLElement).dataset.testid!),
  );

  expect(matchingTileIds).toHaveLength(3);
  expect(new Set(matchingTileIds).size).toBe(3);
  await expect(page.getByTestId("button-hint")).toBeEnabled();
  await expect(slots).toHaveText(["", "", "", "", "", ""]);

  const expectedSlotsAfterSelection = [
    ["", "A", "", "", "", ""],
    ["", "A", "", "A", "", ""],
    ["", "A", "", "A", "", "A"],
  ];

  for (const [index, tileId] of matchingTileIds.entries()) {
    const tile = page.getByTestId(tileId);
    await tile.click();
    await expect(slots).toHaveText(expectedSlotsAfterSelection[index]);
    await expect(tile).toBeDisabled();

    for (const remainingTileId of matchingTileIds.slice(index + 1)) {
      await expect(page.getByTestId(remainingTileId)).toBeEnabled();
    }

    await tile.evaluate((button) => (button as HTMLButtonElement).click());
    await expect(slots).toHaveText(expectedSlotsAfterSelection[index]);
  }

  await expect(page.getByTestId("button-hint")).toBeEnabled();
});

test("a hint on BANANA consumes one A tile and leaves the other two usable", async ({ page }) => {
  const repeatedLetterWord = "BANANA";
  const repeatedLetter = "A";
  await page.addInitScript(() => {
    Math.random = () => 0.3;
  });
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  const getMatchingTileStates = () =>
    page.locator('[data-testid^="pool-letter-"]').evaluateAll(
      (buttons, letter) => buttons
        .filter((button) => button.textContent?.trim() === letter)
        .map((button) => ({
          testId: (button as HTMLElement).dataset.testid!,
          disabled: (button as HTMLButtonElement).disabled,
        })),
      repeatedLetter,
    );

  const initialTileStates = await getMatchingTileStates();
  expect(initialTileStates).toHaveLength(3);
  expect(new Set(initialTileStates.map(({ testId }) => testId)).size).toBe(3);
  await expect(slots).toHaveText(["", "", "", "", "", ""]);

  await page.getByTestId("button-hint").click();

  await expect(slots).toHaveText(["", "A", "", "", "", ""]);
  const tileStatesAfterHint = await getMatchingTileStates();
  expect(tileStatesAfterHint.filter(({ disabled }) => disabled)).toHaveLength(1);
  const remainingTileIds = tileStatesAfterHint
    .filter(({ disabled }) => !disabled)
    .map(({ testId }) => testId);
  expect(remainingTileIds).toHaveLength(2);

  await page.getByTestId(remainingTileIds[0]).click();
  await expect(slots).toHaveText(["", "A", "", "A", "", ""]);
  await expect(page.getByTestId(remainingTileIds[0])).toBeDisabled();
  await expect(page.getByTestId(remainingTileIds[1])).toBeEnabled();

  await page.getByTestId(remainingTileIds[1]).click();
  await expect(slots).toHaveText(["", "A", "", "A", "", "A"]);
  expect((await getMatchingTileStates()).filter(({ disabled }) => disabled)).toHaveLength(3);
});

test("a hint after manually selecting an A preserves the last BANANA A tile", async ({ page }) => {
  const repeatedLetterWord = "BANANA";
  const repeatedLetter = "A";
  await page.addInitScript(() => {
    Math.random = () => 0.3;
  });
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  const getMatchingTileStates = () =>
    page.locator('[data-testid^="pool-letter-"]').evaluateAll(
      (buttons, letter) => buttons
        .filter((button) => button.textContent?.trim() === letter)
        .map((button) => ({
          testId: (button as HTMLElement).dataset.testid!,
          disabled: (button as HTMLButtonElement).disabled,
        })),
      repeatedLetter,
    );

  const initialTileStates = await getMatchingTileStates();
  expect(initialTileStates).toHaveLength(3);
  const manualTileId = initialTileStates[0].testId;
  await page.getByTestId(manualTileId).click();
  await expect(slots).toHaveText(["", "A", "", "", "", ""]);
  await expect(page.getByTestId(manualTileId)).toBeDisabled();

  await page.evaluate(() => {
    Math.random = () => 0.5;
  });
  await page.getByTestId("button-hint").click();
  await expect(slots).toHaveText(["", "A", "", "A", "", ""]);
  const tileStatesAfterHint = await getMatchingTileStates();
  const consumedAfterHint = tileStatesAfterHint
    .filter(({ disabled }) => disabled)
    .map(({ testId }) => testId);
  expect(consumedAfterHint).toHaveLength(2);
  expect(new Set(consumedAfterHint).size).toBe(2);
  expect(consumedAfterHint).toContain(manualTileId);
  const finalTileId = tileStatesAfterHint.find(({ disabled }) => !disabled)?.testId;
  expect(finalTileId).toBeTruthy();

  await page.getByTestId(finalTileId!).click();
  await expect(slots).toHaveText(["", "A", "", "A", "", "A"]);
  const consumedAfterFinalSelection = (await getMatchingTileStates())
    .filter(({ disabled }) => disabled)
    .map(({ testId }) => testId);
  expect(consumedAfterFinalSelection).toHaveLength(3);
  expect(new Set(consumedAfterFinalSelection).size).toBe(3);
  expect(consumedAfterFinalSelection).toContain(manualTileId);
  expect(consumedAfterFinalSelection).toContain(finalTileId);
});

test("typing A twice after a hint fills all BANANA A positions and consumes three distinct tiles", async ({ page }) => {
  const repeatedLetterWord = "BANANA";
  const repeatedLetter = "A";
  await page.addInitScript(() => {
    Math.random = () => 0.3;
  });
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const slots = page.locator('[data-testid^="slot-"]');
  const getConsumedTileIds = () =>
    page.locator('[data-testid^="pool-letter-"]').evaluateAll(
      (buttons, letter) => buttons
        .filter((button) =>
          button.textContent?.trim() === letter &&
          (button as HTMLButtonElement).disabled,
        )
        .map((button) => (button as HTMLElement).dataset.testid!),
      repeatedLetter,
    );
  const matchingTileIds = await page.locator('[data-testid^="pool-letter-"]').evaluateAll(
    (buttons, letter) => buttons
      .filter((button) => button.textContent?.trim() === letter)
      .map((button) => (button as HTMLElement).dataset.testid!),
    repeatedLetter,
  );

  expect(matchingTileIds).toHaveLength(3);
  expect(new Set(matchingTileIds).size).toBe(3);

  await page.getByTestId("button-hint").click();
  await expect(slots).toHaveText(["", "A", "", "", "", ""]);
  const consumedAfterHint = await getConsumedTileIds();
  expect(consumedAfterHint).toHaveLength(1);

  await page.keyboard.press(repeatedLetter.toLowerCase());
  await expect(slots).toHaveText(["", "A", "", "A", "", ""]);
  const consumedAfterFirstKey = await getConsumedTileIds();
  expect(consumedAfterFirstKey).toHaveLength(2);
  expect(new Set(consumedAfterFirstKey).size).toBe(2);

  await page.keyboard.press(repeatedLetter.toLowerCase());
  await expect(slots).toHaveText(["", "A", "", "A", "", "A"]);
  const consumedAfterSecondKey = await getConsumedTileIds();
  expect(consumedAfterSecondKey).toHaveLength(3);
  expect(new Set(consumedAfterSecondKey).size).toBe(3);
  expect(consumedAfterSecondKey.every((tileId) => matchingTileIds.includes(tileId))).toBe(true);
});

test("typing three separated matching letters fills all BANANA A positions and consumes each tile once", async ({ page }) => {
  const repeatedLetterWord = "BANANA";
  const repeatedLetter = "A";
  await openLetterPool(page, repeatedLetterWord);
  await chooseDecoyLevel(page, 2);

  const gameArea = page.getByTestId("letter-pool-game-area");
  const slots = page.locator('[data-testid^="slot-"]');
  const matchingTileIds = await page.locator('[data-testid^="pool-letter-"]').evaluateAll(
    (buttons, letter) => buttons
      .filter((button) => button.textContent?.trim() === letter)
      .map((button) => (button as HTMLElement).dataset.testid!),
    repeatedLetter,
  );

  expect(matchingTileIds).toHaveLength(3);
  expect(new Set(matchingTileIds).size).toBe(3);
  await expect(slots).toHaveText(["", "", "", "", "", ""]);

  const expectedSlotsAfterTyping = [
    ["", "A", "", "", "", ""],
    ["", "A", "", "A", "", ""],
    ["", "A", "", "A", "", "A"],
  ];
  for (const [index, expectedSlots] of expectedSlotsAfterTyping.entries()) {
    await gameArea.press(repeatedLetter.toLowerCase());
    await expect(slots).toHaveText(expectedSlots);

    const consumedTileCount = await page.locator('[data-testid^="pool-letter-"]').evaluateAll(
      (buttons, letter) => buttons.filter(
        (button) =>
          button.textContent?.trim() === letter &&
          (button as HTMLButtonElement).disabled,
      ).length,
      repeatedLetter,
    );
    expect(consumedTileCount).toBe(index + 1);
  }
});

test("a valid alternate word gets feedback without target points or a lost life", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  const score = page.getByTestId("badge-score");
  const fullLives = page.getByTestId("lives-display").locator("svg.fill-destructive");
  await expect(score).toContainText("0 pts");
  await expect(fullLives).toHaveCount(3);

  await page.getByLabel("Try another word from this pool").fill("scare");
  await page.getByRole("button", { name: "Check word" }).click();

  await expect(page.getByText(
    "Good find! SCARE is a valid word from this pool, but it is not this round's target.",
  )).toBeVisible();
  await expect(score).toContainText("0 pts");
  await expect(fullLives).toHaveCount(3);
});

test("alternate-word feedback and candidate clear when the next puzzle starts", async ({ page }) => {
  const nextWord = "PLANT";
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await openLetterPool(page, [TARGET_WORD, nextWord]);
  await chooseDecoyLevel(page, 1);

  const candidateInput = page.getByLabel("Try another word from this pool");
  const alternateWordFeedback = page.getByText(
    "Good find! SCARE is a valid word from this pool, but it is not this round's target.",
  );
  const gameArea = page.getByTestId("letter-pool-game-area");
  const slots = page.locator('[data-testid^="slot-"]');

  await candidateInput.fill("SCARE");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(alternateWordFeedback).toBeVisible();
  await expect(candidateInput).toHaveValue("SCARE");

  for (const letter of TARGET_WORD) {
    await gameArea.press(letter.toLowerCase());
  }
  await expect(slots).toHaveText([...TARGET_WORD]);

  await expect(slots).toHaveText(["", "", "", "", ""], { timeout: 5_000 });
  await expect(candidateInput).toHaveValue("");
  await expect(alternateWordFeedback).toBeHidden();

  for (const letter of nextWord) {
    await gameArea.press(letter.toLowerCase());
  }
  await expect(slots).toHaveText([...nextWord]);
});

test("a delayed alternate-word result from the previous puzzle stays off the next puzzle", async ({ page }) => {
  const nextWord = "PLANT";
  let releaseValidation: () => void = () => {};
  let markValidationStarted: () => void = () => {};
  const validationGate = new Promise<void>((resolve) => {
    releaseValidation = resolve;
  });
  const validationStarted = new Promise<void>((resolve) => {
    markValidationStarted = resolve;
  });

  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await openLetterPool(page, [TARGET_WORD, nextWord]);
  await chooseDecoyLevel(page, 1);
  await page.route("**/api/games/validate-word?*", async (route) => {
    markValidationStarted();
    await validationGate;
    await route.fulfill({ json: { exists: true } });
  });

  const candidateInput = page.getByLabel("Try another word from this pool");
  const gameArea = page.getByTestId("letter-pool-game-area");
  const slots = page.locator('[data-testid^="slot-"]');
  const progress = page.getByTestId("text-progress");
  const oldPuzzleFeedback = page.getByText(
    "Good find! SCARE is a valid word from this pool, but it is not this round's target.",
  );

  await candidateInput.fill("SCARE");
  const responseReceived = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/games/validate-word",
  );
  await page.getByRole("button", { name: "Check word" }).click();
  await validationStarted;

  for (const letter of TARGET_WORD) {
    await gameArea.press(letter.toLowerCase());
  }
  await expect(progress).toContainText("Words completed: 1 / 2");
  await expect(slots).toHaveText(["", "", "", "", ""]);
  await expect(candidateInput).toHaveValue("");

  releaseValidation();
  await responseReceived;
  await expect(oldPuzzleFeedback).toBeHidden();
  await expect(candidateInput).toHaveValue("");
  await expect(progress).toContainText("Words completed: 1 / 2");
});

async function expectAlternateWordCheckToLeaveRoundUnchanged(
  page: Page,
  expectedFeedback: string,
  candidate = "SCARE",
  targetWord = TARGET_WORD,
) {
  const score = page.getByTestId("badge-score");
  const lives = page.getByTestId("lives-display").locator("svg");
  const poolTiles = page.locator('[data-testid^="pool-letter-"]');
  const originalPool = await poolTiles.allTextContents();
  const originalScore = await score.innerText();
  const originalLives = await lives.evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  );
  const candidateInput = page.getByLabel("Try another word from this pool");

  await candidateInput.fill(candidate);
  await page.getByRole("button", { name: "Check word" }).click();

  await expect(page.getByText(expectedFeedback)).toBeVisible();
  await expect(candidateInput).toHaveValue(candidate);
  expect(await score.innerText()).toBe(originalScore);
  expect(await lives.evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  )).toEqual(originalLives);
  await expect(page.locator('[data-testid^="slot-"]')).toHaveText(
    Array.from({ length: targetWord.length }, () => ""),
  );
  await expect(poolTiles).toHaveText(originalPool.map((letter) => letter.trim()));

  // Solving the target afterwards confirms the checked candidate did not replace the round.
  for (const letter of targetWord) {
    await page.getByRole("button", { name: letter, exact: true }).click();
  }
  await expect(page.locator('[data-testid^="slot-"]')).toHaveText([...targetWord]);
}

test("entering the target word gives local guidance without changing the round", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/games/validate-word") {
      dictionaryValidationRequests += 1;
    }
  });

  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That is the target word. Spell it with the pool letters to solve the round.",
    TARGET_WORD,
  );
  expect(dictionaryValidationRequests).toBe(0);
});

test("an out-of-pool alternate word is rejected locally without changing the round", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/games/validate-word") {
      dictionaryValidationRequests += 1;
    }
  });

  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That word does not fit the letters in this pool.",
    "BREAD",
  );
  expect(dictionaryValidationRequests).toBe(0);
});

test("a shorter alternate word is rejected locally without changing the round", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/games/validate-word") {
      dictionaryValidationRequests += 1;
    }
  });

  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That word must be exactly 5 letters long.",
    "CARE",
  );
  expect(dictionaryValidationRequests).toBe(0);
});

test("a wrong-length alternate word preserves placed letters and available tiles", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/games/validate-word") {
      dictionaryValidationRequests += 1;
    }
  });

  const slots = page.locator('[data-testid^="slot-"]');
  const poolTiles = page.locator('[data-testid^="pool-letter-"]');
  for (const letter of TARGET_WORD.slice(0, 2)) {
    const matchingTileIds = await poolTiles.evaluateAll((buttons, targetLetter) =>
      buttons
        .filter((button) => button.textContent?.trim() === targetLetter)
        .map((button) => (button as HTMLElement).dataset.testid!),
      letter,
    );
    expect(matchingTileIds).toHaveLength(1);
    await page.getByTestId(matchingTileIds[0]).click();
  }

  await expect(slots).toHaveText(["C", "A", "", "", ""]);
  const placedLetters = (await slots.allTextContents()).map((letter) => letter.trim());
  const tileStates = await poolTiles.evaluateAll((buttons) =>
    buttons.map((button) => ({
      letter: button.textContent?.trim(),
      disabled: (button as HTMLButtonElement).disabled,
    })),
  );
  const score = await page.getByTestId("badge-score").innerText();
  const lifeStates = await page.getByTestId("lives-display").locator("svg").evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  );

  const candidate = "CARE";
  const candidateInput = page.getByLabel("Try another word from this pool");
  await candidateInput.fill(candidate);
  await page.getByRole("button", { name: "Check word" }).click();

  await expect(page.getByText("That word must be exactly 5 letters long.")).toBeVisible();
  await expect(candidateInput).toHaveValue(candidate);
  await expect(slots).toHaveText(placedLetters);
  expect(await poolTiles.evaluateAll((buttons) =>
    buttons.map((button) => ({
      letter: button.textContent?.trim(),
      disabled: (button as HTMLButtonElement).disabled,
    })),
  )).toEqual(tileStates);
  expect(await page.getByTestId("badge-score").innerText()).toBe(score);
  expect(await page.getByTestId("lives-display").locator("svg").evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  )).toEqual(lifeStates);
  expect(dictionaryValidationRequests).toBe(0);
});

test("a dictionary lookup failure preserves the round and allows an alternate-word retry", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  await page.route("**/api/games/validate-word**", async (route) => {
    dictionaryValidationRequests += 1;
    if (dictionaryValidationRequests === 1) {
      await route.fulfill({ status: 503, body: "Dictionary temporarily unavailable" });
      return;
    }
    await route.fulfill({ json: { exists: true } });
  });

  const slots = page.locator('[data-testid^="slot-"]');
  const poolTiles = page.locator('[data-testid^="pool-letter-"]');
  for (const letter of TARGET_WORD.slice(0, 2)) {
    const matchingTileIds = await poolTiles.evaluateAll((buttons, targetLetter) =>
      buttons
        .filter((button) => button.textContent?.trim() === targetLetter)
        .map((button) => (button as HTMLElement).dataset.testid!),
      letter,
    );
    expect(matchingTileIds).toHaveLength(1);
    await page.getByTestId(matchingTileIds[0]).click();
  }

  await expect(slots).toHaveText(["C", "A", "", "", ""]);
  const placedLetters = (await slots.allTextContents()).map((letter) => letter.trim());
  const tileStates = await poolTiles.evaluateAll((buttons) =>
    buttons.map((button) => ({
      letter: button.textContent?.trim(),
      disabled: (button as HTMLButtonElement).disabled,
    })),
  );
  const score = await page.getByTestId("badge-score").innerText();
  const lifeStates = await page.getByTestId("lives-display").locator("svg").evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  );
  const candidateInput = page.getByLabel("Try another word from this pool");
  await candidateInput.fill("SCARE");
  await page.getByRole("button", { name: "Check word" }).click();

  const retryableError = page.getByText("Could not check that word right now. Please try again.");
  await expect(retryableError).toBeVisible();
  await expect(candidateInput).toHaveValue("SCARE");
  await expect(slots).toHaveText(placedLetters);
  expect(await poolTiles.evaluateAll((buttons) =>
    buttons.map((button) => ({
      letter: button.textContent?.trim(),
      disabled: (button as HTMLButtonElement).disabled,
    })),
  )).toEqual(tileStates);
  expect(await page.getByTestId("badge-score").innerText()).toBe(score);
  expect(await page.getByTestId("lives-display").locator("svg").evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  )).toEqual(lifeStates);

  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText(
    "Good find! SCARE is a valid word from this pool, but it is not this round's target.",
  )).toBeVisible();
  await expect(retryableError).toBeHidden();
  expect(dictionaryValidationRequests).toBe(2);
  await expect(slots).toHaveText(placedLetters);
  expect(await poolTiles.evaluateAll((buttons) =>
    buttons.map((button) => ({
      letter: button.textContent?.trim(),
      disabled: (button as HTMLButtonElement).disabled,
    })),
  )).toEqual(tileStates);
  expect(await page.getByTestId("badge-score").innerText()).toBe(score);
  expect(await page.getByTestId("lives-display").locator("svg").evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  )).toEqual(lifeStates);
});

test("a longer alternate word is rejected locally without changing the round", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/games/validate-word") {
      dictionaryValidationRequests += 1;
    }
  });

  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That word must be exactly 5 letters long.",
    "CARESS",
  );
  expect(dictionaryValidationRequests).toBe(0);
});

test("wrong-length guidance matches a four-letter target", async ({ page }) => {
  const targetWord = "MINT";
  await openLetterPool(page, targetWord);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/games/validate-word") {
      dictionaryValidationRequests += 1;
    }
  });

  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That word must be exactly 4 letters long.",
    "MIN",
    targetWord,
  );
  expect(dictionaryValidationRequests).toBe(0);
});

test("wrong-length guidance stays current through several puzzle length changes", async ({ page }) => {
  const nextWord = "MINT";
  const thirdWord = "PLANT";
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await openLetterPool(page, [TARGET_WORD, nextWord, thirdWord]);
  await chooseDecoyLevel(page, 1);

  const gameArea = page.getByTestId("letter-pool-game-area");
  const progress = page.getByTestId("text-progress");
  const slots = page.locator('[data-testid^="slot-"]');
  for (const letter of TARGET_WORD) {
    await gameArea.press(letter.toLowerCase());
  }

  await expect(progress).toContainText("Words completed: 1 / 3");
  await expect(slots).toHaveText(["", "", "", ""]);

  let dictionaryValidationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/games/validate-word") {
      dictionaryValidationRequests += 1;
    }
  });

  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That word must be exactly 4 letters long.",
    "MIN",
    nextWord,
  );

  await expect(progress).toContainText("Words completed: 2 / 3");
  await expect(slots).toHaveText(["", "", "", "", ""]);
  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That word must be exactly 5 letters long.",
    "PLAN",
    thirdWord,
  );
  expect(dictionaryValidationRequests).toBe(0);
});

test("an alternate word that reuses a pool letter too many times is rejected locally", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/games/validate-word") {
      dictionaryValidationRequests += 1;
    }
  });

  // CARES contains only one C, so the extra C cannot be supplied by any decoy.
  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That word does not fit the letters in this pool.",
    "CCARE",
  );
  expect(dictionaryValidationRequests).toBe(0);
});

test("a non-dictionary alternate word leaves the target, score, and lives unchanged", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);
  await page.route("**/api/games/validate-word?*", (route) =>
    route.fulfill({ json: { exists: false } }),
  );

  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "That letter combination is not in the dictionary.",
  );
});

test("a non-dictionary alternate word preserves in-progress letters and available tiles", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let dictionaryValidationRequests = 0;
  await page.route("**/api/games/validate-word?*", (route) => {
    dictionaryValidationRequests += 1;
    return route.fulfill({ json: { exists: false } });
  });

  const slots = page.locator('[data-testid^="slot-"]');
  const poolTiles = page.locator('[data-testid^="pool-letter-"]');
  for (const letter of TARGET_WORD.slice(0, 2)) {
    const matchingTileIds = await poolTiles.evaluateAll((buttons, targetLetter) =>
      buttons
        .filter((button) => button.textContent?.trim() === targetLetter)
        .map((button) => (button as HTMLElement).dataset.testid!),
      letter,
    );
    expect(matchingTileIds).toHaveLength(1);
    await page.getByTestId(matchingTileIds[0]).click();
  }

  await expect(slots).toHaveText(["C", "A", "", "", ""]);
  const placedLetters = (await slots.allTextContents()).map((letter) => letter.trim());
  const tileStates = await poolTiles.evaluateAll((buttons) =>
    buttons.map((button) => ({
      letter: button.textContent?.trim(),
      disabled: (button as HTMLButtonElement).disabled,
    })),
  );
  const score = await page.getByTestId("badge-score").innerText();
  const lifeStates = await page.getByTestId("lives-display").locator("svg").evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  );

  const candidate = "SCARE";
  const candidateInput = page.getByLabel("Try another word from this pool");
  await candidateInput.fill(candidate);
  await page.getByRole("button", { name: "Check word" }).click();

  await expect(page.getByText("That letter combination is not in the dictionary.")).toBeVisible();
  await expect(candidateInput).toHaveValue(candidate);
  await expect(slots).toHaveText(placedLetters);
  expect(await poolTiles.evaluateAll((buttons) =>
    buttons.map((button) => ({
      letter: button.textContent?.trim(),
      disabled: (button as HTMLButtonElement).disabled,
    })),
  )).toEqual(tileStates);
  expect(await page.getByTestId("badge-score").innerText()).toBe(score);
  expect(await page.getByTestId("lives-display").locator("svg").evaluateAll(
    (hearts) => hearts.map((heart) => heart.getAttribute("class")),
  )).toEqual(lifeStates);
  expect(dictionaryValidationRequests).toBe(1);
});

test("a failed alternate-word validation leaves the target, score, and lives unchanged", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);
  await page.route("**/api/games/validate-word?*", (route) =>
    route.fulfill({ status: 503, json: { error: "Dictionary unavailable" } }),
  );

  await expectAlternateWordCheckToLeaveRoundUnchanged(
    page,
    "Could not check that word right now. Please try again.",
  );
});

test("an alternate word can be retried after a dictionary outage", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let validationAttempts = 0;
  await page.route("**/api/games/validate-word?*", async (route) => {
    validationAttempts += 1;
    if (validationAttempts === 1) {
      await route.fulfill({ status: 503, json: { error: "Dictionary unavailable" } });
    } else {
      await route.fulfill({ json: { exists: true } });
    }
  });

  const candidate = "SCARE";
  const candidateInput = page.getByLabel("Try another word from this pool");
  const checkButton = page.getByRole("button", { name: "Check word" });
  const score = page.getByTestId("badge-score");
  const fullLives = page.getByTestId("lives-display").locator("svg.fill-destructive");
  const poolTiles = page.locator('[data-testid^="pool-letter-"]');
  const originalPool = (await poolTiles.allTextContents()).map((letter) => letter.trim());
  const slots = page.locator('[data-testid^="slot-"]');

  await candidateInput.fill(candidate);
  await checkButton.click();
  await expect(page.getByText(
    "Could not check that word right now. Please try again.",
  )).toBeVisible();
  await expect(candidateInput).toHaveValue(candidate);
  await expect(checkButton).toBeEnabled();

  await checkButton.click();
  await expect(page.getByText(
    "Good find! SCARE is a valid word from this pool, but it is not this round's target.",
  )).toBeVisible();
  await expect(candidateInput).toHaveValue(candidate);
  await expect(score).toContainText("0 pts");
  await expect(fullLives).toHaveCount(3);
  await expect(slots).toHaveText(["", "", "", "", ""]);
  await expect(poolTiles).toHaveText(originalPool);
  expect(validationAttempts).toBe(2);

  // Solving CARES afterwards confirms the retry did not replace the round's target.
  for (const letter of TARGET_WORD) {
    await page.getByRole("button", { name: letter, exact: true }).click();
  }
  await expect(slots).toHaveText([...TARGET_WORD]);
});

test("an alternate word can be retried after its validation request is aborted", async ({ page }) => {
  await openLetterPool(page);
  await chooseDecoyLevel(page, 1);

  let validationAttempts = 0;
  await page.route("**/api/games/validate-word?*", async (route) => {
    validationAttempts += 1;
    if (validationAttempts === 1) {
      await route.abort();
    } else {
      await route.fulfill({ json: { exists: true } });
    }
  });

  const candidate = "SCARE";
  const candidateInput = page.getByLabel("Try another word from this pool");
  const checkButton = page.getByRole("button", { name: "Check word" });
  const score = page.getByTestId("badge-score");
  const fullLives = page.getByTestId("lives-display").locator("svg.fill-destructive");
  const poolTiles = page.locator('[data-testid^="pool-letter-"]');
  const originalPool = (await poolTiles.allTextContents()).map((letter) => letter.trim());
  const slots = page.locator('[data-testid^="slot-"]');

  await candidateInput.fill(candidate);
  await checkButton.click();
  await expect(page.getByText(
    "Could not check that word right now. Please try again.",
  )).toBeVisible();
  await expect(candidateInput).toHaveValue(candidate);
  await expect(checkButton).toBeEnabled();
  expect(validationAttempts).toBe(1);

  await checkButton.click();
  await expect(page.getByText(
    "Good find! SCARE is a valid word from this pool, but it is not this round's target.",
  )).toBeVisible();
  await expect(candidateInput).toHaveValue(candidate);
  await expect(score).toContainText("0 pts");
  await expect(fullLives).toHaveCount(3);
  await expect(slots).toHaveText(["", "", "", "", ""]);
  await expect(poolTiles).toHaveText(originalPool);
  expect(validationAttempts).toBe(2);

  // Solving CARES afterwards confirms the retry did not replace the round's target.
  for (const letter of TARGET_WORD) {
    await page.getByRole("button", { name: letter, exact: true }).click();
  }
  await expect(slots).toHaveText([...TARGET_WORD]);
});
