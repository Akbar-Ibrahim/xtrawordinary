import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  HTMLInputElement: { configurable: true, value: dom.window.HTMLInputElement },
  Node: { configurable: true, value: dom.window.Node },
  NodeFilter: { configurable: true, value: dom.window.NodeFilter },
  Event: { configurable: true, value: dom.window.Event },
  CustomEvent: { configurable: true, value: dom.window.CustomEvent },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  PointerEvent: { configurable: true, value: dom.window.MouseEvent },
  MutationObserver: { configurable: true, value: dom.window.MutationObserver },
  getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
});

let container: HTMLDivElement | undefined;
let root: import("react-dom/client").Root | undefined;

async function renderCount(value: number, label: string) {
  const [{ createRoot }, { AnalyticsCount }, { AnalyticsExactValueProvider }] = await Promise.all([
    import("react-dom/client"),
    import("./AnalyticsCount"),
    import("./AnalyticsExactValueProvider"),
  ]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <AnalyticsExactValueProvider>
        <AnalyticsCount value={value} label={label} />
      </AnalyticsExactValueProvider>,
    );
  });
}

test.afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container?.remove();
  container = undefined;
});

test("clicking a compact analytics count opens its exact value", async () => {
  await renderCount(10_657, "Unique visitors");
  const button = container?.querySelector<HTMLButtonElement>(
    'button[aria-label="Show exact unique visitors: 10.7K"]',
  );
  assert.ok(button);
  assert.equal(button.textContent, "10.7K");

  await act(async () => {
    button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  });

  assert.equal(document.body.querySelector('[role="dialog"] [data-testid="analytics-exact-value"]')?.textContent, "10,657");
});

test("counts that are not abbreviated remain plain text", async () => {
  await renderCount(657, "Visitors");
  assert.equal(container?.textContent, "657");
  assert.equal(container?.querySelector("button"), null);
});
