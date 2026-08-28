import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { MemStorage } from "./mem-storage";
import { FileAnalyticsStore } from "./file-analytics-store";

test("fallback analytics survive a storage restart and remain deduplicated", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "analytics-persistence-"));
  const filePath = path.join(directory, "events.jsonl");
  try {
    const event = {
      eventName: "game_start" as const,
      visitorId: "visitor-1",
      sessionId: "session-1",
      dedupeKey: "persistent-event-1",
      gameSlug: "word-fusion",
      gameMode: "timed",
      occurredAt: "2026-08-27T12:00:00.000Z",
    };
    const firstProcess = new MemStorage({ analyticsFilePath: filePath });
    await firstProcess.recordAnalyticsEvent(event);
    await firstProcess.recordAnalyticsEvent(event);

    const secondProcess = new MemStorage({ analyticsFilePath: filePath });
    const report = await secondProcess.getAnalyticsReport("2026-08-27", "2026-08-27");

    assert.equal(report.totals.gameStarts, 1);
    assert.equal(report.totals.uniqueVisitors, 1);
    assert.equal((await readFile(filePath, "utf8")).trim().split("\n").length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("concurrent fallback writers merge events and deduplicate across instances", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "analytics-concurrency-"));
  const filePath = path.join(directory, "events.jsonl");
  const occurredAt = "2026-08-27T12:00:00.000Z";
  const event = (dedupeKey: string) => ({
    eventName: "page_view" as const,
    visitorId: `visitor-${dedupeKey}`,
    sessionId: `session-${dedupeKey}`,
    dedupeKey,
    occurredAt,
  });
  try {
    const first = new FileAnalyticsStore(filePath);
    const second = new FileAnalyticsStore(filePath);
    await Promise.all([
      first.append(event("shared"), 10),
      second.append(event("shared"), 10),
      first.append(event("first"), 10),
      second.append(event("second"), 10),
    ]);

    const { events } = await new FileAnalyticsStore(filePath).load(10);
    assert.equal(events.length, 3);
    assert.deepEqual(new Set(events.map((item) => item.dedupeKey)), new Set(["shared", "first", "second"]));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("concurrent fallback compaction stays bounded without losing the newest writes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "analytics-compaction-"));
  const filePath = path.join(directory, "events.jsonl");
  const occurredAt = "2026-08-27T12:00:00.000Z";
  const event = (dedupeKey: string) => ({
    eventName: "page_view" as const,
    visitorId: `visitor-${dedupeKey}`,
    sessionId: `session-${dedupeKey}`,
    dedupeKey,
    occurredAt,
  });
  try {
    const first = new FileAnalyticsStore(filePath);
    const second = new FileAnalyticsStore(filePath);
    await first.append(event("old"), 2);
    await Promise.all([
      first.append(event("new-1"), 2),
      second.append(event("new-2"), 2),
    ]);

    const { events } = await new FileAnalyticsStore(filePath).load(10);
    assert.equal(events.length, 2);
    assert.ok(events.some((item) => item.dedupeKey === "new-2"));
    assert.ok(events.some((item) => item.dedupeKey === "new-1"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("fallback cleanup atomically persists only events inside the retention window", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "analytics-cleanup-"));
  const filePath = path.join(directory, "events.jsonl");
  try {
    const storage = new MemStorage({ analyticsFilePath: filePath });
    await storage.recordAnalyticsEvent({
      eventName: "page_view",
      visitorId: "expired",
      sessionId: "expired",
      dedupeKey: "expired",
      occurredAt: "2020-01-01T00:00:00.000Z",
    });
    await storage.recordAnalyticsEvent({
      eventName: "page_view",
      visitorId: "current",
      sessionId: "current",
      dedupeKey: "current",
      occurredAt: new Date().toISOString(),
    });

    assert.equal(await storage.cleanupAnalyticsEvents(), 1);
    const restarted = new MemStorage({ analyticsFilePath: filePath });
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await restarted.getAnalyticsReport(today, today)).totals.uniqueVisitors, 1);
    assert.doesNotMatch(await readFile(filePath, "utf8"), /expired/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});