import { desc, eq, isNull, and } from "drizzle-orm";
import type { ContactMessage, ContactMessageReply, InsertContactMessage, InsertContactMessageReply } from "@shared/schema";
import * as schema from "../db-schema";

function mapContactMessage(
  row: typeof schema.contactMessages.$inferSelect,
  replies: ContactMessageReply[] = [],
): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject ?? null,
    message: row.message,
    readAt: row.readAt instanceof Date ? row.readAt.toISOString() : (row.readAt ? String(row.readAt) : null),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    replies,
  };
}

function mapReply(row: typeof schema.contactMessageReplies.$inferSelect): ContactMessageReply {
  return {
    id: row.id,
    contactMessageId: row.contactMessageId,
    message: row.message,
    sentByAdminId: row.sentByAdminId,
    sentByAdminName: row.sentByAdminName,
    sentAt: row.sentAt instanceof Date ? row.sentAt.toISOString() : String(row.sentAt),
  };
}

export async function createContactMessage(db: any, data: InsertContactMessage): Promise<ContactMessage> {
  const result = await db.insert(schema.contactMessages).values({
    name: data.name,
    email: data.email,
    subject: data.subject ?? null,
    message: data.message,
  });
  const rows = await db.select().from(schema.contactMessages)
    .where(eq(schema.contactMessages.id, result[0].insertId))
    .limit(1);
  return mapContactMessage(rows[0]);
}

export async function getContactMessages(db: any): Promise<ContactMessage[]> {
  const rows = await db.select().from(schema.contactMessages)
    .orderBy(desc(schema.contactMessages.createdAt));
  const replyRows = await db.select().from(schema.contactMessageReplies)
    .orderBy(schema.contactMessageReplies.sentAt);
  const repliesByMessage = new Map<number, ContactMessageReply[]>();
  for (const row of replyRows) {
    const reply = mapReply(row);
    const replies = repliesByMessage.get(reply.contactMessageId) ?? [];
    replies.push(reply);
    repliesByMessage.set(reply.contactMessageId, replies);
  }
  return rows.map((row: typeof schema.contactMessages.$inferSelect) =>
    mapContactMessage(row, repliesByMessage.get(row.id) ?? []));
}

export async function getContactMessage(db: any, id: number): Promise<ContactMessage | undefined> {
  const rows = await db.select().from(schema.contactMessages)
    .where(eq(schema.contactMessages.id, id))
    .limit(1);
  if (!rows[0]) return undefined;
  const replyRows = await db.select().from(schema.contactMessageReplies)
    .where(eq(schema.contactMessageReplies.contactMessageId, id))
    .orderBy(schema.contactMessageReplies.sentAt);
  return mapContactMessage(rows[0], replyRows.map(mapReply));
}

export async function markContactMessageRead(db: any, id: number): Promise<boolean> {
  const result = await db.update(schema.contactMessages)
    .set({ readAt: new Date() })
    .where(and(eq(schema.contactMessages.id, id), isNull(schema.contactMessages.readAt)));
  if ((result[0]?.affectedRows ?? 0) > 0) return true;

  const rows = await db.select({ id: schema.contactMessages.id })
    .from(schema.contactMessages)
    .where(eq(schema.contactMessages.id, id))
    .limit(1);
  return rows.length > 0;
}

export async function createContactMessageReply(db: any, data: InsertContactMessageReply): Promise<ContactMessageReply> {
  const result = await db.insert(schema.contactMessageReplies).values(data);
  const rows = await db.select().from(schema.contactMessageReplies)
    .where(eq(schema.contactMessageReplies.id, result[0].insertId))
    .limit(1);
  return mapReply(rows[0]);
}