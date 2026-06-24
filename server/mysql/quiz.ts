import { eq, desc, and, inArray } from "drizzle-orm";
import type { QuizSession, InsertQuizSession, QuizSessionScore } from "@shared/schema";
import * as schema from "../db-schema";

function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function mapQuizSession(row: any): QuizSession {
  return {
    id: row.id,
    creatorId: row.creatorId,
    gameSlug: row.gameSlug,
    title: row.title,
    description: row.description ?? null,
    shareCode: row.shareCode,
    params: typeof row.params === "string" ? JSON.parse(row.params) : (row.params ?? {}),
    closesAt: row.closesAt instanceof Date ? row.closesAt.toISOString() : (row.closesAt ?? null),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function mapQuizScore(r: any): QuizSessionScore {
  return { id: r.id, sessionId: r.sessionId, userId: r.userId, guestName: r.guestName ?? null, score: r.score, completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : String(r.completedAt) };
}

export async function createQuizSession(db: any, session: InsertQuizSession): Promise<QuizSession> {
  let shareCode = session.shareCode || generateShareCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await db.select({ id: schema.quizSessions.id }).from(schema.quizSessions).where(eq(schema.quizSessions.shareCode, shareCode)).limit(1);
    if (existing.length === 0) break;
    shareCode = generateShareCode();
    attempts++;
  }
  const result = await db.insert(schema.quizSessions).values({
    creatorId: session.creatorId, gameSlug: session.gameSlug, title: session.title,
    description: session.description ?? null, shareCode, params: session.params ?? {},
    closesAt: session.closesAt ? new Date(session.closesAt) : null,
  });
  const rows = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.id, result[0].insertId)).limit(1);
  return mapQuizSession(rows[0]);
}

export async function getQuizSessionByCode(db: any, shareCode: string): Promise<QuizSession | undefined> {
  const rows = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.shareCode, shareCode)).limit(1);
  return rows[0] ? mapQuizSession(rows[0]) : undefined;
}

export async function getQuizSessionsByCreator(db: any, creatorId: number): Promise<QuizSession[]> {
  const rows = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.creatorId, creatorId)).orderBy(desc(schema.quizSessions.createdAt));
  return rows.map((r: any) => mapQuizSession(r));
}

export async function addQuizSessionScore(db: any, sessionId: number, userId: number, score: number, guestName?: string | null): Promise<QuizSessionScore> {
  const existing = await db.select().from(schema.quizSessionScores).where(and(eq(schema.quizSessionScores.sessionId, sessionId), eq(schema.quizSessionScores.userId, userId))).limit(1);
  if (existing[0]) return mapQuizScore(existing[0]);
  const result = await db.insert(schema.quizSessionScores).values({ sessionId, userId, guestName: guestName ?? null, score });
  const rows = await db.select().from(schema.quizSessionScores).where(eq(schema.quizSessionScores.id, result[0].insertId)).limit(1);
  return mapQuizScore(rows[0]);
}

export async function getQuizSessionScores(db: any, sessionId: number): Promise<QuizSessionScore[]> {
  const rows = await db.select().from(schema.quizSessionScores).where(eq(schema.quizSessionScores.sessionId, sessionId)).orderBy(desc(schema.quizSessionScores.score));
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r: any) => r.userId))] as number[];
  const userRows = await db.select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(inArray(schema.users.id, userIds));
  const userMap = new Map(userRows.map((u: any) => [u.id, u]));
  return rows.map((r: any) => ({ ...mapQuizScore(r), playerName: (userMap.get(r.userId) as any)?.name, playerAvatarUrl: (userMap.get(r.userId) as any)?.avatarUrl ?? null }));
}

export async function getQuizSessionScore(db: any, sessionId: number, userId: number): Promise<QuizSessionScore | undefined> {
  const rows = await db.select().from(schema.quizSessionScores).where(and(eq(schema.quizSessionScores.sessionId, sessionId), eq(schema.quizSessionScores.userId, userId))).limit(1);
  return rows[0] ? mapQuizScore(rows[0]) : undefined;
}

export async function deleteQuizSession(db: any, id: number): Promise<void> {
  await db.delete(schema.quizSessionScores).where(eq(schema.quizSessionScores.sessionId, id));
  await db.delete(schema.quizSessions).where(eq(schema.quizSessions.id, id));
}
