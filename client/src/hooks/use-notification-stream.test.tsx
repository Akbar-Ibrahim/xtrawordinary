import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { JSDOM } from "jsdom";
import { useNotificationStream } from "./use-notification-stream";

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

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.();
  }

  fail() {
    this.onerror?.();
  }

  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  static postedMessages: unknown[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  closed = false;

  constructor(readonly name: string) {
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    MockBroadcastChannel.postedMessages.push(data);
    for (const channel of MockBroadcastChannel.instances) {
      if (channel !== this && channel.name === this.name && !channel.closed) {
        queueMicrotask(() => channel.onmessage?.({ data } as MessageEvent));
      }
    }
  }

  close() {
    this.closed = true;
  }
}

class MockLockManager {
  private isHeld = false;

  request(
    name: string,
    _options: LockOptions,
    callback: (lock: Lock | null) => Promise<void> | void,
  ) {
    if (this.isHeld) return Promise.resolve(callback(null));
    this.isHeld = true;
    return Promise.resolve(callback({ name, mode: "exclusive" } as Lock))
      .finally(() => {
        this.isHeld = false;
      });
  }
}

const originalEventSource = globalThis.EventSource;
const originalBroadcastChannel = globalThis.BroadcastChannel;
const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, "locks");
let container: HTMLDivElement | undefined;
let root: import("react-dom/client").Root | undefined;
let secondaryContainer: HTMLDivElement | undefined;
let secondaryRoot: import("react-dom/client").Root | undefined;

function StreamHarness({ isAuthenticated }: { isAuthenticated: boolean }) {
  useNotificationStream(isAuthenticated);
  return null;
}

async function renderStream(isAuthenticated = true) {
  const { createRoot } = await import("react-dom/client");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<StreamHarness isAuthenticated={isAuthenticated} />);
  });
}

async function renderTwoStreams() {
  const { createRoot } = await import("react-dom/client");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  secondaryContainer = document.createElement("div");
  document.body.append(secondaryContainer);
  secondaryRoot = createRoot(secondaryContainer);
  await act(async () => {
    root!.render(<StreamHarness isAuthenticated />);
    secondaryRoot!.render(<StreamHarness isAuthenticated />);
    await Promise.resolve();
  });
}

async function rerenderStream(isAuthenticated: boolean) {
  await act(async () => {
    root!.render(<StreamHarness isAuthenticated={isAuthenticated} />);
  });
}

test.beforeEach(() => {
  MockEventSource.instances = [];
  MockBroadcastChannel.instances = [];
  MockBroadcastChannel.postedMessages = [];
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
});

test.afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
  }
  if (secondaryRoot) {
    await act(async () => secondaryRoot!.unmount());
  }
  container?.remove();
  secondaryContainer?.remove();
  document.body.replaceChildren();
  root = undefined;
  container = undefined;
  secondaryRoot = undefined;
  secondaryContainer = undefined;
  globalThis.EventSource = originalEventSource;
  globalThis.BroadcastChannel = originalBroadcastChannel;
  if (originalLocksDescriptor) {
    Object.defineProperty(navigator, "locks", originalLocksDescriptor);
  } else {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
  }
});

test("notification stream retries with bounded jitter, capped backoff, and reset after opening", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let randomValue = 0.5;
  t.mock.method(Math, "random", () => randomValue);
  await renderStream();

  const advanceToRetry = async (delay: number) => {
    const previousCount = MockEventSource.instances.length;
    t.mock.timers.tick(delay - 1);
    assert.equal(MockEventSource.instances.length, previousCount);
    t.mock.timers.tick(1);
    assert.equal(MockEventSource.instances.length, previousCount + 1);
    return MockEventSource.instances.at(-1)!;
  };

  randomValue = 0;
  MockEventSource.instances[0].fail();
  let current = await advanceToRetry(8_000);
  randomValue = 0.5;
  current.fail();
  current = await advanceToRetry(20_000);
  randomValue = 0.999999;
  current.fail();
  current = await advanceToRetry(47_999);
  randomValue = 0.999999;
  current.fail();
  current = await advanceToRetry(60_000);
  randomValue = 0;
  current.fail();
  current = await advanceToRetry(48_000);

  current.open();
  randomValue = 0.5;
  current.fail();
  await advanceToRetry(10_000);
});

test("signing out cancels a pending retry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await renderStream();

  MockEventSource.instances[0].fail();
  await rerenderStream(false);
  t.mock.timers.tick(60_000);

  assert.equal(MockEventSource.instances.length, 1);
  assert.equal(MockEventSource.instances[0].closed, true);
});

test("unmounting cancels a pending retry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await renderStream();

  MockEventSource.instances[0].fail();
  await act(async () => root!.unmount());
  root = undefined;
  t.mock.timers.tick(60_000);

  assert.equal(MockEventSource.instances.length, 1);
  assert.equal(MockEventSource.instances[0].closed, true);
});

test("group discussion access revocation is broadcast to open group pages", async () => {
  await renderStream();
  let received: CustomEvent<{ groupId: number }> | undefined;
  const handleRevoked = (event: Event) => {
    received = event as CustomEvent<{ groupId: number }>;
  };
  window.addEventListener("group-discussion-access-revoked", handleRevoked);

  MockEventSource.instances[0].message({ type: "group_discussion_access_revoked", groupId: 42 });

  assert.equal(received?.detail.groupId, 42);
  window.removeEventListener("group-discussion-access-revoked", handleRevoked);
});

test("supported tabs share one stream and recover when the owner tab closes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: new MockLockManager(),
  });
  await renderTwoStreams();
  await act(async () => {
    await Promise.resolve();
  });

  assert.equal(MockBroadcastChannel.instances.length, 2);
  assert.equal(MockEventSource.instances.length, 1);

  MockEventSource.instances[0].open();
  const receivedGroupIds: number[] = [];
  const handleRevoked = (event: Event) => {
    receivedGroupIds.push((event as CustomEvent<{ groupId: number }>).detail.groupId);
  };
  window.addEventListener("group-discussion-access-revoked", handleRevoked);
  MockEventSource.instances[0].message({
    type: "group_discussion_access_revoked",
    groupId: 73,
  });
  await act(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  });

  assert.deepEqual(receivedGroupIds, [73, 73]);
  window.removeEventListener("group-discussion-access-revoked", handleRevoked);

  MockEventSource.instances[0].fail();
  t.mock.timers.tick(10_000);
  assert.equal(MockEventSource.instances.length, 2);
  MockEventSource.instances[1].open();
  assert(
    MockBroadcastChannel.postedMessages.some((message) => {
      const data = message as { event?: { type?: string } };
      return data.event?.type === "new_notification";
    }),
  );

  const ownerRoot = root!;
  await act(async () => ownerRoot.unmount());
  root = undefined;
  await act(async () => {
    await Promise.resolve();
  });
  t.mock.timers.tick(60_000);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(MockEventSource.instances.length, 3);
  assert.equal(MockEventSource.instances[0].closed, true);
});

test("lost tab messaging falls back to a local notification stream", async () => {
  globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: new MockLockManager(),
  });
  await renderTwoStreams();

  assert.equal(MockEventSource.instances.length, 1);
  MockBroadcastChannel.instances[1].onmessageerror?.();

  assert.equal(MockEventSource.instances.length, 2);
  assert.equal(MockEventSource.instances[0].closed, false);
});
