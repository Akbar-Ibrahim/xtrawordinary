import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  CUSTOM_FRESH_ANSWER_GAMES,
  readCustomFreshAnswerSnapshot,
  saveCustomFreshAnswerSnapshot,
  type CustomFreshAnswerGame,
} from "../../lib/custom-fresh-answers";

test("saved-word review is read-only, alphabetical, and scoped across account/game changes", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const originals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useCustomFreshAnswers } = await import("../../hooks/use-custom-fresh-answers");
  const { CustomFreshAnswerControls, FreshAnswerToggle } = await import("./custom-fresh-answers-controls");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let current: ReturnType<typeof useCustomFreshAnswers>;
  const observed: Array<{ userId?: number; game: CustomFreshAnswerGame; words: string[] }> = [];

  function Harness({ userId, game, customPlay = true, direct = false }: {
    userId?: number;
    game: CustomFreshAnswerGame;
    customPlay?: boolean;
    direct?: boolean;
  }) {
    current = useCustomFreshAnswers({ userId, game, eligible: customPlay });
    observed.push({ userId, game, words: current.snapshot?.words ?? [] });
    if (direct) {
      return current.snapshot ? (
        <FreshAnswerToggle
          game={game} gameSlug={game} words={current.snapshot.words}
          enabled={current.isEnabled} storageError={current.storageError}
          pendingAppendCount={current.pendingAppendCount}
          onRetryAppend={current.retryPendingAppend}
          onEnabledChange={current.setEnabled}
        />
      ) : null;
    }
    return (
      <CustomFreshAnswerControls
        game={game} gameSlug={game} answerCount={current.currentRunAnswers.size}
        snapshot={current.snapshot} isAvailable={current.isAvailable}
        isEnabled={current.isEnabled} optedOutForCurrentRun={current.optedOutForCurrentRun}
        storageError={current.storageError} pendingAppendCount={current.pendingAppendCount}
        onRetryAppend={current.retryPendingAppend} allowOptIn
        onEnabledChange={current.setEnabled} onEnable={current.optInWithCurrentRunAnswers}
      />
    );
  }

  const words = () => Array.from(container.querySelectorAll("li"), (li) => li.textContent);
  const render = async (userId: number | undefined, game: CustomFreshAnswerGame, customPlay = true, direct = false) => {
    observed.length = 0;
    await act(async () => root.render(<Harness {...{ userId, game, customPlay, direct }} />));
    const expected = userId !== undefined && customPlay
      ? readCustomFreshAnswerSnapshot(userId, game)?.words ?? [] : [];
    for (const frame of observed) {
      assert.ok(frame.words.length === 0 || JSON.stringify(frame.words) === JSON.stringify(expected),
        `wrong account/game words exposed during render for ${userId}/${game}`);
    }
    assert.deepEqual(words(), [...expected].sort());
  };

  try {
    for (const [index, game] of CUSTOM_FRESH_ANSWER_GAMES.entries()) {
      // Different words in every account/game scope.
      const suffix = String.fromCharCode(65 + index);
      saveCustomFreshAnswerSnapshot(17, game, [`ZEBRA${suffix}`, `APPLE${suffix}`, `APPLE${suffix}`]);
      saveCustomFreshAnswerSnapshot(18, game, [`OTHER${suffix}`]);
    }
    const beforeReview = { ...dom.window.localStorage };
    for (const game of CUSTOM_FRESH_ANSWER_GAMES) {
      await render(17, game, true, game === "letter-hunt" || game === "letter-dodge");
      assert.match(container.querySelector("summary")!.textContent!, /View 2 saved answers/);
      const details = container.querySelector("details")!;
      assert.equal(details.open, false);
      details.open = true;
      assert.match(container.textContent!, /in this browser only/);
      assert.ok(container.querySelector("ul")!.classList.contains("overflow-y-auto"));
      assert.equal(container.querySelectorAll("button").length, 1, "only the existing switch can change saved data");
      await render(18, game);
      assert.match(container.querySelector("summary")!.textContent!, /View 1 saved answer$/);
      await render(19, game);
      assert.equal(container.textContent, "");
    }
    assert.deepEqual({ ...dom.window.localStorage }, beforeReview, "review never changes storage");
    await render(17, "letter-hunt");
    await render(undefined, "letter-hunt");
    assert.equal(container.textContent, "");
    await render(17, "letter-hunt", false);
    assert.equal(container.textContent, "");
    await render(17, "letter-hunt");
    assert.equal(current!.isBlocked("APPLEA"), true);

    await act(async () => { current!.appendAnswersFromRun(["BANANA", "APPLEA"]); });
    assert.deepEqual(words(), ["APPLEA", "BANANA", "ZEBRAA"]);

    const originalSetItem = Object.getOwnPropertyDescriptor(dom.window.Storage.prototype, "setItem")!;
    Object.defineProperty(dom.window.Storage.prototype, "setItem", {
      configurable: true,
      value() {
        throw new dom.window.DOMException("Storage is unavailable", "QuotaExceededError");
      },
    });
    await act(async () => { current!.appendAnswersFromRun(["CHERRY"]); });
    assert.deepEqual(words(), ["APPLEA", "BANANA", "ZEBRAA"], "a failed append leaves existing saved answers visible");
    assert.deepEqual(readCustomFreshAnswerSnapshot(17, "letter-hunt")?.words, ["ZEBRAA", "APPLEA", "BANANA"],
      "a failed append leaves the stored list unchanged");
    assert.match(container.querySelector('[role="alert"]')!.textContent!,
      /New answers from this run weren’t saved\. Your existing saved answers are unchanged\./);
    assert.equal(current!.pendingAppendCount, 1);

    Object.defineProperty(dom.window.Storage.prototype, "setItem", originalSetItem);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="button-retry-fresh-answers-letter-hunt"]')!.click();
    });
    assert.equal(container.querySelector('[role="alert"]'), null, "a successful append retry clears the error");
    assert.equal(current!.pendingAppendCount, 0);
    assert.deepEqual(words(), ["APPLEA", "BANANA", "CHERRY", "ZEBRAA"]);
    assert.deepEqual(readCustomFreshAnswerSnapshot(17, "letter-hunt")?.words,
      ["ZEBRAA", "APPLEA", "BANANA", "CHERRY"], "retry merges the missed answer with the existing saved list");

    const originalRemoveItem = Object.getOwnPropertyDescriptor(dom.window.Storage.prototype, "removeItem")!;
    Object.defineProperty(dom.window.Storage.prototype, "removeItem", {
      configurable: true,
      value() {
        throw new dom.window.DOMException("Storage is unavailable", "SecurityError");
      },
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    });
    assert.equal(container.querySelector('[role="switch"]')?.getAttribute("data-state"), "checked",
      "a failed opt-out keeps the switch enabled");
    assert.match(container.querySelector('[role="alert"]')!.textContent!,
      /Couldn’t update the saved answers in this browser/,
      "the failed opt-out is announced");
    assert.deepEqual(words(), ["APPLEA", "BANANA", "CHERRY", "ZEBRAA"],
      "a failed opt-out keeps the saved list visible");
    assert.deepEqual(readCustomFreshAnswerSnapshot(17, "letter-hunt")?.words,
      ["ZEBRAA", "APPLEA", "BANANA", "CHERRY"],
      "a failed opt-out leaves the browser list unchanged");

    Object.defineProperty(dom.window.Storage.prototype, "removeItem", originalRemoveItem);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    });
    assert.equal(container.textContent, "");
    assert.equal(current!.isEnabled, false, "a successful retry opts out");
    assert.equal(readCustomFreshAnswerSnapshot(17, "letter-hunt"), null);
    assert.equal(current!.isBlocked("APPLEA"), false);
    assert.deepEqual(readCustomFreshAnswerSnapshot(18, "letter-hunt")?.words, ["OTHERA"]);
    assert.deepEqual(readCustomFreshAnswerSnapshot(17, "letter-dodge")?.words, ["ZEBRAB", "APPLEB"]);
    await act(async () => { current!.recordAcceptedAnswer("FRESH"); });
    assert.equal(container.textContent, "", "opting out does not offer immediate re-enabling");
    await act(async () => { current!.resetCurrentRun(); current!.recordAcceptedAnswer("FRESH"); });
    assert.match(container.textContent!, /Enable Fresh Answers/);

    Object.defineProperty(dom.window.Storage.prototype, "setItem", {
      configurable: true,
      value() {
        throw new dom.window.DOMException("Storage is unavailable", "QuotaExceededError");
      },
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="button-save-fresh-answers-letter-hunt"]')!.click();
    });
    assert.equal(container.querySelector('[role="alert"]')?.textContent,
      "Couldn’t save the answers in this browser. Check its storage settings and try again.");
    assert.ok(container.querySelector('[data-testid="button-save-fresh-answers-letter-hunt"]'),
      "the opt-in button remains available for a retry");
    assert.equal(container.querySelector('[role="switch"]'), null,
      "a failed save must not show an enabled saved-answer switch");
    assert.equal(current!.snapshot, null);
    assert.equal(readCustomFreshAnswerSnapshot(17, "letter-hunt"), null);

    Object.defineProperty(dom.window.Storage.prototype, "setItem", originalSetItem);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="button-save-fresh-answers-letter-hunt"]')!.click();
    });
    assert.equal(container.querySelector('[role="alert"]'), null, "a successful retry clears the error");
    assert.equal(container.querySelector('[role="switch"]')?.getAttribute("data-state"), "checked");
    assert.deepEqual(words(), ["FRESH"]);
    assert.deepEqual(readCustomFreshAnswerSnapshot(17, "letter-hunt"), { words: ["FRESH"], enabled: true });
    await act(async () => root.unmount());
    const refreshedRoot = createRoot(container);
    await act(async () => refreshedRoot.render(<Harness userId={17} game="letter-hunt" />));
    assert.deepEqual(words(), ["FRESH"], "saved answers survive a fresh mount");
    await act(async () => refreshedRoot.unmount());
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    dom.window.close();
  }
});
