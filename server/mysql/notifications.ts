import { eq, desc, and, isNull, or, sql } from "drizzle-orm";
import type { Notification, InsertNotification, NotificationType } from "@shared/schema";
import { notificationTypeSchema } from "@shared/schema";
import * as schema from "../db-schema";

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    linkUrl: row.linkUrl ?? null,
    readAt: row.readAt instanceof Date ? row.readAt.toISOString() : (row.readAt ? String(row.readAt) : null),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export async function createNotification(db: any, data: InsertNotification): Promise<Notification> {
  const result = await db.insert(schema.notifications).values({
    userId: data.userId, type: data.type, title: data.title, body: data.body, linkUrl: data.linkUrl ?? null,
  });
  const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.id, result[0].insertId)).limit(1);
  return mapNotification(rows[0]);
}

export async function getNotifications(db: any, userId: number, limit = 30): Promise<Notification[]> {
  const rows = await db.select().from(schema.notifications)
    .where(eq(schema.notifications.userId, userId)).orderBy(desc(schema.notifications.createdAt)).limit(limit);
  return rows.map((r: any) => mapNotification(r));
}

export async function getUnreadNotificationCount(db: any, userId: number): Promise<number> {
  const rows = await db.select({ count: sql<number>`COUNT(*)` }).from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return Number(rows[0]?.count ?? 0);
}

export async function markNotificationRead(db: any, id: number, userId: number): Promise<void> {
  await db.update(schema.notifications).set({ readAt: new Date() })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
}

export async function markAllNotificationsRead(db: any, userId: number): Promise<void> {
  await db.update(schema.notifications).set({ readAt: new Date() })
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
}

export async function pruneNotifications(db: any): Promise<number> {
  const now = new Date();
  const readCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const unreadCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const result = await db.delete(schema.notifications).where(
    or(
      and(sql`${schema.notifications.readAt} IS NOT NULL`, sql`${schema.notifications.createdAt} < ${readCutoff}`),
      and(isNull(schema.notifications.readAt), sql`${schema.notifications.createdAt} < ${unreadCutoff}`),
    ),
  );
  return result[0].affectedRows ?? 0;
}

export async function getNotificationPreferences(db: any, userId: number): Promise<Record<NotificationType, boolean>> {
  const rows = await db.select().from(schema.notificationPreferences).where(eq(schema.notificationPreferences.userId, userId));
  const types = notificationTypeSchema.options as NotificationType[];
  const result = {} as Record<NotificationType, boolean>;
  const prefMap = new Map<string, boolean>(rows.map((r: any): [string, boolean] => [r.type, r.enabled === 1 || r.enabled === true]));
  for (const type of types) {
    result[type] = prefMap.has(type) ? prefMap.get(type)! : true;
  }
  return result;
}

export async function setNotificationPreference(db: any, userId: number, type: NotificationType, enabled: boolean): Promise<void> {
  await db.insert(schema.notificationPreferences).values({ userId, type, enabled })
    .onDuplicateKeyUpdate({ set: { enabled } });
}

export async function setAllNotificationPreferences(db: any, userId: number, enabled: boolean): Promise<void> {
  const types = notificationTypeSchema.options as NotificationType[];
  await Promise.all(
    types.map((type) =>
      db.insert(schema.notificationPreferences).values({ userId, type, enabled })
        .onDuplicateKeyUpdate({ set: { enabled } })
    )
  );
}
