import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import type { Game } from "@shared/schema";
import { MiniLeaderboard } from "./mini-leaderboard";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  location: { configurable: true, value: dom.window.location },
  addEventListener: {
    configurable: true,
    value: dom.window.addEventListener.bind(dom.window),
  },
  removeEventListener: {
    configurable: true,
    value: dom.window.removeEventListener.bind(dom.window),
  },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
});

const originalFetch = globalThis.fetch;
let requestedPaths: string[] = [];
let container: HTMLDivElement | undefined;
let root: Root | undefined;
let queryClient: QueryClient | undefined;

function createGame(hasSurvival: boolean): Game {
  return {
    slug: "letter-position",
    name: "Letter Position",
    hasSurvival,
    modes: [
      { slug: "letter-position-one", label: "Mode One" },
      { slug: "letter-position-two", label: "Mode Two" },
    ],
  } as Game;
}

function createGameWithoutSurvival(): Game {
  return {
    slug: "word-ladder",
    name: "Word Ladder",
    hasSurvival: false,
    modes: [
      { slug: "word-ladder-short", label: "Short" },
      { slug: "word-ladder-long", label: "Long" },
    ],
  } as Game;
}

async function flushQueryUpdates() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function clickTab(testId: string) {
  const button = container?.querySelector<HTMLButtonElement>(
    `[data-testid="${testId}"]`,
  );
  assert.ok(button, `Expected tab ${testId} to be rendered`);
  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushQueryUpdates();
}

function fullLeaderboardHref() {
  const link = container?.querySelector<HTMLAnchorElement>(
    '[data-testid="link-full-leaderboard"]',
  )?.parentElement;
  if (!(link instanceof dom.window.HTMLAnchorElement)) {
    throw new Error("Expected the full leaderboard link to be rendered");
  }
  return link.getAttribute("href");
}

async function renderLeaderboard(game: Game, preferredModeSlug?: string) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient!}>
        <MiniLeaderboard game={game} preferredModeSlug={preferredModeSlug} />
      </QueryClientProvider>,
    );
  });
  await flushQueryUpdates();
}

async function rerenderLeaderboard(game: Game) {
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient!}>
        <MiniLeaderboard game={game} />
      </QueryClientProvider>,
    );
  });
  await flushQueryUpdates();
}

test.afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
  }
  queryClient?.clear();
  container?.remove();
  root = undefined;
  queryClient = undefined;
  container = undefined;
  globalThis.fetch = originalFetch;
});

test("loading leaderboard results exposes a polite status while hiding skeletons", async () => {
  requestedPaths = [];
  globalThis.fetch = (async (input) => {
    requestedPaths.push(String(input));
    return new Promise<Response>(() => {});
  }) as typeof fetch;

  await renderLeaderboard(createGame(true));

  const loadingStatus = container?.querySelector('[data-testid="mini-leaderboard-loading"]');
  assert.ok(loadingStatus);
  assert.equal(container?.querySelector('[data-testid="mini-leaderboard-loaded"]'), null);
  assert.equal(loadingStatus.getAttribute("role"), "status");
  assert.equal(loadingStatus.getAttribute("aria-live"), "polite");
  assert.equal(loadingStatus.getAttribute("aria-busy"), "true");
  assert.equal(loadingStatus.textContent?.trim(), "Loading leaderboard results");
  assert.equal(loadingStatus.querySelector('[aria-hidden="true"]')?.children.length, 5);
  assert.deepEqual(requestedPaths, ["/api/leaderboard/letter-position-one"]);
});

test("empty leaderboard results expose a polite status", async () => {
  requestedPaths = [];
  globalThis.fetch = async (input) => {
    requestedPaths.push(String(input));
    return {
      ok: true,
      json: async () => [],
    } as Response;
  };

  await renderLeaderboard(createGame(true));

  const emptyStatus = container?.querySelector('[data-testid="mini-leaderboard-empty"]');
  assert.ok(emptyStatus);
  assert.equal(container?.querySelector('[data-testid="mini-leaderboard-loaded"]'), null);
  assert.equal(emptyStatus.getAttribute("role"), "status");
  assert.equal(emptyStatus.getAttribute("aria-live"), "polite");
  assert.match(emptyStatus.textContent ?? "", /Be the first on the board!/);
});

test("failed leaderboard requests can be retried and render recovered scores", async () => {
  requestedPaths = [];
  let attempts = 0;
  globalThis.fetch = async (input) => {
    requestedPaths.push(String(input));
    attempts += 1;
    if (attempts === 1) {
      return { ok: false } as Response;
    }
    return {
      ok: true,
      json: async () => [
        {
          id: 1,
          userId: 10,
          gameSlug: "letter-position-one",
          score: 1250,
          playerName: "Ada Player",
          username: "ada",
          playerAvatarUrl: null,
          playedAt: "2026-10-15T12:00:00.000Z",
        },
      ],
    } as Response;
  };

  await renderLeaderboard(createGame(true));

  const errorStatus = container?.querySelector('[data-testid="mini-leaderboard-error"]');
  assert.ok(errorStatus);
  assert.equal(errorStatus.getAttribute("role"), "alert");
  assert.match(errorStatus.textContent ?? "", /couldn.t be loaded/i);
  assert.equal(container?.querySelector('[data-testid="mini-leaderboard-empty"]'), null);
  assert.equal(container?.querySelector('[data-testid="mini-leaderboard-retry"]')?.textContent, "Retry");

  const retryButton = container?.querySelector<HTMLButtonElement>(
    '[data-testid="mini-leaderboard-retry"]',
  );
  assert.ok(retryButton);
  await act(async () => {
    retryButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });
  await flushQueryUpdates();

  assert.equal(container?.querySelector('[data-testid="mini-leaderboard-error"]'), null);
  assert.equal(container?.querySelector('[data-testid="mini-leaderboard-empty"]'), null);
  const rankings = container?.querySelector('ol[aria-label="Leaderboard rankings"]');
  assert.ok(rankings);
  assert.match(rankings.textContent ?? "", /Ada Player/);
  assert.match(rankings.textContent ?? "", /1,250/);
  assert.deepEqual(requestedPaths, [
    "/api/leaderboard/letter-position-one",
    "/api/leaderboard/letter-position-one",
  ]);
});

test("rankings expose rank, player, and score in order while hiding decorative rank artwork", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        id: 1,
        userId: 10,
        gameSlug: "letter-position-one",
        score: 1250,
        playerName: "Ada Player",
        username: "ada",
        playerAvatarUrl: null,
        playedAt: "2026-10-15T12:00:00.000Z",
      },
      {
        id: 2,
        userId: 11,
        gameSlug: "letter-position-one",
        score: 980,
        playerName: "Lin Player",
        username: "lin",
        playerAvatarUrl: null,
        playedAt: "2026-10-15T11:00:00.000Z",
      },
      {
        id: 3,
        userId: 12,
        gameSlug: "letter-position-one",
        score: 850,
        playerName: "Morgan Player",
        username: "morgan",
        playerAvatarUrl: null,
        playedAt: "2026-10-15T10:00:00.000Z",
      },
      {
        id: 4,
        userId: 13,
        gameSlug: "letter-position-one",
        score: 720,
        playerName: "Riley Player",
        username: "riley",
        playerAvatarUrl: null,
        playedAt: "2026-10-15T09:00:00.000Z",
      },
    ],
  }) as Response;

  await renderLeaderboard(createGame(true));

  const rankings = container?.querySelector<HTMLOListElement>(
    'ol[aria-label="Leaderboard rankings"]',
  );
  assert.ok(rankings);
  const rows = Array.from(rankings.querySelectorAll("li"));
  assert.equal(rows.length, 4);
  const loadedStatus = container?.querySelector('[data-testid="mini-leaderboard-loaded"]');
  assert.ok(loadedStatus);
  assert.equal(loadedStatus.getAttribute("role"), "status");
  assert.equal(loadedStatus.getAttribute("aria-live"), "polite");
  assert.equal(loadedStatus.textContent?.trim(), "Loaded 4 leaderboard scores for Mode One Classic.");
  assert.match(rows[0].textContent ?? "", /Rank 1/);
  assert.match(rows[0].textContent ?? "", /Ada Player/);
  assert.match(rows[0].textContent ?? "", /Score: 1,250/);
  assert.match(rows[1].textContent ?? "", /Rank 2/);
  assert.match(rows[1].textContent ?? "", /Lin Player/);
  assert.match(rows[1].textContent ?? "", /Score: 980/);
  assert.match(rows[2].textContent ?? "", /Rank 3/);
  assert.match(rows[2].textContent ?? "", /Morgan Player/);
  assert.match(rows[2].textContent ?? "", /Score: 850/);
  assert.match(rows[3].textContent ?? "", /Rank 4/);
  assert.match(rows[3].textContent ?? "", /Riley Player/);
  assert.match(rows[3].textContent ?? "", /Score: 720/);
  for (const [index, row] of rows.entries()) {
    const rankText = row.querySelector(".sr-only");
    assert.equal(rankText?.textContent, `Rank ${index + 1}`);
    const visualRank = rankText?.nextElementSibling;
    assert.equal(visualRank?.getAttribute("aria-hidden"), "true");
    if (index < 3) {
      assert.ok(visualRank?.querySelector("svg"), `Expected rank ${index + 1} icon to be decorative`);
    }
  }
  assert.equal(rows[0].querySelector("a")?.getAttribute("href"), "/u/ada");
  assert.equal(rows[1].querySelector("a")?.getAttribute("href"), "/u/lin");
  const avatar = rows[0].querySelector('[data-testid="mini-avatar-0"]');
  assert.ok(avatar);
  assert.ok(avatar.closest('[aria-hidden="true"]'));
});

test("changing leaderboard selection announces the populated results", async () => {
  requestedPaths = [];
  globalThis.fetch = async (input) => {
    requestedPaths.push(String(input));
    return {
      ok: true,
      json: async () => [
        {
          id: requestedPaths.length,
          userId: 10,
          gameSlug: requestedPaths.at(-1)?.split("/").pop(),
          score: 1250,
          playerName: "Ada Player",
          username: "ada",
          playerAvatarUrl: null,
          playedAt: "2026-10-15T12:00:00.000Z",
        },
      ],
    } as Response;
  };

  await renderLeaderboard(createGame(true));
  assert.equal(
    container?.querySelector('[data-testid="mini-leaderboard-loaded"]')?.textContent?.trim(),
    "Loaded 1 leaderboard score for Mode One Classic.",
  );

  await clickTab("mini-tab-mode-two");

  const loadedStatus = container?.querySelector('[data-testid="mini-leaderboard-loaded"]');
  assert.ok(loadedStatus);
  assert.equal(
    loadedStatus.textContent?.trim(),
    "Loaded 1 leaderboard score for Mode Two Classic.",
  );
  assert.equal(container?.querySelector('[data-testid="mini-leaderboard-loading"]'), null);
  assert.equal(container?.querySelector('[data-testid="mini-leaderboard-empty"]'), null);
  assert.deepEqual(requestedPaths, [
    "/api/leaderboard/letter-position-one",
    "/api/leaderboard/letter-position-two",
  ]);
});

test("mini leaderboard switches score slugs and preserves both selections in the full link", async () => {
  requestedPaths = [];
  globalThis.fetch = async (input) => {
    requestedPaths.push(String(input));
    return {
      ok: true,
      json: async () => [],
    } as Response;
  };

  await renderLeaderboard(createGame(true));
  assert.equal(
    container?.querySelector('[data-testid="mini-leaderboard-tabs"]')?.getAttribute("aria-label"),
    "Game mode",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-mode-one"]')?.getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-mode-two"]')?.getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-classic"]')?.getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-survival"]')?.getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(fullLeaderboardHref(), "/leaderboard?game=letter-position&mode=letter-position-one");

  await clickTab("mini-tab-mode-two");
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-mode-two"]')?.getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-mode-one"]')?.getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(fullLeaderboardHref(), "/leaderboard?game=letter-position&mode=letter-position-two");
  await clickTab("mini-tab-survival");
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-survival"]')?.getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-classic"]')?.getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(
    fullLeaderboardHref(),
    "/leaderboard?game=letter-position&mode=letter-position-two&survival=1",
  );
  await clickTab("mini-tab-mode-one");
  assert.equal(
    fullLeaderboardHref(),
    "/leaderboard?game=letter-position&mode=letter-position-one&survival=1",
  );
  await clickTab("mini-tab-classic");
  assert.equal(fullLeaderboardHref(), "/leaderboard?game=letter-position&mode=letter-position-one");

  assert.deepEqual(requestedPaths, [
    "/api/leaderboard/letter-position-one",
    "/api/leaderboard/letter-position-two",
    "/api/leaderboard/letter-position-two-survival",
    "/api/leaderboard/letter-position-one-survival",
    "/api/leaderboard/letter-position-one",
  ]);
});

test("mini leaderboard opens on the preferred game variant", async () => {
  requestedPaths = [];
  globalThis.fetch = async (input) => {
    requestedPaths.push(String(input));
    return {
      ok: true,
      json: async () => [],
    } as Response;
  };

  await renderLeaderboard(createGame(true), "letter-position-two");

  assert.equal(
    container?.querySelector('[data-testid="mini-tab-mode-two"]')?.getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-mode-one"]')?.getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(fullLeaderboardHref(), "/leaderboard?game=letter-position&mode=letter-position-two");
  assert.deepEqual(requestedPaths, ["/api/leaderboard/letter-position-two"]);
});

test("games without Survival support hide those choices and request only classic scores", async () => {
  requestedPaths = [];
  globalThis.fetch = async (input) => {
    requestedPaths.push(String(input));
    return {
      ok: true,
      json: async () => [],
    } as Response;
  };

  await renderLeaderboard(createGame(false));
  assert.equal(
    container?.querySelector('[data-testid="mini-leaderboard-survival-tabs"]'),
    null,
  );

  await clickTab("mini-tab-mode-two");
  assert.equal(fullLeaderboardHref(), "/leaderboard?game=letter-position&mode=letter-position-two");
  assert.deepEqual(requestedPaths, [
    "/api/leaderboard/letter-position-one",
    "/api/leaderboard/letter-position-two",
  ]);
});

test("reusing the mini leaderboard for another game resets mode and Survival selections", async () => {
  requestedPaths = [];
  globalThis.fetch = async (input) => {
    requestedPaths.push(String(input));
    return {
      ok: true,
      json: async () => [],
    } as Response;
  };

  await renderLeaderboard(createGame(true));
  await clickTab("mini-tab-mode-two");
  await clickTab("mini-tab-survival");
  assert.equal(
    fullLeaderboardHref(),
    "/leaderboard?game=letter-position&mode=letter-position-two&survival=1",
  );

  await rerenderLeaderboard(createGameWithoutSurvival());

  assert.equal(
    container?.querySelector('[data-testid="mini-leaderboard-tabs"]')?.getAttribute("aria-label"),
    "Game mode",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-leaderboard-survival-tabs"]'),
    null,
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-short"]')?.getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    container?.querySelector('[data-testid="mini-tab-long"]')?.getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(
    fullLeaderboardHref(),
    "/leaderboard?game=word-ladder&mode=word-ladder-short",
  );
  assert.deepEqual(requestedPaths, [
    "/api/leaderboard/letter-position-one",
    "/api/leaderboard/letter-position-two",
    "/api/leaderboard/letter-position-two-survival",
    "/api/leaderboard/word-ladder-short",
  ]);
});
