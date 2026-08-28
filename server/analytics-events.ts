import type { AnalyticsEventInput } from "@shared/schema";
import { storage } from "./storage";

type StoredAnalyticsEvent = AnalyticsEventInput & {
  userId?: number | null;
  occurredAt?: string;
};

export async function recordAnalyticsEventSafely(event: StoredAnalyticsEvent): Promise<void> {
  try {
    await storage.recordAnalyticsEvent(event);
  } catch (error) {
    console.error("[Analytics] Event recording failed (non-fatal)", error);
  }
}