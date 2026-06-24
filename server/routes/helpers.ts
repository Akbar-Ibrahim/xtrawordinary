import type { InsertNotification } from "@shared/schema";
import { storage } from "../storage";
import { pushNotifToUser } from "../notification-sse";

export async function createNotificationIfEnabled(data: InsertNotification): Promise<void> {
  try {
    const prefs = await storage.getNotificationPreferences(data.userId);
    if (!prefs[data.type]) return;
    await storage.createNotification(data);
    pushNotifToUser(data.userId);
  } catch (err) {
    console.error("[notification]", err);
  }
}
