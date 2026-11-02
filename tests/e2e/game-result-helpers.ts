import { expect, type Page } from "@playwright/test";

const catalogCache = new Map<string, { status: number; body: string }>();

export async function openResultGame(page: Page, slug: string) {
  await page.route(/\/api\/games(?:\/[^/?]+)?$/, async route => {
    if (route.request().method() !== "GET") return route.fallback();
    const url = route.request().url();
    let response = catalogCache.get(url);
    if (!response) {
      const original = await route.fetch();
      response = { status: original.status(), body: await original.text() };
      catalogCache.set(url, response);
    }
    await route.fulfill({ ...response, contentType: "application/json" });
  });
  await page.goto(`/game/${slug}`);
  await page.waitForLoadState("networkidle");
  const close = page.getByTestId("button-whats-new-close");
  if (await close.isVisible()) await close.click();
  const play = page.getByTestId("button-play");
  if (await play.isVisible()) await play.click();
}

export async function expectRecordedWin(page: Page, slug: string, won: boolean) {
  await expect.poll(() => page.evaluate(gameSlug => {
    const stats = JSON.parse(localStorage.getItem("wordplay_stats") ?? "{}");
    return stats.perGame?.[gameSlug]?.gamesWon;
  }, slug)).toBe(won ? 1 : 0);
}

export async function holdGameIntervals(page: Page) {
  await page.addInitScript(() => {
    const original = window.setInterval.bind(window);
    const callbacks: (() => void)[] = [];
    (window as any).__gameIntervalCallbacks = callbacks;
    window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 1000 && typeof handler === "function" && handler.toString().includes("setTimeLeft")) {
        callbacks.push(() => handler(...args));
        return original(() => {}, 2_000_000_000);
      }
      return original(handler, delay, ...args);
    }) as typeof window.setInterval;
  });
}

export async function expireGameIntervals(page: Page, ticks: number) {
  await page.evaluate(count => {
    const callbacks = (window as any).__gameIntervalCallbacks as (() => void)[];
    for (let tick = 0; tick < count; tick++) callbacks.forEach(callback => callback());
  }, ticks);
}
