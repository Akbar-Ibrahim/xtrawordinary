import { and, desc, eq, isNull } from "drizzle-orm";
import type { GameReport, InsertGameReport } from "@shared/schema";
import { gameReports } from "../db-schema";

function mapReport(row: typeof gameReports.$inferSelect): GameReport {
  return {
    id: row.id,
    gameSlug: row.gameSlug,
    message: row.message,
    readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function createGameReport(db: any, data: InsertGameReport): Promise<GameReport> {
  const result = await db.insert(gameReports).values(data);
  const rows = await db.select().from(gameReports)
    .where(eq(gameReports.id, result[0].insertId)).limit(1);
  return mapReport(rows[0]);
}

export async function getGameReports(db: any): Promise<GameReport[]> {
  const rows = await db.select().from(gameReports)
    .orderBy(desc(gameReports.createdAt), desc(gameReports.id));
  return rows.map(mapReport);
}

export async function markGameReportRead(db: any, id: number): Promise<boolean> {
  const result = await db.update(gameReports).set({ readAt: new Date() })
    .where(and(eq(gameReports.id, id), isNull(gameReports.readAt)));
  if ((result[0]?.affectedRows ?? 0) > 0) return true;
  const rows = await db.select({ id: gameReports.id }).from(gameReports)
    .where(eq(gameReports.id, id)).limit(1);
  return rows.length > 0;
}