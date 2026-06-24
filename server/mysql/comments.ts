import { eq, desc, asc, and, or, inArray, sql } from "drizzle-orm";
import type { Comment, InsertComment, CommentReport, CommentTargetType, LikeTargetType } from "@shared/schema";
import * as schema from "../db-schema";

function mapDbRowToComment(r: typeof schema.comments.$inferSelect, user?: { id: number; name: string; avatarUrl: string | null }): Comment {
  return {
    id: r.id,
    targetType: r.targetType as CommentTargetType,
    targetId: r.targetId,
    userId: r.userId,
    parentId: r.parentId ?? null,
    content: r.isDeleted ? "" : r.content,
    isDeleted: r.isDeleted,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt ? String(r.updatedAt) : null),
    user,
  };
}

export async function createComment(db: any, comment: InsertComment): Promise<Comment> {
  const result = await db.insert(schema.comments).values({ targetType: comment.targetType, targetId: comment.targetId, userId: comment.userId, parentId: comment.parentId ?? null, content: comment.content });
  const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, result[0].insertId)).limit(1);
  const r = rows[0];
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(eq(schema.users.id, r.userId)).limit(1);
  const user = userRows[0] ? { id: userRows[0].id, name: userRows[0].name, avatarUrl: userRows[0].avatarUrl || null } : undefined;
  return mapDbRowToComment(r, user);
}

export async function getComments(db: any, targetType: CommentTargetType, targetId: string, userId?: number): Promise<Comment[]> {
  const rows = await db.select().from(schema.comments).where(and(eq(schema.comments.targetType, targetType), eq(schema.comments.targetId, targetId))).orderBy(asc(schema.comments.createdAt));
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r: any) => r.userId))] as number[];
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const userMap = new Map<number, { id: number; name: string; avatarUrl: string | null }>(userRows.map((u: any) => [u.id as number, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
  const commentIdStrings = rows.map((r: any) => String(r.id));
  const countRows = await db.select({ targetId: schema.likes.targetId, count: sql<number>`COUNT(*)` }).from(schema.likes).where(and(eq(schema.likes.targetType, "comment"), inArray(schema.likes.targetId, commentIdStrings))).groupBy(schema.likes.targetId);
  const countMap = new Map(countRows.map((r: any) => [r.targetId, Number(r.count)]));
  let likedSet = new Set<string>();
  if (userId) {
    const likedRows = await db.select({ targetId: schema.likes.targetId }).from(schema.likes).where(and(eq(schema.likes.targetType, "comment"), eq(schema.likes.userId, userId), inArray(schema.likes.targetId, commentIdStrings)));
    likedSet = new Set(likedRows.map((r: any) => r.targetId));
  }
  const allComments = rows.map((r: any) => ({ ...mapDbRowToComment(r, userMap.get(r.userId)), likeCount: countMap.get(String(r.id)) ?? 0, likedByMe: likedSet.has(String(r.id)) }));
  const roots = allComments.filter((c: any) => c.parentId === null);
  const replies = allComments.filter((c: any) => c.parentId !== null);
  return roots.map((root: any) => ({ ...root, replies: replies.filter((r: any) => r.parentId === root.id) }));
}

export async function getCommentById(db: any, id: number): Promise<Comment | null> {
  const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
  if (!rows[0]) return null;
  return mapDbRowToComment(rows[0], undefined);
}

export async function deleteComment(db: any, id: number, userId: number, isAdmin = false): Promise<boolean> {
  const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
  if (!rows[0]) return false;
  if (!isAdmin && rows[0].userId !== userId) return false;
  await db.update(schema.comments).set({ isDeleted: true, content: "" }).where(eq(schema.comments.id, id));
  return true;
}

export async function updateComment(db: any, id: number, userId: number, content: string): Promise<Comment | null> {
  const rows = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
  if (!rows[0] || rows[0].isDeleted || rows[0].userId !== userId) return null;
  const now = new Date();
  await db.update(schema.comments).set({ content, updatedAt: now }).where(eq(schema.comments.id, id));
  const updated = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const user = userRows[0] ? { id: userRows[0].id, name: userRows[0].name, avatarUrl: userRows[0].avatarUrl || null } : undefined;
  return mapDbRowToComment(updated[0], user);
}

export async function deleteCommentAdmin(db: any, id: number): Promise<void> {
  await db.update(schema.comments).set({ isDeleted: true, content: "" }).where(eq(schema.comments.id, id));
}

export async function reportComment(db: any, commentId: number, reportingUserId: number, reason: string): Promise<CommentReport> {
  const result = await db.insert(schema.commentReports).values({ commentId, reportingUserId, reason });
  const rows = await db.select().from(schema.commentReports).where(eq(schema.commentReports.id, result[0].insertId)).limit(1);
  const r = rows[0];
  return { id: r.id, commentId: r.commentId, reportingUserId: r.reportingUserId, reason: r.reason, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt) };
}

export async function getCommentReports(db: any): Promise<CommentReport[]> {
  const rows = await db.select().from(schema.commentReports).orderBy(desc(schema.commentReports.createdAt));
  if (rows.length === 0) return [];
  const commentIds = [...new Set(rows.map((r: any) => r.commentId))] as number[];
  const reporterIds = [...new Set(rows.map((r: any) => r.reportingUserId))] as number[];
  const commentRows = await db.select().from(schema.comments).where(inArray(schema.comments.id, commentIds));
  const userIds = [...new Set([...reporterIds, ...commentRows.map((c: any) => c.userId as number)])] as number[];
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const userMap = new Map<number, { id: number; name: string; avatarUrl: string | null }>(userRows.map((u: any) => [u.id as number, { id: u.id, name: u.name, avatarUrl: u.avatarUrl || null }]));
  const commentMap = new Map(commentRows.map((c: any) => [c.id, mapDbRowToComment(c, userMap.get(c.userId))]));
  return rows.map((r: any) => ({ id: r.id, commentId: r.commentId, reportingUserId: r.reportingUserId, reason: r.reason, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt), reporter: userMap.get(r.reportingUserId) ? { id: (userMap.get(r.reportingUserId) as any).id, name: (userMap.get(r.reportingUserId) as any).name } : undefined, comment: commentMap.get(r.commentId) }));
}

export async function getRecentCommentCount(db: any, userId: number, since: Date): Promise<number> {
  const rows = await db.select({ cnt: sql<number>`COUNT(*)` }).from(schema.comments).where(and(eq(schema.comments.userId, userId), eq(schema.comments.isDeleted, false), sql`${schema.comments.createdAt} >= ${since}`));
  return Number(rows[0]?.cnt ?? 0);
}

export async function toggleLike(db: any, userId: number, targetType: LikeTargetType, targetId: string): Promise<{ liked: boolean; count: number }> {
  const existing = await db.select().from(schema.likes).where(and(eq(schema.likes.userId, userId), eq(schema.likes.targetType, targetType), eq(schema.likes.targetId, targetId))).limit(1);
  if (existing.length > 0) {
    await db.delete(schema.likes).where(and(eq(schema.likes.userId, userId), eq(schema.likes.targetType, targetType), eq(schema.likes.targetId, targetId)));
  } else {
    await db.insert(schema.likes).values({ userId, targetType, targetId });
  }
  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(schema.likes).where(and(eq(schema.likes.targetType, targetType), eq(schema.likes.targetId, targetId)));
  return { liked: existing.length === 0, count: Number(count) };
}

export async function getLikeCounts(db: any, targetType: LikeTargetType, targetIds: string[]): Promise<Record<string, number>> {
  if (targetIds.length === 0) return {};
  const rows = await db.select({ targetId: schema.likes.targetId, count: sql<number>`COUNT(*)` }).from(schema.likes).where(and(eq(schema.likes.targetType, targetType), inArray(schema.likes.targetId, targetIds))).groupBy(schema.likes.targetId);
  const result: Record<string, number> = {};
  for (const id of targetIds) result[id] = 0;
  for (const r of rows) result[r.targetId] = Number(r.count);
  return result;
}

export async function getUserLikes(db: any, userId: number, targetType: LikeTargetType, targetIds: string[]): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const rows = await db.select({ targetId: schema.likes.targetId }).from(schema.likes).where(and(eq(schema.likes.userId, userId), eq(schema.likes.targetType, targetType), inArray(schema.likes.targetId, targetIds)));
  return new Set(rows.map((r: any) => r.targetId));
}
