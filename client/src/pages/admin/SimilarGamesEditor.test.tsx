import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import type { Game } from "@shared/schema";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Node: { configurable: true, value: dom.window.Node },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
});

const originalFetch = globalThis.fetch;
let container: HTMLDivElement | undefined;
let root: Root | undefined;
let savedLists: Array<{ url: string; body: unknown }> = [];

function makeGame(slug: string, name: string, similarGameSlugs: string[] | null = null): Game {
  return {
    id: 1,
    slug,
    name,
    description: "",
    longDescription: "",
    rules: [],
    difficulty: "easy",
    estimatedTime: "",
    icon: "Gamepad2",
    color: "#000000",
    playCount: 0,
    similarGameSlugs,
  };
}

async function flushUpdates() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test.beforeEach(() => {
  savedLists = [];
  globalThis.fetch = (async (input, init) => {
    savedLists.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
});

test.afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = undefined;
  }
  container?.remove();
  container = undefined;
  globalThis.fetch = originalFetch;
});

test("admin can remove a Similar Games entry and save the remaining list", async () => {
  const { createRoot } = await import("react-dom/client");
  const { SimilarGamesEditor } = await import("./SimilarGamesEditor");
  const game = makeGame("anagram-solver", "Anagram Solver", ["word-scramble", "letter-pool"]);
  const games = [
    game,
    makeGame("word-scramble", "Word Scramble"),
    makeGame("letter-pool", "Letter Pool"),
    makeGame("word-maker", "Word Maker"),
  ];

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <QueryClientProvider client={new QueryClient()}>
        <table>
          <tbody>
            <SimilarGamesEditor game={game} games={games} />
          </tbody>
        </table>
      </QueryClientProvider>,
    );
  });

  const toggle = container.querySelector<HTMLButtonElement>(
    '[data-testid="button-similar-games-toggle-anagram-solver"]',
  );
  assert.ok(toggle);
  await act(async () => toggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));

  const removeButton = container.querySelector<HTMLButtonElement>(
    '[data-testid="button-remove-similar-game-anagram-solver-word-scramble"]',
  );
  assert.ok(removeButton);
  await act(async () => removeButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  assert.equal(
    container.querySelector('[data-testid="similar-game-item-anagram-solver-word-scramble"]'),
    null,
  );

  const saveButton = container.querySelector<HTMLButtonElement>(
    '[data-testid="button-save-similar-games-anagram-solver"]',
  );
  assert.ok(saveButton);
  await act(async () => saveButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  await flushUpdates();

  assert.deepEqual(savedLists, [{
    url: "/api/admin/games/anagram-solver/similar-games",
    body: { similarGameSlugs: ["letter-pool"] },
  }]);
});
