import { appendFile, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyticsEventSchema, type AnalyticsEventRecord } from "@shared/schema";

export class FileAnalyticsStore {
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly lockPath: string;

  constructor(private readonly filePath: string) {
    this.lockPath = `${filePath}.lock`;
  }

  async load(limit: number): Promise<{ events: AnalyticsEventRecord[]; compactOnNextWrite: boolean }> {
    return this.withFileLock(() => this.readEvents(limit));
  }

  private async readEvents(limit: number): Promise<{ events: AnalyticsEventRecord[]; compactOnNextWrite: boolean }> {
    try {
      const content = await readFile(this.filePath, "utf8");
      const eventsByDedupeKey = new Map<string, AnalyticsEventRecord>();
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const raw = JSON.parse(line);
          const event = analyticsEventSchema.safeParse(raw);
          if (
            event.success
            && typeof raw.occurredAt === "string"
            && Number.isFinite(new Date(raw.occurredAt).getTime())
          ) {
            const record = {
              ...event.data,
              userId: typeof raw.userId === "number" ? raw.userId : null,
              occurredAt: raw.occurredAt,
            };
            eventsByDedupeKey.delete(record.dedupeKey);
            eventsByDedupeKey.set(record.dedupeKey, record);
          }
        } catch {
          // A partial final line after a process interruption is safe to ignore.
        }
      }
      const events = [...eventsByDedupeKey.values()];
      return {
        events: events.slice(-limit),
        compactOnNextWrite: events.length > limit,
      };
    } catch (error: any) {
      if (error?.code === "ENOENT") return { events: [], compactOnNextWrite: false };
      throw error;
    }
  }

  async append(event: AnalyticsEventRecord, limit: number): Promise<void> {
    const operation = this.writeQueue.then(() => this.withFileLock(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const { events } = await this.readEvents(Number.MAX_SAFE_INTEGER);
      if (events.some((item) => item.dedupeKey === event.dedupeKey)) return;

      const retainedEvents = [...events, event].slice(-limit);
      if (retainedEvents.length === events.length + 1) {
        await appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
        return;
      }

      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      const content = retainedEvents.map((item) => JSON.stringify(item)).join("\n");
      await writeFile(temporaryPath, content ? `${content}\n` : "", "utf8");
      await rename(temporaryPath, this.filePath);
    }));
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async replace(events: AnalyticsEventRecord[]): Promise<void> {
    const operation = this.writeQueue.then(() => this.withFileLock(async () => {
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      const content = events.map((item) => JSON.stringify(item)).join("\n");
      await writeFile(temporaryPath, content ? `${content}\n` : "", "utf8");
      await rename(temporaryPath, this.filePath);
    }));
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async removeBefore(cutoffTime: number, limit: number): Promise<{ events: AnalyticsEventRecord[]; removed: number }> {
    let result = { events: [] as AnalyticsEventRecord[], removed: 0 };
    const operation = this.writeQueue.then(() => this.withFileLock(async () => {
      const { events } = await this.readEvents(Number.MAX_SAFE_INTEGER);
      const retained = events.filter((event) => new Date(event.occurredAt).getTime() >= cutoffTime).slice(-limit);
      result = { events: retained, removed: events.length - retained.length };
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
      const content = retained.map((item) => JSON.stringify(item)).join("\n");
      await writeFile(temporaryPath, content ? `${content}\n` : "", "utf8");
      await rename(temporaryPath, this.filePath);
    }));
    this.writeQueue = operation.catch(() => undefined);
    await operation;
    return result;
  }

  private async withFileLock<T>(action: () => Promise<T>): Promise<T> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const startedAt = Date.now();
    while (true) {
      try {
        const lock = await open(this.lockPath, "wx");
        try {
          return await action();
        } finally {
          await lock.close();
          await unlink(this.lockPath).catch(() => undefined);
        }
      } catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
        try {
          const lockInfo = await stat(this.lockPath);
          if (Date.now() - lockInfo.mtimeMs > 30_000) {
            await unlink(this.lockPath);
            continue;
          }
        } catch (statError: any) {
          if (statError?.code === "ENOENT") continue;
          throw statError;
        }
        if (Date.now() - startedAt > 5_000) {
          throw new Error(`Timed out waiting for analytics persistence lock: ${this.lockPath}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }
}